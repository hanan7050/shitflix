import Artplayer from 'artplayer';
import '../styles/VideoPlayer.css';

/* ============================================================
   Shitflix — Netflix-Accurate Video Player
   Supports: Web + Android TV (D-pad)
   ============================================================ */

const API_BASE = import.meta.env.VITE_API_URL || 'https://shitflix-backend.onrender.com';

export function createVideoPlayer(mediaId, mediaType, tmdbTitle = null, initialSeason = null, initialEpisode = null) {

  // ── DOM Skeleton ──────────────────────────────────────────
  const page = document.createElement('div');
  page.className = 'sf-player-page';
  // Force full-screen coverage via inline styles (belt + suspenders)
  Object.assign(page.style, {
    position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
    width: '100vw', height: '100vh', background: '#000', zIndex: '9000',
    fontFamily: "'Netflix Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"
  });

  const container = document.createElement('div');
  container.className = 'sf-player-container';
  Object.assign(container.style, { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' });
  page.appendChild(container);

  const playerContainer = document.createElement('div');
  playerContainer.className = 'sf-artplayer-container';
  Object.assign(playerContainer.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', background: '#000', display: 'none' });
  container.appendChild(playerContainer);

  const loading = document.createElement('div');
  loading.className = 'sf-player-loading';
  Object.assign(loading.style, {
    position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: '100', gap: '16px'
  });
  loading.innerHTML = `
    <div style="width:48px;height:48px;border:4px solid rgba(255,255,255,0.15);border-top-color:#e50914;border-radius:50%;animation:sf-spin 0.8s linear infinite"></div>
    <div style="color:white;font-size:1rem;font-weight:500">Loading Stream...</div>
    <div style="color:rgba(255,255,255,0.5);font-size:0.8rem">Optimizing for your network</div>
    <style>@keyframes sf-spin { to { transform:rotate(360deg); } }</style>
  `;
  container.appendChild(loading);

  const errorEl = document.createElement('div');
  errorEl.className = 'sf-player-no-trailer';
  Object.assign(errorEl.style, { display: 'none' });
  container.appendChild(errorEl);


  // ── State ─────────────────────────────────────────────────
  let art = null;
  let selectedSourceIndex = 0;
  let selectedAudioTrack = 0;
  let sourcesList = [];
  let audioTracks = [];
  let realDuration = 0;
  let forceTranscode = false;
  let uiTimer = null;
  let isDragging = false;
  let settingsOpen = false;

  // ── Codec helpers ─────────────────────────────────────────
  const canPlayDolbyNative = (codec) => {
    if (!codec) return false;
    const c = codec.toLowerCase();
    if (c === 'truehd' || c === 'dts') return false;
    const ua = navigator.userAgent.toLowerCase();
    return /^((?!chrome|android).)*safari/i.test(ua) || /edg/i.test(ua);
  };

  const isMKV = () => (sourcesList[selectedSourceIndex]?.filename || '').toLowerCase().endsWith('.mkv');

  const getStreamUrl = (startTime = 0) => {
    const endpoint = (isMKV() || forceTranscode) ? 'transcode' : 'stream';
    let url = `${API_BASE}/api/${endpoint}/${mediaType}/${mediaId}?sourceIndex=${selectedSourceIndex}`;
    if (endpoint === 'transcode' && selectedAudioTrack !== 0) url += `&audioTrack=${selectedAudioTrack}`;
    if (endpoint === 'transcode' && startTime > 0) url += `&start=${startTime}`;
    if (mediaType === 'tv' && season && episode) url += `&season=${season}&episode=${episode}`;
    return url;
  };

  // ── Helpers ───────────────────────────────────────────────
  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const mm = String(m).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  // ── Netflix UI HTML ───────────────────────────────────────
  const titleLabel = mediaType === 'tv' ? `S${season} E${episode} — ${title}` : title;

  const uiEl = document.createElement('div');
  uiEl.className = 'sf-netflix-ui';
  uiEl.innerHTML = `
    <!-- Top Bar -->
    <div class="sf-netflix-top-bar">
      <button class="sf-netflix-back-btn sf-nf-btn" id="nf-back" tabindex="0" aria-label="Go back">
        <svg viewBox="0 0 24 24" width="28" height="28"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <span class="sf-netflix-header-title">${titleLabel}</span>
    </div>

    <!-- Bottom Bar -->
    <div class="sf-netflix-bottom-bar">
      <!-- Title row -->
      <div class="sf-nf-title-row">
        ${mediaType === 'tv' ? `<span class="sf-nf-series-label">Episode</span>` : ''}
        <span class="sf-nf-title">${title}</span>
      </div>

      <!-- Timeline -->
      <div class="sf-netflix-timeline-wrapper" id="nf-timeline" tabindex="0" role="slider" aria-label="Seek">
        <div class="sf-netflix-timeline-track">
          <div class="sf-netflix-timeline-buffered" id="nf-buffered"></div>
          <div class="sf-netflix-timeline-progress" id="nf-progress">
            <div class="sf-netflix-timeline-thumb"></div>
          </div>
        </div>
        <div class="sf-netflix-time-tooltip" id="nf-time-tip">0:00</div>
      </div>

      <!-- Controls Row -->
      <div class="sf-netflix-controls-row">
        <!-- Left controls -->
        <div class="sf-netflix-controls-left">
          <button class="sf-nf-btn" id="nf-play" tabindex="0" aria-label="Play/Pause">
            <svg viewBox="0 0 24 24" width="32" height="32"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <button class="sf-nf-btn" id="nf-rw" tabindex="0" aria-label="Rewind 10 seconds">
            <svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="5" font-weight="bold" font-family="Arial">10</text></svg>
          </button>
          <button class="sf-nf-btn" id="nf-ff" tabindex="0" aria-label="Forward 10 seconds">
            <svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="5" font-weight="bold" font-family="Arial">10</text></svg>
          </button>

          <!-- Volume -->
          <div class="sf-nf-volume-wrap">
            <button class="sf-nf-btn" id="nf-vol" tabindex="0" aria-label="Mute/Unmute">
              <svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            </button>
            <input type="range" class="sf-nf-volume-slider" id="nf-vol-slider" min="0" max="1" step="0.05" value="1" aria-label="Volume">
          </div>

          <!-- Time -->
          <div class="sf-nf-time" id="nf-time">0:00 / 0:00</div>
        </div>

        <!-- Right controls -->
        <div class="sf-netflix-controls-right">
          <button class="sf-nf-btn" id="nf-settings" tabindex="0" aria-label="Settings">
            <svg viewBox="0 0 24 24" width="24" height="24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.73 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
          </button>
          <button class="sf-nf-btn" id="nf-fs" tabindex="0" aria-label="Fullscreen">
            <svg viewBox="0 0 24 24" width="24" height="24" id="nf-fs-icon"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
  page.appendChild(uiEl);

  // ── Center Play/Pause animation ───────────────────────────
  const centerAnim = document.createElement('div');
  centerAnim.className = 'sf-nf-center-anim';
  centerAnim.innerHTML = `<div class="sf-nf-ripple-circle"></div><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  page.appendChild(centerAnim);

  // ── Seek flash overlays ───────────────────────────────────
  const seekFlashL = document.createElement('div');
  seekFlashL.className = 'sf-nf-seek-flash left';
  seekFlashL.innerHTML = `<div class="sf-nf-seek-label"><svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg><span>-10s</span></div>`;
  page.appendChild(seekFlashL);

  const seekFlashR = document.createElement('div');
  seekFlashR.className = 'sf-nf-seek-flash right';
  seekFlashR.innerHTML = `<div class="sf-nf-seek-label"><svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg><span>+10s</span></div>`;
  page.appendChild(seekFlashR);

  // ── Settings Panel (right drawer) ────────────────────────
  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'sf-settings-panel';

  page.appendChild(loading);
  page.appendChild(errorEl);
  page.appendChild(playerContainer);
  page.appendChild(settingsPanel);

  // ── Get element refs ──────────────────────────────────────
  const $ = (id) => uiEl.querySelector(`#${id}`);
  const nfBack     = $('nf-back');
  const nfPlay     = $('nf-play');
  const nfRw       = $('nf-rw');
  const nfFf       = $('nf-ff');
  const nfVol      = $('nf-vol');
  const nfVolSlider = $('nf-vol-slider');
  const nfSettings = $('nf-settings');
  const nfFs       = $('nf-fs');
  const nfFsIcon   = $('nf-fs-icon');
  const nfTime     = $('nf-time');
  const nfTimeline = $('nf-timeline');
  const nfProgress = $('nf-progress');
  const nfBuffered = $('nf-buffered');
  const nfTimeTip  = $('nf-time-tip');

  // ── UI fade logic ─────────────────────────────────────────
  const showUI = () => {
    uiEl.classList.add('visible');
    clearTimeout(uiTimer);
    if (art && art.playing && !settingsOpen) {
      uiTimer = setTimeout(() => uiEl.classList.remove('visible'), 3500);
    }
  };

  const hideUI = () => {
    clearTimeout(uiTimer);
    uiEl.classList.remove('visible');
  };

  playerContainer.addEventListener('mousemove', showUI);
  playerContainer.addEventListener('touchstart', showUI, { passive: true });
  playerContainer.addEventListener('keydown', showUI);

  // Click on video area (not buttons) = toggle UI
  playerContainer.addEventListener('click', (e) => {
    if (e.target === playerContainer || e.target.closest('.sf-artplayer-container video')) {
      if (uiEl.classList.contains('visible')) {
        if (art) art.playing ? art.pause() : art.play();
      } else {
        showUI();
      }
    }
  });

  // ── Center animation ──────────────────────────────────────
  const triggerCenterAnim = (isPlaying) => {
    centerAnim.querySelector('svg').innerHTML = isPlaying
      ? '<path d="M8 5v14l11-7z"/>'
      : '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    centerAnim.classList.remove('playing', 'paused');
    void centerAnim.offsetWidth;
    centerAnim.classList.add(isPlaying ? 'playing' : 'paused');
  };

  // ── Seek flash ────────────────────────────────────────────
  const flashSeek = (dir) => {
    const el = dir === 'left' ? seekFlashL : seekFlashR;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
    el.addEventListener('animationend', () => el.classList.remove('active'), { once: true });
  };

  // ── Play/Pause icons ──────────────────────────────────────
  const syncPlayIcon = () => {
    if (!art) return;
    nfPlay.innerHTML = art.playing
      ? '<svg viewBox="0 0 24 24" width="32" height="32"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>';
  };

  // ── Volume ────────────────────────────────────────────────
  let muted = false;
  const syncVolIcon = () => {
    const v = parseFloat(nfVolSlider.value);
    if (muted || v === 0) {
      nfVol.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
    } else if (v < 0.5) {
      nfVol.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>';
    } else {
      nfVol.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    }
  };

  nfVol.addEventListener('click', () => {
    muted = !muted;
    if (art) art.muted = muted;
    syncVolIcon();
  });

  nfVolSlider.addEventListener('input', () => {
    const v = parseFloat(nfVolSlider.value);
    if (art) art.volume = v;
    muted = v === 0;
    syncVolIcon();
  });

  // ── Fullscreen ────────────────────────────────────────────
  const syncFsIcon = () => {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    nfFsIcon.innerHTML = isFs
      ? '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>'
      : '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
  };

  const toggleFs = () => {
    const el = container;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  };

  nfFs.addEventListener('click', toggleFs);
  document.addEventListener('fullscreenchange', syncFsIcon);
  document.addEventListener('webkitfullscreenchange', syncFsIcon);

  // ── Timeline update ───────────────────────────────────────
  const updateTimeline = () => {
    if (!art) return;
    const curr = art.currentTime || 0;
    const dur = realDuration || art.duration || 0;
    const pct = dur > 0 ? (curr / dur) * 100 : 0;
    nfProgress.style.width = `${pct}%`;
    nfTime.textContent = `${fmt(curr)} / ${fmt(dur)}`;

    // Buffered
    try {
      const video = art.template.$video;
      if (video && video.buffered && video.buffered.length > 0 && dur > 0) {
        const buffEnd = video.buffered.end(video.buffered.length - 1);
        nfBuffered.style.width = `${Math.min(100, (buffEnd / dur) * 100)}%`;
      }
    } catch (_) {}
  };

  // ── Timeline scrubbing ────────────────────────────────────
  const scrubAt = (clientX) => {
    if (!art) return;
    const rect = nfTimeline.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dur = realDuration || art.duration || 0;
    art.currentTime = pct * dur;
  };

  nfTimeline.addEventListener('mousemove', (e) => {
    const rect = nfTimeline.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = realDuration || (art ? art.duration : 0) || 0;
    nfTimeTip.textContent = fmt(pct * dur);
    nfTimeTip.style.left = `${pct * 100}%`;
  });

  nfTimeline.addEventListener('click', (e) => scrubAt(e.clientX));

  // Touch drag on timeline
  nfTimeline.addEventListener('touchstart', (e) => { isDragging = true; scrubAt(e.touches[0].clientX); }, { passive: true });
  nfTimeline.addEventListener('touchmove', (e) => { if (isDragging) scrubAt(e.touches[0].clientX); }, { passive: true });
  nfTimeline.addEventListener('touchend', () => { isDragging = false; });

  // Mouse drag on timeline
  nfTimeline.addEventListener('mousedown', (e) => {
    isDragging = true;
    scrubAt(e.clientX);
    const onMove = (ev) => { if (isDragging) scrubAt(ev.clientX); };
    const onUp = () => { isDragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ── Button actions ────────────────────────────────────────
  nfBack.addEventListener('click', () => { if (art) art.pause(); window.history.back(); });

  nfPlay.addEventListener('click', () => {
    if (!art) return;
    if (art.playing) { art.pause(); triggerCenterAnim(false); }
    else { art.play(); triggerCenterAnim(true); }
  });

  const seekBy = (amount) => {
    if (!art) return;
    const dur = realDuration || art.duration || 0;
    art.currentTime = Math.max(0, Math.min(dur, (art.currentTime || 0) + amount));
    flashSeek(amount > 0 ? 'right' : 'left');
    showUI();
  };

  nfRw.addEventListener('click', () => seekBy(-10));
  nfFf.addEventListener('click', () => seekBy(10));

  // ── Settings Panel ────────────────────────────────────────
  const buildSettings = () => {
    settingsPanel.innerHTML = `
      <div class="sf-settings-header">
        <h2>Player Settings</h2>
        <button class="sf-settings-close-btn" id="sf-settings-close" tabindex="0" aria-label="Close settings">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
    `;

    if (sourcesList.length > 1) {
      const sec = document.createElement('div');
      sec.className = 'sf-settings-section';
      sec.innerHTML = '<h3>Select File</h3>';
      sourcesList.forEach((source, index) => {
        const btn = document.createElement('button');
        btn.className = `sf-settings-item${index === selectedSourceIndex ? ' active' : ''}`;
        btn.tabIndex = 0;
        btn.innerHTML = `
          <div class="sf-settings-item-label">
            ${source.filename || `File ${index + 1}`}
          </div>
          <div class="sf-settings-item-check"></div>
        `;
        btn.addEventListener('click', () => {
          selectedSourceIndex = index;
          selectedAudioTrack = 0;
          forceTranscode = false;
          audioTracks = [];
          art.switchUrl(getStreamUrl());
          buildSettings();
          fetchAudioTracks();
          art.play();
        });
        sec.appendChild(btn);
      });
      settingsPanel.appendChild(sec);
    }

    if (audioTracks.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'sf-settings-section';
      sec.innerHTML = '<h3>Audio Track</h3>';
      audioTracks.forEach(track => {
        const btn = document.createElement('button');
        btn.className = `sf-settings-item${track.index === selectedAudioTrack ? ' active' : ''}`;
        btn.tabIndex = 0;
        btn.innerHTML = `
          <div class="sf-settings-item-label">
            ${track.language || 'Unknown'}
            <span class="sf-settings-item-sublabel">${track.title || track.codec || ''}</span>
          </div>
          <div class="sf-settings-item-check"></div>
        `;
        btn.addEventListener('click', () => {
          selectedAudioTrack = track.index;
          forceTranscode = true;
          const t = art ? (art.currentTime || 0) : 0;
          art.switchUrl(getStreamUrl(t));
          closeSettings();
          art.play();
        });
        sec.appendChild(btn);
      });
      settingsPanel.appendChild(sec);
    }

    const closeBtn = settingsPanel.querySelector('#sf-settings-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);

    // focus first item for TV
    const firstItem = settingsPanel.querySelector('.sf-settings-item, #sf-settings-close');
    if (firstItem) setTimeout(() => firstItem.focus(), 80);
  };

  const openSettings = () => {
    settingsOpen = true;
    if (art) art.pause();
    buildSettings();
    settingsPanel.classList.add('open');
    showUI();
  };

  const closeSettings = () => {
    settingsOpen = false;
    settingsPanel.classList.remove('open');
    nfSettings.focus();
    if (art) art.play();
    showUI();
  };

  nfSettings.addEventListener('click', openSettings);

  // ── Keyboard ──────────────────────────────────────────────
  playerContainer.tabIndex = -1;

  document.addEventListener('keydown', (e) => {
    if (settingsOpen) {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Back') { e.preventDefault(); closeSettings(); return; }
      return;
    }

    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        seekBy(-10);
        showUI();
        break;
      case 'ArrowRight':
        e.preventDefault();
        seekBy(10);
        showUI();
        break;
      case ' ':
        e.preventDefault();
        if (art) { art.playing ? art.pause() : art.play(); triggerCenterAnim(!art.playing); }
        break;
      case 'Escape':
      case 'Backspace':
        e.preventDefault();
        if (art) art.pause();
        window.history.back();
        break;
      case 'f':
      case 'F':
        toggleFs();
        break;
      case 'm':
      case 'M':
        muted = !muted;
        if (art) art.muted = muted;
        syncVolIcon();
        break;
    }
  });

  // ── fetchAudioTracks ──────────────────────────────────────
  const fetchAudioTracks = () => {
    let url = `${API_BASE}/api/probe/${mediaType}/${mediaId}?sourceIndex=${selectedSourceIndex}`;
    if (mediaType === 'tv' && season && episode) url += `&season=${season}&episode=${episode}`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data && data.duration) realDuration = data.duration;

        if (data && data.tracks) {
          audioTracks = data.tracks;

          const cur = audioTracks.find(t => t.index === selectedAudioTrack);
          if (cur && !forceTranscode && !isMKV()) {
            const codec = (cur.codec || '').toLowerCase();
            if (['ac3', 'eac3', 'dts', 'truehd'].includes(codec) && !canPlayDolbyNative(codec)) {
              forceTranscode = true;
              if (art) art.switchUrl(getStreamUrl(art.currentTime || 0));
            }
          }
          if (settingsOpen) buildSettings();
        }
      })
      .catch(err => console.warn('[Player] probe failed:', err));
  };

  // ── initStream ────────────────────────────────────────────
  const initStream = () => {
    loading.style.display = 'flex';
    playerContainer.style.display = 'none';
    errorEl.style.display = 'none';

    fetch(`${API_BASE}/api/stream/${mediaType}/${mediaId}?sourceIndex=${selectedSourceIndex}`, { method: 'HEAD' })
      .then(res => {
        if (!res.ok) throw new Error('Stream not found in your Telegram channel.');

        loading.style.display = 'none';
        playerContainer.style.display = 'block';

        if (!art) {
          // Artplayer — minimal config, custom UI handles everything
          art = new Artplayer({
            container: playerContainer,
            url: getStreamUrl(),
            title,
            autoplay: true,
            volume: 1,
            muted: false,
            hotkey: false,        // we handle hotkeys ourselves
            pip: false,
            setting: false,
            fullscreen: false,
            fullscreenWeb: false,
            playbackRate: false,
            aspectRatio: false,
            controls: [],
            layers: [],
            settings: [],
            theme: '#e50914',
          });

          // Wire events
          art.on('play',  () => { syncPlayIcon(); showUI(); });
          art.on('pause', () => { syncPlayIcon(); showUI(); });
          art.on('video:timeupdate', updateTimeline);
          art.on('video:loadedmetadata', updateTimeline);
          art.on('ready', () => { 
            showUI(); 
            playerContainer.focus(); 
          });

          // Seek on transcoded stream: re-fetch from start timestamp
          let isSeeking = false;
          art.on('seek', (time) => {
            if (getStreamUrl().includes('transcode') && !isSeeking) {
              isSeeking = true;
              art.switchUrl(getStreamUrl(time));
              art.play();
              setTimeout(() => { isSeeking = false; }, 1200);
            }
          });

        } else {
          art.switchUrl(getStreamUrl());
        }
      })
      .catch(err => {
        loading.style.display = 'none';
        playerContainer.style.display = 'block';
        errorEl.style.display = 'flex';
        errorEl.innerHTML = `
          <svg viewBox="0 0 24 24" width="64" height="64"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#e50914"/></svg>
          <h2 style="color:white;margin:8px 0 4px">Stream Unavailable</h2>
          <p style="color:#888;font-size:.88rem">${err.message}</p>
        `;
      });
  };

  // ── Bootstrap ─────────────────────────────────────────────
  fetch(`${API_BASE}/api/mapping/${mediaType}/${mediaId}`)
    .then(r => r.json())
    .then(mapping => {
      if (mapping && mapping.sources && mapping.sources.length > 0) {
        sourcesList = mapping.sources;
      }
      initStream();
      fetchAudioTracks();
    })
    .catch(() => {
      initStream();
      fetchAudioTracks();
    });

  // ── Cleanup ───────────────────────────────────────────────
  return {
    element: page,
    cleanup: () => {
      clearTimeout(uiTimer);
      document.removeEventListener('fullscreenchange', syncFsIcon);
      document.removeEventListener('webkitfullscreenchange', syncFsIcon);
      if (art) art.destroy(true);
    }
  };
}
