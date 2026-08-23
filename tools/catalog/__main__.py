"""Build the bundled catalog.

    python -m tools.catalog --limit 20

Writes ``src/data/recipes.json`` and ``src/data/ingredients.json``. Run
manually; the output is committed. See docs/01_TECHNICAL_SPEC.md 5.2.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from pydantic import ValidationError

from tools.catalog.build import build_vocabulary, to_catalog_recipe
from tools.catalog.fetch import fetch_all_meals
from tools.catalog.models import CatalogRecipe
from tools.catalog.seed_loader import load_seed_recipes, merge_seed

logger = logging.getLogger("catalog")

OUTPUT_DIR = Path(__file__).resolve().parents[2] / "src" / "data"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the HomeChef bundled catalog.")
    parser.add_argument("--limit", type=int, default=None, help="stop after N recipes")
    parser.add_argument(
        "--output-dir", type=Path, default=OUTPUT_DIR, help="where to write the JSON files"
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    raw_meals = fetch_all_meals(limit=args.limit)
    logger.info("fetched %d meals", len(raw_meals))

    recipes: list[CatalogRecipe] = []
    skipped = 0
    for raw in raw_meals:
        try:
            recipes.append(to_catalog_recipe(raw))
        except ValidationError:
            # One bad record must not fail a 300-recipe build.
            skipped += 1
            logger.warning("skipping malformed meal %s", raw.get("idMeal", "<unknown>"))

    if not recipes:
        logger.error("no recipes produced; refusing to write an empty catalog")
        return 1

    # Merged before build_vocabulary so seed ingredients reach the vocabulary.
    # A seed id that is not already in the TheMealDB-derived vocabulary would
    # otherwise be unreachable from the pantry forever -- the test suite pins
    # seed ids to existing vocabulary entries to keep that from happening.
    seed = load_seed_recipes()
    recipes = merge_seed(recipes, seed)
    logger.info("merged %d hand-curated seed recipes", len(seed))

    vocabulary = build_vocabulary(recipes)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    _write(args.output_dir / "recipes.json", [r.model_dump(by_alias=True) for r in recipes])
    _write(args.output_dir / "ingredients.json", [v.model_dump(by_alias=True) for v in vocabulary])

    logger.info(
        "wrote %d recipes and %d ingredients (%d skipped)", len(recipes), len(vocabulary), skipped
    )
    _report_equipment_coverage(recipes)
    return 0


def _write(path: Path, payload: object) -> None:
    # sort_keys and a trailing newline keep the committed diff readable.
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    logger.info("wrote %s", path)


def _report_equipment_coverage(recipes: list[CatalogRecipe]) -> None:
    """Surface how many recipes fell back to ``unclassified``.

    A high fallback rate means the keyword pass is not carrying the equipment
    wedge and the LLM enrichment step is doing real work, not decoration. These
    recipes are excluded from every user's results until enrichment classifies
    them, so this number is a backlog, not a statistic.
    """
    unclassified = sum(1 for r in recipes if r.equipment_required == ["unclassified"])
    logger.info(
        "equipment: %d/%d recipes unclassified (%.0f%%)",
        unclassified,
        len(recipes),
        100 * unclassified / len(recipes),
    )


if __name__ == "__main__":
    sys.exit(main())
