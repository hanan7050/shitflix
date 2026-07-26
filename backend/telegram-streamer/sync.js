const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
require('dotenv').config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);
const TMDB_API_KEY = "c29379565234e20d7cbf4f2e835c3e41"; // From frontend api.js

const TARGET_CHANNEL = "-1001749123776"; // The Holy Films

// A regex to extract title and year, ignoring common scene tags
function parseTitleAndYear(text) {
  if (!text) return null;
  
  // Clean extension
  text = text.replace(/\.(mp4|mkv|avi|webm)$/i, '');
  
  let season = null;
  let episode = null;
  
  // Match S01E01, s1e1, S01 E01, Season 1 Episode 1
  const seMatch = text.match(/s([0-9]{1,2})\s*e([0-9]{1,2})/i) || text.match(/season\s*([0-9]{1,2})\s*episode\s*([0-9]{1,2})/i);
  if (seMatch) {
    season = parseInt(seMatch[1], 10);
    episode = parseInt(seMatch[2], 10);
  } else {
    // Try EP01 or E01 at the end of the filename
    const epMatch = text.match(/\s+(ep|e)\s*([0-9]{1,3})(\s|$)/i);
    if (epMatch) {
      season = 1;
      episode = parseInt(epMatch[2], 10);
    }
  }
  
  // Look for a year like (2010) or .2010. or [2010]
  const yearMatch = text.match(/(19[0-9]{2}|20[0-9]{2})/);
  let year = null;
  let titlePart = text;
  
  if (yearMatch) {
    year = yearMatch[1];
    titlePart = text.substring(0, yearMatch.index);
  }
  
  // Remove common quality and release tags
  titlePart = titlePart.replace(/1080p|720p|4k|2160p|bluray|webrip|web-dl|x264|x265|hevc|hdr/gi, ' ');
  // Remove season/episode tags like S01E01, so it searches the show name
  titlePart = titlePart.replace(/s[0-9]{1,2}\s*e[0-9]{1,2}.*/gi, ' ');
  titlePart = titlePart.replace(/season\s*[0-9]{1,2}\s*episode\s*[0-9]{1,2}.*/gi, ' ');
  titlePart = titlePart.replace(/\s+(ep|e)\s*[0-9]{1,3}(\s|$).*/gi, ' ');
  
  let title = titlePart.replace(/[._\-\[\]()]/g, ' ').trim();
  title = title.replace(/\s+/g, ' ').trim();
  
  return { title, year, season, episode };
}

async function searchTMDB(title, year) {
  if (!title) return null;
  const query = encodeURIComponent(title);
  
  // If year is provided, strictly search movie and tv endpoints with year parameter
  if (year) {
    const movieUrl = `https://api.tmdb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${query}&primary_release_year=${year}&language=en-US`;
    const tvUrl = `https://api.tmdb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${query}&first_air_date_year=${year}&language=en-US`;
    
    try {
      const [movieRes, tvRes] = await Promise.all([fetch(movieUrl), fetch(tvUrl)]);
      const [movieData, tvData] = await Promise.all([movieRes.json(), tvRes.json()]);
      
      let movies = (movieData.results || []).map(m => ({ ...m, media_type: 'movie' }));
      let tvShows = (tvData.results || []).map(t => ({ ...t, media_type: 'tv' }));
      
      let combined = [...movies, ...tvShows].sort((a, b) => b.popularity - a.popularity);
      
      if (combined.length > 0) {
        return combined[0];
      }
    } catch (err) {
      console.error("TMDB Search with Year Error:", err.message);
    }
    // If strict year search fails, fall through to general search just in case
  }

  // Fallback or if no year is provided
  let url = `https://api.tmdb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${query}&language=en-US`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      let media = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
      if (media.length === 0) return null;
      
      if (year) {
        const exact = media.find(r => 
          (r.release_date && r.release_date.startsWith(year)) || 
          (r.first_air_date && r.first_air_date.startsWith(year))
        );
        if (exact) return exact;
      }
      return media[0];
    }
  } catch (err) {
    console.error("TMDB Search Error:", err.message);
  }
  return null;
}

async function runSync(client) {
  console.log(`Fetching ALL messages from channel: ${TARGET_CHANNEL}...`);
  
  let mappings = { movie: {}, tv: {} };
  if (fs.existsSync('./mappings.json')) {
    mappings = JSON.parse(fs.readFileSync('./mappings.json', 'utf8'));
    // Migrate old format
    for (const type in mappings) {
      for (const tmdbId in mappings[type]) {
        const item = mappings[type][tmdbId];
        if (item.messageId && !item.sources) {
          item.sources = [{
            channel: item.channel,
            messageId: item.messageId,
            filename: `Video ${item.messageId}`
          }];
          delete item.channel;
          delete item.messageId;
        }
      }
    }
  }

  let newAdditions = 0;

  for await (const msg of client.iterMessages(TARGET_CHANNEL)) {
    if (msg.media && msg.media.document) {
      const doc = msg.media.document;
      const filenameAttr = doc.attributes.find(attr => attr.className === 'DocumentAttributeFilename');
      const filename = filenameAttr ? filenameAttr.fileName : '';
      
      const textToParse = msg.message || filename;
      const parsed = parseTitleAndYear(textToParse);
      
      if (parsed && parsed.title) {
        
        let alreadyMapped = false;
        for (const tmdbId in mappings.movie) {
          const movie = mappings.movie[tmdbId];
          if (movie.sources && movie.sources.some(s => s.messageId === msg.id && s.channel === TARGET_CHANNEL)) {
            alreadyMapped = true;
            break;
          }
        }
        
        if (!alreadyMapped) {
          for (const tmdbId in mappings.tv) {
            const tvShow = mappings.tv[tmdbId];
            if (tvShow.seasons) {
              for (const s in tvShow.seasons) {
                for (const e in tvShow.seasons[s].episodes) {
                  const sources = tvShow.seasons[s].episodes[e].sources || [];
                  if (sources.some(src => src.messageId === msg.id && src.channel === TARGET_CHANNEL)) {
                    alreadyMapped = true;
                    break;
                  }
                }
                if (alreadyMapped) break;
              }
            }
            if (alreadyMapped) break;
          }
        }
        
        if (!alreadyMapped) {
          console.log(`🔍 Found New Video: "${parsed.title}" (Year: ${parsed.year || '?'})`);
          const tmdbData = await searchTMDB(parsed.title, parsed.year);
          if (tmdbData) {
            console.log(`   ✅ Matched to TMDB: ${tmdbData.title || tmdbData.name} (${tmdbData.id}) [${tmdbData.media_type}]`);
            
            if (tmdbData.media_type === 'tv') {
              if (!mappings.tv[tmdbData.id]) {
                mappings.tv[tmdbData.id] = {
                  title: tmdbData.title || tmdbData.name,
                  poster_path: tmdbData.poster_path,
                  backdrop_path: tmdbData.backdrop_path,
                  overview: tmdbData.overview,
                  popularity: tmdbData.popularity || 0,
                  vote_average: tmdbData.vote_average || 0,
                  release_date: tmdbData.release_date || tmdbData.first_air_date || '',
                  genre_ids: tmdbData.genre_ids || [],
                  original_language: tmdbData.original_language || 'en',
                  seasons: {}
                };
              }
              
              const s = parsed.season || 1;
              const e = parsed.episode || 1;
              
              if (!mappings.tv[tmdbData.id].seasons[s]) {
                mappings.tv[tmdbData.id].seasons[s] = { episodes: {} };
              }
              if (!mappings.tv[tmdbData.id].seasons[s].episodes[e]) {
                mappings.tv[tmdbData.id].seasons[s].episodes[e] = { sources: [] };
              }
              
              mappings.tv[tmdbData.id].seasons[s].episodes[e].sources.push({
                channel: TARGET_CHANNEL,
                messageId: msg.id,
                filename: filename || `Video ${msg.id}`
              });
            } else {
              if (!mappings.movie[tmdbData.id]) {
                mappings.movie[tmdbData.id] = {
                  title: tmdbData.title || tmdbData.name,
                  poster_path: tmdbData.poster_path,
                  backdrop_path: tmdbData.backdrop_path,
                  overview: tmdbData.overview,
                  popularity: tmdbData.popularity || 0,
                  vote_average: tmdbData.vote_average || 0,
                  release_date: tmdbData.release_date || tmdbData.first_air_date || '',
                  genre_ids: tmdbData.genre_ids || [],
                  original_language: tmdbData.original_language || 'en',
                  sources: []
                };
              }
              
              mappings.movie[tmdbData.id].sources.push({
                channel: TARGET_CHANNEL,
                messageId: msg.id,
                filename: filename || `Video ${msg.id}`
              });
            }
            
            newAdditions++;
            
            // Write progressively every 20 additions so the UI updates
            if (newAdditions % 20 === 0) {
              fs.writeFileSync('./mappings.json', JSON.stringify(mappings, null, 2));
              console.log(`💾 Progressively saved ${newAdditions} items to mappings.json...`);
            }
          }
        }
      }
    }
  }

  if (newAdditions > 0) {
    fs.writeFileSync('./mappings.json', JSON.stringify(mappings, null, 2));
    console.log(`🎉 Auto-Sync Complete! Added ${newAdditions} new movies to the catalog.`);
  } else {
    console.log(`✨ Auto-Sync Complete! No new movies found.`);
  }
}

module.exports = { runSync };
