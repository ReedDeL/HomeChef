# HomeChef Discord status reporting

`discord-status.yml` and `scripts/discord-status.mjs` post concise status updates
to Discord when commits or changes are made to the project.

## One-time setup

1. Local environment:
   Add `DISCORD_WEBHOOK_URL` to `.env` (gitignored):

   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```

2. GitHub Actions (CI):
   In GitHub, open this repository's **Settings** > **Secrets and variables** > **Actions**,
   and create a repository secret named `DISCORD_WEBHOOK_URL`.

The URL is a credential. Never commit it, add it to an Expo environment file,
or put it into issue or pull-request text.

## Automated updates

- **Git commits**: `.githooks/post-commit` (installed via `git config core.hooksPath .githooks`)
  automatically runs on every local commit to post the customer outcome, why it matters, the next step, and the owner.
- **Agent turns**: `.agents/hooks.json` triggers on turn completion (`Stop`) to post
  a status card for new commits or work in progress (deduplicated via state hashing).
- **GitHub push**: `discord-status.yml` runs on push to `master` to post recent commit summaries.

## Tone & Style: "Engineer Explaining to Non-Technical Sales"

Discord status reports are written for **non-technical sales, marketing, and cross-functional team members**. When drafting manual status reports or commit summaries, write them as if you are briefing a sales rep before a customer demo:

### The 3-Part Status Formula

1. **What Changed / What Shipped:** One clear, jargon-free sentence explaining the new capability or bug fix.
2. **Why It Matters (Customer & Sales Impact):** How this helps users (e.g. saves time, prevents meal mistakes, makes onboarding frictionless) or what sales can highlight in a pitch.
3. **What’s Next / Ready to Demo:** Clear note on what can be tested or demoed right now.

### Tone Comparison

| ❌ Too Technical (Avoid)                                                                   | ✅ Sales-Friendly (Preferred)                                                                                                                                        |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _"Refactored `src/engine/decide.ts` with set difference and RLS joins on `household_id`."_ | _"⚡ **Decision Engine Upgrade:** HomeChef now matches meals against your pantry in under 10ms without confusing roommate allergies. Ready for instant live demos."_ |
| _"Fixed CORS preflight 500 error in `photo-to-pantry` Edge Function."_                     | _"📸 **Pantry Scanner Fix:** Users can now snap fridge photos from mobile web without getting stuck on loading screens."_                                            |
| _"Added closed enum for 10 equipment tiers in Python ETL."_                                | _"🍳 **Equipment Smart Filtering:** Dorm students with only a microwave will never be suggested an oven bake. Zero broken recipes."_                                 |
| _"Applied migration for `meal_satiety` table."_                                            | _"🍽️ **Post-Meal Check-Ins:** Added a quick 1-tap fullness rating after cooking so HomeChef learns how filling each meal is over time."_                             |

## Manual updates

Run from the command line:

```bash
# Explicit status update (use the sales-friendly formula)
npm run status:discord -- --status shipped --summary "📸 **Pantry Photo Scanner is Live on Web!**\nUsers can now snap photos of their fridge to auto-populate their pantry with 90%+ accuracy. Ready to test on mobile Safari."

# Report latest commit
npm run status:discord -- --post-commit

# Report current working tree changes
npm run status:discord -- --changes

# Auto-detect and post if new commits/changes exist
npm run status:discord -- --auto

# Dry-run without posting
npm run status:discord -- --status planned --summary "📚 **Wikibooks Recipe Catalog Expansion:** Ingesting 3,800+ dorm & offline recipes so users never run out of meal ideas." --dry-run
```
