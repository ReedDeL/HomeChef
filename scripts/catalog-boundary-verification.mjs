import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { argv, stderr, stdout } from 'node:process';

const root = resolve(import.meta.dirname, '..');
const transitionalHashes = new Map([
  ['src/data/recipes.json', '49b4e144cd61f405b38c61b407f8712fa6bb61d3e6e53ea704d2e894be92562a'],
  ['src/data/ingredients.json', '6351d72b359949ef06724bfee30dd8551115504c534e7ea6a4483c034226cf04'],
]);
const sourceRoots = ['app', 'src', 'supabase', 'tools', 'scripts', '.github'];
const configFiles = [
  'package.json',
  'package-lock.json',
  '.env.example',
  'app.json',
  'eas.json',
  'pyproject.toml',
  'tsconfig.json',
  'vitest.config.ts',
  'eslint.config.mjs',
];
const excludedJsonPayloads = new Set([
  'src/data/recipes.json',
  'src/data/ingredients.json',
  'tools/catalog/seed/microwave.json',
]);
const allowedProviderReferences = new Set(['app/settings.tsx', 'src/lib/catalog/catalog.test.ts']);
const selfPath = 'scripts/catalog-boundary-verification.mjs';
const failures = [];

function check(name, condition) {
  if (condition) {
    stdout.write(`PASS ${name}\n`);
  } else {
    failures.push(name);
    stderr.write(`FAIL ${name}\n`);
  }
}

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function fullReleaseImportPaths(source, importerPath) {
  const importSpecifiers = [
    ...source.matchAll(/(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)(['"`])([^'"`]+)\1/g),
  ].map((match) => match[2]);
  return importSpecifiers
    .map((specifier) => resolveProjectImport(specifier, importerPath))
    .filter(
      (specifier) =>
        specifier !== null &&
        /^(?:src\/data\/(?:recipes|ingredients|(?:(?:full|hosted|catalog|protected)[-_]?)?release)(?:\.json)?|src\/lib\/catalog\/(?:(?:full|hosted|catalog|protected)[-_]?)?release|build\/catalog\/release(?:\.json)?)$/i.test(
          specifier
        )
    );
}

function resolveProjectImport(specifier, importerPath) {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith('.')) {
    return normalize(join(dirname(importerPath), specifier)).replaceAll('\\', '/');
  }
  return specifier.replaceAll('\\', '/');
}

function isTransitionalPayloadSpecifier(specifier) {
  return /^src\/data\/(?:recipes|ingredients)\.json$/i.test(specifier);
}

function runSelfTests() {
  const fixtures = [
    ["import recipes from '@/data/hosted-release.json';", 'app/test.tsx'],
    ["import recipes from '@/data/full-release.json';", 'app/test.tsx'],
    ["import recipes from '@/data/protected-release.json';", 'app/test.tsx'],
    ["import release from '@/lib/catalog/full-release';", 'app/test.tsx'],
    ["import release from '@/lib/catalog/release';", 'app/test.tsx'],
    ["import release from '@/data/catalog-release';", 'app/test.tsx'],
    ["const release = require('../../build/catalog/release.json');", 'app/(tabs)/test.tsx'],
    ["const release = require('build/catalog/release.json');", 'app/test.tsx'],
    ["import release from './hosted-release.json';", 'src/data/other.ts'],
    ["import recipes from './recipes.json';", 'src/data/other.ts'],
    ["import release from './release';", 'src/lib/catalog/other.ts'],
    ['const release = require(`./release`);', 'src/lib/catalog/other.ts'],
  ];
  for (const [fixture, importerPath] of fixtures) {
    check(
      `fixture rejects ${fixture.match(/['"`]([^'"`]+)['"`]/)?.[1]}`,
      fullReleaseImportPaths(fixture, importerPath).length === 1
    );
  }
}

for (const [file, expectedHash] of transitionalHashes) {
  check(
    `${file} matches its protected transitional hash`,
    digest(join(root, file)) === expectedHash
  );
}

const sourceFiles = sourceRoots
  .flatMap((directory) => filesIn(join(root, directory)))
  .concat(configFiles.map((file) => join(root, file)))
  .filter(
    (file) =>
      /\.(?:[cm]?[jt]sx?|json|ya?ml|toml|sql|py)$/.test(file) ||
      configFiles.includes(relative(root, file))
  )
  .filter((file) => !excludedJsonPayloads.has(relative(root, file)))
  .filter((file) => relative(root, file) !== selfPath);

const fullPayloadImports = [];
const retiredProviderBehavior = [];
const unexpectedTheMealDbReferences = [];

for (const file of sourceFiles) {
  const projectPath = relative(root, file);
  const source = readFileSync(file, 'utf8');
  const releaseImports = fullReleaseImportPaths(source, projectPath);
  const hasOnlyAllowedTransitionalImports =
    projectPath === 'src/data/catalog.ts' && releaseImports.every(isTransitionalPayloadSpecifier);
  if (releaseImports.length > 0 && !hasOnlyAllowedTransitionalImports) {
    fullPayloadImports.push(projectPath);
  }

  const hasRetiredProviderBehavior =
    /spoonacular|\b(?:provider|recipe)[-_ ]?(?:tier|api)\b|\btier[-_ ]?[12]\b/i.test(source);
  if (hasRetiredProviderBehavior) retiredProviderBehavior.push(projectPath);

  const mentionsTheMealDb = /themealdb/i.test(source);
  if (mentionsTheMealDb && !allowedProviderReferences.has(projectPath)) {
    unexpectedTheMealDbReferences.push(projectPath);
  }
}

check(
  'Metro app and source code import full catalog payloads only through src/data/catalog.ts',
  fullPayloadImports.length === 0
);
check(
  'No active retired provider tier or API behavior remains',
  retiredProviderBehavior.length === 0
);
check(
  'TheMealDB appears only in approved transitional attribution locations',
  unexpectedTheMealDbReferences.length === 0
);

const settings = readFileSync(join(root, 'app/settings.tsx'), 'utf8');
check(
  'Settings retains required transitional TheMealDB attribution',
  settings.includes('Transitional bundled catalog data from TheMealDB') &&
    settings.includes('https://www.themealdb.com/')
);

if (argv.includes('--self-test')) runSelfTests();

if (failures.length > 0) {
  throw new Error(`${failures.length} catalog boundary assertions failed`);
}
