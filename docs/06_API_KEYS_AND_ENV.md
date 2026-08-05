# HomeChef — API Keys & Environment Setup

**Version:** 1.0 · **Date:** August 3, 2026
**Read this before writing any code that touches a third-party service.**

---

## 0. The one rule

> **A key shipped in a mobile app is a public key.**

React Native bundles are trivially extractable — `.ipa` and `.apk` files are ZIP archives, and anyone can unzip yours and read every string in it. `EXPO_PUBLIC_` variables, `.env` files bundled at build time, and hardcoded constants are all equally exposed.

**Therefore: every secret key lives in Supabase, and only Edge Functions read it.** The client never holds a third-party key — it calls our Edge Function, and the Edge Function calls the vendor.

```
   ❌ WRONG                              ✅ RIGHT

   App ──[Gemini key]──▶ Google         App ──▶ Edge Function ──[key]──▶ Google
   App ──[Spoon key]───▶ Spoonacular    App ──▶ Edge Function ──[key]──▶ Spoonacular
        key is in the bundle,                  key lives in Supabase secrets,
        anyone can extract it                  never leaves the server
```

---

## 1. Every key, and where it goes

| Key | Get it from | Where it lives | Client-safe? |
|---|---|---|---|
| **Gemini API key** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Supabase secret | ❌ **Never** |
| **Spoonacular API key** | [spoonacular.com/food-api/console](https://spoonacular.com/food-api/console) | Supabase secret | ❌ **Never** |
| **Supabase URL** | Supabase dashboard → Settings → API | Client `.env` | ✅ Yes — public by design |
| **Supabase anon key** | Supabase dashboard → Settings → API | Client `.env` | ✅ Yes — RLS protects the data |
| **Supabase service_role key** | Supabase dashboard → Settings → API | **Nowhere yet** | ❌ **Never** — bypasses all RLS |

### On the two Supabase keys

They are not interchangeable, and confusing them is the single most common way a Supabase project leaks.

- **`anon` key** — meant to be public. It identifies your project, and Row Level Security decides what the caller may actually read. Safe in the app bundle.
- **`service_role` key** — bypasses RLS entirely. It can read every user's allergens and every household's pantry. **If this key ever reaches the client, your database is fully open.** We have no use for it in this project. If you find yourself reaching for it, that's a signal your RLS policy is wrong.

---

## 2. Setup — do this once

### Step 1 — Get the keys

**Gemini** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → *Create API key*. Free tier, no credit card.

**Spoonacular** — [spoonacular.com/food-api/console](https://spoonacular.com/food-api/console) → sign up → Profile → API key. Choose the **Free** plan on their own site, *not* through RapidAPI — RapidAPI's free tier requires a credit card and bills overages. Signing up directly means you hit a hard stop at 50 points instead of a surprise charge.

**Supabase** — dashboard → Settings → API. Copy the Project URL and the `anon` key.

### Step 2 — Put the secrets in Supabase

```bash
supabase secrets set GEMINI_API_KEY=your_key_here
supabase secrets set SPOONACULAR_API_KEY=your_key_here

# Confirm — prints names and digests, never values
supabase secrets list
```

Or via dashboard: **Project Settings → Edge Functions → Secrets**.

These are readable only from inside Edge Functions, via `Deno.env.get()`. They are not in your repo, not in your bundle, and not visible to the client.

### Step 3 — Client environment

Create `.env` at the repo root:

```bash
# .env  — safe to ship; these two are public by design
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

**Only ever put the Supabase URL and anon key behind `EXPO_PUBLIC_`.** That prefix means "compile this into the app bundle." Anything else with that prefix is a leak.

### Step 4 — Local Edge Function development

```bash
# supabase/.env.local  — MUST be gitignored
GEMINI_API_KEY=your_key_here
SPOONACULAR_API_KEY=your_key_here
```

```bash
supabase functions serve --env-file supabase/.env.local
```

### Step 5 — `.gitignore`

Verify these lines exist **before your first commit**:

```gitignore
.env
.env.*
!.env.example
supabase/.env.local
```

### Step 6 — `.env.example` (committed)

So a new teammate knows what to fill in without ever seeing a real value:

```bash
# .env.example  — committed. Real values go in .env (gitignored).
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Secrets are NOT here. They live in Supabase:
#   supabase secrets set GEMINI_API_KEY=...
#   supabase secrets set SPOONACULAR_API_KEY=...
```

---

## 3. Reading keys in an Edge Function

```ts
// supabase/functions/analyze-pantry-photo/index.ts
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Reads from Supabase secrets. Never reaches the client.
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    // Fail loudly in logs, say nothing useful to the caller.
    console.error("GEMINI_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ... call Gemini, validate with Zod, return the result
});
```

Two habits worth keeping:

- **Never echo a key into an error response or a log line.** Logs get shared in bug reports and pasted into chat.
- **Never put a key in a URL query string.** URLs land in server logs, browser history, and analytics. Spoonacular's API does take the key as a query parameter — that is unavoidable on their side, but it is one more reason the call happens server-side where the URL is never exposed to a user agent.

---

## 4. Who holds what

| | RJ | Harshal | Third seat |
|---|---|---|---|
| Supabase project owner | ✅ | Member | Member |
| Gemini API key | ✅ Creates | Uses via Supabase | — |
| Spoonacular account | ✅ Creates | Uses via Supabase | — |
| Can read raw secret values | ✅ | ✅ (dashboard) | ❌ |

**Nobody needs a key on their laptop except for local Edge Function development.** If you are building a screen, you need the Supabase URL and anon key — nothing more.

---

## 5. If a key leaks

Assume compromise the moment a key touches a public repo, a screenshot, a Slack message, or a pasted stack trace. Rotating is cheap; not rotating is not.

1. **Revoke immediately** in the vendor console. Do not wait to assess impact.
2. **Generate a replacement.**
3. `supabase secrets set KEY=new_value`
4. **Purge from git history** if it was ever committed — `git rm --cached` is not enough, the value stays in history. Use `git filter-repo` or BFG.
5. **Post it in the Notion status report.** No blame; the point is that the other founders know the key changed and why a build might break.

GitHub push protection is enabled on the repo and will block most accidental commits — but it is a backstop, not the plan.

---

## 6. Pre-launch checklist

Before the App Store submission on **Aug 17**:

- [ ] No `EXPO_PUBLIC_` variable holds anything but the Supabase URL and anon key
- [ ] `grep -ri "AIza\|sk-\|service_role" src/ app/` returns nothing
- [ ] `.env` and `supabase/.env.local` are gitignored and were never committed
- [ ] `.env.example` is committed and current
- [ ] GitHub secret scanning + push protection on
- [ ] TheMealDB supporter payment made (R4)
- [ ] Spoonacular attribution and backlink shipped in the UI (R11)
- [ ] A test build has been unzipped and string-searched for key patterns

That last one takes two minutes and is the only check that tests what actually ships:

```bash
unzip -p build.ipa | strings | grep -i "AIza\|spoonacular.*key"
```

---

## Quick reference

```
SECRETS (Supabase only — never in the bundle)
  GEMINI_API_KEY          → supabase secrets set
  SPOONACULAR_API_KEY     → supabase secrets set

PUBLIC (client .env, safe to bundle)
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY

NEVER USE
  Supabase service role key   ← bypasses RLS; no legitimate use in this app
```

---

*Application42 · HomeChef · API Keys & Environment Setup v1.0 · August 3, 2026*
