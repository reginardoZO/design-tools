import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const app = new URL('apps/traylab-southwire/', root);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('TrayLab has one hub card and is included in the static build', () => {
  const hub = read('index.html');
  assert.equal(hub.match(/href="apps\/traylab-southwire\/index.html"/g)?.length, 1);
  assert.match(hub, /TrayLab &middot; Cable Tray Sizing/);
  assert.match(read('scripts/build.mjs'), /const STATIC_APPS = \[[^\]]*'traylab-southwire'/);
});

test('TrayLab links resolve locally and under a GitHub Pages project path', () => {
  const html = read('apps/traylab-southwire/index.html');
  const page = new URL('index.html', app);
  const hosted = new URL('https://example.test/design-tools/apps/traylab-southwire/index.html');
  for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const local = new URL(href, page);
    assert.ok(existsSync(fileURLToPath(local)), `Missing ${local.pathname}`);
    assert.ok(new URL(href, hosted).pathname.startsWith('/design-tools/'));
  }
  assert.match(html, /href="\.\.\/\.\.\/index.html"/);
  assert.match(html, /href="\.\.\/\.\.\/shared\/theme.css"/);
  assert.match(html, /<noscript>/);
});

test('TrayLab is a geometry/fill sizing tool built from local modules and catalog', () => {
  const js = read('apps/traylab-southwire/app.js');
  for (const module of ['nec', 'project', 'arrangement', 'format']) {
    assert.ok(existsSync(new URL(`${module}.js`, app)));
  }
  for (const module of ['project', 'arrangement', 'format']) assert.ok(js.includes(`'./${module}.js'`));
  for (const removed of ['compliance.js', 'installation.js']) assert.equal(existsSync(new URL(removed, app)), false);
  assert.doesNotMatch(js, /ampacity|ambient|installationReview|fileImport|localStorage\.getItem\('traylab-saved/i);
  const catalog = JSON.parse(read('apps/traylab-southwire/catalog.json'));
  assert.equal(JSON.parse(read('apps/traylab-southwire/catalog-metadata.json')).totalRecords, catalog.length);
});

test('TrayLab uses hub color and typography tokens without its former palette', () => {
  const css = read('apps/traylab-southwire/styles.css');
  const js = read('apps/traylab-southwire/app.js');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(js, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /fonts\.googleapis\.com|DM Sans|Manrope/);
  assert.match(css, /var\(--ui\)/);
  assert.match(css, /var\(--data\)/);
  assert.match(css, /@media print \{[\s\S]*\.hub-nav,/);
});
