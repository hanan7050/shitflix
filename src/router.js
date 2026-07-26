// ============================================
// SHITFLIX — Simple SPA Router (Hash-based)
// ============================================

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  const hash = window.location.hash.slice(1) || '/';
  return hash;
}

export function getRouteParams() {
  const hash = getCurrentRoute();
  const parts = hash.split('/').filter(Boolean);
  return parts;
}

function matchRoute(hash) {
  // Exact match
  if (routes[hash]) return { handler: routes[hash], params: {} };

  // Pattern matching: /detail/:type/:id
  for (const [pattern, handler] of Object.entries(routes)) {
    const patternParts = pattern.split('/').filter(Boolean);
    const hashParts = hash.split('/').filter(Boolean);

    if (patternParts.length !== hashParts.length) continue;

    const params = {};
    let match = true;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = hashParts[i];
      } else if (patternParts[i] !== hashParts[i]) {
        match = false;
        break;
      }
    }

    if (match) return { handler, params };
  }

  return null;
}

export async function handleRoute() {
  const hash = getCurrentRoute();
  const matched = matchRoute(hash);

  // Clean up previous route
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const container = document.getElementById('sf-page-content');
  if (!container) return;

  if (matched) {
    const cleanup = await matched.handler(container, matched.params);
    if (typeof cleanup === 'function') {
      currentCleanup = cleanup;
    }
  } else {
    // Default to home
    if (routes['/']) {
      const cleanup = await routes['/'](container, {});
      if (typeof cleanup === 'function') {
        currentCleanup = cleanup;
      }
    }
  }

  // Scroll to top on route change
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);

  // Handle initial route
  if (!window.location.hash) {
    window.location.hash = '/';
  } else {
    handleRoute();
  }
}
