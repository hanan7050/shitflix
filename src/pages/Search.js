import { createSearchResults } from '../components/SearchOverlay.js';

export async function renderSearch(container, params) {
  container.innerHTML = '';
  
  const hash = window.location.hash;
  const match = hash.match(/^#\/search\/(.+)/);
  const query = match ? decodeURIComponent(match[1]) : '';
  
  const results = createSearchResults(query);
  container.appendChild(results);
  
  return () => {};
}
