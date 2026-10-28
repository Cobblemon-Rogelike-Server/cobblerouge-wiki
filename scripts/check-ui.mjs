// Real browser checks; no mocks of the wiki, data, routes or browser storage.
import { promises as fs } from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectPage } from "./lib/cdp.mjs";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const artifacts =
  process.env.WIKI_UI_ARTIFACTS ||
  path.join(os.tmpdir(), "cobblerouge-wiki-preview");
await fs.mkdir(artifacts, { recursive: true });
const profile = await fs.mkdtemp(
  path.join(os.tmpdir(), "cobblerouge-wiki-browser-"),
);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
const {
  headers: [{ headers }],
} = JSON.parse(
  await fs.readFile(new URL("../vercel.json", import.meta.url), "utf8"),
);
let failData = false;
const server = http.createServer(async (req, res) => {
  try {
    if (failData && req.url === "/data.json") {
      res.writeHead(503).end();
      return;
    }
    const target = path.resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (target !== root.slice(0, -1) && !target.startsWith(root))
      throw Error("outside root");
    const filename =
      target === root.slice(0, -1) || target === root
        ? path.join(root, "index.html")
        : target;
    const bytes = await fs.readFile(filename);
    res.writeHead(200, {
      "Content-Type":
        mime[path.extname(filename)] || "application/octet-stream",
      ...Object.fromEntries(headers.map((h) => [h.key, h.value])),
    });
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = spawn(
  process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let errors = "",
  page;
browser.stderr.on("data", (chunk) => {
  errors += chunk;
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await delay(30);
  }
  throw Error("Timed out: " + label);
}
const report = { links: [], actions: [], viewports: [], status: "running" };
const targets = new Map(),
  articles = JSON.parse(
    await fs.readFile(path.join(root, "data.json"), "utf8"),
  );
const articleMap = new Map(articles.articles.map((a) => [a.id, a]));
const categoryMap = new Map(articles.categories.map((c) => [c.id, c]));
const visited = new Set();
const record = (name, source, details) =>
  report.actions.push({ name, source, status: "passed", details });
async function writeReport() {
  await fs.writeFile(
    path.join(artifacts, "link-audit.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
try {
  let port;
  await until(
    async () => {
      try {
        port = Number(
          (
            await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")
          ).split("\n")[0],
        );
        return port > 0;
      } catch {
        return false;
      }
    },
    "Chromium debugging port",
    45000,
  );
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  page = await connectPage(
    tabs.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  const { send, evaluate } = page;
  const click = async (selector) => {
    await send("Page.bringToFront");
    await send("Emulation.setFocusEmulationEnabled", { enabled: true });
    const p = await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...p,
      button: "left",
      clickCount: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...p,
      button: "left",
      clickCount: 1,
    });
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__errors=[];window.__csp=[];window.addEventListener('error',e=>window.__errors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective))`,
  });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const viewport = async (width, height = 1000) => {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 821,
    });
    await delay(50);
  };
  await viewport(1440);
  await send("Page.navigate", { url: origin });
  await until(
    () => evaluate(`Boolean(document.querySelector('.home-heading'))`),
    "home",
  );
  const settle = () =>
    evaluate(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
    );
  const route = async (hash) => {
    await settle();
    let title;
    try {
      title = expected(hash);
    } catch {
      title = "문서를 찾을 수 없습니다.";
    }
    await evaluate(
      `document.querySelector('#search').blur();if(location.hash===${JSON.stringify(hash)}){document.querySelector('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}else location.hash=${JSON.stringify(hash)}`,
    );
    await until(
      () =>
        evaluate(
          `location.hash===${JSON.stringify(hash)} && document.querySelector('h1')?.textContent===${JSON.stringify(title)} && document.querySelector('#main')===document.activeElement`,
        ),
      "route " + hash,
    );
    await settle();
  };
  const images = async () => {
    await evaluate(
      `Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>null)}))`,
    );
    assert.deepEqual(
      await evaluate(
        `[...document.images].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src'))`,
      ),
      [],
      "images load",
    );
    assert.equal(
      await evaluate(
        `[...document.images].every(i=>!i.src.includes('/editorial/'))`,
      ),
      true,
      "only game images and brand icon",
    );
  };
  const overflow = async (label) =>
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),
      true,
      label + " horizontal overflow",
    );
  const clean = async () => {
    assert.deepEqual(
      await evaluate("window.__errors"),
      [],
      "browser exceptions",
    );
    assert.deepEqual(await evaluate("window.__csp"), [], "production CSP");
    assert.equal(
      await evaluate(
        `document.querySelectorAll('#save-article,[data-learning],input[type=checkbox],progress,.recent-list,.mini-progress,a[href="#/saved"]').length`,
      ),
      0,
      "personal reading UI removed",
    );
  };
  const shot = async (name, full = false) => {
    await images();
    const metrics = await send("Page.getLayoutMetrics"),
      params = { format: "png", captureBeyondViewport: full };
    if (full)
      params.clip = {
        x: 0,
        y: 0,
        width: metrics.cssContentSize.width,
        height: metrics.cssContentSize.height,
        scale: 1,
      };
    const out = await send("Page.captureScreenshot", params);
    await fs.writeFile(
      path.join(artifacts, name + ".png"),
      Buffer.from(out.data, "base64"),
    );
  };
  function expected(hash) {
    const url = new URL(hash, origin),
      [raw] = url.hash.slice(2).split("?"),
      route = decodeURIComponent(raw || "");
    if (route === "") return "CobbleRouge 위키";
    if (route === "start") return articleMap.get("getting-started").title;
    if (route.startsWith("article/")) {
      const a = articleMap.get(route.slice(8));
      assert.ok(a, "unknown article " + hash);
      return a.title;
    }
    if (route === "search") {
      const q = new URLSearchParams(url.hash.split("?")[1]).get("q");
      return q ? "‘" + q + "’ 검색 결과" : "문서 검색";
    }
    const c = categoryMap.get(route);
    assert.ok(c, "unknown route " + hash);
    return c.name;
  }
  async function gather(source) {
    const links = await evaluate(
      `[...document.querySelectorAll('a[href]')].map(a=>({label:a.textContent.trim()||a.getAttribute('aria-label')||'',href:a.getAttribute('href'),visible:!!a.getClientRects().length}))`,
    );
    for (const link of links) {
      assert.ok(link.href && link.href !== "#", "empty link at " + source);
      const u = new URL(link.href, origin),
        row = { source, label: link.label, href: link.href, status: "pending" };
      if (u.origin !== origin) {
        assert.equal(u.protocol, "https:");
        assert.equal(u.hostname, "github.com");
        row.kind = "external";
        row.status = "checked-separately";
      } else if (u.hash === "#main") {
        row.kind = "skip";
        row.status = "passed";
      } else if (u.hash.startsWith("#/")) {
        expected(u.hash);
        row.kind = "route";
        const old = targets.get(u.hash);
        if (!old || (!old.visible && link.visible))
          targets.set(u.hash, {
            source,
            href: link.href,
            visible: link.visible,
          });
      } else {
        assert.equal(u.pathname, "/LICENSE.txt");
        const response = await fetch(u);
        assert.equal(response.status, 200);
        assert.ok((await response.text()).length > 100);
        row.kind = "resource";
        row.status = "passed";
      }
      report.links.push(row);
    }
    await clean();
  }
  await gather("#/");
  await shot("home-desktop");
  await shot("home-desktop-full", true);
  assert.equal(
    await evaluate(`document.querySelectorAll('.journey-flow>li').length`),
    4,
    "all four steps visible without buttons",
  );
  assert.ok(
    await evaluate(
      `document.querySelector('.journey-flow').textContent.includes('地図')||document.querySelector('.journey-flow').textContent.includes('지도 선택')`,
    ),
  );
  // Audit every page's rendered links, including generated previous/next/related/toc navigation.
  for (const a of articles.articles) {
    const hash = "#/article/" + encodeURIComponent(a.id);
    await route(hash);
    assert.equal(
      await evaluate(`document.querySelector('h1').textContent`),
      a.title,
    );
    await overflow(a.id);
    await images();
    await gather(hash);
    visited.add(hash);
  }
  for (const c of articles.categories) {
    const hash = "#/" + c.id;
    await route(hash);
    await gather(hash);
    await images();
  }
  await route("#/article/getting-started");
  await shot("guide-desktop");
  // Test every crop filter and gather the links in those states too.
  await route("#/crops");
  const filters = await evaluate(
    `[...document.querySelectorAll('[data-filter]')].map(b=>b.dataset.filter)`,
  );
  for (const filter of filters) {
    await evaluate(
      `[...document.querySelectorAll('[data-filter]')].find(b=>b.dataset.filter===${JSON.stringify(filter)}).click()`,
    );
    const count = articles.articles.filter(
      (a) =>
        a.category === "crops" && (filter === "전체" || a.group === filter),
    ).length;
    assert.equal(
      await evaluate(`document.querySelectorAll('.document-row').length`),
      count,
    );
    assert.equal(
      await evaluate(`document.activeElement.getAttribute('aria-pressed')`),
      "true",
    );
    await gather("#/crops");
    record("재배 환경 필터", "#/crops", filter + ": " + count + " documents");
  }
  for (const query of ["던전입장", "유전자", "딸기", "cobblemon"]) {
    await route("#/search?q=" + encodeURIComponent(query));
    await gather("#/search?q=" + encodeURIComponent(query));
    if (query !== "cobblemon")
      assert.ok(
        (await evaluate(`document.querySelectorAll('.document-row').length`)) >
          0,
      );
  }
  await route("#/search?q=" + encodeURIComponent("유전자"));
  await shot("search-desktop");
  const facets = await evaluate(
    `[...document.querySelectorAll('[data-search-category]')].map(b=>b.dataset.searchCategory)`,
  );
  for (const facet of facets) {
    await evaluate(
      `[...document.querySelectorAll('[data-search-category]')].find(b=>b.dataset.searchCategory===${JSON.stringify(facet)}).click()`,
    );
    await until(
      () =>
        evaluate(
          `document.querySelector('[data-search-category="${facet}"]')?.getAttribute('aria-pressed')==='true'`,
        ),
      "search facet",
    );
    await gather(
      "#/search?q=" +
        encodeURIComponent("유전자") +
        (facet === "all" ? "" : "&category=" + facet),
    );
    record("검색 분류", locationSafe(facet), facet);
  }
  await route(
    "#/search?q=" + encodeURIComponent("<img src=x onerror=alert(1)>"),
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll('#main img,#main script').length`,
    ),
    0,
  );
  await route("#/search?q=no-such-item-9485");
  assert.ok(await evaluate(`Boolean(document.querySelector('.empty-state'))`));
  await route("#/search");
  await gather("#/search");
  await evaluate(
    `document.querySelector('#search').focus();document.querySelector('#search').value='딸기';document.querySelector('#search').dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}))`,
  );
  await delay(250);
  assert.equal(
    await evaluate("location.hash"),
    "#/search",
    "IME does not search unfinished composition",
  );
  await evaluate(
    `document.querySelector('#search').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))`,
  );
  await until(
    () =>
      evaluate(
        `document.querySelectorAll('.document-row').length>0 && location.hash.includes(encodeURIComponent('딸기'))`,
      ),
    "IME search",
  );
  record("한글 검색", "#/search", "Composition completes before search.");
  await evaluate(
    `document.querySelector('#search').value='유전자';document.querySelector('#search-form').requestSubmit()`,
  );
  await until(
    () => evaluate(`location.hash.includes(encodeURIComponent('유전자'))`),
    "search submit",
  );
  // Every distinct rendered destination is followed through a real DOM link, not only parsed.
  for (const [hash, target] of targets) {
    await route(target.source);
    await evaluate(
      `{const a=[...document.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===${JSON.stringify(target.href)});if(!a)throw Error('Missing audited anchor');if(a.closest('details'))a.closest('details').open=true;a.click();}`,
    );
    await until(
      () =>
        evaluate(
          `location.hash===${JSON.stringify(hash)} && document.querySelector('h1')?.textContent===${JSON.stringify(expected(hash))}`,
        ),
      "follow " + hash,
    );
    await settle();
    const section = new URLSearchParams(hash.split("?")[1]).get("section");
    if (section) {
      assert.equal(
        await evaluate(
          `Boolean(document.getElementById(${JSON.stringify(section)}))`,
        ),
        true,
      );
      assert.equal(
        await evaluate(
          `document.getElementById(${JSON.stringify(section)}).getBoundingClientRect().top>=document.querySelector('.topbar').getBoundingClientRect().bottom`,
        ),
        true,
        "section clear of header",
      );
    }
    visited.add(hash);
  }
  for (const row of report.links)
    if (row.kind === "route") {
      assert.ok(visited.has(new URL(row.href, origin).hash));
      row.status = "passed";
    }
  record(
    "실제 링크 이동",
    "#/",
    "Every distinct rendered hash destination followed via its anchor.",
  );
  await route("#/article/getting-started?section=section-4");
  await send("Browser.grantPermissions", {
    origin,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  });
  await click("#copy-link");
  await until(
    () =>
      evaluate(
        `document.querySelector('#copy-status').textContent==='링크를 복사했습니다.'`,
      ),
    "copy link",
  );
  assert.equal(
    await evaluate("navigator.clipboard.readText()"),
    origin + "/#/article/getting-started?section=section-4",
  );
  record(
    "링크 복사",
    await evaluate("location.hash"),
    "Current document including section copied.",
  );
  await send("Browser.resetPermissions");
  await send("Browser.setPermission", {
    origin,
    permission: { name: "clipboard-write" },
    setting: "denied",
  });
  await click("#copy-link");
  await until(
    () =>
      evaluate(
        `document.querySelector('#copy-status').textContent.includes('주소창')`,
      ),
    "copy fallback",
  );
  record(
    "링크 복사 실패 안내",
    "#/article/getting-started",
    "Address bar fallback visible.",
  );
  await evaluate(
    `localStorage.setItem('cobblerouge-wiki:reading:v1',JSON.stringify({checked:['party'],saved:['getting-started'],recent:['getting-started']}));localStorage.setItem('other-preference','preserve')`,
  );
  await send("Page.reload");
  await until(
    () => evaluate(`Boolean(document.querySelector('.prose'))`),
    "reload old reading state",
  );
  assert.equal(
    await evaluate(`localStorage.getItem('cobblerouge-wiki:reading:v1')`),
    null,
  );
  assert.equal(
    await evaluate(`localStorage.getItem('other-preference')`),
    "preserve",
  );
  await clean();
  record(
    "기존 읽기 기록 정리",
    "#/article/getting-started",
    "Only retired key removed; unrelated storage retained.",
  );
  await evaluate(`location.hash='#/saved'`);
  await until(
    () =>
      evaluate(
        `location.hash==='#/'&&Boolean(document.querySelector('.home-heading'))`,
      ),
    "saved redirect",
  );
  record("이전 저장 문서 주소", "#/saved", "Redirects to home.");
  await route("#/start");
  assert.equal(
    await evaluate(`document.querySelector('h1').textContent`),
    articleMap.get("getting-started").title,
  );
  await route("#/");
  await evaluate(`document.querySelector('.skip').click()`);
  assert.equal(await evaluate("document.activeElement.id"), "main");
  assert.equal(await evaluate("location.hash"), "#/");
  record("본문 건너뛰기", "#/", "Main focus without replacing route.");
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "k",
    code: "KeyK",
    modifiers: 2,
  });
  assert.equal(await evaluate("document.activeElement.id"), "search");
  record("검색 단축키", "#/", "Ctrl K focuses search.");
  await route("#/article/not-found");
  assert.equal(
    await evaluate(`document.querySelector('h1').textContent`),
    "문서를 찾을 수 없습니다.",
  );
  await route("#/%E0%A4%A");
  assert.equal(
    await evaluate(`document.querySelector('h1').textContent`),
    "문서를 찾을 수 없습니다.",
  );
  // Check ordinary browser history, not just direct routes.
  await route("#/dungeon");
  await route("#/article/dungeon-entry");
  await evaluate("history.back()");
  await until(
    () =>
      evaluate(
        `location.hash==='#/dungeon'&&document.querySelector('h1')?.textContent==='던전 도감'`,
      ),
    "browser back",
  );
  await evaluate("history.forward()");
  await until(
    () =>
      evaluate(
        `location.hash==='#/article/dungeon-entry'&&Boolean(document.querySelector('.prose'))`,
      ),
    "browser forward",
  );
  record(
    "브라우저 뒤로·앞으로",
    "#/article/dungeon-entry",
    "Category and document restored.",
  );
  for (const width of [320, 390, 768, 1024, 1440]) {
    await viewport(width, width < 821 ? 844 : 1000);
    for (const hash of [
      "#/",
      "#/article/getting-started",
      "#/crops",
      "#/article/crops-strawberry",
      "#/article/dungeon-levels",
      "#/search?q=" + encodeURIComponent("유전자"),
    ]) {
      await route(hash);
      await overflow(width + " " + hash);
      await images();
      await clean();
      report.viewports.push({ width, source: hash, status: "passed" });
    }
    await route("#/");
    if (width === 390 || width === 768)
      await shot(width === 390 ? "home-mobile" : "home-tablet");
    if (width === 390) {
      await shot("home-mobile-full", true);
      await evaluate(`document.querySelector('#menu-toggle').click()`);
      assert.equal(
        await evaluate(
          `document.querySelector('#menu-toggle').getAttribute('aria-expanded')`,
        ),
        "true",
      );
      assert.equal(
        await evaluate(
          `document.querySelector('#sidebar').contains(document.activeElement)`,
        ),
        true,
      );
      await shot("menu-mobile");
      await evaluate(
        `document.querySelector('#sidebar a:last-of-type')?.focus()`,
      );
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Escape",
        code: "Escape",
      });
      assert.equal(await evaluate("document.activeElement.id"), "menu-toggle");
      await evaluate(
        `document.querySelector('#menu-toggle').click();document.querySelector('#menu-backdrop').click()`,
      );
      assert.equal(
        await evaluate(`document.querySelector('#sidebar').inert`),
        true,
      );
      record(
        "모바일 메뉴",
        "#/",
        "Open, Escape and backdrop close preserve focus.",
      );
      await route("#/article/getting-started");
      await shot("guide-mobile");
      await evaluate(`document.querySelector('.mobile-toc summary').click()`);
      assert.equal(
        await evaluate(`document.querySelector('.mobile-toc').open`),
        true,
      );
      await evaluate(
        `document.querySelector('#mobile-toc-list a[data-section=section-3]').click()`,
      );
      assert.equal(
        await evaluate(`document.querySelector('.mobile-toc').open`),
        false,
      );
      assert.equal(
        await evaluate(
          `document.querySelector('#section-3').getBoundingClientRect().top>=document.querySelector('.topbar').getBoundingClientRect().bottom`,
        ),
        true,
      );
      record(
        "모바일 목차",
        await evaluate("location.hash"),
        "Section visible; contents closes after selection.",
      );
    }
  }
  await viewport(1440);
  await route("#/");
  const contrast = await evaluate(
    `(()=>{const luminance=c=>{const a=c.match(/[\\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*a[0]+.7152*a[1]+.0722*a[2]};return ['.home-heading p','.page-meta','.nav-item','.journey-flow p','.category-block p','.category-block a'].flatMap(s=>[...document.querySelectorAll(s)].filter(e=>e.getClientRects().length).map(e=>{let p=e,bg='rgba(0, 0, 0, 0)';while(p&&bg==='rgba(0, 0, 0, 0)'){bg=getComputedStyle(p).backgroundColor;p=p.parentElement;}if(bg==='rgba(0, 0, 0, 0)')bg='rgb(255,255,255)';const fg=luminance(getComputedStyle(e).color),b=luminance(bg);return {selector:s,ratio:(Math.max(fg,b)+.05)/(Math.min(fg,b)+.05)}}))})()`,
  );
  for (const item of contrast)
    assert.ok(item.ratio >= 4.5, JSON.stringify(item));
  record("본문과 링크 대비", "#/", "Sampled text meets 4.5:1.");
  const disabled = await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `for(const name of ['getItem','setItem','removeItem'])Storage.prototype[name]=()=>{throw Error('Storage blocked')}`,
  });
  await send("Page.reload");
  await until(
    () => evaluate(`Boolean(document.querySelector('.home-heading'))`),
    "storage blocked",
  );
  await route("#/article/getting-started");
  await clean();
  record(
    "저장소 차단",
    "#/article/getting-started",
    "Navigation works without storage.",
  );
  await send("Page.removeScriptToEvaluateOnNewDocument", {
    identifier: disabled.identifier,
  });
  failData = true;
  await send("Page.reload");
  await until(
    () => evaluate(`Boolean(document.querySelector('#retry'))`),
    "load failure",
  );
  failData = false;
  await evaluate(`document.querySelector('#retry').click()`);
  await until(
    () => evaluate(`Boolean(document.querySelector('.prose'))`),
    "retry data",
  );
  record(
    "다시 불러오기",
    "#/article/getting-started",
    "503 followed by successful retry.",
  );
  await clean();
  // Filter/search states add records to targets already visited above or known article destinations.
  for (const row of report.links)
    if (row.status === "pending") {
      const u = new URL(row.href, origin);
      assert.ok(visited.has(u.hash), "new unvisited destination " + row.href);
      row.status = "passed";
    }
  report.status = "passed";
  report.uniqueDestinations = targets.size;
  report.documentCount = articles.articles.length;
  console.log(
    `PASS: ${articles.articles.length} documents, ${report.links.length} rendered link occurrences, ${targets.size} distinct destinations, ${report.actions.length} controls/scenarios, five responsive widths. Artifacts: ${artifacts}`,
  );
} catch (error) {
  try {
    report.browser = await page?.evaluate(
      `({url:location.href,active:document.activeElement?.outerHTML.slice(0,150),heading:document.querySelector('h1')?.textContent,focused:document.hasFocus(),copyStatus:document.querySelector('#copy-status')?.textContent,errors:window.__errors,csp:window.__csp})`,
    );
    console.error(JSON.stringify(report.browser));
  } catch {}
  report.status = "failed";
  report.error = String(error);
  console.error(errors.slice(-1500));
  throw error;
} finally {
  await writeReport();
  page?.close();
  browser.kill();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
function locationSafe(facet) {
  return "#/search?category=" + facet;
}
