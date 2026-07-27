"""
Build-time recipe catalog pipeline.

Pulls the full TheMealDB catalog once, normalizes it into the BundledRecipe
shape the app expects (see src/data/types.ts), and writes it to
src/data/recipes.json. The app never calls TheMealDB at runtime — this
script's output is what ships inside the app bundle, which is also what
makes Cook Mode work offline.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/build_catalog.py [--limit N]

Equipment tagging (owned by Harshal): `tag_equipment()` below is a first-pass
keyword heuristic over category/name/instructions. It's deliberately rough —
swap in a better classifier (rules, LLM pass, or manual overrides file)
before this feeds real recommendations. Every recipe must end up with at
least one tag or the equipment filter will silently hide it from everyone.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

API_KEY = os.environ.get("THEMEALDB_API_KEY", "1")
BASE_URL = f"https://www.themealdb.com/api/json/v1/{API_KEY}"
OUTPUT_PATH = ROOT / "src" / "data" / "recipes.json"
REQUEST_DELAY_SECONDS = 0.2  # be polite to the free tier

# Keyword -> equipment tag. Checked against category + name + instructions,
# lowercased. See module docstring — this is a rough first pass.
EQUIPMENT_KEYWORDS: dict[str, list[str]] = {
    "oven": ["bake", "baked", "roast", "oven", "casserole"],
    "stove": ["fry", "sauté", "saute", "simmer", "boil", "skillet", "stovetop", "pan"],
    "microwave": ["microwave"],
    "air-fryer": ["air fryer", "air-fryer"],
    "blender": ["blend", "smoothie", "puree", "purée"],
    "rice-cooker": ["rice cooker"],
    "toaster-oven": ["toast", "toaster oven"],
    "kettle": ["kettle", "boil water"],
}


def fetch_json(url: str) -> dict[str, Any]:
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    time.sleep(REQUEST_DELAY_SECONDS)
    return response.json()


def fetch_categories() -> list[str]:
    data = fetch_json(f"{BASE_URL}/categories.php")
    return [c["strCategory"] for c in data.get("categories", [])]


def fetch_meal_ids_for_category(category: str) -> list[str]:
    data = fetch_json(f"{BASE_URL}/filter.php?c={requests.utils.quote(category)}")
    meals = data.get("meals") or []
    return [m["idMeal"] for m in meals]


def fetch_meal_detail(meal_id: str) -> dict[str, Any] | None:
    data = fetch_json(f"{BASE_URL}/lookup.php?i={meal_id}")
    meals = data.get("meals") or []
    return meals[0] if meals else None


def extract_ingredients(meal: dict[str, Any]) -> list[dict[str, str]]:
    ingredients = []
    for i in range(1, 21):
        name = (meal.get(f"strIngredient{i}") or "").strip()
        measure = (meal.get(f"strMeasure{i}") or "").strip()
        if name:
            ingredients.append({"name": name.lower(), "measure": measure or "to taste"})
    return ingredients


def tag_equipment(meal: dict[str, Any]) -> list[str]:
    haystack = " ".join(
        [meal.get("strCategory", ""), meal.get("strMeal", ""), meal.get("strInstructions", "")]
    ).lower()

    tags = {tag for tag, keywords in EQUIPMENT_KEYWORDS.items() if any(k in haystack for k in keywords)}

    # TODO(Harshal): everything falls back to "stove" if nothing matched, which is a
    # reasonable default but not a verified one — replace with real tagging logic.
    if not tags:
        tags.add("stove")
    return sorted(tags)


def normalize(meal: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": meal["idMeal"],
        "name": meal["strMeal"],
        "category": meal.get("strCategory"),
        "cuisine": meal.get("strArea"),
        # TheMealDB has no cook-time field; leave null until estimated/tagged.
        "cookTimeMinutes": None,
        "requiredEquipment": tag_equipment(meal),
        # TODO: dietary tagging (vegetarian/vegan/gluten-free/etc). Deliberately
        # left empty rather than keyword-guessed — a wrong allergy/diet tag is
        # worse than an absent one. Needs a manual pass or a vetted classifier.
        "dietaryTags": [],
        "imageUrl": meal.get("strMealThumb"),
        "instructions": (meal.get("strInstructions") or "").strip(),
        "ingredients": extract_ingredients(meal),
    }


def build_catalog(limit: int | None) -> list[dict[str, Any]]:
    categories = fetch_categories()
    print(f"Found {len(categories)} categories", file=sys.stderr)

    meal_ids: dict[str, None] = {}
    for category in categories:
        for meal_id in fetch_meal_ids_for_category(category):
            meal_ids[meal_id] = None
        if limit and len(meal_ids) >= limit:
            break

    ids = list(meal_ids.keys())[:limit] if limit else list(meal_ids.keys())
    print(f"Fetching details for {len(ids)} recipes...", file=sys.stderr)

    catalog = []
    for i, meal_id in enumerate(ids, 1):
        meal = fetch_meal_detail(meal_id)
        if meal:
            catalog.append(normalize(meal))
        if i % 25 == 0:
            print(f"  {i}/{len(ids)}", file=sys.stderr)
    return catalog


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="Cap recipe count (useful for dev iteration)")
    args = parser.parse_args()

    catalog = build_catalog(args.limit)
    OUTPUT_PATH.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    print(f"Wrote {len(catalog)} recipes to {OUTPUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
