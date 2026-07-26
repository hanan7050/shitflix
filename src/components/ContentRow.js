import { createMovieCard } from './MovieCard.js';

export function createContentRow(title, items) {
  const row = document.createElement('section');
  row.className = 'sf-row';

  row.innerHTML = `
    <div class="sf-row-header">
      <div class="sf-row-title">
        ${title}
        <div class="sf-row-explore">
          Explore All
          <svg viewBox="0 0 24 24" width="12" height="12"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/></svg>
        </div>
      </div>
    </div>
    <div class="sf-row-container">
      <button class="sf-row-arrow sf-row-arrow--left sf-hidden" aria-label="Scroll Left">
        <svg viewBox="0 0 24 24" width="28" height="28"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/></svg>
      </button>
      <div class="sf-row-slider-wrap">
        <div class="sf-row-scroller"></div>
      </div>
      <button class="sf-row-arrow sf-row-arrow--right" aria-label="Scroll Right">
        <svg viewBox="0 0 24 24" width="28" height="28"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/></svg>
      </button>
    </div>
  `;

  const wrap = row.querySelector('.sf-row-slider-wrap');
  const scroller = row.querySelector('.sf-row-scroller');
  const leftArrow = row.querySelector('.sf-row-arrow--left');
  const rightArrow = row.querySelector('.sf-row-arrow--right');

  items.forEach(item => {
    scroller.appendChild(createMovieCard(item));
  });

  let currentTranslate = 0;
  
  const getVisibleWidth = () => {
    return wrap.clientWidth;
  };

  const updateArrows = () => {
    if (currentTranslate >= 0) {
      leftArrow.classList.add('sf-hidden');
    } else {
      leftArrow.classList.remove('sf-hidden');
    }
    
    const maxTranslate = -(scroller.scrollWidth - wrap.clientWidth);
    if (currentTranslate <= maxTranslate + 5) { // 5px buffer
      rightArrow.classList.add('sf-hidden');
    } else {
      rightArrow.classList.remove('sf-hidden');
    }
  };

  leftArrow.addEventListener('click', () => {
    currentTranslate += getVisibleWidth();
    if (currentTranslate > 0) currentTranslate = 0;
    scroller.style.transform = `translateX(${currentTranslate}px)`;
    updateArrows();
  });

  rightArrow.addEventListener('click', () => {
    currentTranslate -= getVisibleWidth();
    const maxTranslate = -(scroller.scrollWidth - wrap.clientWidth);
    if (currentTranslate < maxTranslate) currentTranslate = maxTranslate;
    scroller.style.transform = `translateX(${currentTranslate}px)`;
    updateArrows();
  });

  // Initial check once element is likely painted
  setTimeout(updateArrows, 100);
  window.addEventListener('resize', () => {
    // Reset on resize to prevent weird states
    currentTranslate = 0;
    scroller.style.transform = `translateX(0px)`;
    updateArrows();
  });

  return row;
}
