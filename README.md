# HomeChef

> ***"Making Chefs Go Extinct!"***

An inventory-driven meal decision engine. Tell it what's in your kitchen once, and it tells you what to make right now — no scrolling, no deciding, no re-entering your pantry every time.

Full product context lives in [homechef-product-vision.md](./homechef-product-vision.md).

## Why

Most recipe apps hand you a list of possibilities. HomeChef hands you a decision: a small number of strong options you can actually cook with what you already own, filtered by your equipment, allergies, diet, and the time you have.

Built first for college students — the hardest constraints (no equipment, low budget, tiny pantry) make the product sharper, not weaker.

## Status

Early-stage MVP scaffold. Core pieces in place: onboarding, manual + photo-based pantry entry, the four-bucket recommendation engine, cook mode, saved meals, and a shopping list — all running against a bundled offline recipe catalog.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Expo 57 |
| Routing | expo-router (file-based, typed routes) |
| UI | React Native 0.86 / React 19.2 |
| Language | TypeScript 6.0 |
| Local storage | `expo-sqlite` (pantry/recipes) + `react-native-mmkv` (session/onboarding) |
| Accounts | Supabase |
| Recipe data | Bundled JSON in [`src/data/`](./src/data), built by [`scripts/build_catalog.py`](./scripts/build_catalog.py) from TheMealDB |

## Getting started

```bash
npm install
cp .env.example .env   # fill in Supabase project URL/anon key
npm run start           # or: npm run ios / npm run android / npm run web
```

### Rebuilding the recipe catalog

The app never calls a recipe API at runtime — the catalog is pulled once at build time and shipped inside the bundle, which is what makes Cook Mode work offline.

```bash
pip install -r scripts/requirements.txt
python scripts/build_catalog.py
```

### Wiring up photo-based ingredient recognition

The scan screen calls whatever URL is in `EXPO_PUBLIC_INGREDIENT_RECOGNITION_URL` — leave it blank during development and it returns a mocked result so the flow stays demoable. To go live, deploy the included Supabase Edge Function, which proxies to Clarifai's `food-item-recognition` model so the Clarifai key never ships inside the app:

```bash
supabase functions deploy recognize-ingredients
supabase secrets set CLARIFAI_API_KEY=<your Clarifai Personal Access Token>
```

Then set `EXPO_PUBLIC_INGREDIENT_RECOGNITION_URL` in `.env` to `https://<project-ref>.supabase.co/functions/v1/recognize-ingredients`.

## Project structure

```
app/                             expo-router screens (onboarding, tabs, inventory, recipe detail, auth)
src/components/                  shared UI (chips, recipe cards, buckets, toasts)
src/data/                        bundled recipe catalog + static types
src/db/                          SQLite schema, migrations, and queries
src/features/                    feature logic (auth, onboarding profile, inventory, recommendation engine, saved meals, shopping list)
src/lib/                         MMKV storage and Supabase client
scripts/                         build-time recipe catalog pipeline (Python)
supabase/functions/              Edge Functions (Clarifai proxy for ingredient recognition)
```

## Team

| Role | Person |
|---|---|
| Co-Founder / CEO | RJ DeLancey |
| Co-Founder / CTO | Harshal Meka |
