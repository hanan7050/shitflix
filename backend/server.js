const express = require('express');
const cors = require('cors');
const { makeProviders, makeStandardFetcher, targets } = require('@movie-web/providers');
const fetch = require('node-fetch');

const app = express();
const port = 3001;

app.use(cors());

const fetcher = makeStandardFetcher(fetch);
const providers = makeProviders({
  fetcher,
  target: targets.NATIVE
});

app.get('/api/stream', async (req, res) => {
  const { tmdbId, type, season, episode, releaseYear, title } = req.query;

  if (!tmdbId || !type) {
    return res.status(400).json({ error: 'tmdbId and type are required' });
  }

  const media = {
    type: type === 'movie' ? 'movie' : 'show',
    title: title || 'Unknown Title',
    releaseYear: parseInt(releaseYear) || 2000,
    tmdbId: tmdbId,
    season: type === 'tv' ? { number: parseInt(season) || 1, tmdbId: '0' } : undefined,
    episode: type === 'tv' ? { number: parseInt(episode) || 1, tmdbId: '0' } : undefined
  };

  try {
    const output = await providers.runAll({
      media: media,
      sourceOrder: ['vidsrc', 'flixhq', 'showbox'] 
    });

    if (output) {
      res.json(output);
    } else {
      res.status(404).json({ error: 'No stream found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
