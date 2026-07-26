import { getImageUrl, ImageSize, getTitle, getMediaType } from '../api.js';

export function createSearchResults(query) {
  const container = document.createElement('div');
  container.className = 'sf-search-page sf-page';
  
  if (!query) return container;

  const heading = document.createElement('div');
  heading.className = 'sf-search-heading';
  heading.innerHTML = `Results for "<strong>${query}</strong>"`;
  container.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'sf-search-grid';
  container.appendChild(grid);

  // Skeletons
  for (let i = 0; i < 12; i++) {
    const skel = document.createElement('div');
    skel.className = 'sf-search-result-card';
    skel.innerHTML = '<div style="width: 100%; aspect-ratio: 2/3; background: #2f2f2f; animation: pulse 1.5s infinite"></div>';
    grid.appendChild(skel);
  }

  fetch('http://localhost:3000/api/catalog')
    .then(res => res.json())
    .then(data => {
      grid.innerHTML = '';
      if (!data || !data.results) throw new Error('No data');
      
      const q = query.toLowerCase();
      const filtered = data.results.filter(item => getTitle(item).toLowerCase().includes(q));
      
      if (filtered.length === 0) {
        container.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'sf-search-empty';
        empty.innerHTML = `
          <h2>No results found for "${query}"</h2>
          <p>Suggestions: Try different keywords, looking for a movie or TV show, or using a movie, TV show, or actor's name.</p>
        `;
        container.appendChild(empty);
        return;
      }

      filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'sf-search-result-card';
        
        const title = getTitle(item);
        const imgUrl = item.poster_path ? getImageUrl(item.poster_path, ImageSize.POSTER_MEDIUM) : '';
        
        card.innerHTML = `
          ${imgUrl ? `<img src="${imgUrl}" alt="${title}" loading="lazy">` : `<div style="width:100%; aspect-ratio:2/3; background:#222; display:flex; align-items:center; justify-content:center; text-align:center; padding:8px">${title}</div>`}
          <div class="sf-search-result-card-title">${title}</div>
        `;
        
        card.addEventListener('click', () => {
          const type = getMediaType(item);
          document.dispatchEvent(new CustomEvent('sf:open-modal', {
            detail: { item, type }
          }));
        });
        
        grid.appendChild(card);
      });
    })
    .catch(err => {
      console.error(err);
      grid.innerHTML = '';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'sf-search-empty';
      errorDiv.innerHTML = `<h2>Oops, something went wrong</h2><p>Please try again later.</p>`;
      container.appendChild(errorDiv);
    });

  return container;
}
