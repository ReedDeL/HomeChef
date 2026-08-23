## Design decisions

### Why Wikibooks, and what we verified

Queried live against the Wikibooks API on 2026-08-13:

| Metric | Count |
|---|---|
| `Category:Recipes` (pages) | **3,824** |
| `Category:Recipes with images` | **832** |
| `Category:Featured recipes` | **40** |
| `Category:Recipes with metric units` | **895** |

Parse yield, measured on a random sample of 120 pages (seed 7):

| Property | Share | Projected over 3,824 |
|---|---|---|
| Has an `==Ingredients==` section | **100%** | 3,824 |
| Has a `==Procedure==` section | **96%** | 3,665 |
| Declares a parseable `time=` | **35%** | 1,338 |
| **Expected usable recipes** | **~96%** | **~3,650** |

The time figure drove a design decision. Requiring a declared time would have
cut the corpus to ~1,338 *and* held Wikibooks to a stricter standard than
TheMealDB, whose 792 recipes have their time estimated by
`build.estimate_total_minutes` without exception. So: declared time when
present, estimated otherwise. Net effect is a catalog where 35% of Wikibooks
rows carry a *better* time than anything shipping today.

The wikitext is far more structured than raw scraping would suggest. A representative page (`Cookbook:20-Minute Beef Stroganoff`) carries:

```wikitext
{{recipesummary|category=Beef recipes|servings=4|time=20 minutes|difficulty=2}}
{{Nutrition Summary|ServingSize=1 serving (440 g)|Cals=487|...}}

==Ingredients==
* {{convert|8|oz|g|abbr=on}} wide [[Cookbook:Pasta|egg noodles]]
* 1 large (1 [[Cookbook:Cup|cup]]) coarsely-[[Cookbook:Chopping|chopped]] [[Cookbook:Onion|onion]]

==Procedure==
# Prepare noodles according to package directions and drain.
# As the noodles are boiling, warm oil in very deep [[Cookbook:Skillet|skillet]] or [[Cookbook:Dutch Oven|Dutch oven]].
```

Four properties matter, and each is better than what TheMealDB gives us:

1. **`time=` is declared**, not estimated. TheMealDB has no time field at all — `build.estimate_total_minutes` guesses from prose. Wikibooks states it.
2. **Ingredients are wikilinked to canonical pages.** `[[Cookbook:Onion|onion]]` is a stable identifier, not a free-text string. This attacks the exact step the Technical Spec §5.2 calls the one where "an error here propagates everywhere."
3. **`{{convert|8|oz|g}}` is a parsed measurement already** — quantity and unit as separate template arguments.
4. **Equipment appears as wikilinks** (`[[Cookbook:Skillet|skillet]]`, `[[Cookbook:Dutch Oven|Dutch Oven]]`), giving the equipment pass a structured signal instead of only prose keywords.

### The licensing question, answered

**CC BY-SA does not force HomeChef open source.** It is a content license, not a software copyleft like the GPL. Share-alike attaches to the licensed work and its adaptations — the recipe *prose*. It does not reach:

- the app source code, the decision engine, or the UI;
- our derived metadata (equipment tags, time estimates, normalized ingredient IDs) — these are extracted facts, and facts are not copyrightable;
- ingredient lists, which in the US are generally uncopyrightable as mere listings (*Publications Int'l v. Meredith*).

What it does require, and what this plan implements:

1. **Attribution** — recipe title, a link back to the source page, the license name and a link to it.
2. **Indicate modification** — if we rewrite instruction prose, say so.
3. **Share-alike on the prose** — our adapted recipe text is CC BY-SA 4.0. Someone may copy our recipe text. They may not copy our app.
4. **No DRM** — no technical restrictions on the licensed text.

> Not legal advice. The share-alike-on-displayed-text obligation is real and worth ten minutes of a lawyer's time before public release, but nothing here threatens the codebase.

### The image strategy — and why not to scrape

Scraping food photography off the open web is the one option to reject outright. Recipe *text* sits in a genuinely permissive legal zone; **photographs do not.** A photo is the most unambiguously copyrightable asset involved, commercial use has no fair-use shelter, and image hosts are exactly where DMCA notices originate. It would trade a solved problem for an unbounded liability.

Three clean sources instead, in priority order:

1. **Wikimedia Commons** (this plan, Task 8). 832 recipes already have images. Verified live: license metadata is machine-readable per file via `extmetadata` → `LicenseShortName`, `Artist`, `NonFree`. Sampled files returned `CC BY-SA 2.5`, `CC BY-SA 4.0`, and `Public domain`, all with no `NonFree` flag. Attribution can be generated automatically, which is the only reason this is tractable at 800+ files.
2. **Unsplash / Pexels** (not in this plan). Free for commercial use, no attribution required, high quality — but generic. A stock photo of "pasta" is not a photo of *this* recipe, which is a small honesty cost.
3. **Generated imagery** (not in this plan). Owned outright and stylistically consistent, but synthetic food photography misrepresents the dish.

For the ~3,000 recipes with no Commons image, the answer is **no image**, matching the existing seed-recipe precedent in `seed_loader.py:69` — *"A wrong or placeholder photo is worse than none."*

### The risk that decides whether this is worth doing

`equipment.py:53` is unambiguous: an unclassified recipe is **excluded from every user's result set** until enrichment classifies it. Unknown excludes; it does not admit.

So importing 3,824 recipes that the keyword pass cannot classify adds **catalog weight, not usable answers.** Task 9 measures this before Task 10 decides whether to ship. If the unclassified rate on Wikibooks exceeds ~35%, the import is inert until LLM enrichment runs, and this plan has not yet delivered value. Treat Task 9's number as the go/no-go.

---
