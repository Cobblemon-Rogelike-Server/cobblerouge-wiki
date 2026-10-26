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
const server = http.createServer(async (req, res) => {
  try {
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
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective))`,
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(`window.location=${JSON.stringify(origin)}`);
  await until(
    () => evaluate(`Boolean(document.querySelector('.hero'))`),
    "home",
  );

  const data = JSON.parse(
    await fs.readFile(path.join(root, "data.json"), "utf8"),
  );
  const route = async (hash) => {
    await evaluate(`location.hash=${JSON.stringify(hash)}`);
    await until(
      () =>
        evaluate(
          `location.hash===${JSON.stringify(hash)} && document.querySelector('#main')===document.activeElement`,
        ),
      "route " + hash,
    );
    await delay(70);
  };
  const overflow = async (label) =>
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),
      true,
      label + " horizontal overflow",
    );
  const images = async () => {
    await evaluate(
      `Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>null)}))`,
    );
    assert.deepEqual(
      await evaluate(
        `[...document.images].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src'))`,
      ),
      [],
      "all images load",
    );
  };
  const shot = async (name, full = false) => {
    await images();
    const metrics = await send("Page.getLayoutMetrics");
    const params = { format: "png", captureBeyondViewport: full };
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
  assert.equal(data.articles.length, 114);
  for (const a of data.articles)
    for (const match of a.html.matchAll(/href="#\/article\/([^"?]+)[^"]*"/g))
      assert.ok(
        data.articles.some(
          (other) => other.id === decodeURIComponent(match[1]),
        ),
        a.id + " links to " + match[1],
      );
  await images();
  await overflow("home desktop");
  await shot("home-desktop");
  await shot("home-desktop-full", true);
  await evaluate(`document.querySelector('[data-journey="1"]').click()`);
  assert.match(
    await evaluate(`document.querySelector('#journey-panel').textContent`),
    /レベル|레벨 5/,
  );
  await evaluate(`document.querySelector('[data-journey="1"]').focus()`);
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
  });
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-selected=true][role=tab]').dataset.journey`,
    ),
    "2",
  );
  assert.equal(await evaluate(`document.activeElement.id`), "journey-tab-2");
  await route("#/article/getting-started");
  assert.equal(
    await evaluate(`document.querySelectorAll('#toc-list a').length`),
    5,
  );
  await overflow("guide desktop");
  await shot("guide-desktop");
  await evaluate(
    `document.querySelector('[data-learning=party]').click();document.querySelector('#save-article').click()`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('#save-article').getAttribute('aria-pressed')`,
    ),
    "true",
  );
  await send("Page.reload");
  await until(
    () =>
      evaluate(
        `Boolean(document.querySelector('[data-learning=party]')?.checked)`,
      ),
    "reading checklist persists",
  );
  assert.equal(
    await evaluate(
      `document.querySelector('#save-article').getAttribute('aria-pressed')`,
    ),
    "true",
  );
  await route("#/saved");
  assert.equal(
    await evaluate(`document.querySelectorAll('.entry-card').length`),
    1,
  );
  await route("#/");
  assert.match(
    await evaluate(`document.querySelector('.mini-progress').textContent`),
    /1 \/ 4/,
  );
  assert.match(
    await evaluate(`document.querySelector('.recent-list').textContent`),
    /시작 안내/,
  );
  await route("#/article/getting-started?section=section-4");
  assert.ok(
    await evaluate(
      `Math.abs(document.querySelector('#section-4').getBoundingClientRect().top-110)<10`,
    ),
    "direct section link scrolls",
  );
  // Every old article URL and every category still renders safely without layout breakage.
  for (const a of data.articles) {
    await route("#/article/" + encodeURIComponent(a.id));
    assert.equal(
      await evaluate(`document.querySelector('h1')?.textContent`),
      a.title,
    );
    await overflow("article " + a.id);
  }
  for (const c of data.categories) {
    await route("#/" + c.id);
    await overflow(c.id);
    await images();
  }
  await route("#/crops");
  await evaluate(`document.querySelectorAll('[data-filter]')[1].click()`);
  assert.ok(
    (await evaluate(`document.querySelectorAll('.entry-card').length`)) < 57,
  );
  assert.equal(
    await evaluate(`document.activeElement.getAttribute('aria-pressed')`),
    "true",
  );
  await route("#/search?q=" + encodeURIComponent("던전입장"));
  assert.ok(
    (await evaluate(`document.querySelectorAll('.entry-card').length`)) > 0,
  );
  await route("#/search?q=" + encodeURIComponent("유전자"));
  assert.ok(
    (await evaluate(`document.querySelectorAll('.entry-card').length`)) > 0,
  );
  await shot("search-desktop");
  await evaluate(
    `document.querySelector('[data-search-category=dungeon]').click()`,
  );
  await until(
    () =>
      evaluate(
        `location.hash.includes('category=dungeon') && document.querySelectorAll('.entry-card').length>0`,
      ),
    "search facet",
  );
  await route(
    "#/search?q=" + encodeURIComponent("<img src=x onerror=alert(1)>"),
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll('#main img,#main script').length`,
    ),
    0,
  );
  assert.match(
    await evaluate(`document.querySelector('h1').textContent`),
    /<img/,
  );
  await route("#/search?q=no-such-item-9485");
  assert.ok(await evaluate(`Boolean(document.querySelector('.empty-state'))`));
  await route("#/article/not-found");
  assert.match(
    await evaluate(`document.querySelector('h1').textContent`),
    /길을 조금/,
  );
  await route("#/");
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "k",
    code: "KeyK",
    modifiers: 2,
  });
  assert.equal(await evaluate(`document.activeElement.id`), "search");
  await evaluate(`document.querySelector('#search').blur()`);
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(100);
  await overflow("home mobile");
  await shot("home-mobile");
  await shot("home-mobile-full", true);
  assert.equal(
    await evaluate(`document.querySelector('#sidebar').inert`),
    true,
  );
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
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
  });
  assert.equal(
    await evaluate(`document.querySelector('#sidebar').inert`),
    true,
  );
  await route("#/article/getting-started");
  await overflow("guide mobile");
  await shot("guide-mobile");
  await shot("guide-mobile-full", true);
  assert.equal(
    await evaluate(`document.querySelector('.mobile-toc').open`),
    false,
  );
  await evaluate(`document.querySelector('.mobile-toc summary').click()`);
  assert.equal(
    await evaluate(`document.querySelector('.mobile-toc').open`),
    true,
  );
  await evaluate(
    `document.querySelector('#mobile-toc-list a[data-section="section-3"]').click()`,
  );
  assert.equal(
    await evaluate(`document.querySelector('.mobile-toc').open`),
    false,
  );
  await until(
    () =>
      evaluate(
        `document.querySelector('#section-3').getBoundingClientRect().top>=document.querySelector('.topbar').getBoundingClientRect().bottom && document.querySelector('#section-3').getBoundingClientRect().top<200`,
      ),
    "mobile table of contents scroll",
  );
  for (const hash of [
    "#/dungeon",
    "#/crops",
    "#/article/dungeon-entry",
    "#/article/dungeon-levels",
    "#/article/crops-strawberry",
    "#/guild",
  ]) {
    await route(hash);
    await overflow("mobile " + hash);
    await images();
  }
  await shot("guild-mobile");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 800,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await route("#/");
  await overflow("tablet");
  await shot("home-tablet");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 740,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(100);
  await overflow("small mobile");
  await route("#/article/getting-started");
  await overflow("small guide");
  assert.deepEqual(await evaluate("window.__errors"), [], "browser errors");
  assert.deepEqual(
    await evaluate("window.__csp"),
    [],
    "production CSP violations",
  );
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `Storage.prototype.getItem=()=>{throw new Error('Storage unavailable')};Storage.prototype.setItem=()=>{throw new Error('Storage unavailable')}`,
  });
  await send("Page.reload");
  await until(
    () => evaluate(`Boolean(document.querySelector('[data-learning=party]'))`),
    "no-storage fallback",
  );
  await evaluate(
    `document.querySelector('[data-learning=party]').click();document.querySelector('#save-article').click()`,
  );
  assert.match(
    await evaluate(`document.querySelector('#toast').textContent`),
    /이번 화면/,
  );
  assert.deepEqual(
    await evaluate("window.__errors"),
    [],
    "storage fallback without errors",
  );
  console.log(
    `PASS: ${data.articles.length} preserved/new article routes, categories, images, search, persistence, step keyboard controls, deep links, mobile drawer, production CSP and 320/390/800/1440px layouts. Screenshots: ${artifacts}`,
  );
} catch (error) {
  console.error(errors.slice(-1500));
  throw error;
} finally {
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
