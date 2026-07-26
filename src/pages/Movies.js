import { createHeroBanner } from '../components/HeroBanner.js';
import { createContentRow } from '../components/ContentRow.js';

export async function renderMovies(container) {
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
    const localRes = await fetch('http://localhost:3000/api/catalog').catch(() => ({ ok: false }));

    let localLibrary = [];
    if (localRes && localRes.ok) {
      const data = await localRes.json();
      localLibrary = data.results || [];
    }

    page.innerHTML = '';
    
    // Filter localLibrary to only movies
    const localMovies = localLibrary.filter(item => item.media_type === 'movie' || (!item.first_air_date && !item.name));
    
    if (localMovies.length === 0) {
      page.innerHTML = '<div style="padding: 100px; text-align: center; color: white;"><h2>Your Movie Library is Empty</h2><p>Sync your Telegram channel to see movies here.</p></div>';
      return () => {};
    }

    const sortByPopularity = (a, b) => (b.popularity || 0) - (a.popularity || 0);
    const sortByRating = (a, b) => (b.vote_average || 0) - (a.vote_average || 0);
    const sortByDate = (a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0);

    const fTrending = [...localMovies].sort(sortByPopularity).slice(0, 20);
    const fTopRated = [...localMovies].sort(sortByRating).slice(0, 20);
    const fRecent = [...localMovies].sort(sortByDate).slice(0, 20);
    
    const shuffledHero = [...localMovies].sort(() => 0.5 - Math.random()).slice(0, 10);
    
    const hero = createHeroBanner(shuffledHero);
    page.appendChild(hero);
    heroCleanup = hero._cleanup;


    // General Rows
    if (fRecent.length > 0) page.appendChild(createContentRow('Recently Added (By Release)', fRecent));
    if (fTopRated.length > 0) page.appendChild(createContentRow('Top Rated Movies', fTopRated));
    if (fAction.length > 0) page.appendChild(createContentRow('Action Movies', fAction));
    if (fThriller.length > 0) page.appendChild(createContentRow('Thriller Movies', fThriller));
    if (fAnimation.length > 0) page.appendChild(createContentRow('Animation', fAnimation));
    if (fRomance.length > 0) page.appendChild(createContentRow('Romance Movies', fRomance));

  } catch (error) {
    console.error(error);
    page.innerHTML = '<div style="padding: 100px; text-align: center; color: white;">Failed to load content. Please try again later.</div>';
  }

  return () => {
    if (heroCleanup) heroCleanup();
  };
}
