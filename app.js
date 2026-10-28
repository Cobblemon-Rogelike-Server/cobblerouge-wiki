"use strict";
const $ = (s) => document.querySelector(s),
  main = $("#main"),
  search = $("#search");
const paths = {
  home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
  sprout:
    '<path d="M12 21v-9M12 14C5 14 3 10 3 5c6 0 9 3 9 9ZM12 11c0-6 4-8 9-8 0 5-3 8-9 8Z"/>',
  tree: '<path d="m12 2-6 7h3l-5 6h5l-4 4h14l-4-4h5l-5-6h3zM12 19v3"/>',
  blocks:
    '<path d="m3 7 5-3 5 3-5 3zM3 7v6l5 3 5-3V7M8 10v6m5-3 4-2 4 3-5 3-3-2m3 2v5l5-3v-5M8 16v4l8 2"/>',
  lamp: '<path d="M9 3h6M12 3v3m-5 0h10l2 12H5zM5 18h14v3H5zM9 10h6m-3 0v5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  book: '<path d="M12 6C8 3 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15"/>',
  swords:
    '<path d="m4 3 7 5 10 12-2 2L7 11 3 4zM14 7l6-4 1 1-4 7M5 15l4 4M3 21l4-4M15 16l4-4"/>',
  users:
    '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6M22 21v-3a6 6 0 0 0-4-5"/>',
  map: '<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15M15 6v15"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );

const order = {
  guides: ["getting-started", "first-harvest", "growing", "building"],
  dungeon: [
    "dungeon-entry",
    "dungeon-overview",
    "dungeon-currency-map",
    "dungeon-wild",
    "dungeon-trainer",
    "dungeon-clinic",
    "dungeon-vault",
    "dungeon-gene-lab",
    "dungeon-boss",
    "dungeon-settlement",
    "dungeon-stats",
  ],
  guild: [
    "guild-overview",
    "guild-membership",
    "guild-requests",
    "guild-joint-expedition",
  ],
};
function entries(id) {
  const list = data.articles.filter((a) => a.category === id),
    ranks = order[id] || [];
  return list.sort(
    (a, b) =>
      (ranks.includes(a.id) ? ranks.indexOf(a.id) : 999) -
      (ranks.includes(b.id) ? ranks.indexOf(b.id) : 999),
  );
}

const normalize = (value) =>
  String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko")
    .replace(/\s+/g, " ")
    .trim();
const category = (id) => data.categories.find((c) => c.id === id);
const find = (id) => data.articles.find((a) => a.id === id);
const routeOf = (article) => "#/article/" + encodeURIComponent(article.id);
const picture = (src, alt = "") =>
  src
    ? `<img src="./${esc(src)}" alt="${esc(alt)}" width="64" height="64" loading="lazy" decoding="async">`
    : "";
const mobileMenu = matchMedia("(max-width:820px)");
let data,
  searchTimer,
  tocObserver,
  toastTimer,
  lastRoute = "",
  activeFilter = "전체";
// Retire only this wiki's former reading state. No replacement tracking or preferences.
try {
  localStorage.removeItem("cobblerouge-wiki:reading:v1");
} catch {
  /* Storage is optional. */
}
$("#search-icon").innerHTML = icon("search");
$("#search-shortcut").textContent = /Mac|iPhone|iPad/.test(navigator.platform)
  ? "⌘ K"
  : "Ctrl K";

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2600);
}
function navLink(id, name, active, href = "#/" + id, count = "") {
  return `<a href="${href}" class="nav-item${active === id ? " active" : ""}"${active === id ? ' aria-current="page"' : ""}><span>${esc(name)}</span>${count !== "" ? `<span class="nav-count">${count}</span>` : ""}</a>`;
}
function navigation(active) {
  const group = (title, ids) =>
    `<p class="nav-label">${title}</p>` +
    ids
      .map((id) =>
        navLink(id, category(id).name, active, "#/" + id, entries(id).length),
      )
      .join("");
  $("#navigation").innerHTML =
    navLink("home", "위키 홈", active, "#/") +
    navLink("start", "처음 시작하기", active, "#/article/getting-started") +
    group("게임 안내", ["dungeon", "guild", "guides"]) +
    group("생활과 제작", ["crops", "trees", "wood", "decor"]);
}
function breadcrumb(parts = []) {
  return `<nav class="breadcrumb" aria-label="현재 위치"><a href="#/">위키 홈</a>${parts.map((p) => `<span aria-hidden="true">/</span>${p.href ? `<a href="${p.href}">${esc(p.name)}</a>` : `<span aria-current="page">${esc(p.name)}</span>`}`).join("")}</nav>`;
}
function documentLink(id, label = "") {
  const a = find(id);
  return `<a href="${routeOf(a)}">${esc(label || a.title)}</a>`;
}
function documentRow(a, compact = false) {
  return `<li class="document-row${compact ? " compact" : ""}"><a class="document-link" href="${routeOf(a)}">${a.image ? `<span class="document-image">${picture(a.image)}</span>` : ""}<span class="document-copy"><span class="document-title">${esc(a.title)}</span><span class="document-description">${esc(a.summary)}</span></span></a></li>`;
}
function documentList(articles, style = "") {
  return `<ul class="document-list ${style}">${articles.map((a) => documentRow(a)).join("")}</ul>`;
}
const journey = [
  [
    "파티 준비",
    "파티의 코스트와 진화 계열 중복을 확인하고 지닌 도구를 뺍니다.",
    "dungeon-entry",
    "dungeon/map",
  ],
  [
    "방 공략",
    "레벨 5부터 파티를 키우며 전투·포획·회복으로 다음 층을 준비합니다.",
    "dungeon-overview",
    "dungeon/wild",
  ],
  [
    "지도 선택",
    "방의 보상을 받은 뒤 던전 지도를 우클릭해 다음 목적지를 고릅니다.",
    "dungeon-currency-map",
    "dungeon/ancient-coin",
  ],
  [
    "정산",
    "10층마다 보스를 만납니다. 모험 종료 시 보스 처치 수에 따라 종료 보상을 받습니다.",
    "dungeon-settlement",
    "dungeon/boss",
  ],
];
const homeCategories = [
  ["dungeon", ["dungeon-entry", "dungeon-overview", "dungeon-gene-lab"]],
  ["guild", ["guild-membership", "guild-requests", "guild-joint-expedition"]],
  ["crops", ["first-harvest", "growing", "crops-strawberry"]],
  ["trees", ["trees-apricot", "trees-world_tree"]],
  ["wood", ["wood-apricot", "wood-world_tree"]],
  ["decor", ["decor-lanterns", "decor-flower-pots"]],
  ["guides", ["getting-started", "first-harvest", "building"]],
];
function home() {
  navigation("home");
  document.title = "CobbleRouge 위키";
  main.innerHTML = `<header class="home-heading"><h1>CobbleRouge 위키</h1><p>던전 진행과 섬 생활에 필요한 규칙을 정리했습니다.</p><div class="page-meta">${data.articles.length}개 문서 <span aria-hidden="true">·</span> 내용 기준 ${data.updated.replaceAll("-", ".")}</div></header>
  <div class="home-intro"><section class="start-guide" aria-labelledby="start-title"><h2 id="start-title">처음 시작하기</h2><p>먼저 파티의 코스트와 입장 조건을 확인하세요. 던전에서는 레벨 5부터 파티를 키우고, 모험이 끝나면 별도의 종료 보상을 받습니다.</p><a class="start-link" href="#/article/getting-started">시작 안내 읽기 ${icon("arrow")}</a></section><section class="quick-reference" aria-labelledby="quick-title"><h2 id="quick-title">주요 문서</h2><ul>${["dungeon-gene-lab", "dungeon-stats", "dungeon-settlement", "guild-overview"].map((id) => `<li>${documentLink(id)} ${icon("arrow")}</li>`).join("")}</ul></section></div>
  <section class="journey-section" aria-labelledby="journey-title"><div class="section-heading"><h2 id="journey-title">던전 진행 순서</h2><a href="#/article/dungeon-overview">전체 진행 보기 ${icon("arrow")}</a></div><ol class="journey-flow">${journey.map(([title, desc, id, img], i) => `<li><span class="step-heading"><span class="step-number">${i + 1}.</span>${picture("images/" + img + ".png")}<a href="#/article/${id}">${title}</a></span><p>${desc}</p></li>`).join("")}</ol><p class="flow-note">방 공략 → 보상 수령 → 지도 선택을 반복합니다. 던전 파티·전리품·남은 금화는 모험 종료 시 정리됩니다.</p></section>
  <section class="category-section" aria-labelledby="category-title"><div class="section-heading"><h2 id="category-title">분야별 문서</h2><span>분류를 선택하면 전체 목록을 볼 수 있습니다.</span></div><div class="category-index">${homeCategories
    .map(([id, links]) => {
      const c = category(id),
        list = entries(id),
        image = list.find((a) => a.image)?.image;
      return `<section class="category-block"><div class="category-block-heading">${image ? picture(image) : icon(c.icon)}<h3><a href="#/${id}">${c.name}</a></h3><span>${id === "crops" ? "작물 56종 · 도구 1개" : list.length + "개 문서"}</span></div><p>${esc(c.description)}</p><ul>${links.map((article) => `<li>${documentLink(article)}</li>`).join("")}</ul></section>`;
    })
    .join("")}</div></section>`;
}
function listing(id, filter = "전체") {
  const c = category(id);
  if (!c) return missing();
  navigation(id);
  document.title = c.name + " — CobbleRouge 위키";
  const list = entries(id),
    groups = [...new Set(list.map((a) => a.group))];
  if (!groups.includes(filter)) filter = "전체";
  const selected =
    id === "crops" && filter !== "전체"
      ? list.filter((a) => a.group === filter)
      : list;
  const start = {
    dungeon: "dungeon-entry",
    guild: "guild-overview",
    guides: "getting-started",
  }[id];
  main.innerHTML = `${breadcrumb([{ name: c.name }])}<header class="page-heading"><h1>${c.name}</h1><p>${esc(c.description)}</p><div class="page-meta">${id === "crops" ? "작물 56종 · 재배 도구 1개" : list.length + "개 문서"}</div></header>${start ? `<p class="category-start">처음이라면 ${documentLink(start)}부터 확인하세요.</p>` : ""}${id === "crops" ? `<p class="content-note">성장 시간은 섬이 로드된 동안 기준입니다. 가격은 기본 설정이며 운영 서버의 안내를 확인하세요.</p><div class="filters" role="group" aria-label="재배 환경">${["전체", ...groups].map((g) => `<button class="filter" data-filter="${esc(g)}" aria-pressed="${g === filter}">${esc(g)}</button>`).join("")}</div>` : ""}<p class="list-meta" role="status">${selected.length}개 문서${filter !== "전체" ? " · " + esc(filter) : ""}</p>${documentList(selected, ["crops", "trees", "wood", "decor"].includes(id) ? "catalog-grid" : "")}`;
  main.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      listing(id, activeFilter);
      [...main.querySelectorAll("[data-filter]")]
        .find((b) => b.dataset.filter === activeFilter)
        .focus({ preventScroll: true });
    }),
  );
}
function showArticle(id) {
  const a = find(id);
  if (!a) return missing();
  const c = category(a.category);
  navigation(id === "getting-started" ? "start" : c.id);
  document.title = a.title + " — CobbleRouge 위키";
  const siblings = entries(c.id),
    current = siblings.indexOf(a);
  const suggestions = {
    "getting-started": ["dungeon-entry", "dungeon-overview", "first-harvest"],
    "dungeon-entry": [
      "dungeon-overview",
      "dungeon-currency-map",
      "dungeon-stats",
    ],
    "dungeon-overview": [
      "dungeon-currency-map",
      "dungeon-loot",
      "dungeon-settlement",
    ],
    "dungeon-settlement": ["dungeon-stats", "guild-requests", "dungeon-entry"],
    "first-harvest": ["growing", "crops-strawberry", "building"],
    "guild-overview": [
      "guild-membership",
      "guild-requests",
      "guild-joint-expedition",
    ],
  };
  const related = (
    suggestions[id] ||
    siblings.filter((x) => x.id !== id && x.group === a.group).map((x) => x.id)
  )
    .map(find)
    .filter(Boolean)
    .slice(0, 3);
  main.innerHTML = `${breadcrumb([{ name: c.name, href: "#/" + c.id }, { name: a.title }])}<div class="article-layout"><article class="article"><header class="article-heading"><h1>${esc(a.title)}</h1><div class="article-meta"><span>내용 기준 ${data.updated.replaceAll("-", ".")}</span><button id="copy-link" class="copy-button">링크 복사</button><span id="copy-status" class="sr-only" role="status"></span></div></header><details class="mobile-toc"><summary>이 문서의 목차</summary><nav aria-label="이 문서의 목차"><ol id="mobile-toc-list"></ol></nav></details>${c.id !== "guides" ? '<p class="content-note">수치·가격은 기본 설정 기준입니다. 운영 서버의 안내를 우선 확인하세요.</p>' : ""}<div class="prose">${a.html}</div><nav class="article-pagination" aria-label="이전 및 다음 문서">${current > 0 ? `<a href="${routeOf(siblings[current - 1])}"><span>← 이전 문서</span><strong>${esc(siblings[current - 1].title)}</strong></a>` : "<span></span>"}${current < siblings.length - 1 ? `<a href="${routeOf(siblings[current + 1])}"><span>다음 문서 →</span><strong>${esc(siblings[current + 1].title)}</strong></a>` : "<span></span>"}</nav>${related.length ? `<section class="related"><h2>관련 문서</h2><ul>${related.map((x) => `<li>${documentLink(x.id)}</li>`).join("")}</ul></section>` : ""}</article><aside class="article-aside"><nav class="toc" aria-label="이 문서의 목차"><h2>이 문서에서</h2><ol id="toc-list"></ol></nav></aside></div>`;
  const headings = [...main.querySelectorAll(".prose h2,.prose h3")];
  headings.forEach((h, i) => {
    h.id = "section-" + (i + 1);
    h.tabIndex = -1;
  });
  $(".toc").hidden = !headings.length;
  $(".mobile-toc").hidden = !headings.length;
  $("#toc-list").innerHTML = headings
    .map(
      (h) =>
        `<li class="toc-${h.tagName.toLowerCase()}"><a href="${routeOf(a)}?section=${h.id}" data-section="${h.id}">${esc(h.textContent)}</a></li>`,
    )
    .join("");
  $("#mobile-toc-list").innerHTML = $("#toc-list").innerHTML;
  main.querySelectorAll("[data-section]").forEach((link) =>
    link.addEventListener("click", (event) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button
      )
        return;
      event.preventDefault();
      link.closest(".mobile-toc")?.removeAttribute("open");
      history.replaceState(null, "", link.getAttribute("href"));
      const target = document.getElementById(link.dataset.section);
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
          ? "instant"
          : "smooth",
      });
    }),
  );
  if ("IntersectionObserver" in window) {
    tocObserver = new IntersectionObserver(
      (changes) => {
        for (const entry of changes)
          if (entry.isIntersecting)
            main
              .querySelectorAll("[data-section]")
              .forEach((link) =>
                link.setAttribute(
                  "aria-current",
                  String(link.dataset.section === entry.target.id),
                ),
              );
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    headings.forEach((h) => tocObserver.observe(h));
  }
  $("#copy-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $("#copy-status").textContent = "링크를 복사했습니다.";
      toast("링크를 복사했습니다.");
    } catch {
      $("#copy-status").textContent = "주소창에서 링크를 복사해 주세요.";
      toast("주소창에서 링크를 복사해 주세요.");
    }
  });
}
function results(query, scope = "all") {
  if (scope !== "all" && !category(scope)) scope = "all";
  navigation("search");
  document.title = (query ? query + " 검색" : "검색") + " — CobbleRouge 위키";
  const words = normalize(query).split(" ").filter(Boolean);
  const matches = words.length
    ? data.articles
        .filter((a) =>
          words.every(
            (word) =>
              normalize(a.search).includes(word) ||
              normalize(a.search).replaceAll(" ", "").includes(word),
          ),
        )
        .sort(
          (a, b) =>
            Number(normalize(b.title).includes(normalize(query))) -
            Number(normalize(a.title).includes(normalize(query))),
        )
    : [];
  const selected =
    scope === "all" ? matches : matches.filter((a) => a.category === scope);
  main.innerHTML = `${breadcrumb([{ name: "검색" }])}<header class="page-heading"><h1>${query ? "‘" + esc(query) + "’ 검색 결과" : "문서 검색"}</h1><p role="status">${query ? selected.length + "개의 문서를 찾았습니다." : "이름, 아이템 ID 또는 본문 내용으로 검색할 수 있습니다."}</p></header>${matches.length ? `<div class="filters" role="group" aria-label="검색 분류">${[["all", "전체", matches.length], ...data.categories.map((c) => [c.id, c.name, matches.filter((a) => a.category === c.id).length]).filter((x) => x[2])].map(([id, name, count]) => `<button class="filter" data-search-category="${id}" aria-pressed="${id === scope}">${name} <span>${count}</span></button>`).join("")}</div>${selected.length ? documentList(selected) : '<p class="empty-state">이 분류에 해당하는 문서가 없습니다. 다른 분류를 선택하세요.</p>'}` : `<section class="empty-state"><h2>${query ? "검색 결과가 없습니다." : "자주 찾는 주제"}</h2>${query ? "<p>짧은 이름이나 다른 검색어를 입력해 보세요.</p>" : ""}<ul>${["던전 입장", "유전자", "딸기"].map((q) => `<li><a href="#/search?q=${encodeURIComponent(q)}">${q}</a></li>`).join("")}</ul></section>`}`;
  main.querySelectorAll("[data-search-category]").forEach((button) =>
    button.addEventListener("click", () => {
      location.hash =
        "#/search?q=" +
        encodeURIComponent(query) +
        (button.dataset.searchCategory === "all"
          ? ""
          : "&category=" + button.dataset.searchCategory);
    }),
  );
}
function missing() {
  navigation("");
  document.title = "문서를 찾을 수 없습니다 — CobbleRouge 위키";
  main.innerHTML =
    '<section class="empty-state"><h1>문서를 찾을 수 없습니다.</h1><p>주소를 확인하거나 검색으로 문서를 찾아보세요.</p><a href="#/">위키 홈으로</a></section>';
}
function render() {
  if (!data) return;
  tocObserver?.disconnect();
  const raw = location.hash || "#/";
  let route;
  try {
    route = decodeURIComponent(raw.split("?")[0].replace(/^#\/?/, ""));
  } catch {
    missing();
    setMenu(false);
    main.focus({ preventScroll: true });
    return;
  }
  if (route === "saved") {
    location.replace("#/");
    return;
  }
  const params = new URLSearchParams(
      raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "",
    ),
    query = (params.get("q") || "").slice(0, 200),
    section = params.get("section");
  const searchFocused = document.activeElement === search;
  search.value = route === "search" ? query : "";
  if (route !== lastRoute) activeFilter = "전체";
  if (!route) home();
  else if (route === "search") results(query, params.get("category") || "all");
  else if (route === "start") showArticle("getting-started");
  else if (route.startsWith("article/")) showArticle(route.slice(8));
  else listing(route, activeFilter);
  setMenu(false);
  if (!searchFocused) main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
  lastRoute = route;
  if (section && /^section-\d+$/.test(section))
    requestAnimationFrame(() =>
      document.getElementById(section)?.scrollIntoView({ behavior: "instant" }),
    );
}
function setMenu(open) {
  $("#sidebar").classList.toggle("open", open);
  $("#sidebar").inert = mobileMenu.matches && !open;
  $("#menu-backdrop").hidden = !(open && mobileMenu.matches);
  document.body.classList.toggle("menu-open", open && mobileMenu.matches);
  $("#menu-toggle").setAttribute("aria-expanded", String(open));
  $("#menu-toggle").setAttribute(
    "aria-label",
    open ? "메뉴 닫기" : "메뉴 열기",
  );
  $("#menu-toggle").innerHTML = icon(open ? "close" : "menu");
}
function doSearch() {
  const query = search.value.trim().slice(0, 200),
    next = "#/search" + (query ? "?q=" + encodeURIComponent(query) : "");
  if (location.hash === next) render();
  else location.hash = next;
}
$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(searchTimer);
  doSearch();
});
search.addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  if (!event.isComposing) searchTimer = setTimeout(doSearch, 180);
});
search.addEventListener("compositionend", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(doSearch, 180);
});
$("#menu-toggle").addEventListener("click", () => {
  const open = $("#menu-toggle").getAttribute("aria-expanded") !== "true";
  setMenu(open);
  if (open && mobileMenu.matches) $("#sidebar a")?.focus();
});
$("#menu-backdrop").addEventListener("click", () => {
  setMenu(false);
  $("#menu-toggle").focus();
});
$("#sidebar").addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});
$(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ behavior: "instant" });
});
mobileMenu.addEventListener("change", () => setMenu(false));
window.addEventListener("hashchange", () => {
  clearTimeout(searchTimer);
  render();
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    search.focus();
    search.select();
  }
  const open = $("#menu-toggle").getAttribute("aria-expanded") === "true";
  if (event.key === "Escape") {
    setMenu(false);
    if (open) $("#menu-toggle").focus();
    else if (document.activeElement === search) search.blur();
  }
  if (event.key === "Tab" && open && mobileMenu.matches) {
    const items = [
        $("#menu-toggle"),
        ...$("#sidebar").querySelectorAll("a,button"),
      ],
      first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
async function load() {
  setMenu(false);
  try {
    const response = await fetch("./data.json");
    if (!response.ok) throw Error();
    data = await response.json();
    if (!Array.isArray(data.articles) || !Array.isArray(data.categories))
      throw Error();
    render();
  } catch {
    main.innerHTML =
      '<section class="empty-state"><h1>위키를 불러오지 못했습니다.</h1><p>연결 상태를 확인하고 다시 시도해 주세요.</p><button id="retry" class="primary-button">다시 불러오기</button></section>';
    $("#retry").addEventListener("click", load);
  }
}
load();
