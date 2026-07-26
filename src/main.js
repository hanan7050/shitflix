// ============================================
// SHITFLIX — App Entry Point
// ============================================

// --- Styles ---
import './styles/index.css';
import './styles/navbar.css';
import './styles/hero.css';
import './styles/row.css';
import './styles/card.css';
import './styles/modal.css';
import './styles/player.css';
import './styles/search.css';
import './styles/footer.css';

// --- Core ---
import { hasApiKey, setApiKey, validateApiKey, getMovieGenres, getTVGenres } from './api.js';
import { setGenres } from './state.js';
import { registerRoute, initRouter, handleRoute } from './router.js';

// --- Components ---
import { createNavbar } from './components/Navbar.js';
import { createFooter } from './components/Footer.js';
import { initModal } from './components/Modal.js';

// --- Pages ---
import { renderHome } from './pages/Home.js';
import { renderTvShows } from './pages/TvShows.js';
import { renderMovies } from './pages/Movies.js';
import { renderMyList } from './pages/MyList.js';
import { renderSearch } from './pages/Search.js';
import { renderPlayer } from './pages/Player.js';

// ============================================
// API Key Prompt
// ============================================
function showApiKeyPrompt() {
  const app = document.getElementById('app');
  const loading = document.getElementById('sf-loading-screen');
  if (loading) loading.classList.add('sf-hidden');

  app.innerHTML = `
    <div class="sf-api-prompt">
      <div class="sf-api-prompt-card">
        <span class="sf-logo-text" style="display:inline-block; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">S</span>
        <h2>Welcome to Shitflix</h2>
        <p>
          To get started, you need a free TMDB API key.<br/>
          Get one at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a>
        </p>
        <div class="sf-api-input-group">
          <input type="text" class="sf-api-input" id="sf-api-key-input" placeholder="Paste your API key here..." autocomplete="off" />
          <button class="sf-api-submit" id="sf-api-key-submit">Go</button>
        </div>
        <div class="sf-api-error" id="sf-api-error"></div>
      </div>
    </div>
  `;

  const input = document.getElementById('sf-api-key-input');
  const btn = document.getElementById('sf-api-key-submit');
  const error = document.getElementById('sf-api-error');

  async function submit() {
    const key = input.value.trim();
    if (!key) {
      error.textContent = 'Please enter your API key';
      return;
    }

    btn.textContent = 'Validating...';
    btn.disabled = true;
    error.textContent = '';

    const valid = await validateApiKey(key);
    if (valid) {
      initApp();
    } else {
      error.textContent = 'Invalid API key. Please check and try again.';
      btn.textContent = 'Go';
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  // Focus input
  setTimeout(() => input.focus(), 300);
}

// ============================================
// Load Genres (cached globally)
// ============================================
async function loadGenres() {
  try {
    const [movieGenres, tvGenres] = await Promise.all([
      getMovieGenres(),
      getTVGenres(),
    ]);
    setGenres('movie', movieGenres.genres || []);
    setGenres('tv', tvGenres.genres || []);
  } catch (err) {
    console.warn('Failed to load genres:', err);
  }
}

// ============================================
// Register Routes
// ============================================
function setupRoutes() {
  registerRoute('/', renderHome);
  registerRoute('/tv', renderTvShows);
  registerRoute('/movies', renderMovies);
  registerRoute('/mylist', renderMyList);

  // Search route: #/search/{query}
  registerRoute('/search/:query', async (container, params) => {
    const query = decodeURIComponent(params.query || '');
    return renderSearch(container, { query });
  });

  // Player route: #/player/{type}/{id}
  registerRoute('/player/:type/:id', renderPlayer);
}

// ============================================
// Initialize Application
// ============================================
async function initApp() {
  const app = document.getElementById('app');

  // Show loading screen
  app.innerHTML = `
    <div id="sf-loading-screen" class="sf-loading-screen">
      <div class="sf-loading-logo">
        <span class="sf-logo-text" style="display:inline-block; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">S</span>
      </div>
      <div class="sf-loading-bar">
        <div class="sf-loading-bar-fill"></div>
      </div>
    </div>
  `;

  // Load genres
  await loadGenres();

  // Build app shell
  app.innerHTML = '';

  // Navbar
  const navbar = createNavbar();
  app.appendChild(navbar);

  // Main content area
  const main = document.createElement('main');
  main.className = 'sf-main-content';
  main.id = 'sf-page-content';
  app.appendChild(main);

  // Footer
  const footer = createFooter();
  app.appendChild(footer);

  // Initialize modal system
  const cleanupModal = initModal();

  // Setup routes and start router
  setupRoutes();
  initRouter();


}

// ============================================
// Boot
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  if (!hasApiKey()) {
    // Provide a default test API key if the user doesn't have one
    setApiKey('c29379565234e20d7cbf4f2e835c3e41'); 
  }
  initApp();
});
