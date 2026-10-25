'use strict';

const $ = (selector) => document.querySelector(selector);
const main = $('#main');
const search = $('#search');
const iconPaths = {
  home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
  sprout: '<path d="M12 21v-9M12 14C5 14 3 10 3 5c6 0 9 3 9 9ZM12 11c0-6 4-8 9-8 0 5-3 8-9 8Z"/>',
  tree: '<path d="m12 2-6 7h3l-5 6h5l-4 4h14l-4-4h5l-5-6h3zM12 19v3"/>',
  blocks: '<path d="m3 7 5-3 5 3-5 3zM3 7v6l5 3 5-3V7M8 10v6m5-3 4-2 4 3-5 3-3-2m3 2v5l5-3v-5M8 16v4l8 2"/>',
  lamp: '<path d="M9 3h6M12 3v3m-5 0h10l2 12H5zM5 18h14v3H5zM9 10h6m-3 0v5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  book: '<path d="M12 6C8 3 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
const icon = (name) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.book}</svg>`;
const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const normalize = (value) => String(value).normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g, ' ').trim();
let data;
let activeFilter = '전체';
let searchTimer;
let lastRoute = '';
const mobileMenu = window.matchMedia('(max-width:700px)');

$('#search-icon').innerHTML = icon('search');

function category(id) { return data.categories.find((c) => c.id === id); }
function entries(id) { return data.articles.filter((a) => a.category === id); }
function routeOf(article) { return '#/article/' + encodeURIComponent(article.id); }
function picture(path, className = '', alt = '') {
  return path ? `<img class="${className}" src="./${esc(path)}" width="128" height="128" loading="lazy" decoding="async" alt="${esc(alt)}">` : '';
}

function navigation(active) {
  $('#navigation').innerHTML = `<a href="#/" class="nav-item ${active === 'home' ? 'active' : ''}" ${active === 'home' ? 'aria-current="page"' : ''}>${icon('home')}<span>위키 홈</span></a><p class="nav-label nav-section">농장과 섬 생활</p>` + data.categories.map((c) => `<a href="#/${c.id}" class="nav-item ${active === c.id ? 'active' : ''}" ${active === c.id ? 'aria-current="page"' : ''}>${icon(c.icon)}<span>${c.name}</span><span class="nav-count">${entries(c.id).length}</span></a>`).join('');
}

function breadcrumb(parts) {
  return `<nav class="breadcrumb" aria-label="현재 위치"><a href="#/">위키 홈</a>${parts.map((p) => `<span aria-hidden="true">/</span>${p.href ? `<a href="${p.href}">${esc(p.name)}</a>` : `<span aria-current="page">${esc(p.name)}</span>`}`).join('')}</nav>`;
}

function card(article) {
  const c = category(article.category);
  return `<a class="entry-card ${article.category === 'guides' ? 'guide-card' : ''}" href="${routeOf(article)}"><div class="entry-picture ${article.category}">${article.image ? picture(article.image) : icon(c.icon)}</div><div class="entry-copy"><span class="entry-group">${esc(article.group || c.name)}</span><h3>${esc(article.title)}</h3><p>${esc(article.summary)}</p></div><span class="card-arrow">${icon('arrow')}</span></a>`;
}

function home() {
  navigation('home');
  document.title = 'CobbleRouge 위키 — 씨앗부터 수확까지';
  const collections = data.categories.filter((c) => c.id !== 'guides');
  const featured = ['first-harvest', 'growing', 'building'].map((id) => data.articles.find((a) => a.id === id)).filter(Boolean);
  main.innerHTML = `
    <section class="hero">
      <div class="hero-copy"><div class="eyebrow"><span class="status-dot"></span> COBBLEROUGE FIELD NOTES</div><h1>씨앗부터 수확까지,<br>이곳에 차곡차곡.</h1><p>심고, 기다리고, 수확하는 작은 즐거움.<br>나만의 섬을 가꾸는 이야기를 찾아보세요.</p><a class="primary-button" href="${routeOf(featured[0])}">첫 수확 준비하기 ${icon('arrow')}</a><div class="hero-footnote"><span>✦</span> 56종의 작물, 저마다 다른 성장 이야기</div></div>
      <div class="field-scene" aria-hidden="true"><div class="scene-orbit orbit-one"></div><div class="scene-orbit orbit-two"></div><span class="scene-spark spark-one">✦</span><span class="scene-spark spark-two">✧</span><div class="specimen specimen-tree"><img src="./images/fruits/world_tree.png" width="210" height="210" alt=""><span>01 — 세계나무 열매</span></div><div class="specimen specimen-berry"><img src="./images/fruits/strawberry.png" width="86" height="86" alt=""><span>달콤한 첫 수확</span></div><div class="specimen specimen-mushroom"><img src="./images/fruits/galaxy_mushroom.png" width="125" height="125" alt=""></div><div class="scene-label"><span class="scene-label-line"></span>작은 씨앗, 새로운 모험</div><span class="scene-coordinate">FIELD GUIDE / VOL. 01</span></div>
    </section>
    <section class="collection-section"><div class="section-heading"><div><span class="eyebrow">EXPLORE THE WIKI</span><h2>무엇을 찾아볼까요?</h2></div><span class="section-note">궁금한 분야부터 가볍게 둘러보세요</span></div><div class="collections">${collections.map((c, i) => `<a href="#/${c.id}" class="collection collection-${c.id}"><div class="collection-top"><span class="collection-icon">${icon(c.icon)}</span><span class="collection-number">0${i + 1}</span></div><h3>${c.name}</h3><p>${c.description}</p><div class="collection-footer"><span>${c.id === 'crops' ? '56종 + 재배 도구' : entries(c.id).length + '개 모음'}</span>${icon('arrow')}</div></a>`).join('')}</div></section>
    <section class="guide-section"><div class="section-heading"><div><span class="eyebrow">NOTES FROM THE GARDEN</span><h2>농장 일을 시작하기 전에</h2></div><a class="text-link" href="#/guides">길라잡이 전체 ${icon('arrow')}</a></div><div class="featured-guides">${featured.map((a, i) => `<a class="featured-guide" href="${routeOf(a)}"><span class="guide-number">0${i + 1}</span><div><span class="entry-group">${i === 0 ? '첫 수확' : i === 1 ? '재배의 기본' : '나만의 섬'}</span><h3>${esc(a.title)}</h3><p>${esc(a.summary)}</p></div><span class="card-arrow">${icon('arrow')}</span></a>`).join('')}</div></section>
    <aside class="wiki-tip"><span class="tip-icon">${icon('book')}</span><div><strong>열매도, 성장 모습도 입체적으로</strong><p>게임 속 모습으로 찍은 그림과 함께 씨앗, 열매, 성장 단계와 조합법을 살펴보세요.</p></div><a href="#/crops">작물 둘러보기 ${icon('arrow')}</a></aside>`;
}

function listing(id, filter = '전체') {
  const c = category(id);
  if (!c) return missing();
  navigation(id);
  document.title = `${c.name} — CobbleRouge 위키`;
  const list = entries(id);
  const groups = [...new Set(list.map((a) => a.group).filter(Boolean))];
  const showFilters = id === 'crops';
  const selected = showFilters && filter !== '전체' ? list.filter((a) => a.group === filter) : list;
  main.innerHTML = `${breadcrumb([{name:c.name}])}<header class="page-heading"><span class="eyebrow">${c.label}</span><h1>${c.name}<span class="heading-count">${list.length}</span></h1><p>${c.description}</p></header>${id === 'crops' ? '<aside class="notice compact">성장 시간은 섬이 로드되어 있는 동안 기준이며, 가격은 섬 상점 기본값입니다. 실제 서버 설정에 따라 달라질 수 있습니다.</aside>' : ''}${showFilters ? `<div class="filters" role="group" aria-label="재배 환경">${['전체', ...groups].map((g) => `<button class="filter ${g === filter ? 'selected' : ''}" data-filter="${esc(g)}" aria-pressed="${g === filter}">${esc(g)}</button>`).join('')}</div>` : ''}<div class="list-meta"><span role="status">${selected.length}개의 항목</span><span>이름을 눌러 자세히 보기</span></div><div class="entry-grid">${selected.map(card).join('')}</div>`;
  main.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    listing(id, activeFilter);
    const current = [...main.querySelectorAll('[data-filter]')].find((b) => b.dataset.filter === activeFilter);
    current?.focus({preventScroll:true});
  }));
}

function showArticle(id) {
  const article = data.articles.find((a) => a.id === id);
  if (!article) return missing();
  const c = category(article.category);
  navigation(c.id);
  document.title = `${article.title} — CobbleRouge 위키`;
  const siblings = entries(c.id);
  const current = siblings.indexOf(article);
  const related = siblings.filter((a) => a.id !== id && a.group === article.group).slice(0, 3);
  main.innerHTML = `${breadcrumb([{name:c.name,href:'#/' + c.id},{name:article.title}])}<article class="article"><header class="article-heading"><div><span class="eyebrow">${esc(article.group || c.label)}</span><h1>${esc(article.title)}</h1><p>${esc(article.summary)}</p></div>${article.image ? picture(article.image, 'article-image') : `<span class="article-emblem">${icon(c.icon)}</span>`}</header><div class="article-tools"><span>자료 기준 ${data.updated.replaceAll('-', '.')}</span><button id="copy-link" class="text-button">이 항목 링크 복사 ${icon('book')}</button><span id="copy-status" class="sr-only" role="status"></span></div>${c.id !== 'guides' ? '<aside class="notice compact">수치와 가격은 기본값입니다. 게임에서 안내하는 현재 서버 설정을 확인하세요.</aside>' : ''}<div class="prose">${article.html}</div><div class="article-pagination">${current > 0 ? `<a href="${routeOf(siblings[current - 1])}"><small>이전 항목</small><strong>← ${esc(siblings[current - 1].title)}</strong></a>` : '<span></span>'}${current < siblings.length - 1 ? `<a href="${routeOf(siblings[current + 1])}"><small>다음 항목</small><strong>${esc(siblings[current + 1].title)} →</strong></a>` : '<span></span>'}</div></article>${related.length ? `<section class="related"><div class="section-heading"><h2>함께 찾아보기</h2><a class="text-link" href="#/${c.id}">전체 보기 ${icon('arrow')}</a></div><div class="entry-grid">${related.map(card).join('')}</div></section>` : ''}`;
  $('#copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $('#copy-status').textContent = '링크를 복사했습니다.';
      $('#copy-link').textContent = '복사했습니다 ✓';
    } catch {
      $('#copy-status').textContent = '자동 복사를 사용할 수 없습니다. 주소창의 주소를 복사해 주세요.';
      $('#copy-link').textContent = '주소창에서 링크를 복사해 주세요';
    }
  });
}

function results(query) {
  navigation('search');
  document.title = `${query ? query + ' 검색' : '검색'} — CobbleRouge 위키`;
  const words = normalize(query).split(' ').filter(Boolean);
  const matches = words.length ? data.articles.filter((a) => words.every((w) => normalize(a.search).includes(w))).sort((a, b) => Number(normalize(b.title).includes(normalize(query))) - Number(normalize(a.title).includes(normalize(query)))) : [];
  main.innerHTML = `${breadcrumb([{name:'검색'}])}<header class="page-heading"><span class="eyebrow">SEARCH THE WIKI</span><h1>${query ? '‘' + esc(query) + '’ 검색 결과' : '무엇이 궁금한가요?'}</h1><p role="status">${query ? matches.length + '개의 항목을 찾았습니다.' : '작물 이름, 아이템 ID, 궁금한 내용을 입력해 보세요.'}</p></header>${matches.length ? `<div class="entry-grid">${matches.map(card).join('')}</div>` : `<section class="empty-state">${icon('search')}<h2>${query ? '아직 찾지 못했어요' : '작은 궁금증부터 시작해 보세요'}</h2><p>${query ? '다른 이름이나 짧은 검색어로 다시 찾아보세요.' : '예: 딸기, 세계나무, 울타리, 계단'}</p><div class="suggestions">${['딸기','세계나무','울타리'].map((q) => `<a href="#/search?q=${encodeURIComponent(q)}">${q} ${icon('arrow')}</a>`).join('')}</div></section>`}`;
}

function missing() {
  navigation('');
  document.title = '항목을 찾을 수 없습니다 — CobbleRouge 위키';
  main.innerHTML = '<section class="empty-state"><span class="eyebrow">길을 조금 벗어났네요</span><h1>항목을 찾을 수 없습니다</h1><p>주소를 확인하거나 위키 홈에서 다시 찾아보세요.</p><a class="primary-button" href="#/">위키 홈으로 →</a></section>';
}

function render() {
  if (!data) return;
  const raw = location.hash || '#/';
  let route;
  try { route = decodeURIComponent(raw.split('?')[0].replace(/^#\/?/, '')); } catch { return missing(); }
  const query = new URLSearchParams(raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '').get('q') || '';
  if (route !== 'search') search.value = '';
  else search.value = query;
  if (route !== lastRoute) activeFilter = '전체';
  if (!route) home();
  else if (route === 'search') results(query);
  else if (route.startsWith('article/')) showArticle(route.slice(8));
  else listing(route, activeFilter);
  setMenu(false);
  if (document.activeElement !== search) {
    main.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
  lastRoute = route;
}

function setMenu(open) {
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar').inert = mobileMenu.matches && !open;
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('#menu-toggle').setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  $('#menu-toggle').textContent = open ? '×' : '☰';
}

function doSearch() {
  const query = search.value.trim();
  const next = '#/search' + (query ? '?q=' + encodeURIComponent(query) : '');
  if (location.hash === next) render();
  else location.hash = next;
}

$('#search-form').addEventListener('submit', (event) => { event.preventDefault(); clearTimeout(searchTimer); doSearch(); });
search.addEventListener('input', (event) => {
  clearTimeout(searchTimer);
  if (!event.isComposing) searchTimer = setTimeout(doSearch, 180);
});
search.addEventListener('compositionend', () => { clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 180); });
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.focus(); search.select(); }
  if (event.key === 'Escape') {
    const wasOpen = $('#menu-toggle').getAttribute('aria-expanded') === 'true';
    setMenu(false);
    if (wasOpen) $('#menu-toggle').focus();
    else if (document.activeElement === search) { search.blur(); }
  }
});
$('#menu-toggle').addEventListener('click', () => setMenu($('#menu-toggle').getAttribute('aria-expanded') !== 'true'));
$('#sidebar').addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
mobileMenu.addEventListener('change', () => setMenu(false));
document.addEventListener('click', (event) => {
  if (!event.target.closest('#sidebar') && !event.target.closest('#menu-toggle')) setMenu(false);
});
window.addEventListener('hashchange', () => { clearTimeout(searchTimer); render(); });

async function load() {
  try {
    const response = await fetch('./data.json');
    if (!response.ok) throw Error('HTTP ' + response.status);
    data = await response.json();
    if (!Array.isArray(data.articles) || !Array.isArray(data.categories)) throw Error('Invalid content');
    render();
  } catch {
    main.innerHTML = '<section class="empty-state"><h1>위키를 불러오지 못했습니다</h1><p>연결 상태를 확인하고 다시 시도해 주세요.</p><button id="retry" class="primary-button">다시 불러오기</button></section>';
    $('#retry').addEventListener('click', load);
  }
}
load();
