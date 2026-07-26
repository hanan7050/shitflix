export function createNavbar() {
  const nav = document.createElement('nav');
  nav.className = 'sf-navbar';

  nav.innerHTML = `
    <div class="sf-nav-left">
      <button class="sf-mobile-menu-btn">☰</button>
      <a href="#/" class="sf-logo" style="text-decoration:none;">
        <span style="color: #E50914; font-size: 38px; font-weight: 900; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; display: inline-block; line-height: 1;">S</span>
      </a>
      <ul class="sf-nav-links">
        <li><a href="#/" class="sf-nav-link active">Home</a></li>
        <li><a href="#/tv" class="sf-nav-link">TV Shows</a></li>
        <li><a href="#/movies" class="sf-nav-link">Movies</a></li>
        <li><a href="#/mylist" class="sf-nav-link">My List</a></li>
      </ul>
    </div>
    <div class="sf-nav-right">
      <div class="sf-search-container">
        <button class="sf-search-icon" aria-label="Search">
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>
        </button>
        <input type="text" class="sf-search-input" placeholder="Titles, people, genres" />
      </div>
      <div class="sf-profile-avatar">S</div>
    </div>
    <div class="sf-mobile-nav">
      <ul>
        <li><a href="#/" class="sf-nav-link">Home</a></li>
        <li><a href="#/tv" class="sf-nav-link">TV Shows</a></li>
        <li><a href="#/movies" class="sf-nav-link">Movies</a></li>
        <li><a href="#/mylist" class="sf-nav-link">My List</a></li>
      </ul>
    </div>
  `;

  const searchContainer = nav.querySelector('.sf-search-container');
  const searchIcon = nav.querySelector('.sf-search-icon');
  const searchInput = nav.querySelector('.sf-search-input');
  const mobileMenuBtn = nav.querySelector('.sf-mobile-menu-btn');
  const mobileNav = nav.querySelector('.sf-mobile-nav');
  const navLinks = nav.querySelectorAll('.sf-nav-link');

  const handleScroll = () => {
    if (window.scrollY > 70) {
      nav.classList.add('sf-nav-scrolled');
    } else {
      nav.classList.remove('sf-nav-scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll);

  searchIcon.addEventListener('click', () => {
    searchContainer.classList.add('sf-search-active');
    searchInput.focus();
  });

  searchInput.addEventListener('blur', () => {
    if (!searchInput.value.trim()) {
      searchContainer.classList.remove('sf-search-active');
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchContainer.classList.remove('sf-search-active');
      searchInput.blur();
    } else if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        window.location.hash = `/search/${encodeURIComponent(query)}`;
      }
    }
  });

  const updateActiveLinks = () => {
    const currentHash = window.location.hash || '#/';
    navLinks.forEach(link => {
      if (link.getAttribute('href') === currentHash) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  };

  window.addEventListener('hashchange', updateActiveLinks);
  updateActiveLinks();

  mobileMenuBtn.addEventListener('click', () => {
    mobileNav.classList.toggle('sf-mobile-open');
  });

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('sf-mobile-open');
    });
  });

  nav._cleanup = () => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('hashchange', updateActiveLinks);
  };

  return nav;
}
