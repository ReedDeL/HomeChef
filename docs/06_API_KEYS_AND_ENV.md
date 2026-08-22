# HomeChef — API Keys & Environment Setup

## Rule

A mobile-app key is public. Only `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` may be compiled into the client. RLS protects
the public anon key; the service-role key is never client-safe.

## Current key inventory

| Key                             | Location                      | Purpose                               |
| ------------------------------- | ----------------------------- | ------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Client `.env`                 | Supabase project URL                  |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Client `.env`                 | Authenticated client access under RLS |
| `GEMINI_API_KEY`                | Supabase Edge Function secret | Photo-to-pantry only                  |

HomeChef has no recipe-provider API key. Do not add a recipe-provider secret,
public variable, Edge Function call, or local environment entry. Catalog sources
are checksum-pinned archives handled by authorized build tooling, not live APIs.

## Setup

```bash
# .env (ignored)
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase secret (never commit or expose in the app)
supabase secrets set GEMINI_API_KEY=...
```

For local Edge Function work, keep `GEMINI_API_KEY` in ignored
`supabase/.env.local`. Never log a secret or include it in a URL. Edge Functions
handle CORS preflight first and include CORS headers on errors.

## Catalog operations

Checksum manifests, bulk archives, and release activation are not secrets, but
they are controlled operational inputs. Do not download sources, load releases,
activate catalog data, or change remote configuration without explicit,
target-specific authorization and a read-only audit when applicable.

## If a key leaks

Revoke and replace it immediately, update the relevant Supabase secret, remove
the value from history if committed, and record the rotation for the team. Do
not paste the leaked value into an issue, log, or chat.
