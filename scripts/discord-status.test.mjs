import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPayload,
  describeAreas,
  formatChangesPayload,
  formatCommitPayload,
  getWebhookUrl,
  main,
  parseCommand,
  parseStatusFiles,
  plainSubject,
  sendStatus,
  validateWebhookUrl,
} from './discord-status.mjs';

test('creates a compact shipped status card', () => {
  const payload = createPayload({
    status: 'shipped',
    summary: 'Pantry scan is ready for device testing.',
    url: 'https://github.com/example/homechef/pull/42',
  });

  assert.equal(payload.username, 'HomeChef status');
  assert.equal(payload.embeds[0].title, 'HomeChef - Shipped');
  assert.equal(payload.embeds[0].color, 0x57f287);
  assert.equal(payload.embeds[0].url, 'https://github.com/example/homechef/pull/42');
});

test('accepts dry runs without a webhook and validates status values', () => {
  assert.deepEqual(
    parseCommand(['--status', 'blocked', '--summary', 'Need a test device.', '--dry-run']),
    {
      dryRun: true,
      hook: false,
      mode: 'manual',
      status: 'blocked',
      summary: 'Need a test device.',
      url: undefined,
      commitRef: undefined,
      webhookUrl: undefined,
    }
  );
  assert.throws(
    () => parseCommand(['--status', 'done', '--summary', 'Finished.']),
    /must be one of/
  );
});

test('parses post-commit, commit, changes, auto, and hook modes', () => {
  assert.equal(parseCommand(['--post-commit']).mode, 'post-commit');
  assert.equal(parseCommand(['--auto', '--hook']).mode, 'auto');
  assert.equal(parseCommand(['--auto', '--hook']).hook, true);
  assert.equal(parseCommand(['--changes']).mode, 'changes');

  const commitOption = parseCommand(['--commit', 'HEAD~1', '--dry-run']);
  assert.equal(commitOption.mode, 'commit');
  assert.equal(commitOption.commitRef, 'HEAD~1');
  assert.equal(commitOption.dryRun, true);
});

test('only accepts Discord incoming-webhook URLs', () => {
  assert.equal(
    validateWebhookUrl('https://discord.com/api/webhooks/123456/token').hostname,
    'discord.com'
  );
  assert.throws(() => validateWebhookUrl('https://example.com/api/webhooks/123/token'));
});

test('rewrites commit subjects as plain past-tense sentences', () => {
  assert.equal(plainSubject('Add equipment filter'), 'Added equipment filter.');
  assert.equal(
    plainSubject('fix(ui): Correct pantry chip overlap'),
    'Corrected pantry chip overlap.'
  );
  assert.equal(plainSubject('Design weekly meal prep'), 'Designed weekly meal prep.');
  assert.equal(plainSubject('Ship the beta.'), 'Ship the beta.');
  assert.equal(plainSubject(''), 'Shipped an update to the app');
});

test('groups changed files into reader-facing product areas', () => {
  assert.deepEqual(describeAreas([]), []);
  assert.deepEqual(describeAreas(['src/engine/relax.ts']), ['⚡ Meal recommendations']);
  // The photo scanner is more specific than its supabase/ parent path.
  assert.deepEqual(describeAreas(['supabase/functions/analyze-pantry-photo/index.ts']), [
    '📸 Fridge photo scanner',
  ]);
  assert.deepEqual(describeAreas(['supabase/migrations/0005_budget.sql']), [
    '🔒 Sign-in & saved preferences',
  ]);
  // Nothing recognizable gets the honest fallback, never a wrong guess.
  assert.deepEqual(describeAreas(['weird/unknown.bin']), ['🚀 Core product improvements']);
  // Deduped in first-seen order.
  assert.deepEqual(describeAreas(['docs/x.md', 'app/y.tsx', 'docs/z.md']), [
    '📋 Product planning',
    '📱 HomeChef app experience',
  ]);
});

test('parses porcelain status into plain paths, renames included', () => {
  const files = parseStatusFiles(
    ['M  src/engine/decide.ts', '?? docs/new plan.md', 'R  old/name.ts -> new/name.ts'].join('\n')
  );
  assert.deepEqual(files, ['src/engine/decide.ts', 'docs/new plan.md', 'new/name.ts']);
});

test('formats commit payloads as a plain-English update', () => {
  const payload = formatCommitPayload(
    {
      hash: 'abcdef123456',
      shortHash: 'abcdef1',
      author: 'Reed DeLancey',
      subject: 'Add Discord status updater',
      body: 'Automates status updates on commits and turns.',
    },
    {
      url: 'https://github.com/example/homechef/commit/abcdef1',
      files: ['scripts/discord-status.mjs', '.github/workflows/discord-status.yml'],
    }
  );

  assert.equal(payload.username, 'HomeChef status');
  assert.equal(payload.embeds[0].title, 'HomeChef progress update');
  assert.equal(payload.embeds[0].color, 0x5865f2);

  const description = payload.embeds[0].description;
  // The real subject, past tense, with author credit — no raw body dump.
  assert.ok(description.includes('**What changed:** Added Discord status updater.'));
  assert.ok(!description.includes('Automates status updates'));
  assert.ok(description.includes('**Touches:** 2 files — 🛠️ Behind-the-scenes improvements'));
  // Impact comes from the area, never a keyword guess about the diff.
  assert.ok(
    description.includes(
      '**Why it matters:** This helps the team ship customer-facing improvements more reliably.'
    )
  );
  // No fabricated readiness claims.
  assert.ok(!description.includes('Next step'));
  assert.ok(!description.includes('can be shown in the next build'));
  assert.equal(payload.embeds[0].url, 'https://github.com/example/homechef/commit/abcdef1');
});

test('formats working tree changes without dumping diff stats', () => {
  const payload = formatChangesPayload({
    branch: 'docs/cleanup',
    files: ['app/(tabs)/pantry.tsx', 'README.md'],
  });

  assert.equal(payload.username, 'HomeChef status');
  assert.equal(payload.embeds[0].title, 'HomeChef work in progress');
  assert.equal(payload.embeds[0].color, 0xfee75c);

  const description = payload.embeds[0].description;
  assert.ok(description.includes('**In progress** on docs/cleanup: 2 files touched so far.'));
  assert.ok(description.includes('📱 HomeChef app experience · 📋 Product planning'));
  assert.ok(description.includes('Still underway — not ready for a customer demo yet.'));
  assert.ok(!description.includes('|'));
  assert.ok(!description.includes('```'));
});

test('resolves webhook url from options or environment', () => {
  assert.equal(
    getWebhookUrl({ webhookUrl: 'https://discord.com/api/webhooks/1/override' }, {}),
    'https://discord.com/api/webhooks/1/override'
  );
  assert.equal(
    getWebhookUrl({}, { DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/env' }),
    'https://discord.com/api/webhooks/1/env'
  );
});

test('posts a JSON payload through the supplied sender', async () => {
  let request;
  await sendStatus(
    {
      webhookUrl: 'https://discord.com/api/webhooks/123456/token',
      status: 'planned',
      summary: 'Start recipe import.',
    },
    async (url, options) => {
      request = { options, url };
      return new Response(null, { status: 204 });
    }
  );

  assert.equal(request.url, 'https://discord.com/api/webhooks/123456/token');
  assert.equal(request.options.method, 'POST');
  assert.equal(JSON.parse(request.options.body).embeds[0].title, 'HomeChef - Planned');
});

test('main executes dry run successfully', async () => {
  const exitCode = await main(
    ['--status', 'shipped', '--summary', 'Ready for testing.', '--dry-run'],
    {}
  );
  assert.equal(exitCode, 0);
});
