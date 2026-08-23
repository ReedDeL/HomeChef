import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DISCORD_WEBHOOK_HOSTS = new Set(['discord.com', 'discordapp.com']);
const STATUS_OPTIONS = {
  planned: { color: 0x5865f2, label: 'Planned' },
  'in-progress': { color: 0xfee75c, label: 'In progress' },
  blocked: { color: 0xed4245, label: 'Blocked' },
  shipped: { color: 0x57f287, label: 'Shipped' },
};
const SUMMARY_LIMIT = 4_000;
const STATE_FILENAME = '.discord-sync-state';

/**
 * The channel's readers are non-technical, so every automated message is
 * translated before posting: automatic cards lead with the customer outcome,
 * why it matters, and the next step. Accuracy over
 * cleverness — anything we cannot confidently name falls back to generic
 * wording rather than a guess.
 */

/** First-word swaps that turn commit-imperative style into spoken English. */
const VERB_SOFTENERS = new Map([
  ['add', 'Added'],
  ['bump', 'Upgraded'],
  ['clean', 'Cleaned'],
  ['correct', 'Corrected'],
  ['deduplicate', 'Deduplicated'],
  ['design', 'Designed'],
  ['document', 'Documented'],
  ['drop', 'Removed'],
  ['fix', 'Fixed'],
  ['improve', 'Improved'],
  ['move', 'Moved'],
  ['pin', 'Pinned'],
  ['refactor', 'Reorganized'],
  ['remove', 'Removed'],
  ['rename', 'Renamed'],
  ['retract', 'Withdrew'],
  ['revert', 'Reverted'],
  ['update', 'Updated'],
]);

/**
 * Commit-message prefixes like "feat:" or "fix(ui):" are team shorthand that
 * means nothing to sales; everything after them reads as a normal sentence.
 */
const CONVENTIONAL_PREFIX =
  /^(feat|fix|chore|docs|test|style|perf|build|ci|refactor)(\([^)]*\))?!?:\s+/;

/**
 * Reader-facing product areas, checked in order so the most specific match
 * wins (the photo scanner lives inside supabase/ but deserves its own name).
 * Labels are what a salesperson can repeat to a customer, not directories.
 */
const PRODUCT_AREAS = [
  [/analyze-pantry-photo|pantry-photo|gemini/i, '📸 Fridge photo scanner'],
  [/^supabase\//, '🔒 Sign-in & saved preferences'],
  [/^src\/engine\//, '⚡ Meal recommendations'],
  [/^src\/data\/|^src\/lib\/ingredients\//, '🥗 Pantry & recipes'],
  [/^app\/|^src\/components\//, '📱 HomeChef app experience'],
  [/\.md$|^docs\//, '📋 Product planning'],
  [
    /^tools\/|^scripts\/|^\.github\/|^src\/lib\/|package.*\.json$|config\.[a-z]+$|\.(prettierrc|gitignore)$/,
    '🛠️ Behind-the-scenes improvements',
  ],
];

const FALLBACK_AREA = '🚀 Core product improvements';

/** Maps a changed file to its reader-facing area, or null when unclassifiable. */
function areaForFile(file) {
  for (const [pattern, label] of PRODUCT_AREAS) {
    if (pattern.test(file)) return label;
  }
  return null;
}

/**
 * "what changed" in words a non-engineer can act on: which parts of the
 * product the work touched, not which directories. Deduped in first-seen
 * order; an empty file list yields no areas, while files nobody could
 * classify get the honest generic fallback rather than a wrong guess.
 */
export function describeAreas(files) {
  const areas = [];
  for (const file of files) {
    const area = areaForFile(file);
    if (area && !areas.includes(area)) areas.push(area);
  }

  if (files.length > 0 && areas.length === 0) return [FALLBACK_AREA];
  return areas;
}

/** Rewrite a commit subject as a plain sentence, or fall back gracefully. */
export function plainSubject(subject) {
  const text = (subject ?? '').trim();
  if (!text) return 'Shipped an update to the app';

  const stripped = text.replace(CONVENTIONAL_PREFIX, '');
  const [first, ...rest] = stripped.split(' ');
  const softened = VERB_SOFTENERS.get(first?.toLowerCase() ?? '');
  const sentence = softened ? [softened, ...rest].join(' ') : stripped;

  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

export function parseCommand(argv) {
  const options = {
    dryRun: false,
    hook: false,
    mode: 'manual',
    status: '',
    summary: '',
    url: undefined,
    commitRef: undefined,
    webhookUrl: undefined,
  };

  if (argv.length === 0) {
    return { help: true };
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (argument === '--hook') {
      options.hook = true;
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      return { help: true };
    }

    if (argument === '--post-commit') {
      options.mode = 'post-commit';
      continue;
    }

    if (argument === '--auto') {
      options.mode = 'auto';
      continue;
    }

    if (argument === '--changes') {
      options.mode = 'changes';
      continue;
    }

    if (argument === '--commit') {
      options.mode = 'commit';
      const nextArg = argv[index + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options.commitRef = nextArg;
        index += 1;
      }
      continue;
    }

    if (
      argument === '--status' ||
      argument === '--summary' ||
      argument === '--url' ||
      argument === '--webhook-url'
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(argument + ' requires a value.');
      }
      index += 1;

      if (argument === '--status') options.status = value;
      if (argument === '--summary') options.summary = value;
      if (argument === '--url') options.url = value;
      if (argument === '--webhook-url') options.webhookUrl = value;
      continue;
    }

    throw new Error('Unknown option: ' + argument);
  }

  if (options.url) validateStatusUrl(options.url);
  if (options.webhookUrl) validateWebhookUrl(options.webhookUrl);

  if (options.mode === 'manual') {
    if (!options.status && !options.summary) {
      return { help: true };
    }

    if (!Object.hasOwn(STATUS_OPTIONS, options.status)) {
      throw new Error('--status must be one of: ' + Object.keys(STATUS_OPTIONS).join(', ') + '.');
    }

    if (!options.summary.trim()) {
      throw new Error('--summary is required.');
    }

    if (options.summary.length > SUMMARY_LIMIT) {
      throw new Error('--summary must be ' + SUMMARY_LIMIT + ' characters or fewer.');
    }
  }

  return options;
}

export function validateWebhookUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DISCORD_WEBHOOK_URL must be a valid URL.');
  }

  if (
    url.protocol !== 'https:' ||
    !DISCORD_WEBHOOK_HOSTS.has(url.hostname) ||
    !url.pathname.startsWith('/api/webhooks/')
  ) {
    throw new Error('DISCORD_WEBHOOK_URL must be an HTTPS Discord incoming-webhook URL.');
  }

  return url;
}

export function createPayload({ status = 'planned', summary = '', url, title, color }) {
  const statusOption = STATUS_OPTIONS[status] ?? { color: color ?? 0x5865f2, label: status };
  const embedTitle = title ?? 'HomeChef - ' + statusOption.label;
  const embedColor = color ?? statusOption.color;

  return {
    username: 'HomeChef status',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: embedTitle,
        description: summary.trim(),
        color: embedColor,
        timestamp: new Date().toISOString(),
        ...(url ? { url } : {}),
      },
    ],
  };
}

/**
 * The customer-facing point of each product area, keyed by the exact label
 * above. Deliberately derived from AREAS rather than commit-subject keywords:
 * a keyword guess about what a change does can easily be wrong, and telling
 * sales something inaccurate is worse than telling them something modest.
 * These sentences describe what the AREA does for customers, never what this
 * particular diff claims to have achieved, so they stay true for any change
 * that touches it.
 */
const AREA_IMPACT = new Map([
  [
    '📸 Fridge photo scanner',
    'Customers can get from a fridge photo to useful meal ideas with less effort.',
  ],
  [
    '🔒 Sign-in & saved preferences',
    'New and returning customers can get into HomeChef and keep their preferences with less friction.',
  ],
  [
    '⚡ Meal recommendations',
    'Customers are less likely to be shown meals they cannot actually cook.',
  ],
  ['🥗 Pantry & recipes', 'Meal suggestions better reflect what customers already have at home.'],
  ['📱 HomeChef app experience', 'Everyday use of the app gets smoother.'],
  ['📋 Product planning', 'The team stays aligned on what ships next.'],
  [
    '🛠️ Behind-the-scenes improvements',
    'This helps the team ship customer-facing improvements more reliably.',
  ],
  ['🚀 Core product improvements', 'This keeps the core HomeChef experience steady.'],
]);

/** The "why it matters" sentence for the lead area, or '' when there is none. */
export function impactForAreas(areas) {
  const first = areas.find((area) => AREA_IMPACT.has(area));
  return first ? (AREA_IMPACT.get(first) ?? '') : '';
}

export function formatCommitPayload(commitInfo, { url, files = [] } = {}) {
  const subject = plainSubject(commitInfo?.subject);
  const author = commitInfo?.author?.trim() || 'the HomeChef team';
  const areas = describeAreas(files);
  const impact = impactForAreas(areas);

  let description = `**What changed:** ${subject} Shipped by ${author}.`;
  if (areas.length > 0) {
    description += `\n\n**Touches:** ${files.length} file${files.length === 1 ? '' : 's'} — ${areas.join(', ')}`;
  }
  if (impact) {
    description += `\n\n**Why it matters:** ${impact}`;
  }

  return {
    username: 'HomeChef status',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: 'HomeChef progress update',
        description: description.slice(0, SUMMARY_LIMIT),
        color: 0x5865f2,
        timestamp: new Date().toISOString(),
        ...(url ? { url } : {}),
      },
    ],
  };
}

export function formatChangesPayload({ branch = 'main', files = [], url } = {}) {
  let description = `**In progress** on ${branch}`;
  if (files.length > 0) {
    description += `: ${files.length} file${files.length === 1 ? '' : 's'} touched so far`;
  }
  description += '.';

  const areas = describeAreas(files);
  if (areas.length > 0) {
    description += `\n\n${areas.join(' · ')}`;
  }
  // The one claim that is always true about uncommitted work.
  description += '\n\nStill underway — not ready for a customer demo yet.';

  return {
    username: 'HomeChef status',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: 'HomeChef work in progress',
        description: description.slice(0, SUMMARY_LIMIT),
        color: 0xfee75c,
        timestamp: new Date().toISOString(),
        ...(url ? { url } : {}),
      },
    ],
  };
}

export function getGitBranch(cwd = process.cwd()) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'main';
  }
}

export function getCommitInfo(ref = 'HEAD', cwd = process.cwd()) {
  try {
    const raw = execSync(`git log -1 --format="%H%x00%h%x00%an%x00%s%x00%b" ${ref}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (!raw) return null;
    const [hash, shortHash, author, subject, body] = raw.split('\0');
    return { hash, shortHash, author, subject, body: body || '' };
  } catch {
    return null;
  }
}

/** Paths touched by a commit — the raw material for the product-area summary. */
export function getCommitFiles(ref = 'HEAD', cwd = process.cwd()) {
  try {
    const raw = execSync(`git diff-tree --no-commit-id --name-only -r --root ${ref}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (!raw) return [];
    return raw.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * `git status --porcelain` lines look like "XY path" (or "XY old -> new" for
 * renames); only the destination path matters for what a change is about.
 */
export function parseStatusFiles(porcelain) {
  return porcelain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const body = line.slice(3);
      const arrow = body.indexOf(' -> ');
      return arrow === -1 ? body : body.slice(arrow + 4);
    });
}

export function getWorkingTreeInfo(cwd = process.cwd()) {
  try {
    const changes = execSync('git status --porcelain -- .', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    const statSummary = execSync('git diff HEAD --stat -- .', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    return { changes, statSummary, files: parseStatusFiles(changes) };
  } catch {
    return { changes: '', statSummary: '', files: [] };
  }
}

export function getWebhookUrl(options, environment = process.env, cwd = process.cwd()) {
  if (options?.webhookUrl) {
    return options.webhookUrl;
  }
  if (environment?.DISCORD_WEBHOOK_URL) {
    return environment.DISCORD_WEBHOOK_URL;
  }

  try {
    const envPath = path.join(cwd, '.env');
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
      if (process.env.DISCORD_WEBHOOK_URL) {
        return process.env.DISCORD_WEBHOOK_URL;
      }
    }
  } catch {
    // Non-fatal if .env does not exist or cannot be read.
  }

  return undefined;
}

export async function sendStatus({ webhookUrl, payload, ...options }, send = fetch) {
  validateWebhookUrl(webhookUrl);
  const body = payload || createPayload(options);
  const response = await send(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error('Discord returned ' + response.status + (detail ? ': ' + detail : '.'));
  }
}

export async function main(
  argv = process.argv.slice(2),
  environment = process.env,
  send = fetch,
  cwd = process.cwd()
) {
  const options = parseCommand(argv);
  if (options.help) {
    process.stdout.write(usage() + '\n');
    return 0;
  }

  const webhookUrl = getWebhookUrl(options, environment, cwd);
  if (!webhookUrl && !options.dryRun) {
    if (options.hook) {
      // In hook mode, exit cleanly without breaking agent flow if webhook is unconfigured
      process.stdout.write('{}\n');
      return 0;
    }
    throw new Error('DISCORD_WEBHOOK_URL is required unless --dry-run is used.');
  }

  const statePath = path.join(cwd, STATE_FILENAME);

  if (options.mode === 'manual') {
    const payload = createPayload(options);
    if (options.dryRun) {
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return 0;
    }

    await sendStatus({ webhookUrl, payload }, send);
    if (options.hook) {
      process.stdout.write('{}\n');
    } else {
      process.stdout.write('Sent HomeChef ' + options.status + ' status to Discord.\n');
    }
    return 0;
  }

  if (options.mode === 'post-commit' || options.mode === 'commit') {
    const ref = options.commitRef || 'HEAD';
    const commit = getCommitInfo(ref, cwd);
    if (!commit) {
      if (options.hook) {
        process.stdout.write('{}\n');
      } else {
        process.stderr.write(`Could not inspect git commit ${ref}.\n`);
      }
      return 0;
    }

    const payload = formatCommitPayload(commit, {
      url: options.url,
      files: getCommitFiles(ref, cwd),
    });
    if (options.dryRun) {
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return 0;
    }

    await sendStatus({ webhookUrl, payload }, send);
    try {
      fs.writeFileSync(statePath, `commit:${commit.hash}`, 'utf8');
    } catch {
      // Non-fatal write failure
    }

    if (options.hook) {
      process.stdout.write('{}\n');
    } else {
      process.stdout.write(`Sent HomeChef commit ${commit.shortHash} to Discord.\n`);
    }
    return 0;
  }

  if (options.mode === 'changes') {
    const branch = getGitBranch(cwd);
    const { changes, files } = getWorkingTreeInfo(cwd);
    if (!changes) {
      if (options.hook) {
        process.stdout.write('{}\n');
      } else {
        process.stdout.write('No working tree changes to report.\n');
      }
      return 0;
    }

    const payload = formatChangesPayload({ branch, files, url: options.url });
    if (options.dryRun) {
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return 0;
    }

    await sendStatus({ webhookUrl, payload }, send);

    if (options.hook) {
      process.stdout.write('{}\n');
    } else {
      process.stdout.write(`Sent HomeChef working tree changes (${branch}) to Discord.\n`);
    }
    return 0;
  }

  if (options.mode === 'auto') {
    let lastState = '';
    if (fs.existsSync(statePath)) {
      try {
        lastState = fs.readFileSync(statePath, 'utf8').trim();
      } catch {
        // Non-fatal read error
      }
    }

    const branch = getGitBranch(cwd);
    const commit = getCommitInfo('HEAD', cwd);
    const { changes, files } = getWorkingTreeInfo(cwd);

    let payload = null;
    let newState = '';

    if (changes) {
      const hash = crypto
        .createHash('sha256')
        .update(changes + (commit ? commit.hash : ''))
        .digest('hex');
      newState = `changes:${hash}`;
      if (newState !== lastState) {
        payload = formatChangesPayload({ branch, files, url: options.url });
      }
    } else if (commit) {
      newState = `commit:${commit.hash}`;
      if (newState !== lastState) {
        payload = formatCommitPayload(commit, {
          url: options.url,
          files: getCommitFiles('HEAD', cwd),
        });
      }
    }

    if (!payload) {
      if (options.hook) {
        process.stdout.write('{}\n');
      }
      return 0;
    }

    if (options.dryRun) {
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      return 0;
    }

    await sendStatus({ webhookUrl, payload }, send);
    try {
      fs.writeFileSync(statePath, newState, 'utf8');
    } catch {
      // Non-fatal write failure
    }

    if (options.hook) {
      process.stdout.write('{}\n');
    } else {
      process.stdout.write(`Sent HomeChef update (${branch}) to Discord.\n`);
    }
    return 0;
  }

  if (options.hook) {
    process.stdout.write('{}\n');
  }

  return 0;
}

function validateStatusUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('--url must be a valid HTTPS URL.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('--url must be a valid HTTPS URL.');
  }
}

function usage() {
  return [
    'Usage: npm run status:discord -- [options]',
    '',
    'Modes:',
    '  --status <status> --summary <text>  Post manual status update (planned, in-progress, blocked, shipped)',
    '  --post-commit                       Post status update for the latest git commit',
    '  --commit [ref]                      Post status update for a specific commit (default: HEAD)',
    '  --changes                           Post status update for current working tree changes',
    '  --auto                              Automatically post update for new commits or working tree changes',
    '',
    'Options:',
    '  --url <https-url>                   Link the update to an issue, PR, commit, or release',
    '  --webhook-url <https-url>           Override DISCORD_WEBHOOK_URL',
    '  --dry-run                           Print the Discord payload without sending it',
    '  --hook                              Run in lifecycle hook mode (outputs JSON response)',
    '  --help, -h                          Show this help message',
  ].join('\n');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unexpected Discord status error.';
    process.stderr.write(message + '\n');
    process.exitCode = 1;
  });
}
