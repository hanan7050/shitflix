import { getDetails, getImageUrl, ImageSize, getTitle, getYear, getRuntime, getMediaType, getDate } from '../api.js';
import { isInMyList, toggleMyList, showToast, getGenreNames } from '../state.js';

export function initModal() {
  let root = document.getElementById('sf-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'sf-modal-root';
    document.body.appendChild(root);
  }

  const handleOpen = async (e) => {
    const { item } = e.detail;
    const mediaType = getMediaType(item);
    
    // Create overlay structure
    const overlay = document.createElement('div');
    overlay.className = 'sf-modal-overlay';
    root.innerHTML = '';
    root.appendChild(overlay);
    
    document.body.style.overflow = 'hidden';
    
    try {
      const details = await getDetails(item.id, mediaType);
      
      const title = getTitle(details);
      const imageUrl = details.backdrop_path ? getImageUrl(details.backdrop_path, ImageSize.BACKDROP_LARGE) : '';
      const inList = isInMyList(item.id);
      
      let rating = 'G';
      if (details.vote_average > 7.5) rating = 'TV-MA';
      else if (details.vote_average > 6) rating = 'PG-13';
      else if (details.vote_average > 4) rating = 'PG';
      
      const runtimeDisplay = mediaType === 'movie' 
        ? getRuntime(details.runtime)
        : `${details.number_of_seasons || 1} Season${details.number_of_seasons > 1 ? 's' : ''}`;

      const castNames = details.credits?.cast?.slice(0, 8).map(c => c.name).join(', ') || 'Unknown';
      const genreNames = details.genres?.map(g => g.name).join(', ') || getGenreNames(item.genre_ids).join(', ');
      const description = details.overview || 'No description available.';

      const similarItems = (details.similar?.results || details.recommendations?.results || []).slice(0, 9);
      const similarHtml = similarItems.length > 0 ? `
        <div class="sf-modal-similar">
          <div class="sf-modal-similar-title">More Like This</div>
          <div class="sf-modal-similar-grid">
            ${similarItems.map(sim => `
              <div class="sf-modal-similar-card" data-id="${sim.id}">
                ${sim.backdrop_path 
                  ? `<img src="${getImageUrl(sim.backdrop_path, ImageSize.BACKDROP_SMALL)}" alt="${getTitle(sim)}" loading="lazy" />` 
                  : `<div style="width:100%; aspect-ratio:16/9; background:#181818; display:flex; align-items:center; justify-content:center; text-align:center; padding: 10px; font-size: 0.8rem; font-weight: bold;">${getTitle(sim)}</div>`
                }
                <div class="sf-modal-similar-card-info">
                  <div class="sf-modal-meta">
                    <span>${getYear(getDate(sim))}</span>
                  </div>
                  <div style="font-size:0.8rem; font-weight:bold">${getTitle(sim)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '';

      const trailerKey = details.videos && details.videos.results 
        ? details.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key || details.videos.results.find(v => v.site === 'YouTube')?.key
        : null;

      const playerId = `sf-modal-player-${Date.now()}`;

      const modalHtml = `
        <div class="sf-modal" role="dialog" aria-modal="true">
          <button class="sf-modal-close" aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
          </button>
          
          <div class="sf-modal-header">
            ${trailerKey 
              ? `<div id="${playerId}" style="width:100%; height:130%; position:absolute; top:-15%; left:0; pointer-events:none; opacity:0; transition: opacity 0.5s ease-in-out;"></div>` 
              : (imageUrl ? `<img class="sf-modal-backdrop" src="${imageUrl}" alt="${title}" />` : `<div style="width:100%; height:100%; background:linear-gradient(45deg, #181818, #383838);"></div>`)
            }
            <div class="sf-modal-header-gradient"></div>
            <div class="sf-modal-header-content">
              <h1 class="sf-modal-title">${title}</h1>
              <div class="sf-modal-header-buttons">
                <button class="sf-card-action-btn sf-play-btn" style="width:auto; padding: 0 24px; border-radius: 4px; gap: 8px; font-weight: bold; background: white; color: black; border:none;">
                  <svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                  Play
                </button>
                <button class="sf-card-action-btn sf-list-btn" aria-label="${inList ? 'Remove from My List' : 'Add to My List'}">
                  ${inList 
                    ? `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>` 
                    : `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg>`
                  }
                </button>
                <button class="sf-card-action-btn sf-like-btn" aria-label="Like">
                  <svg viewBox="0 0 24 24" width="18" height="18"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" fill="currentColor"/></svg>
                </button>
              </div>
            </div>
          </div>
          
          <div class="sf-modal-body">
            <div>
              <div class="sf-modal-meta">
                <span>${getYear(getDate(details))}</span>
                <span class="sf-maturity">${rating}</span>
                <span>${runtimeDisplay}</span>
              </div>
              <p class="sf-modal-description">${description}</p>
            </div>
            
            <div class="sf-modal-sidebar">
              <div class="sf-modal-sidebar-section">
                <strong>Cast:</strong> <span>${castNames}</span>
              </div>
              <div class="sf-modal-sidebar-section">
                <strong>Genres:</strong> <span>${genreNames}</span>
              </div>
            </div>
            
            ${similarHtml}
          </div>
        </div>
      `;
      
      overlay.innerHTML = modalHtml;

      // Initialize YouTube player if trailer exists
      if (trailerKey) {
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
              mute: 1, // Autoplay requires mute in most browsers
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3
            },
            events: {
              onReady: (e) => {
                e.target.playVideo();
              },
              onStateChange: (e) => {
                const iframe = document.getElementById(playerId);
                if (e.data === window.YT.PlayerState.PLAYING) {
                  if (iframe) iframe.style.opacity = '1';
                } else {
                  if (iframe) iframe.style.opacity = '0';
                }
                
                // If it ends, play again
                if (e.data === window.YT.PlayerState.ENDED) {
                  e.target.playVideo();
                }
              }
            }
          });
        };

        if (window.YT && window.YT.Player) {
          initPlayer();
        } else {
          // If script not loaded yet, inject it
          if (!document.getElementById('yt-api-script')) {
            const tag = document.createElement('script');
            tag.id = 'yt-api-script';
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
          }
          // YouTube API calls this function when ready
          const oldCallback = window.onYouTubeIframeAPIReady;
          window.onYouTubeIframeAPIReady = () => {
            if (oldCallback) oldCallback();
            initPlayer();
          };
        }
      }
      
      const closeModal = () => {
        document.body.style.overflow = '';
        root.innerHTML = '';
      };

      const closeBtn = overlay.querySelector('.sf-modal-close');
      closeBtn.addEventListener('click', closeModal);
      
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) closeModal();
      });

      const keyHandler = (ev) => {
        if (ev.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', keyHandler);
        }
      };
      document.addEventListener('keydown', keyHandler);

      const playBtn = overlay.querySelector('.sf-play-btn');
      playBtn.addEventListener('click', () => {
        closeModal();
        window.location.hash = `#/player/${mediaType}/${item.id}`;
      });

      const listBtn = overlay.querySelector('.sf-list-btn');
      listBtn.addEventListener('click', () => {
        const isNowInList = toggleMyList(item);
        listBtn.innerHTML = isNowInList 
          ? `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>` 
          : `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg>`;
        listBtn.setAttribute('aria-label', isNowInList ? 'Remove from My List' : 'Add to My List');
        showToast(isNowInList ? 'Added to My List' : 'Removed from My List');
      });
      
      // Setup similar cards click
      const similarCards = overlay.querySelectorAll('.sf-modal-similar-card');
      similarCards.forEach((card, index) => {
        card.addEventListener('click', () => {
          const simItem = similarItems[index];
          // Close current and open new
          closeModal();
          document.dispatchEvent(new CustomEvent('sf:open-modal', { detail: { item: simItem } }));
        });
      });
      
    } catch (err) {
      console.error(err);
      overlay.innerHTML = `<div class="sf-modal" style="padding: 40px; text-align: center; color: white;">Error loading details. <button class="sf-modal-close" style="position:static; margin: 20px auto;">Close</button></div>`;
      overlay.querySelector('button').addEventListener('click', () => {
        document.body.style.overflow = '';
        root.innerHTML = '';
      });
    }
  };

  document.addEventListener('sf:open-modal', handleOpen);

  return () => {
    document.removeEventListener('sf:open-modal', handleOpen);
  };
}
