const { spawn } = require('child_process');
const express = require('express');
const app = express();
const ffmpegPath = require('ffmpeg-static');

app.get('/test', (req, res) => {
  res.setHeader('Content-Type', 'video/x-matroska');
  const start = req.query.start || 0;
  
  const url = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  
  const args = [
    '-ss', start,
    '-i', url,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-copyts',
    '-f', 'matroska',
    'pipe:1'
  ];
  
  const ffmpeg = spawn(ffmpegPath, args);
  ffmpeg.stdout.pipe(res);
});

app.listen(3002, () => console.log('Test server on 3002'));
