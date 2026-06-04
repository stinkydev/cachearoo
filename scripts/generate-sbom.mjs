#!/usr/bin/env node
// Generates a combined CycloneDX SBOM (sbom.json at repo root) for the whole
// Cachearoo product:
//   - Backend production dependencies (the Node server), from the root npm tree
//   - Frontend production dependencies (the admin web app), from the _admin tree
//
// Both trees are read offline from `npm ls --omit=dev` plus each installed
// package's package.json (same production-tree, node_modules-only approach as
// scripts/gen-third-party-notices.js). Components are tagged by ecosystem and
// merged into one BOM, de-duplicated by package URL so shared packages count
// once. Run after `npm install` in both the root and _admin so the trees
// reflect what actually ships.
//
// Usage: node scripts/generate-sbom.mjs   (run from anywhere; paths resolve
// relative to the repo root). No network access required.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..');
const outPath = join(repoRoot, 'sbom.json');

// Each project contributes its production tree under this ecosystem tag.
const projects = [
  { ecosystem: 'backend', dir: repoRoot },
  { ecosystem: 'frontend', dir: join(repoRoot, '_admin') },
];

// SPDX/license string off an installed package.json (mirrors gen-third-party-notices).
function normalizeLicense(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type || l).join(' OR ');
  if (pkg.licenses && pkg.licenses.type) return pkg.licenses.type;
  return null;
}

// Turn a license string into a CycloneDX licenses[] entry. Compound expressions
// (with AND/OR/parentheses) become an SPDX expression; a bare token an id.
function licensesField(str) {
  if (!str) return undefined;
  if (/\s(AND|OR|WITH)\s|[()]/.test(str)) return [{ expression: str }];
  return [{ license: { id: str } }];
}

// Index every installed package under a node_modules tree by `name@version`,
// so a node from `npm ls` can be matched to the exact version on disk.
function indexInstalled(nodeModulesDir, index) {
  if (!existsSync(nodeModulesDir)) return index;
  for (const entry of readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.bin') continue;
    if (entry.name.startsWith('@')) {
      // Scope directory: each child is a package.
      const scopeDir = join(nodeModulesDir, entry.name);
      for (const sub of readdirSync(scopeDir, { withFileTypes: true })) {
        if (sub.isDirectory()) addPackage(join(scopeDir, sub.name), index);
      }
    } else if (!entry.name.startsWith('.')) {
      addPackage(join(nodeModulesDir, entry.name), index);
    }
  }
  return index;
}

function addPackage(pkgDir, index) {
  const manifest = join(pkgDir, 'package.json');
  if (existsSync(manifest)) {
    try {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.name && pkg.version) {
        const key = `${pkg.name}@${pkg.version}`;
        if (!index.has(key)) index.set(key, normalizeLicense(pkg));
      }
    } catch {
      /* ignore unreadable manifests */
    }
  }
  // Recurse into nested deps (npm nests on version conflicts).
  indexInstalled(join(pkgDir, 'node_modules'), index);
}

// Collect unique `name@version` from an `npm ls --json` dependency tree.
function collectTree(deps, set) {
  for (const [name, node] of Object.entries(deps || {})) {
    if (node.version) set.add(`${name}@${node.version}`);
    collectTree(node.dependencies, set);
  }
  return set;
}

function componentFor(nameVersion, license, ecosystem) {
  const at = nameVersion.lastIndexOf('@');
  const fullName = nameVersion.slice(0, at);
  const version = nameVersion.slice(at + 1);
  const slash = fullName.indexOf('/');
  const group = fullName.startsWith('@') && slash !== -1 ? fullName.slice(0, slash) : undefined;
  const name = group ? fullName.slice(slash + 1) : fullName;
  const purl = `pkg:npm/${fullName}@${version}`;
  return {
    type: 'library',
    ...(group ? { group } : {}),
    name,
    version,
    purl,
    'bom-ref': purl,
    ...(licensesField(license) ? { licenses: licensesField(license) } : {}),
    properties: [{ name: 'cachearoo:ecosystem', value: ecosystem }],
  };
}

const seen = new Set();
const components = [];
const counts = {};
for (const { ecosystem, dir } of projects) {
  console.log(`Reading ${ecosystem} production tree (npm ls --omit=dev) in ${dir}...`);
  // `npm ls` exits non-zero on peer/extraneous warnings but still prints the
  // JSON tree on stdout — read it from the thrown error in that case.
  let lsJson;
  try {
    lsJson = execFileSync('npm', ['ls', '--omit=dev', '--all', '--json'], {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    lsJson = err.stdout;
    if (!lsJson) throw err;
  }
  const tree = JSON.parse(lsJson);
  const installed = indexInstalled(join(dir, 'node_modules'), new Map());
  const set = collectTree(tree.dependencies, new Set());
  counts[ecosystem] = 0;
  for (const nv of [...set].sort()) {
    const purl = `pkg:npm/${nv.slice(0, nv.lastIndexOf('@'))}@${nv.slice(nv.lastIndexOf('@') + 1)}`;
    if (seen.has(purl)) continue; // shared across trees; first (backend) wins
    seen.add(purl);
    components.push(componentFor(nv, installed.get(nv), ecosystem));
    counts[ecosystem]++;
  }
}

// `npm ls` exits non-zero on tree problems but still prints JSON; we ignore the
// exit code by reading stdout above. Surface a hint if a tree came back empty.
for (const { ecosystem } of projects) {
  if (!counts[ecosystem]) console.warn(`Warning: no ${ecosystem} components found — did you run npm install?`);
}

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const ver = pkg.version || '0.0.0';
const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: 'cachearoo',
      version: ver,
      description: pkg.description || 'Cachearoo',
      'bom-ref': `pkg:cachearoo/cachearoo@${ver}`,
    },
    properties: [
      {
        name: 'cachearoo:note',
        value: 'Production dependencies of the backend (root) and frontend (_admin) npm trees',
      },
    ],
  },
  components,
};

writeFileSync(outPath, JSON.stringify(bom, null, 2) + '\n');
console.log(
  `Wrote ${outPath}: ${components.length} components ` +
    `(${counts.backend || 0} backend + ${counts.frontend || 0} frontend).`,
);
