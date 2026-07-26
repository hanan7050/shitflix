const express = require('express');
const cors = require('cors');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
require('dotenv').config();

const app = express();
app.use(cors());

// Capture logs
global.logBuffer = [];
const originalLog = console.log;
const originalError = console.error;
console.log = function(...args) {
  originalLog.apply(console, args);
  global.logBuffer.push({ type: 'log', time: new Date().toISOString(), message: args.join(' ') });
  if (global.logBuffer.length > 100) global.logBuffer.shift();
};
console.error = function(...args) {
  originalError.apply(console, args);
  global.logBuffer.push({ type: 'error', time: new Date().toISOString(), message: args.join(' ') });
  if (global.logBuffer.length > 100) global.logBuffer.shift();
};

// Status route for debugging
app.get('/api/status', async (req, res) => {
  try {
    if (!client) {
      return res.status(500).json({ status: 'error', message: 'Client not initialized' });
    }
    console.log("[Status API] Calling getMe...");
    const me = await client.getMe();
    console.log("[Status API] getMe success");
    res.json({ status: 'ok', user: me.username || me.firstName });
  } catch (error) {
    console.log("[Status API] Error:", error.message);
    res.status(500).json({ status: 'error', message: error.message || String(error) });
  }
});

// Logs route for debugging Render remotely
app.get('/api/logs', (req, res) => {
  res.json({ logs: global.logBuffer || [] });
});

app.get('/', (req, res) => {
  res.send('Shitflix API is running!');
});

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);

let client;

async function initTelegram() {
  console.log("Connecting to Telegram...");
  try {
    client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });
    await client.connect();
    console.log("✅ Connected to Telegram MTProto!");
  } catch (error) {
    console.error("❌ Failed to connect to Telegram MTProto:", error.message || error);
    if (error.errorMessage === 'AUTH_KEY_DUPLICATED' || String(error).includes('AUTH_KEY_DUPLICATED')) {
      console.log("⚠️ Auth key duplicated. This happens during Render zero-downtime deploys. Retrying in 10 seconds...");
      
      // CRITICAL: We MUST disconnect the failed client to kill the zombie socket!
      // Otherwise, Telegram still thinks this socket is holding the connection!
      try {
        if (client) {
          await client.disconnect();
          console.log("🧹 Cleaned up zombie socket.");
        }
      } catch (e) {
        console.log("Error cleaning up socket:", e.message);
      }
      
      setTimeout(initTelegram, 10000);
    }
  }
}

app.get('/', (req, res) => {
  res.send('Shitflix Backend is awake! 🚀');
});

app.get('/api/catalog', (req, res) => {
  try {
    const mappings = JSON.parse(fs.readFileSync('./mappings.json', 'utf8'));
    
    // Convert mapping object to an array for the frontend
    const movies = Object.keys(mappings.movie || {}).map(tmdbId => ({
      id: tmdbId,
      media_type: 'movie',
      ...mappings.movie[tmdbId]
    }));
    
    const tvShows = Object.keys(mappings.tv || {}).map(tmdbId => ({
      id: tmdbId,
      media_type: 'tv',
      ...mappings.tv[tmdbId]
    }));
    
    // Combine and reverse so newest additions are at the top
    const allMedia = [...movies, ...tvShows].reverse();
    
    res.json({ results: allMedia });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read catalog.' });
  }
});

// Returns all mapped TMDB IDs — used by frontend to filter TMDB results
// against the local Telegram library without making N individual /mapping calls
app.get('/api/catalog/ids', (req, res) => {
  try {
    const mappings = JSON.parse(fs.readFileSync('./mappings.json', 'utf8'));
    const movieIds = Object.keys(mappings.movie || {}).map(id => ({ id: String(id), type: 'movie' }));
    const tvIds    = Object.keys(mappings.tv    || {}).map(id => ({ id: String(id), type: 'tv' }));
    res.json({ ids: [...movieIds, ...tvIds] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read catalog.' });
  }
});


app.get('/api/mapping/:mediaType/:tmdbId', (req, res) => {
  try {
    const { mediaType, tmdbId } = req.params;
    const mappings = JSON.parse(fs.readFileSync('./mappings.json', 'utf8'));
    const mapping = mappings[mediaType] && mappings[mediaType][tmdbId];
    if (mapping) {
      res.json(mapping);
    } else {
      res.status(404).json({ error: 'Mapping not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read catalog.' });
  }
});

const probeCache = {};

app.get('/api/probe/:mediaType/:tmdbId', (req, res) => {
  const { mediaType, tmdbId } = req.params;
  const sourceIndex = req.query.sourceIndex || 0;
  const season = req.query.season;
  const episode = req.query.episode;
  
  const cacheKey = `${mediaType}_${tmdbId}_${season || ''}_${episode || ''}_${sourceIndex}`;
  if (probeCache[cacheKey]) {
    return res.json(probeCache[cacheKey]);
  }
  
  // We use the local raw stream URL as the input for ffprobe
  const PORT = process.env.PORT || 3000;
  let streamUrl = `http://127.0.0.1:${PORT}/api/stream/${mediaType}/${tmdbId}?sourceIndex=${sourceIndex}`;
  if (mediaType === 'tv' && season && episode) {
    streamUrl += `&season=${season}&episode=${episode}`;
  }
  
  execFile(ffprobePath, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    streamUrl
  ], (error, stdout, stderr) => {
    if (error) {
      console.error('ffprobe error:', error);
      return res.status(500).json({ error: 'Failed to probe file.' });
    }
    
    try {
      const data = JSON.parse(stdout);
      const audioStreams = data.streams ? data.streams.filter(s => s.codec_type === 'audio') : [];
      const subtitleStreams = data.streams ? data.streams.filter(s => s.codec_type === 'subtitle') : [];
      
      const tracks = audioStreams.map((stream, index) => {
        const lang = (stream.tags && stream.tags.language) ? stream.tags.language : 'Unknown';
        const title = (stream.tags && stream.tags.title) ? stream.tags.title : `Track ${index + 1}`;
        return {
          index: index,
          language: lang,
          title: title,
          codec: stream.codec_name
        };
      });
      
      const subtitles = subtitleStreams.map((stream, index) => {
        const lang = (stream.tags && stream.tags.language) ? stream.tags.language : 'Unknown';
        const title = (stream.tags && stream.tags.title) ? stream.tags.title : `Subtitle ${index + 1}`;
        return {
          index: index,
          language: lang,
          title: title,
          codec: stream.codec_name
        };
      });
      
      const duration = data.format && data.format.duration ? parseFloat(data.format.duration) : null;
      
      const result = { tracks, subtitles, duration };
      probeCache[cacheKey] = result;
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse ffprobe output.' });
    }
  });
});

app.get('/api/audio/:mediaType/:tmdbId', (req, res) => {
  const { mediaType, tmdbId } = req.params;
  const sourceIndex = req.query.sourceIndex || 0;
  const audioTrack = req.query.audioTrack || 0;
  const start = parseFloat(req.query.start) || 0;
  const season = req.query.season;
  const episode = req.query.episode;
  
  const PORT = process.env.PORT || 3000;
  let streamUrl = `http://127.0.0.1:${PORT}/api/stream/${mediaType}/${tmdbId}?sourceIndex=${sourceIndex}`;
  if (mediaType === 'tv' && season && episode) {
    streamUrl += `&season=${season}&episode=${episode}`;
  }
  
  let ffmpegArgs = [];
  if (start > 0) {
    ffmpegArgs.push('-ss', start.toString());
  }
  
  ffmpegArgs.push(
    '-i', streamUrl,
    '-map', `0:a:${audioTrack}`,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-f', 'adts',
    'pipe:1'
  );
  
  res.setHeader('Content-Type', 'audio/aac');
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
  ffmpegProcess.stdout.pipe(res);
  
  req.on('close', () => {
    ffmpegProcess.kill('SIGKILL');
  });
});

app.get('/api/subtitle/:mediaType/:tmdbId', (req, res) => {
  const { mediaType, tmdbId } = req.params;
  const sourceIndex = req.query.sourceIndex || 0;
  const trackIndex = req.query.trackIndex || 0;
  const season = req.query.season;
  const episode = req.query.episode;
  
  const PORT = process.env.PORT || 3000;
  let streamUrl = `http://127.0.0.1:${PORT}/api/stream/${mediaType}/${tmdbId}?sourceIndex=${sourceIndex}`;
  if (mediaType === 'tv' && season && episode) {
    streamUrl += `&season=${season}&episode=${episode}`;
  }
  
  let ffmpegArgs = [
    '-i', streamUrl,
    '-map', `0:${trackIndex}`,
    '-c:s', 'webvtt',
    '-f', 'webvtt',
    'pipe:1'
  ];
  
  res.setHeader('Content-Type', 'text/vtt');
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
  ffmpegProcess.stdout.pipe(res);
  
  ffmpegProcess.stderr.on('data', (data) => {
    // console.log(`[ffmpeg sub] ${data}`);
  });
  
  req.on('close', () => {
    ffmpegProcess.kill('SIGKILL');
  });
});

app.get('/api/transcode/:mediaType/:tmdbId', (req, res) => {
  const { mediaType, tmdbId } = req.params;
  const sourceIndex = req.query.sourceIndex || 0;
  const audioTrack = req.query.audioTrack || 0;
  const start = req.query.start || 0; // Accept start time parameter
  const season = req.query.season;
  const episode = req.query.episode;
  
  const PORT = process.env.PORT || 3000;
  let streamUrl = `http://127.0.0.1:${PORT}/api/stream/${mediaType}/${tmdbId}?sourceIndex=${sourceIndex}`;
  if (mediaType === 'tv' && season && episode) {
    streamUrl += `&season=${season}&episode=${episode}`;
  }
  
  const mappings = JSON.parse(fs.readFileSync('./mappings.json', 'utf8'));
  const mapping = mappings[mediaType] && mappings[mediaType][tmdbId];
  
  let filename = '';
  if (mediaType === 'tv' && season && episode && mapping && mapping.seasons && mapping.seasons[season] && mapping.seasons[season].episodes[episode]) {
      const sources = mapping.seasons[season].episodes[episode].sources || [];
      filename = sources[sourceIndex] ? sources[sourceIndex].filename : '';
  } else if (mapping && mapping.sources && mapping.sources[sourceIndex]) {
      filename = mapping.sources[sourceIndex].filename || '';
  }
  
  const isMKV = filename.toLowerCase().endsWith('.mkv');

  let ffmpegArgs = [];
  
  if (start > 0) {
    ffmpegArgs.push('-ss', start.toString());
  }
  
  ffmpegArgs.push('-i', streamUrl);
  
  if (isMKV) {
    ffmpegArgs.push(
      '-map', '0:v:0',
      '-map', `0:a:${audioTrack}`,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1'
    );
    res.setHeader('Content-Type', 'video/mp4');
  } else {
    ffmpegArgs.push(
      '-map', '0:v:0',
      '-map', `0:a:${audioTrack}`,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-ac', '2',
      '-b:a', '256k',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1'
    );
    res.setHeader('Content-Type', 'video/mp4');
  }
  
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
  
  ffmpegProcess.stdout.pipe(res);
  
  ffmpegProcess.stderr.on('data', (data) => {
    console.log(`[ffmpeg] ${data}`);
  });

  req.on('close', () => {
    ffmpegProcess.kill('SIGKILL');
  });
});

app.get('/api/stream/:mediaType/:tmdbId', async (req, res) => {
  const { mediaType, tmdbId } = req.params;
  
  // 1. Look up the mapping
  const mappings = JSON.parse(fs.readFileSync('./mappings.json', 'utf8'));
  const mapping = mappings[mediaType] && mappings[mediaType][tmdbId];
  
  if (!mapping) {
    return res.status(404).json({ error: 'Movie not mapped to a Telegram file yet.' });
  }

  const sourceIndex = parseInt(req.query.sourceIndex) || 0;
  const season = req.query.season;
  const episode = req.query.episode;
  
  let source = null;
  if (mediaType === 'tv' && season && episode) {
    if (mapping.seasons && mapping.seasons[season] && mapping.seasons[season].episodes && mapping.seasons[season].episodes[episode]) {
      const sources = mapping.seasons[season].episodes[episode].sources;
      if (sources && sources[sourceIndex]) {
        source = sources[sourceIndex];
      }
    }
  } else if (mapping.sources && mapping.sources[sourceIndex]) {
    source = mapping.sources[sourceIndex];
  }
  
  if (!source) {
    return res.status(404).json({ error: 'Source not found for this movie/episode.' });
  }

  const { channel, messageId } = source;

  try {
    // 2. Fetch the message from Telegram
    console.log(`[Stream API] Fetching message ID ${messageId} from channel ${channel}`);
    // Using BigInt for channel and array for ids to ensure GramJS resolves it correctly
    const messages = await client.getMessages(BigInt(channel), { ids: [Number(messageId)] });
    console.log(`[Stream API] Fetched messages! Result length: ${messages ? messages.length : 0}`);
    if (!messages || messages.length === 0 || !messages[0] || !messages[0].media) {
      console.log(`[Stream API] Message not found or no media.`);
      return res.status(404).json({ error: 'File not found on Telegram.' });
    }

    const document = messages[0].media.document;
    if (!document) {
      return res.status(400).json({ error: 'Message does not contain a video document.' });
    }

    const fileSize = Number(document.size);
    
    // Quick exit for HEAD requests (used by VideoPlayer.js to check existence)
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes'
      });
      return res.end();
    }

    const range = req.headers.range;

    // 3. Handle Range Requests for HTML5 Video
    if (!range) {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      // Just stream the whole thing if no range (not recommended, but standard fallback)
      let requestClosedFull = false;
      req.on('close', () => { requestClosedFull = true; });
      const iterator = client.iterDownload({ file: messages[0].media });
      for await (const chunk of iterator) {
        if (requestClosedFull) {
          console.log(`[Stream API] Request closed by client (full stream), aborting download.`);
          break;
        }
        res.write(chunk);
      }
      if (!requestClosedFull) res.end();
      return;
    }

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });

    const bigInt = require('big-integer');

    // 4. Stream exactly the requested chunk from Telegram
    // We use a manual offset down to the exact byte requested
    const iterator = client.iterDownload({
      file: messages[0].media,
      offset: bigInt(start),
    });

    let requestClosed = false;
    req.on('close', () => {
      requestClosed = true;
    });

    let downloaded = 0;
    for await (const chunk of iterator) {
      if (requestClosed) {
        console.log(`[Stream API] Request closed by client, aborting download.`);
        break;
      }
      if (downloaded >= chunksize) break;
      
      const remaining = chunksize - downloaded;
      const toSend = chunk.length > remaining ? chunk.slice(0, remaining) : chunk;
      
      res.write(toSend);
      downloaded += toSend.length;
    }
    
    if (!requestClosed) {
      res.end();
    }

  } catch (error) {
    console.error("Stream Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

const { runSync } = require('./sync.js');

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🎬 Telegram Streamer running on http://localhost:${PORT}`);
  await initTelegram();
  
  // Skip initial sync to avoid locking the Telegram client at startup
  // await runSync(client);
  
  // Schedule auto-sync every 30 minutes (30 * 60 * 1000)
  setInterval(async () => {
    try {
      await runSync(client);
    } catch (e) {
      console.error("Auto-sync failed:", e.message);
    }
  }, 30 * 60 * 1000);
});
