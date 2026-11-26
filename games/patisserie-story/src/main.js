// src/main.js
// 《甜点屋物语》纯 HTML5 Hash 路由器与页面生命周期调度

import { mountStartPage } from './pages/start.js?v=20261126z12';
import { mountIntroPage } from './pages/intro.js';
import { mountHomePage } from './pages/home.js?v=20261126q';
import { mountMapPage } from './pages/map.js';
import { mountStoryPage } from './pages/story.js?v=20261126z12';
import { mountMinigamePage } from './pages/minigame.js';
import { mountShopPage } from './pages/shop.js?v=20261126z11';
import { mountJobsPage } from './pages/jobs.js?v=20261126w';
import { mountRecipesPage } from './pages/recipes.js';

const ROUTES = {
  start:    { mount: mountStartPage,    title: '甜点屋物语',   showNav: false },
  intro:    { mount: mountIntroPage,    title: '风铃湾物语',   showNav: false },
  home:     { mount: mountHomePage,     title: '星月糖屋',     showNav: true, backTo: '#/start' },
  map:      { mount: mountMapPage,      title: '风铃湾地图',   showNav: true, backTo: '#/home' },
  story:    { mount: mountStoryPage,    title: '甜点屋物语',   showNav: true, backTo: '#/home' },
  minigame: { mount: mountMinigamePage, title: '甜点制作挑战', showNav: true, backTo: '#/home' },
  shop:     { mount: mountShopPage,     title: '星月糖屋营业', showNav: true, backTo: '#/home' },
  jobs:     { mount: mountJobsPage,     title: '风铃湾打工中心', showNav: true, backTo: '#/shop' },
  recipes:  { mount: mountRecipesPage,  title: '复古食谱手账', showNav: true, backTo: '#/home' }
};

const pageRoot = document.getElementById('page-root');
const navBar = document.getElementById('app-nav');
const navBack = document.getElementById('nav-back');
const navTitle = document.getElementById('nav-title');

let currentCleanup = null;
let currentBackTarget = '#/home';

function parseHash() {
  const raw = (window.location.hash || '#/start').replace(/^#\/?/, '');
  const [namePart, queryPart] = raw.split('?');
  const name = ROUTES[namePart] ? namePart : 'start';
  const params = {};
  if (queryPart) {
    const sp = new URLSearchParams(queryPart);
    for (const [k, v] of sp.entries()) params[k] = v;
  }
  return { name, params };
}

export function navigate(route, params = {}, { replace = false } = {}) {
  const qs = new URLSearchParams(params).toString();
  const nextHash = `#/${route}${qs ? '?' + qs : ''}`;
  if (replace) {
    window.location.replace(nextHash);
  } else if (window.location.hash === nextHash) {
    renderRoute();
  } else {
    window.location.hash = nextHash;
  }
}

export function setPageTitle(title) {
  if (title) {
    navTitle.textContent = title;
    document.title = `${title} · 甜点屋物语`;
  }
}

function renderRoute() {
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (_) {}
    currentCleanup = null;
  }

  const { name, params } = parseHash();
  const route = ROUTES[name];

  navBar.classList.toggle('is-hidden', !route.showNav);
  setPageTitle(route.title);
  currentBackTarget = route.backTo || '#/home';

  pageRoot.className = `page-${name}`;
  pageRoot.innerHTML = '';
  pageRoot.scrollTop = 0;

  currentCleanup = route.mount(pageRoot, params, { navigate, setPageTitle }) || null;
}

navBack.addEventListener('click', () => {
  window.location.hash = currentBackTarget;
});

window.addEventListener('hashchange', renderRoute);

if (!window.location.hash) {
  window.location.replace('#/start');
} else {
  renderRoute();
}
