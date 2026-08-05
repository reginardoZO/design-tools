/**
 * Builds every application into a single static `dist/` tree that can be
 * published to GitHub Pages as one package.
 *
 *   dist/
 *     index.html               <- hub
 *     assets/                  <- hub card artwork
 *     apps/neher/              <- static app, copied
 *     apps/under-routing/      <- static app, copied
 *     apps/dimensionador/      <- vite build output
 *     apps/panel-router/       <- vite build output
 *     apps/voltage-drop/       <- vite build output
 *     apps/nec-cable-tray/     <- vite build output
 *
 * The `apps/` prefix mirrors the source layout, so the hub's links work both
 * in the repository and in the published site.
 *
 * Usage: node scripts/build.mjs
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const distApps = join(dist, 'apps');

/** Applications with a Vite build step. `dir` is relative to apps/. */
const VITE_APPS = ['dimensionador', 'panel-router', 'voltage-drop', 'nec-cable-tray'];

/** Applications that are already plain static files. */
const STATIC_APPS = ['neher', 'under-routing', 'conduit-fill'];

// Node >= 22 refuses to spawn the npm.cmd shim without a shell on Windows, so
// run npm through the shell. Every command below is a fixed literal.
function run(command, cwd) {
  console.log(`  $ ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

function buildViteApp(name) {
  const appDir = join(root, 'apps', name);
  console.log(`\n▶ building ${name}`);

  run(existsSync(join(appDir, 'package-lock.json')) ? 'npm ci' : 'npm install', appDir);
  run('npm run build', appDir);

  const out = join(appDir, 'dist');
  if (!existsSync(out)) throw new Error(`${name}: expected build output at ${out}`);
  cpSync(out, join(distApps, name), { recursive: true });
}

function copyStaticApp(name) {
  console.log(`\n▶ copying ${name}`);
  cpSync(join(root, 'apps', name), join(distApps, name), {
    recursive: true,
    filter: (source) =>
      !/[\\/](node_modules|\.vscode|\.git)([\\/]|$)/.test(source) &&
      !/[\\/]package(-lock)?\.json$/.test(source),
  });
}

console.log(`Building the Engineering Tools Hub into ${dist}`);
rmSync(dist, { recursive: true, force: true });
mkdirSync(distApps, { recursive: true });

// hub shell + the shared palette the static pages link to
cpSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
cpSync(join(root, 'shared'), join(dist, 'shared'), { recursive: true });

for (const name of STATIC_APPS) copyStaticApp(name);
for (const name of VITE_APPS) buildViteApp(name);

// Tell GitHub Pages not to run the content through Jekyll, which would drop
// files and folders whose names start with an underscore.
writeFileSync(join(dist, '.nojekyll'), '');

console.log('\n✔ dist/ is ready to publish.');
