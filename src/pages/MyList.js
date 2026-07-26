import { getMyList, subscribe } from '../state.js';
import { createMovieCard } from '../components/MovieCard.js';

export async function renderMyList(container) {
  container.innerHTML = '';
  
  const page = document.createElement('div');
  page.className = 'sf-page sf-search-page'; // Reuse padding from search page
  container.appendChild(page);
  
  const render = () => {
    page.innerHTML = '';
    const items = getMyList();
    
    const heading = document.createElement('div');
    heading.className = 'sf-search-heading';
    heading.innerHTML = '<strong>My List</strong>';
    page.appendChild(heading);
    
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sf-search-empty';
      empty.innerHTML = `
        <svg viewBox="0 0 24 24" width="64" height="64" style="margin-bottom: 16px; opacity: 0.5;">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="currentColor"/>
        </svg>
        <h2>Your list is empty</h2>
        <p>Add movies and TV shows to your list to watch them later.</p>
        <button style="margin-top: 24px; padding: 12px 24px; background: white; color: black; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;" onclick="window.location.hash = '#/'">Browse</button>
      `;
      page.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'sf-search-grid';
      items.forEach(item => {
        grid.appendChild(createMovieCard(item));
      });
      page.appendChild(grid);
    }
  };
  
  render();
  const unsubscribe = subscribe('myList', render);
  
  return () => {
    unsubscribe();
  };
}
