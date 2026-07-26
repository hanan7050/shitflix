import { createHeroBanner } from '../components/HeroBanner.js';
import { createContentRow } from '../components/ContentRow.js';
import {
  getMalayalamMovies,
  getSouthIndianMovies,
  getCatalogIdSet,
  filterByCatalog,
} from '../api.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function renderHome(container) {
  container.innerHTML = '';
  
  const page = document.createElement('div');
  page.className = 'sf-page';
  
  const skeletonHero = document.createElement('div');
  skeletonHero.style.cssText = 'width:100%;height:80vh;background:#222;animation:pulse 1.5s infinite';
  page.appendChild(skeletonHero);
  
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div');
    s.style.cssText = 'width:100%;height:150px;background:#111;margin-top:20px;animation:pulse 1.5s infinite';
    page.appendChild(s);
  }
  
  container.appendChild(page);

  let heroCleanup = null;

  try {
    // Fetch local catalog + catalog ID set in parallel
    const [localRes, catalogIdSet] = await Promise.all([
      fetch(`${API_BASE}/api/catalog`).catch(() => ({ ok: false })),
      getCatalogIdSet(),
    ]);

    let localLibrary = [];
    if (localRes && localRes.ok) {
      const data = await localRes.json();
      localLibrary = data.results || [];
    }

    page.innerHTML = '';
    
    // Helper: check if item was released recently (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const minDateStr = threeMonthsAgo.toISOString().split('T')[0];

    const isRecent = (item) => {
      const date = item.release_date || item.first_air_date;
      return date && date >= minDateStr;
    };

    // Filter local library so the ENTIRE home page only shows recent releases
    localLibrary = localLibrary.filter(isRecent);

    if (localLibrary.length === 0) {
      page.innerHTML = '<div style="padding:100px;text-align:center;color:white"><h2>No Recent Content</h2><p>Check back later for new releases.</p></div>';
      return () => {};
    }

    // Hero banner
    const heroItems = [...localLibrary].sort(() => 0.5 - Math.random()).slice(0, 10);
    const hero = createHeroBanner(heroItems);
    page.appendChild(hero);
    heroCleanup = hero._cleanup;

    // ── Prepare all rows ──────────────────────────────────────────
    const rows = [];

    // Helper: add a numbered badge (Top 10 style) to items
    const withRank = (items) => items.slice(0, 10).map((item, i) => ({ ...item, _rank: i + 1 }));

    // Fetch regional rows from TMDB, filtered by Telegram catalog
    const [mlData, siItems] = await Promise.all([
      getMalayalamMovies().catch(() => ({ results: [] })),
      getSouthIndianMovies().catch(() => ([])),
    ]);

    // 1. Recently Added (Filtered to recent releases)
    // Since localLibrary is already filtered, we can just use it directly
    rows.push(createContentRow('Recently Added', localLibrary.slice(0, 20)));

    // 2. Popular Movies
    const movies = localLibrary.filter(item => item.media_type === 'movie' || (!item.first_air_date && !item.name));
    if (movies.length > 0) {
      const popularMovies = [...movies].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
      rows.push(createContentRow('Popular Movies', popularMovies));
    }

    // 3. Malayalam Top 10
    const mlItems = filterByCatalog(mlData.results || [], catalogIdSet, 'movie');
    if (mlItems.length > 0) {
      rows.push(createContentRow('Malayalam Top 10', withRank(mlItems), { showRank: true }));
    }

    // 4. South Indian Top 10
    const filteredSi = filterByCatalog(siItems || [], catalogIdSet, 'movie');
    if (filteredSi.length > 0) {
      rows.push(createContentRow('South Indian Top 10', withRank(filteredSi), { showRank: true }));
    }

    // 5. TV Shows
    const tvShows = localLibrary.filter(item => item.media_type === 'tv' || item.first_air_date || item.name);
    if (tvShows.length > 0) {
      rows.push(createContentRow('TV Shows', tvShows.slice(0, 20)));
    }

    // Genre rows
    const actionItems = localLibrary.filter(item => item.genre_ids && (item.genre_ids.includes(28) || item.genre_ids.includes(10759)));
    if (actionItems.length > 0) rows.push(createContentRow('Action & Adventure', actionItems.slice(0, 20)));

    const comedyItems = localLibrary.filter(item => item.genre_ids && item.genre_ids.includes(35));
    if (comedyItems.length > 0) rows.push(createContentRow('Comedy', comedyItems.slice(0, 20)));

    const dramaItems = localLibrary.filter(item => item.genre_ids && item.genre_ids.includes(18));
    if (dramaItems.length > 0) rows.push(createContentRow('Drama', dramaItems.slice(0, 20)));

    const topRated = [...localLibrary].filter(item => item.vote_average > 7).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    if (topRated.length > 0) rows.push(createContentRow('Top Rated', topRated.slice(0, 20)));

    // Append all rows in order
    rows.forEach(row => page.appendChild(row));

  } catch (error) {
    console.error(error);
    page.innerHTML = `<div style="padding:100px;text-align:center;color:white;word-break:break-all;">Failed to load catalog. Error: ${error.message}<br><br>${error.stack}</div>`;
  }

  return () => {
    if (heroCleanup) heroCleanup();
  };
}
