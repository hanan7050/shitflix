import { getImageUrl, ImageSize, getTitle, getMediaType, getDetails, getTrailerKey } from '../api.js';

export function createHeroBanner(items) {
  const container = document.createElement('div');
  container.className = 'sf-hero';

  if (!items || items.length === 0) {
    return container;
  }

  const validItems = items.filter(item => item.backdrop_path).slice(0, 6);
  if (validItems.length === 0) return container;

  const bgContainer = document.createElement('div');
  container.appendChild(bgContainer);

  const gradient = document.createElement('div');
  gradient.className = 'sf-hero-gradient';
  container.appendChild(gradient);

  const contentContainer = document.createElement('div');
  contentContainer.className = 'sf-hero-content';
  container.appendChild(contentContainer);

  const maturityContainer = document.createElement('div');
  maturityContainer.className = 'sf-maturity-badge-container';
  const maturityBadge = document.createElement('span');
  maturityBadge.className = 'sf-maturity-badge';
  maturityContainer.appendChild(maturityBadge);
  container.appendChild(maturityContainer);

  const bgs = validItems.map((item, index) => {
    const div = document.createElement('div');
    div.className = 'sf-hero-bg';
    if (index === 0) div.classList.add('sf-active');
    bgContainer.appendChild(div);
    return div;
  });

  const loadBgImage = (index) => {
    if (!bgs[index].style.backgroundImage) {
      // Fix: use BACKDROP_LARGE (which is 'original') for high-quality images
      const url = getImageUrl(validItems[index].backdrop_path, ImageSize.BACKDROP_LARGE);
      bgs[index].style.backgroundImage = `url('${url}')`;
    }
  };

  loadBgImage(0);
  if (validItems.length > 1) {
    loadBgImage(1);
  }

  let currentIndex = 0;
  let intervalId;
  let videoTimeoutId;

  const updateContent = (index) => {
    const item = validItems[index];
    const title = getTitle(item);
    const overviewText = item.overview || '';
    const truncatedOverview = overviewText.length > 200 ? overviewText.substring(0, 200) + '...' : overviewText;
    const matchScore = item.vote_average ? Math.round(item.vote_average * 10) : 0;
    const maturityText = item.adult ? '18+' : (matchScore > 80 ? 'TV-MA' : 'TV-14');
    const mediaType = getMediaType(item) || 'movie';

    maturityBadge.textContent = maturityText;

    contentContainer.innerHTML = `
      <h1 class="sf-hero-title">${title}</h1>
      <div class="sf-hero-meta">
        
      </div>
      <p class="sf-hero-overview">${truncatedOverview}</p>
      <div class="sf-hero-buttons">
        <a href="#/player/${mediaType}/${item.id}" class="sf-btn sf-btn-play" tabindex="0">
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
          Play
        </a>
        <button class="sf-btn sf-btn-info sf-more-info-btn" tabindex="0">
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/></svg>
          More Info
        </button>
      </div>
    `;

    const moreInfoBtn = contentContainer.querySelector('.sf-more-info-btn');
    if (moreInfoBtn) {
      moreInfoBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('sf:open-modal', { detail: { item } }));
      });
    }

    // Clean up existing video
    if (videoTimeoutId) clearTimeout(videoTimeoutId);
    bgs.forEach(bg => {
      const container = bg.querySelector('.sf-hero-video-container');
      if (container) container.remove();
    });

    // Schedule trailer fetch and play like Netflix
    videoTimeoutId = setTimeout(async () => {
      try {
        const details = await getDetails(item.id, mediaType);
        const trailerKey = getTrailerKey(details.videos);
        if (trailerKey) {
          // Ensure YouTube API is loaded
          if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
          }

          const videoContainer = document.createElement('div');
          videoContainer.className = 'sf-hero-video-container';
          videoContainer.style.position = 'absolute';
          videoContainer.style.top = '50%';
          videoContainer.style.left = '50%';
          videoContainer.style.width = '100vw';
          videoContainer.style.height = '56.25vw';
          videoContainer.style.transform = 'translate(-50%, -50%) scale(1.15)';
          videoContainer.style.pointerEvents = 'none';
          videoContainer.style.zIndex = '0';
          videoContainer.style.opacity = '0';
          videoContainer.style.transition = 'opacity 1.5s ease-in-out';
          
          const playerDiv = document.createElement('div');
          const playerId = 'yt-player-' + Date.now();
          playerDiv.id = playerId;
          videoContainer.appendChild(playerDiv);
          
          const clickBlocker = document.createElement('div');
          clickBlocker.style.position = 'absolute';
          clickBlocker.style.inset = '0';
          clickBlocker.style.zIndex = '10';
          clickBlocker.style.pointerEvents = 'auto'; // intercept all mouse events
          clickBlocker.style.background = 'transparent';
          videoContainer.appendChild(clickBlocker);
          
          bgs[index].style.overflow = 'hidden';
          bgs[index].appendChild(videoContainer);

          const initPlayer = () => {
            new window.YT.Player(playerId, {
              videoId: trailerKey,
              width: '100%',
              height: '100%',
              playerVars: {
                autoplay: 1,
                controls: 0,
                showinfo: 0,
                modestbranding: 1,
                playsinline: 1,
                rel: 0,
                disablekb: 1,
                mute: 1
              },
              events: {
                onReady: (e) => {
                  e.target.mute();
                  e.target.playVideo();
                },
                onStateChange: (e) => {
                  if (e.data === window.YT.PlayerState.PLAYING) {
                    setTimeout(() => {
                      videoContainer.style.opacity = '1';
                    }, 500);
                  } else {
                    videoContainer.style.opacity = '0';
                  }
                }
              }
            });
          };

          if (window.YT && window.YT.Player) {
            initPlayer();
          } else {
            window.onYouTubeIframeAPIReady = initPlayer;
          }
        }
      } catch (err) {
        console.error("Failed to load trailer", err);
      }
    }, 2500); // 2.5 seconds idle time before playing trailer
  };

  updateContent(0);

  if (validItems.length > 1) {
    intervalId = setInterval(() => {
      bgs[currentIndex].classList.remove('sf-active');
      currentIndex = (currentIndex + 1) % validItems.length;
      loadBgImage(currentIndex);
      bgs[currentIndex].classList.add('sf-active');
      
      const nextIndex = (currentIndex + 1) % validItems.length;
      loadBgImage(nextIndex);
      
      updateContent(currentIndex);
    }, 15000); // Increased interval to 15s to allow time to watch the trailer
  }

  container._cleanup = () => {
    if (intervalId) clearInterval(intervalId);
    if (videoTimeoutId) clearTimeout(videoTimeoutId);
  };

  return container;
}
