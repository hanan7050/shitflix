// ============================================
// SHITFLIX — TMDB API Wrapper
// ============================================

const BASE_URL = 'https://api.tmdb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/';

export const ImageSize = {
  BACKDROP_LARGE: 'original',
  BACKDROP_MEDIUM: 'w1280',
  BACKDROP_SMALL: 'w780',
  POSTER_LARGE: 'w500',
  POSTER_MEDIUM: 'w342',
  POSTER_SMALL: 'w185',
  POSTER_TINY: 'w92',
  PROFILE: 'w185',
  STILL: 'w300',
};

export function getImageUrl(path, size = ImageSize.POSTER_MEDIUM) {
  if (!path) return null;
  return `${IMG_BASE}${size}${path}`;
}

export function getApiKey() {
  return 'c29379565234e20d7cbf4f2e835c3e41';
}

export function setApiKey(key) {
  // no-op since it's hardcoded
}

export function hasApiKey() {
  return true;
}

export async function getMapping(tmdbId, mediaType) {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const res = await fetch(`${API_BASE_URL}/api/mapping/${mediaType}/${tmdbId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchTMDB(endpoint, params = {}) {
  const apiKey = getApiKey();

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'en-US');

  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null) {
      url.searchParams.set(key, val);
    }
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.status_message || `TMDB Error: ${res.status}`);
  }
  return res.json();
}

// ---- Trending ----
export function getTrending(mediaType = 'all', timeWindow = 'week') {
  return fetchTMDB(`/trending/${mediaType}/${timeWindow}`);
}

// ---- Movies ----
export function getPopularMovies(page = 1) {
  return fetchTMDB('/movie/popular', { page });
}

export function getTopRatedMovies(page = 1) {
  return fetchTMDB('/movie/top_rated', { page });
}

export function getUpcomingMovies(page = 1) {
  return fetchTMDB('/movie/upcoming', { page });
}

export function getNowPlayingMovies(page = 1) {
  return fetchTMDB('/movie/now_playing', { page });
}

export function getMovieDetails(id) {
  return fetchTMDB(`/movie/${id}`, { append_to_response: 'videos,credits,similar,recommendations' });
}

export function discoverMovies(params = {}) {
  return fetchTMDB('/discover/movie', { sort_by: 'popularity.desc', ...params });
}

// ---- Regional / Language Discovery ----

/**
 * Fetch top Malayalam movies from TMDB.
 * Uses with_original_language=ml and region=IN.
 */
export function getMalayalamMovies(page = 1) {
  const minDate = new Date();
  minDate.setMonth(minDate.getMonth() - 3);
  
  return fetchTMDB('/discover/movie', {
    sort_by: 'popularity.desc',
    with_original_language: 'ml',
    region: 'IN',
    'vote_count.gte': 5,
    'primary_release_date.gte': minDate.toISOString().split('T')[0],
    page,
  });
}

/**
 * Fetch top South Indian movies from TMDB.
 * South Indian languages: Tamil (ta), Telugu (te), Kannada (kn), Malayalam (ml).
 * TMDB doesn't support OR on language so we fetch all four in parallel.
 */
export async function getSouthIndianMovies() {
  const minDate = new Date();
  minDate.setMonth(minDate.getMonth() - 3);
  const minDateStr = minDate.toISOString().split('T')[0];

  const langs = ['ta', 'te', 'kn', 'ml'];
  const results = await Promise.allSettled(
    langs.map(lang =>
      fetchTMDB('/discover/movie', {
        sort_by: 'popularity.desc',
        with_original_language: lang,
        region: 'IN',
        'vote_count.gte': 5,
        'primary_release_date.gte': minDateStr,
        page: 1,
      })
    )
  );

  const seen = new Set();
  const combined = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.results) {
      for (const item of r.value.results) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          combined.push({ ...item, media_type: 'movie' });
        }
      }
    }
  }
  // Sort by popularity descending and return top 20
  return combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
}

/**
 * Fetch the TMDB IDs that are present in the Telegram catalog.
 * Returns a Set of "type:id" strings for fast lookup.
 */
export async function getCatalogIdSet() {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const res = await fetch(`${API_BASE_URL}/api/catalog/ids`);
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set((data.ids || []).map(e => `${e.type}:${e.id}`));
  } catch {
    return new Set();
  }
}

/**
 * Filter a TMDB results array to only include items that exist in the catalog.
 */
export function filterByCatalog(items, catalogIdSet, mediaType = 'movie') {
  return items.filter(item => {
    const type = item.media_type || mediaType;
    return catalogIdSet.has(`${type}:${String(item.id)}`);
  });
}


export function getPopularTV(page = 1) {
  return fetchTMDB('/tv/popular', { page });
}

export function getTopRatedTV(page = 1) {
  return fetchTMDB('/tv/top_rated', { page });
}

export function getTVDetails(id) {
  return fetchTMDB(`/tv/${id}`, { append_to_response: 'videos,credits,similar,recommendations' });
}

export function discoverTV(params = {}) {
  return fetchTMDB('/discover/tv', { sort_by: 'popularity.desc', ...params });
}

// ---- Genres ----
export function getMovieGenres() {
  return fetchTMDB('/genre/movie/list');
}

export function getTVGenres() {
  return fetchTMDB('/genre/tv/list');
}

// ---- Search ----
export function searchMulti(query, page = 1) {
  return fetchTMDB('/search/multi', { query, page });
}

// ---- Utility ----
export function getDetails(id, type = 'movie') {
  return type === 'tv' ? getTVDetails(id) : getMovieDetails(id);
}

export function getTrailerKey(videos) {
  if (!videos || !videos.results) return null;
  const trailer = videos.results.find(
    (v) => v.type === 'Trailer' && v.site === 'YouTube'
  ) || videos.results.find(
    (v) => v.site === 'YouTube'
  );
  return trailer ? trailer.key : null;
}

export function getYear(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('-')[0];
}

export function getRuntime(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function getMediaType(item) {
  if (item.media_type) return item.media_type;
  if (item.title || item.release_date) return 'movie';
  if (item.name || item.first_air_date) return 'tv';
  return 'movie';
}

export function getTitle(item) {
  return item.title || item.name || 'Untitled';
}

export function getDate(item) {
  return item.release_date || item.first_air_date || '';
}

// Validate API key
export async function validateApiKey(key) {
  const oldKey = getApiKey();
  setApiKey(key);
  try {
    await fetchTMDB('/configuration');
    return true;
  } catch {
    setApiKey(oldKey);
    return false;
  }
}
