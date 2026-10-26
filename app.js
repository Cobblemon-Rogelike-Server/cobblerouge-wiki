"use strict";
const $ = (selector) => document.querySelector(selector),
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
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  swords:
    '<path d="m4 3 7 5 10 12-2 2L7 11 3 4zM14 7l6-4 1 1-4 7M5 15l4 4M3 21l4-4M15 16l4-4"/>',
  users:
    '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6M22 21v-3a6 6 0 0 0-4-5"/>',
  map: '<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15M15 6v15"/>',
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
const normalize = (value) =>
  String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko")
    .replace(/\s+/g, " ")
    .trim();
let data,
  searchTimer,
  lastRoute = "",
  tocObserver,
  toastTimer,
  scrollFrame;
let activeFilter = "전체";
const mobileMenu = matchMedia("(max-width:800px)"),
  storageKey = "cobblerouge-wiki:reading:v1";
let reading = { checked: [], saved: [], recent: [] };
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored && typeof stored === "object")
    for (const key of Object.keys(reading))
      if (Array.isArray(stored[key]))
        reading[key] = [
          ...new Set(
            stored[key].filter(
              (value) => typeof value === "string" && value.length < 160,
            ),
          ),
        ].slice(0, key === "recent" ? 6 : 200);
} catch {
  /* The wiki works when browser storage is unavailable. */
}
const saveReading = () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(reading));
    return true;
  } catch {
    return false;
  }
};
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2600);
}
const category = (id) => data.categories.find((c) => c.id === id),
  find = (id) => data.articles.find((a) => a.id === id),
  routeOf = (a) => "#/article/" + encodeURIComponent(a.id);
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
const picture = (path, className = "", alt = "") =>
  path
    ? `<img class="${className}" src="./${esc(path)}" width="128" height="128" loading="lazy" decoding="async" alt="${esc(alt)}">`
    : "";
const minRead = (a) => Math.max(1, Math.ceil(a.search.length / 450));
$("#search-icon").innerHTML = icon("search");
const guideTasks = [
  ["party", "파티와 코스트 조건을 확인했어요", "dungeon-entry"],
  ["map", "보상 뒤에 지도를 쓰는 법을 알아요", "dungeon-currency-map"],
  ["settle", "모험 뒤에 남는 것을 이해했어요", "dungeon-settlement"],
  ["next", "다음에 읽을 문서를 골랐어요", "dungeon-stats"],
];
const journey = [
  {
    title: "입장 준비",
    tag: "모험 밖",
    image: "dungeon/map",
    heading: "내 코스트 안에서 파티를 준비해요.",
    text: "같은 진화 계열은 한 마리만. 지닌 도구를 빼고 /던전 입장에서 조건을 확인하세요.",
    link: "dungeon-entry",
    action: "파티 준비 자세히 보기",
  },
  {
    title: "방 공략",
    tag: "모험 안",
    image: "dungeon/wild",
    heading: "레벨 5에서 시작해 이번 모험을 키워요.",
    text: "야생에서 포획하고, 전투하거나 연구소를 이용해 파티를 정비하세요. 입장 전 파티는 PC에 보관됩니다.",
    link: "dungeon-overview",
    action: "여섯 가지 방 알아보기",
  },
  {
    title: "지도와 선택",
    tag: "다음 층으로",
    image: "dungeon/ancient-coin",
    heading: "보상을 받았다면, 지도를 우클릭해요.",
    text: "다음 방을 고르기 전에 정비할 수 있어요. 10층마다 보스를 만나고, 이후에는 다음 구간의 테마를 선택합니다.",
    link: "dungeon-currency-map",
    action: "지도와 금화 사용법",
  },
  {
    title: "보스와 정산",
    tag: "다음 모험으로",
    image: "dungeon/boss",
    heading: "이번 도전의 성과를 정산해요.",
    text: "쓰러뜨린 보스 수에 따라 종료 보상을 정산합니다. 던전 파티·전리품·남은 금화는 모험이 끝나면 정리돼요.",
    link: "dungeon-settlement",
    action: "종료 후 남는 것 확인",
  },
];
function navLink(id, name, svg, active, href = "#/" + id, count = "") {
  return `<a href="${href}" class="nav-item ${active === id ? "active" : ""}" ${active === id ? 'aria-current="page"' : ""}>${icon(svg)}<span>${esc(name)}</span>${count !== "" ? `<span class="nav-count">${count}</span>` : ""}</a>`;
}
function navigation(active) {
  const group = (title, ids) =>
    `<p class="nav-label">${title}</p>` +
    ids
      .map((id) => {
        const c = category(id);
        return c
          ? navLink(id, c.name, c.icon, active, "#/" + id, entries(id).length)
          : "";
      })
      .join("");
  $("#navigation").innerHTML =
    `${navLink("home", "위키 홈", "home", active)}${navLink("start", "처음 시작하기", "compass", active, "#/article/getting-started")}<div class="nav-separator"></div>${group("모험을 떠나요", ["dungeon", "guild"])}${group("섬에서 살아가요", ["crops", "trees", "wood", "decor", "guides"])}<div class="nav-separator"></div>${navLink("saved", "나중에 읽을 문서", "bookmark", active, "#/saved", reading.saved.filter((id) => find(id)).length)}`;
}
function breadcrumb(parts = []) {
  return `<nav class="breadcrumb" aria-label="현재 위치"><a href="#/">${icon("home")} 위키 홈</a>${parts.map((p) => `<span aria-hidden="true">/</span>${p.href ? `<a href="${p.href}">${esc(p.name)}</a>` : `<span aria-current="page">${esc(p.name)}</span>`}`).join("")}</nav>`;
}
function card(a) {
  const c = category(a.category);
  return `<a class="entry-card" href="${routeOf(a)}"><div class="entry-picture ${a.category}">${a.image ? picture(a.image, "pixel", "") : icon(c.icon)}</div><div class="entry-copy"><span class="entry-group">${esc(a.group || c.name)}</span><h3>${esc(a.title)}</h3><p>${esc(a.summary)}</p><span class="entry-bottom">${minRead(a)}분 읽기 ${icon("arrow")}</span></div></a>`;
}
function heading(kicker, title, link = "", label = "전체 보기") {
  return `<div class="section-heading"><div><span class="eyebrow">${kicker}</span><h2>${title}</h2></div>${link ? `<a class="text-link" href="${link}">${label} ${icon("arrow")}</a>` : ""}</div>`;
}
function journeyMarkup() {
  return `<section class="journey-section">${heading("HOW THE ADVENTURE WORKS", "한 번의 모험은 이렇게 흘러가요.")}<p class="section-intro">각 단계를 눌러, 지금 해야 할 일을 살펴보세요.</p><div class="journey-tabs" role="tablist" aria-label="던전의 진행 단계">${journey.map((s, i) => `<button role="tab" id="journey-tab-${i}" aria-controls="journey-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-journey="${i}"><span class="step-index">0${i + 1}</span><strong>${s.title}</strong><span class="step-arrow">${icon("arrow")}</span></button>`).join("")}</div><div id="journey-panel" class="journey-panel" role="tabpanel" aria-labelledby="journey-tab-0" tabindex="0"></div><p class="journey-caption">방 공략 → 보상 수령 → 지도 사용을 반복해요. 유한 던전의 목표는 100층 보스입니다.</p></section>`;
}
function bindJourney() {
  if (!$("#journey-panel")) return;
  const choose = (i) => {
    const s = journey[i];
    document.querySelectorAll("[data-journey]").forEach((button, n) => {
      button.setAttribute("aria-selected", String(i === n));
      button.tabIndex = i === n ? 0 : -1;
    });
    $("#journey-panel").setAttribute("aria-labelledby", "journey-tab-" + i);
    $("#journey-panel").innerHTML =
      `<div class="journey-art">${picture("images/" + s.image + ".png", "pixel", "")}</div><div><span class="pill">${s.tag}</span><h3>${s.heading}</h3><p>${s.text}</p><a class="text-link" href="${routeOf(find(s.link))}">${s.action} ${icon("arrow")}</a></div><span class="journey-watermark" aria-hidden="true">0${i + 1}</span>`;
  };
  document.querySelectorAll("[data-journey]").forEach((button) => {
    button.addEventListener("click", () =>
      choose(Number(button.dataset.journey)),
    );
    button.addEventListener("keydown", (event) => {
      let n = Number(button.dataset.journey);
      if (event.key === "ArrowRight") n = (n + 1) % 4;
      else if (event.key === "ArrowLeft") n = (n + 3) % 4;
      else if (event.key === "Home") n = 0;
      else if (event.key === "End") n = 3;
      else return;
      event.preventDefault();
      choose(n);
      $("#journey-tab-" + n).focus();
    });
  });
  choose(0);
}
function home() {
  navigation("home");
  document.title = "CobbleRouge 위키 — 모험의 첫 페이지";
  const featured = [
    [
      "dungeon",
      "던전으로 떠나요",
      "파티 준비부터 보스와 종료 보상까지.",
      "dungeon/map",
    ],
    [
      "crops",
      "나만의 섬을 가꿔요",
      "56종의 작물과 성장·수확 방법을 찾아요.",
      "fruits/strawberry",
    ],
    [
      "guild",
      "함께하는 모험을 찾아요",
      "가입부터 의뢰·보상·합동 탐사까지.",
      "guild/emblem",
    ],
  ];
  const recent = reading.recent.map(find).filter(Boolean).slice(0, 3),
    readCount = guideTasks.filter(([id]) =>
      reading.checked.includes(id),
    ).length;
  main.innerHTML = `<div class="home-topline"><span>모험가의 기록</span><span>게임 속 작은 발견을 위한 안내서</span></div>
 <section class="hero"><img class="hero-landscape" src="./assets/editorial/islands.webp" width="1792" height="1024" alt="농장과 오두막에서 다리를 건너 숲속 던전으로 이어지는 떠 있는 섬의 콘셉트 일러스트" fetchpriority="high"><div class="hero-shade"></div><div class="hero-copy"><span class="hero-eyebrow"><span class="small-star">✧</span> YOUR NEXT ADVENTURE STARTS HERE</span><h1>처음 온 섬,<br>어디부터 시작할까요?</h1><p>든든한 파티와 한 번의 도전, 그리고 나만의 섬.<br>당신의 첫 모험을 한 페이지씩 준비해 보세요.</p><div class="hero-actions"><a class="primary-button" href="#/article/getting-started">첫 모험 준비하기 ${icon("arrow")}</a><a class="hero-secondary" href="#/dungeon">던전 도감 보기 ↗</a></div><span class="hero-note">${icon("book")} 처음이라면 ‘시작 안내’부터 읽어 보세요.</span></div><span class="hero-stamp"><span>COBBLEROUGE</span><strong>모험의 첫 페이지</strong><small>FIELD GUIDE · 01</small></span></section>
 <div class="hero-caption"><span>EXPLORE. GROW. BELONG.</span><span>위키를 위한 콘셉트 일러스트</span></div>
 <section class="quick-start"><a class="quick-start-intro" href="#/article/getting-started"><span class="round-icon">${icon("compass")}</span><div><strong>처음 오셨나요?</strong><span>입장 전 꼭 알아둘 것부터 시작해요.</span></div>${icon("arrow")}</a><div class="quick-facts"><a href="#/article/dungeon-entry"><span>01</span> 파티와 코스트</a><a href="#/article/dungeon-currency-map"><span>02</span> 지도 사용법</a><a href="#/article/dungeon-settlement"><span>03</span> 모험 뒤에 남는 것</a></div></section>
 <section class="explore-section">${heading("FIND YOUR WAY", "어떤 모험을 찾고 있나요?")}<div class="path-cards">${featured.map(([id, title, desc, img], i) => `<a class="path-card path-${id}" href="#/${id}"><span class="path-number">0${i + 1}</span><div class="path-image">${picture("images/" + img + ".png", "pixel", "")}</div><span class="entry-group">${id === "dungeon" ? "BATTLE & EXPLORE" : id === "crops" ? "GROW & BUILD" : "PLAY TOGETHER"}</span><h3>${title}</h3><p>${desc}</p><span class="path-bottom">${entries(id).length}개 문서 ${icon("arrow")}</span></a>`).join("")}</div></section>
 ${journeyMarkup()}
 <section class="home-reading"><div><div class="reading-feature"><span class="eyebrow">A LITTLE PREPARATION</span><h2>알아두면 가벼워지는<br>첫 도전.</h2><p>처음부터 모든 규칙을 외울 필요는 없어요.<br>이 네 가지를 알고 출발하면 충분해요.</p><a class="text-link" href="#/article/getting-started">시작 안내 펼치기 ${icon("arrow")}</a><div class="mini-progress"><span>내 읽기 체크</span><strong>${readCount} / 4</strong><progress value="${readCount}" max="4" aria-label="시작 안내 읽기 체크"></progress></div></div></div><div class="must-read">${[
   [
     "dungeon-entry",
     "파티는 코스트 안에서",
     "같은 진화 계열은 한 마리만 준비해요.",
   ],
   [
     "dungeon-entry",
     "원래 파티는 PC에 보관돼요",
     "던전에서는 기본 진화 형태, 레벨 5부터 시작해요.",
   ],
   [
     "dungeon-settlement",
     "전리품과 종료 보상은 달라요",
     "이번 모험의 파티와 아이템은 정산 뒤 정리돼요.",
   ],
 ]
   .map(
     ([id, title, desc], i) =>
       `<a href="#/article/${id}"><span class="must-number">0${i + 1}</span><div><h3>${title}</h3><p>${desc}</p></div>${icon("arrow")}</a>`,
   )
   .join("")}</div></section>
 <section class="reference-section">${heading("THE FIELD LIBRARY", "궁금할 때 바로 펼쳐보세요.")}<div class="reference-grid">${[
   "guides",
   "trees",
   "wood",
   "decor",
 ]
   .map((id) => {
     const c = category(id);
     return `<a href="#/${id}"><span class="reference-icon">${icon(c.icon)}</span><div><h3>${c.name}</h3><p>${c.description}</p></div>${icon("arrow")}</a>`;
   })
   .join("")}</div></section>
 <section class="faq-section">${heading("GOOD TO KNOW", "자주 궁금해하는 이야기")}<div class="faq-list"><details><summary>더블 배틀은 친구와 같이 입장하는 건가요? <span>+</span></summary><p>아니요. 한 플레이어가 자신의 포켓몬 두 마리를 직접 지휘하는 방식입니다. 던전은 각자 도전하며, 탐험단 가입과도 별개예요. <a href="#/article/dungeon-overview">싱글·더블 안내 →</a></p></details><details><summary>모험 도중에 나오면 원래 포켓몬도 사라지나요? <span>+</span></summary><p>입장 전 파티는 PC에 보관됩니다. 종료할 때 정리되는 것은 이번 던전의 파티·포획한 포켓몬·전리품과 금화예요. 보관한 장비와 종료 보상은 정산 때 처리됩니다. <a href="#/article/dungeon-settlement">정산 안내 →</a></p></details><details><summary>작물이 자라지 않을 때는 무엇을 확인하나요? <span>+</span></summary><p>빛이 9 이상인지, 알맞은 곳에 심었는지 확인하세요. 성장 시간은 섬이 로드되어 있는 동안을 기준으로 합니다. <a href="#/article/growing">재배의 기본 →</a></p></details></div></section>
 ${recent.length ? `<section>${heading("CONTINUE YOUR JOURNAL", "최근 펼쳐본 문서")}<div class="recent-list">${recent.map((a) => `<a href="${routeOf(a)}">${icon("book")}<span>${esc(a.title)}</span>${icon("arrow")}</a>`).join("")}</div></section>` : ""}
 <aside class="closing-note"><span>✧</span><div><strong>정답을 외우기보다, 나만의 모험을 발견해요.</strong><p>수치와 보상은 현재 게임의 안내를 확인하세요. 이 위키는 그 길을 찾는 데 함께할게요.</p></div><a href="#/article/getting-started">시작 안내 ${icon("arrow")}</a></aside>`;
  bindJourney();
}
function listing(id, filter = "전체") {
  const c = category(id);
  if (!c) return missing();
  navigation(id);
  document.title = `${c.name} — CobbleRouge 위키`;
  const list = entries(id),
    groups = [...new Set(list.map((a) => a.group).filter(Boolean))],
    selected =
      id === "crops" && filter !== "전체"
        ? list.filter((a) => a.group === filter)
        : list;
  const visual = {
    dungeon: "images/dungeon/map.png",
    guild: "images/guild/emblem.png",
    crops: "images/fruits/strawberry.png",
    trees: "images/trees/world_tree_log.png",
    wood: "images/wood/apricot_stairs.png",
  }[id];
  main.innerHTML = `${breadcrumb([{ name: c.name }])}<header class="page-heading"><div><span class="eyebrow">THE ${c.label} GUIDE</span><h1>${c.name}<span class="heading-count">${list.length}</span></h1><p>${c.description}</p></div>${visual ? picture(visual, "category-image pixel", "") : icon(c.icon)}</header>${["dungeon", "guild", "guides"].includes(id) ? `<a class="category-start" href="${routeOf(find(id === "guild" ? "guild-overview" : id === "dungeon" ? "dungeon-entry" : "getting-started"))}">${icon("compass")}<span><strong>처음이라면 이 문서부터</strong>${id === "guild" ? "탐험단의 역할과 가입 방법" : id === "dungeon" ? "입장 조건과 파티 준비" : "처음 온 모험가를 위한 시작 안내"}</span>${icon("arrow")}</a>` : ""}${id === "crops" ? `<aside class="notice compact">성장 시간은 섬이 로드되어 있는 동안 기준입니다. 가격은 섬 상점 기본값이며 현재 서버 설정을 확인하세요.</aside><div class="filters" role="group" aria-label="재배 환경">${["전체", ...groups].map((g) => `<button class="filter ${g === filter ? "selected" : ""}" data-filter="${esc(g)}" aria-pressed="${g === filter}">${esc(g)}</button>`).join("")}</div>` : ""}<div class="list-meta"><span role="status">${selected.length}개 문서${filter !== "전체" ? " · " + esc(filter) : ""}</span><span>궁금한 항목을 눌러 자세히 읽어보세요.</span></div><div class="entry-grid">${selected.map(card).join("")}</div>`;
  main.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      listing(id, activeFilter);
      [...main.querySelectorAll("[data-filter]")]
        .find((b) => b.dataset.filter === activeFilter)
        ?.focus({ preventScroll: true });
    }),
  );
}
function guideChecklist() {
  return `<section class="guide-checklist"><div><span class="eyebrow">BEFORE YOUR FIRST ADVENTURE</span><h2>출발 전, 한 번만 확인해요.</h2><p>이해한 항목을 체크해 두세요. 읽기 기록은 이 기기에만 저장됩니다.</p></div><div>${guideTasks.map(([id, label, link]) => `<label><input type="checkbox" data-learning="${id}" ${reading.checked.includes(id) ? "checked" : ""}><span>${label}</span><a href="#/article/${link}" aria-label="${label} 관련 문서">${icon("arrow")}</a></label>`).join("")}</div><p id="checklist-status" role="status"></p><button class="text-button" id="reset-reading">읽기 체크 초기화</button></section>`;
}
function showArticle(id) {
  const a = find(id);
  if (!a) return missing();
  const c = category(a.category),
    isStart = id === "getting-started";
  navigation(isStart ? "start" : c.id);
  document.title = `${a.title} — CobbleRouge 위키`;
  const siblings = entries(c.id),
    current = siblings.indexOf(a),
    saved = reading.saved.includes(id);
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
  main.innerHTML = `${breadcrumb([{ name: c.name, href: "#/" + c.id }, { name: a.title }])}<div class="article-layout"><article class="article"><header class="article-heading"><span class="eyebrow">${esc(isStart ? "YOUR FIRST CHAPTER" : c.label + " / " + (a.group || c.name))}</span><h1>${esc(a.title)}</h1><p>${esc(a.summary)}</p><div class="article-meta"><span>${icon("clock")} 약 ${minRead(a)}분 읽기</span><span>내용 기준 ${data.updated.replaceAll("-", ".")}</span></div></header><div class="article-tools"><button id="save-article" class="tool-button ${saved ? "is-saved" : ""}" aria-pressed="${saved}">${icon("bookmark")} ${saved ? "저장한 문서" : "나중에 읽기"}</button><button id="copy-link" class="tool-button">${icon("book")} 링크 복사</button><span id="copy-status" class="sr-only" role="status"></span></div><details class="mobile-toc"><summary>${icon("book")} 이 문서의 목차 <span aria-hidden="true">+</span></summary><nav aria-label="이 문서의 목차"><ol id="mobile-toc-list"></ol></nav></details>${isStart ? `<div class="start-note">${icon("compass")} 처음이라면 아래 순서대로 읽어보세요. 한 번에 모든 규칙을 외울 필요는 없어요.</div>${journeyMarkup()}` : ""}${c.id !== "guides" ? '<aside class="notice compact">수치와 가격은 기본 설정입니다. 현재 게임에서 안내하는 서버 설정을 먼저 확인하세요.</aside>' : ""}<div class="prose">${a.html}</div>${isStart ? guideChecklist() : ""}<div class="article-pagination">${current > 0 ? `<a href="${routeOf(siblings[current - 1])}"><small>← 이전 문서</small><strong>${esc(siblings[current - 1].title)}</strong></a>` : "<span></span>"}${current < siblings.length - 1 ? `<a href="${routeOf(siblings[current + 1])}"><small>다음 문서 →</small><strong>${esc(siblings[current + 1].title)}</strong></a>` : "<span></span>"}</div>${related.length ? `<section class="related">${heading("YOUR NEXT PAGE", "이어서 읽으면 좋아요.")}<div class="related-links">${related.map((x) => `<a href="${routeOf(x)}"><div><span>${category(x.category).name}</span><strong>${esc(x.title)}</strong></div>${icon("arrow")}</a>`).join("")}</div></section>` : ""}</article><aside class="article-aside"><nav class="toc" aria-label="이 문서의 목차"><span class="toc-title">${icon("book")} 이 문서에서</span><ol id="toc-list"></ol></nav><a class="aside-start" href="#/article/getting-started">${icon("compass")}<strong>모험이 처음이라면</strong><span>입장부터 정산까지<br>시작 안내와 함께해요.</span><span class="text-link">첫 페이지로 ${icon("arrow")}</span></a><span class="aside-date">수치와 규칙은 실제 게임의<br>현재 안내를 기준으로 확인하세요.</span></aside></div>`;
  const headings = [...main.querySelectorAll(".prose h2,.prose h3")];
  headings.forEach((h, i) => (h.id = "section-" + (i + 1)));
  $(".toc").hidden = headings.length === 0;
  $(".mobile-toc").hidden = headings.length === 0;
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
      document.getElementById(link.dataset.section)?.scrollIntoView({
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
          if (entry.isIntersecting) {
            main
              .querySelectorAll("[data-section]")
              .forEach((link) =>
                link.setAttribute(
                  "aria-current",
                  String(link.dataset.section === entry.target.id),
                ),
              );
          }
      },
      { rootMargin: "-110px 0px -60% 0px" },
    );
    headings.forEach((h) => tocObserver.observe(h));
  }
  $("#save-article").addEventListener("click", () => {
    const button = $("#save-article"),
      exists = reading.saved.includes(id);
    reading.saved = exists
      ? reading.saved.filter((x) => x !== id)
      : [id, ...reading.saved];
    const stored = saveReading();
    button.setAttribute("aria-pressed", String(!exists));
    button.classList.toggle("is-saved", !exists);
    button.innerHTML =
      icon("bookmark") + (exists ? " 나중에 읽기" : " 저장한 문서");
    navigation(isStart ? "start" : c.id);
    toast(
      stored
        ? exists
          ? "저장한 문서에서 뺐어요."
          : "나중에 읽을 문서에 저장했어요."
        : "이 기기에 저장할 수 없어 이번 화면에서만 유지됩니다.",
    );
  });
  $("#copy-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $("#copy-status").textContent = "링크를 복사했습니다.";
      toast("이 문서의 링크를 복사했어요.");
    } catch {
      $("#copy-status").textContent = "주소창에서 링크를 복사해 주세요.";
      toast("주소창의 주소를 복사해 주세요.");
    }
  });
  if (isStart) {
    const updateChecklist = () => {
      $("#checklist-status").textContent =
        `${guideTasks.filter(([key]) => reading.checked.includes(key)).length} / 4개 확인했어요. 게임 진행도와는 별개인 읽기 체크입니다.`;
    };
    main.querySelectorAll("[data-learning]").forEach((box) =>
      box.addEventListener("change", () => {
        reading.checked = box.checked
          ? [...new Set([...reading.checked, box.dataset.learning])]
          : reading.checked.filter((x) => x !== box.dataset.learning);
        if (!saveReading()) toast("이번 화면에서만 읽기 체크를 유지합니다.");
        updateChecklist();
      }),
    );
    $("#reset-reading").addEventListener("click", () => {
      reading.checked = [];
      saveReading();
      main
        .querySelectorAll("[data-learning]")
        .forEach((box) => (box.checked = false));
      updateChecklist();
    });
    updateChecklist();
    bindJourney();
  }
  reading.recent = [id, ...reading.recent.filter((x) => x !== id)].slice(0, 6);
  saveReading();
}
function results(query, scope = "all") {
  if (scope !== "all" && !category(scope)) scope = "all";
  navigation("search");
  document.title = `${query ? query + " 검색" : "검색"} — CobbleRouge 위키`;
  const words = normalize(query).split(" ").filter(Boolean),
    matches = words.length
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
  main.innerHTML = `${breadcrumb([{ name: "검색" }])}<header class="page-heading"><div><span class="eyebrow">SEARCH YOUR FIELD GUIDE</span><h1>${query ? "‘" + esc(query) + "’ 검색 결과" : "궁금한 것부터 찾아보세요."}</h1><p role="status">${query ? selected.length + "개의 문서를 찾았습니다." : "던전 입장, 유전자, 딸기처럼 이름이나 궁금한 내용을 입력해 보세요."}</p></div>${icon("search")}</header>${matches.length ? `<div class="filters search-filters" role="group" aria-label="검색 분류">${[["all", "전체", matches.length], ...data.categories.map((c) => [c.id, c.name, matches.filter((a) => a.category === c.id).length]).filter((x) => x[2])].map(([id, name, count]) => `<button class="filter ${scope === id ? "selected" : ""}" data-search-category="${id}" aria-pressed="${scope === id}">${name} <span>${count}</span></button>`).join("")}</div><div class="entry-grid">${selected.map(card).join("")}</div>` : `<section class="empty-state">${icon("search")}<h2>${query ? "조금 다른 말로 찾아볼까요?" : "어떤 모험이 궁금한가요?"}</h2><p>${query ? "짧은 이름이나 다른 검색어를 입력해 보세요. 아이템 ID로도 검색할 수 있어요." : "자주 찾는 주제부터 가볍게 펼쳐보세요."}</p><div class="suggestions">${["던전 입장", "유전자", "딸기"].map((q) => `<a href="#/search?q=${encodeURIComponent(q)}">${q} ${icon("arrow")}</a>`).join("")}</div><a class="text-link" href="#/article/getting-started">처음이라면 시작 안내 읽기 ${icon("arrow")}</a></section>`}`;
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
function savedPage() {
  navigation("saved");
  document.title = "나중에 읽을 문서 — CobbleRouge 위키";
  const list = reading.saved.map(find).filter(Boolean);
  main.innerHTML = `${breadcrumb([{ name: "나중에 읽을 문서" }])}<header class="page-heading"><div><span class="eyebrow">YOUR READING SHELF</span><h1>나중에 읽을 문서<span class="heading-count">${list.length}</span></h1><p>문서의 ‘나중에 읽기’를 누르면 이 기기에 모아둘 수 있어요.</p></div>${icon("bookmark")}</header>${list.length ? `<div class="entry-grid">${list.map(card).join("")}</div>` : `<div class="empty-state">${icon("bookmark")}<h2>아직 빈 책장이에요.</h2><p>궁금한 문서를 저장하고 다음 모험 전에 다시 읽어보세요.</p><a class="primary-button" href="#/article/getting-started">첫 문서 펼치기 ${icon("arrow")}</a></div>`}`;
}
function missing() {
  navigation("");
  document.title = "문서를 찾을 수 없습니다 — CobbleRouge 위키";
  main.innerHTML = `<section class="empty-state">${icon("map")}<span class="eyebrow">A SMALL DETOUR</span><h1>길을 조금 벗어났네요.</h1><p>주소를 확인하거나 위키 홈에서 다른 이야기를 찾아보세요.</p><a class="primary-button" href="#/">위키 홈으로 ${icon("arrow")}</a></section>`;
}
function updateProgress() {
  scrollFrame = null;
  const prose = main.querySelector(".prose"),
    bar = $("#reading-progress");
  bar.hidden = !prose;
  if (!prose) return;
  const top = prose.getBoundingClientRect().top + scrollY - 130,
    total = Math.max(1, prose.scrollHeight - innerHeight + 190);
  bar.value = Math.max(0, Math.min(100, ((scrollY - top) / total) * 100));
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
  else if (route === "saved") savedPage();
  else if (route === "start") showArticle("getting-started");
  else if (route.startsWith("article/")) showArticle(route.slice(8));
  else listing(route, activeFilter);
  setMenu(false);
  if (!searchFocused) main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
  lastRoute = route;
  if (section && /^section-\d+$/.test(section))
    requestAnimationFrame(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: "instant" });
      updateProgress();
    });
  else updateProgress();
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
  $("#menu-toggle").innerHTML = open ? icon("close") : "☰";
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
  if (open && mobileMenu.matches) $("#navigation a").focus();
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
window.addEventListener(
  "scroll",
  () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
  },
  { passive: true },
);
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
    const focusable = [
        $("#menu-toggle"),
        ...$("#sidebar").querySelectorAll("a,button"),
      ],
      first = focusable[0],
      last = focusable.at(-1);
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
  try {
    const response = await fetch("./data.json");
    if (!response.ok) throw Error();
    data = await response.json();
    if (!Array.isArray(data.articles) || !Array.isArray(data.categories))
      throw Error();
    render();
  } catch {
    main.innerHTML =
      '<section class="empty-state"><h1>위키를 불러오지 못했어요.</h1><p>연결 상태를 확인하고 다시 시도해 주세요.</p><button id="retry" class="primary-button">다시 불러오기</button></section>';
    $("#retry").addEventListener("click", load);
  }
}
load();
