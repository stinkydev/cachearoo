#!/usr/bin/env node
// Renders the combined CycloneDX SBOM (sbom.json) into a human-readable
// Markdown report: a license tally plus per-ecosystem component tables.
//
// Usage:
//   node scripts/sbom-report.mjs               # print to stdout
//   node scripts/sbom-report.mjs out.md        # write to out.md
//   node scripts/sbom-report.mjs --sbom x.json # read a different SBOM

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..');

function usage(exitCode = 1) {
  const stream = exitCode ? process.stderr : process.stdout;
  stream.write(`Usage:
  node scripts/sbom-report.mjs               # print to stdout
  node scripts/sbom-report.mjs out.md        # write to out.md
  node scripts/sbom-report.mjs --sbom x.json # read a different SBOM
`);
  process.exit(exitCode);
}

const args = process.argv.slice(2);
let sbomPath = join(repoRoot, 'sbom.json');
let outPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') usage(0);
  if (args[i] === '--sbom') {
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
      console.error('Missing value for --sbom');
      usage(1);
    }
    sbomPath = args[++i];
  } else if (args[i].startsWith('--')) {
    console.error(`Unknown option: ${args[i]}`);
    usage(1);
  } else if (outPath) {
    console.error(`Unexpected extra output path: ${args[i]}`);
    usage(1);
  } else {
    outPath = args[i];
  }
}

const bom = JSON.parse(readFileSync(sbomPath, 'utf8'));

const licenseStr = (c) => {
  const parts = [];
  for (const l of c.licenses || []) {
    if (l.license?.id) parts.push(l.license.id);
    else if (l.license?.name) parts.push(l.license.name);
    else if (l.expression) parts.push(l.expression);
  }
  return parts.join(' / ') || '(unspecified)';
};
const ecoOf = (c) =>
  (c.properties || []).find((p) => p.name === 'cachearoo:ecosystem')?.value || 'other';
const nameOf = (c) => (c.group ? `${c.group}/${c.name}` : c.name || '');

const components = (bom.components || []).slice();
const byEco = { backend: [], frontend: [], other: [] };
const tally = {};
for (const c of components) {
  const eco = ecoOf(c);
  (byEco[eco] || byEco.other).push(c);
  const lic = licenseStr(c);
  tally[lic] = (tally[lic] || 0) + 1;
}

const prod = bom.metadata?.component || {};
let md = `# Third-Party Components - ${prod.name || 'project'} ${prod.version || ''}\n\n`;
md += `Generated from \`${sbomPath.replace(repoRoot + '\\', '').replace(repoRoot + '/', '')}\` `;
md += `(CycloneDX ${bom.specVersion}). ${components.length} components total.\n\n`;

md += `## License summary\n\n| License | Count |\n|---|---|\n`;
for (const [lic, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  md += `| ${lic} | ${n} |\n`;
}
md += `\n`;

const titles = {
  backend: 'Backend (Node server)',
  frontend: 'Frontend (admin web app)',
  other: 'Other',
};
for (const eco of ['backend', 'frontend', 'other']) {
  const list = byEco[eco];
  if (!list.length) continue;
  list.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  md += `## ${titles[eco]} (${list.length})\n\n| Component | Version | License |\n|---|---|---|\n`;
  for (const c of list) {
    md += `| ${nameOf(c)} | ${c.version || ''} | ${licenseStr(c)} |\n`;
  }
  md += `\n`;
}

if (outPath) {
  writeFileSync(outPath, md);
  console.error(`Wrote ${outPath} (${components.length} components).`);
} else {
  process.stdout.write(md);
}
