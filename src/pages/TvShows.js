import { createHeroBanner } from '../components/HeroBanner.js';
import { createContentRow } from '../components/ContentRow.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function renderTvShows(container) {
  container.innerHTML = '';
  
  const page = document.createElement('div');
  page.className = 'sf-page';
  
  const skeletonHero = document.createElement('div');
  skeletonHero.style.width = '100%';
  skeletonHero.style.height = '80vh';
  skeletonHero.style.background = '#222';
  skeletonHero.style.animation = 'pulse 1.5s infinite';
  page.appendChild(skeletonHero);
  
  for (let i = 0; i < 4; i++) {
    const skeletonRow = document.createElement('div');
    skeletonRow.style.width = '100%';
    skeletonRow.style.height = '150px';
    skeletonRow.style.background = '#111';
    skeletonRow.style.marginTop = '20px';
    skeletonRow.style.animation = 'pulse 1.5s infinite';
    page.appendChild(skeletonRow);
  }
  
  container.appendChild(page);

  let heroCleanup = null;

  try {
    const localRes = await fetch(`${API_BASE}/api/catalog`).catch(() => ({ ok: false }));

    let localLibrary = [];
    if (localRes && localRes.ok) {
      const data = await localRes.json();
      localLibrary = data.results || [];
    }

    page.innerHTML = '';
    
    // Filter localLibrary to only TV shows
    const localShows = localLibrary.filter(item => item.media_type === 'tv' || item.first_air_date || item.name);
    
    if (localShows.length === 0) {
      page.innerHTML = '<div style="padding: 100px; text-align: center; color: white;"><h2>Your TV Show Library is Empty</h2><p>Sync your Telegram channel to see TV Shows here.</p></div>';
      return () => {};
    }

    const sortByPopularity = (a, b) => (b.popularity || 0) - (a.popularity || 0);
    const sortByRating = (a, b) => (b.vote_average || 0) - (a.vote_average || 0);
    const sortByDate = (a, b) => new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0);

    const fTrending = [...localShows].sort(sortByPopularity).slice(0, 20);
    const fTopRated = [...localShows].sort(sortByRating).slice(0, 20);
    const fRecent = [...localShows].sort(sortByDate).slice(0, 20);
    
    const shuffledHero = [...localShows].sort(() => 0.5 - Math.random()).slice(0, 10);
    
    const hero = createHeroBanner(shuffledHero);
    page.appendChild(hero);
    heroCleanup = hero._cleanup;

    if (fRecent.length > 0) page.appendChild(createContentRow('Recently Added in Library', fRecent));
    if (fTrending.length > 0) page.appendChild(createContentRow('Trending TV Shows in Library', fTrending));
    if (fTopRated.length > 0) page.appendChild(createContentRow('Top Rated TV Shows', fTopRated));

    // By Genre
    const actionShows = localShows.filter(item => item.genre_ids && (item.genre_ids.includes(10759) || item.genre_ids.includes(28)));
    if (actionShows.length > 0) page.appendChild(createContentRow('Action & Adventure', actionShows));

    const comedyShows = localShows.filter(item => item.genre_ids && item.genre_ids.includes(35));
    if (comedyShows.length > 0) page.appendChild(createContentRow('Comedy TV Shows', comedyShows));

    const dramaShows = localShows.filter(item => item.genre_ids && item.genre_ids.includes(18));
    if (dramaShows.length > 0) page.appendChild(createContentRow('Drama TV Shows', dramaShows));

  } catch (error) {
    console.error(error);
    page.innerHTML = '<div style="padding: 100px; text-align: center; color: white;">Failed to load content. Please try again later.</div>';
  }

  return () => {
    if (heroCleanup) heroCleanup();
  };
}
