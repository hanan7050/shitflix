import { getImageUrl, ImageSize, getTitle, getYear, getDate, getMediaType } from '../api.js';
import { isInMyList, toggleMyList, showToast, getGenreNames } from '../state.js';

export function createMovieCard(item) {
  const card = document.createElement('div');
  card.className = 'sf-card';
  card.tabIndex = 0;
  
  const title = getTitle(item);
  card.setAttribute('aria-label', title);
  
  const mediaType = getMediaType(item);
  const imagePath = item.backdrop_path || item.poster_path;
  const imageUrl = imagePath ? getImageUrl(imagePath, ImageSize.BACKDROP_MEDIUM) : '';
  
  let rating = 'G';
  if (item.vote_average > 7.5) rating = 'TV-MA';
  else if (item.vote_average > 6) rating = 'PG-13';
  else if (item.vote_average > 4) rating = 'PG';

  const inList = isInMyList(item.id);
  const addIcon = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg>`;
  const checkIcon = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>`;

  card.innerHTML = `
    <div class="sf-card-poster-wrap">
      ${imageUrl 
        ? `<img class="sf-card-poster" src="${imageUrl}" loading="lazy" alt="${title}" />` 
        : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:linear-gradient(45deg, #181818, #383838); padding: 10px; text-align:center; font-size: 0.8rem; font-weight: bold;">${title}</div>`
      }
    </div>
    <div class="sf-card-info">
      <div class="sf-card-title">${title}</div>
      <div class="sf-card-actions">
        <button class="sf-card-action-btn sf-play-btn" aria-label="Play">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
        </button>
        <button class="sf-card-action-btn sf-list-btn" aria-label="${inList ? 'Remove from My List' : 'Add to My List'}">
          ${inList ? checkIcon : addIcon}
        </button>
        <button class="sf-card-action-btn sf-like-btn" aria-label="Like">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" fill="currentColor"/></svg>
        </button>
        <button class="sf-card-action-btn sf-card-expand-btn" aria-label="More Info">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/></svg>
        </button>
      </div>
      <div class="sf-card-meta">

        <span class="sf-maturity">${rating}</span>
        <span>${getYear(getDate(item))}</span>
      </div>
      <div class="sf-card-genres">
        ${getGenreNames(item.genre_ids).slice(0,3).join(' &bull; ')}
      </div>
    </div>
  `;

  const playBtn = card.querySelector('.sf-play-btn');
  const listBtn = card.querySelector('.sf-list-btn');
  const expandBtn = card.querySelector('.sf-card-expand-btn');

  const openPlayer = (e) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    showToast('Loading Player...');
    window.location.hash = `/player/${mediaType}/${item.id}`;
  };

  card.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('.sf-card-action-btn');
    if (actionBtn) {
      e.preventDefault();
      e.stopPropagation();
      
      if (actionBtn.classList.contains('sf-play-btn')) {
        openPlayer(e);
      } else if (actionBtn.classList.contains('sf-list-btn')) {
        const isNowInList = toggleMyList(item);
        actionBtn.innerHTML = isNowInList ? checkIcon : addIcon;
        actionBtn.setAttribute('aria-label', isNowInList ? 'Remove from My List' : 'Add to My List');
        showToast(isNowInList ? 'Added to My List' : 'Removed from My List');
      } else if (actionBtn.classList.contains('sf-like-btn')) {
        showToast('Liked!');
      } else if (actionBtn.classList.contains('sf-card-expand-btn')) {
        showToast('Opening Details...');
        document.dispatchEvent(new CustomEvent('sf:open-modal', { detail: { item } }));
      }
      return;
    }
    
    // Fallback: click on the rest of the card
    openPlayer(e);
  });

  // D-pad Enter support for Android TV
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.classList.contains('sf-card-action-btn')) {
          activeEl.click();
      } else {
          openPlayer(e);
      }
    }
  });

  return card;
}
