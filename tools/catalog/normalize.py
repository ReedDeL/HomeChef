"""Canonical ingredient identity.

This is the highest-leverage module in the pipeline. ``inventory.ingredient_id``
is a foreign key into the vocabulary this produces, and the engine's pantry
lookup is a set membership test over these ids. If "scallion" and "green onion"
survive as two ids, the set difference silently breaks and every recommendation
is wrong in a way no test of the engine itself would catch.
"""

from __future__ import annotations

import re
import unicodedata

# Surface forms that mean the same ingredient. Left side is what a source might
# write; right side is the canonical id. Deliberately conservative -- merging
# two genuinely different ingredients is worse than leaving a near-duplicate,
# because it produces confidently wrong recommendations.
SYNONYMS: dict[str, str] = {
    "scallion": "green_onion",
    "scallions": "green_onion",
    "spring_onion": "green_onion",
    "spring_onions": "green_onion",
    "green_onions": "green_onion",
    "coriander_leaves": "cilantro",
    "fresh_coriander": "cilantro",
    "aubergine": "eggplant",
    "courgette": "zucchini",
    "capsicum": "bell_pepper",
    "bell_peppers": "bell_pepper",
    "garbanzo_beans": "chickpeas",
    "chick_peas": "chickpeas",
    "plain_flour": "all_purpose_flour",
    "flour": "all_purpose_flour",
    "castor_sugar": "caster_sugar",
    "confectioners_sugar": "powdered_sugar",
    "icing_sugar": "powdered_sugar",
    "double_cream": "heavy_cream",
    "heavy_whipping_cream": "heavy_cream",
    "minced_beef": "ground_beef",
    "beef_mince": "ground_beef",
    "prawns": "shrimp",
    "prawn": "shrimp",
}

# Descriptors that qualify an ingredient without changing what it is. Stripped
# so "fresh chopped garlic" and "garlic" resolve together.
_LEADING_MODIFIERS: frozenset[str] = frozenset(
    {
        "fresh",
        "freshly",
        "finely",
        "roughly",
        "coarsely",
        "chopped",
        "minced",
        "diced",
        "sliced",
        "grated",
        "shredded",
        "crushed",
        "ground",
        "whole",
        "large",
        "small",
        "medium",
        "hot",
        "cold",
        "warm",
        "raw",
        "cooked",
    }
)

# Allergen groups by canonical id. The engine treats these as a set operation,
# which is what keeps "egg" from matching "eggplant".
ALLERGEN_GROUPS: dict[str, list[str]] = {
    "egg": ["egg"],
    "eggs": ["egg"],
    "egg_white": ["egg"],
    "egg_yolk": ["egg"],
    "milk": ["dairy"],
    "butter": ["dairy"],
    "cheese": ["dairy"],
    "cheddar_cheese": ["dairy"],
    "parmesan": ["dairy"],
    "cream": ["dairy"],
    "heavy_cream": ["dairy"],
    "yogurt": ["dairy"],
    "peanut": ["nut", "peanut"],
    "peanuts": ["nut", "peanut"],
    "peanut_butter": ["nut", "peanut"],
    "almond": ["nut", "tree_nut"],
    "almonds": ["nut", "tree_nut"],
    "walnut": ["nut", "tree_nut"],
    "walnuts": ["nut", "tree_nut"],
    "cashew": ["nut", "tree_nut"],
    "cashews": ["nut", "tree_nut"],
    "pecan": ["nut", "tree_nut"],
    "pistachio": ["nut", "tree_nut"],
    "hazelnut": ["nut", "tree_nut"],
    "shrimp": ["shellfish"],
    "prawn": ["shellfish"],
    "crab": ["shellfish"],
    "lobster": ["shellfish"],
    "all_purpose_flour": ["gluten", "wheat"],
    "bread_flour": ["gluten", "wheat"],
    "wheat_flour": ["gluten", "wheat"],
    "pasta": ["gluten", "wheat"],
    "bread": ["gluten", "wheat"],
    "soy_sauce": ["soy", "gluten"],
    "soybean": ["soy"],
    "tofu": ["soy"],
    "fish_sauce": ["fish"],
    "salmon": ["fish"],
    "tuna": ["fish"],
    "anchovy": ["fish"],
    "sesame_oil": ["sesame"],
    "sesame_seeds": ["sesame"],
}

# Pre-populated on first run so a brand-new pantry is not empty.
STAPLES: frozenset[str] = frozenset(
    {
        "salt",
        "black_pepper",
        "olive_oil",
        "vegetable_oil",
        "sugar",
        "all_purpose_flour",
        "water",
        "garlic_powder",
    }
)

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    """Lowercase, strip accents, and collapse everything else to underscores."""
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    slug = _NON_ALNUM.sub("_", ascii_only.lower()).strip("_")
    return slug


def canonical_id(raw_name: str) -> str:
    """Resolve a free-text ingredient name to its canonical id.

    Returns ``""`` for input that carries no ingredient at all, so callers can
    drop it rather than inventing an empty id.
    """
    slug = slugify(raw_name)
    if not slug:
        return ""

    parts = slug.split("_")
    while len(parts) > 1 and parts[0] in _LEADING_MODIFIERS:
        parts = parts[1:]
    slug = "_".join(parts)

    # Apply synonyms repeatedly so chains resolve, but never loop forever.
    seen: set[str] = set()
    while slug in SYNONYMS and slug not in seen:
        seen.add(slug)
        slug = SYNONYMS[slug]

    return slug


def allergen_groups_for(ingredient_id: str) -> list[str]:
    """Allergen groups for a canonical id. Unknown ingredients carry none."""
    return list(ALLERGEN_GROUPS.get(ingredient_id, []))


def is_staple(ingredient_id: str) -> bool:
    return ingredient_id in STAPLES


def display_name(ingredient_id: str) -> str:
    return ingredient_id.replace("_", " ")
