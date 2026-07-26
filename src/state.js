// ============================================
// SHITFLIX — State Management
// ============================================

const state = {
  myList: JSON.parse(localStorage.getItem('sf_my_list') || '[]'),
  genres: { movie: [], tv: [] },
  genreMap: {},
  cachedData: {},
};

const listeners = new Map();

// ---- My List ----
export function getMyList() {
  return [...state.myList];
}

export function isInMyList(id) {
  return state.myList.some((item) => item.id === id);
}

export function addToMyList(item) {
  if (isInMyList(item.id)) return;
  const entry = {
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    media_type: item.media_type || (item.title ? 'movie' : 'tv'),
    vote_average: item.vote_average,
    overview: item.overview,
    release_date: item.release_date || item.first_air_date,
    genre_ids: item.genre_ids || (item.genres ? item.genres.map(g => g.id) : []),
  };
  state.myList.unshift(entry);
  persistMyList();
  notify('myList');
}

export function removeFromMyList(id) {
  state.myList = state.myList.filter((item) => item.id !== id);
  persistMyList();
  notify('myList');
}

export function toggleMyList(item) {
  if (isInMyList(item.id)) {
    removeFromMyList(item.id);
    return false;
  } else {
    addToMyList(item);
    return true;
  }
}

function persistMyList() {
  localStorage.setItem('sf_my_list', JSON.stringify(state.myList));
}

// ---- Genres ----
export function setGenres(type, genres) {
  state.genres[type] = genres;
  genres.forEach((g) => {
    state.genreMap[g.id] = g.name;
  });
}

export function getGenres(type) {
  return state.genres[type] || [];
}

export function getGenreName(id) {
  return state.genreMap[id] || '';
}

export function getGenreNames(ids = []) {
  return ids.map((id) => state.genreMap[id]).filter(Boolean);
}

// ---- Cache ----
export function cacheData(key, data, ttlMs = 5 * 60 * 1000) {
  state.cachedData[key] = {
    data,
    expires: Date.now() + ttlMs,
  };
}

export function getCachedData(key) {
  const cached = state.cachedData[key];
  if (!cached) return null;
  if (Date.now() > cached.expires) {
    delete state.cachedData[key];
    return null;
  }
  return cached.data;
}

// ---- Event Listeners ----
export function subscribe(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
  return () => listeners.get(event)?.delete(callback);
}

function notify(event, data) {
  listeners.get(event)?.forEach((cb) => cb(data));
}

// ---- Toast ----
export function showToast(message, duration = 3000) {
  const root = document.getElementById('sf-toast-root');
  if (!root) return;

  const toast = document.createElement('div');
  toast.className = 'sf-toast';
  toast.textContent = message;
  root.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('sf-toast-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ---- Utility ----
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
