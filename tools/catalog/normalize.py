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
    "jelly": "jam",
    "jellies": "jam",
    "peanutbutter": "peanut_butter",
    "pb": "peanut_butter",
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
    # --- Vocabulary variants (curated 2026-08-07) -------------------------
    # The entries above cover base ids only, so the catalog shipped 897
    # ingredients of which just 35 carried any group: `mozzarella`,
    # `sour_cream`, and `egg_yolks` were all untagged and would be served to
    # a user who declared that exact allergy. Matching is exact-id by design
    # (it is what keeps "egg" from matching "eggplant"), so every real variant
    # has to be listed rather than inferred.
    #
    # Curated by hand, not by keyword: `nutmeg` is not a nut, `butter_beans`
    # and `butternut_squash` are not dairy, `eggplant` is not egg,
    # `oyster_mushrooms` is not shellfish, and `corn_flour` / `rice_flour` /
    # `rice_noodles` are not gluten. Where a call is genuinely arguable the
    # tag goes on: over-tagging costs a recipe, under-tagging costs a user.
    "unsalted_butter": ["dairy"],
    "salted_butter": ["dairy"],
    "melted_butter": ["dairy"],
    "chilled_butter": ["dairy"],
    "buttermilk": ["dairy"],
    "greek_yogurt": ["dairy"],
    "natural_yoghurt": ["dairy"],
    "sour_cream": ["dairy"],
    "single_cream": ["dairy"],
    "whipping_cream": ["dairy"],
    "clotted_cream": ["dairy"],
    "condensed_milk": ["dairy"],
    "evaporated_milk": ["dairy"],
    "cream_cheese": ["dairy"],
    "mozzarella": ["dairy"],
    "feta": ["dairy"],
    "ricotta": ["dairy"],
    "mascarpone": ["dairy"],
    "gruyere": ["dairy"],
    "brie": ["dairy"],
    "gouda_cheese": ["dairy"],
    "goats_cheese": ["dairy"],
    "colby_jack_cheese": ["dairy"],
    "bryndza_cheese": ["dairy"],
    "cheese_curds": ["dairy"],
    "parmesan_cheese": ["dairy"],
    "ghee": ["dairy"],
    "custard": ["dairy"],
    "ice_cream": ["dairy"],
    "milk_chocolate": ["dairy"],
    "egg_yolks": ["egg"],
    "egg_wash": ["egg"],
    "free_range_egg_beaten": ["egg"],
    "free_range_eggs_beaten": ["egg"],
    "meringue_nests": ["egg"],
    # Mayonnaise is egg-based; the vegan variant is a different product.
    "mayonnaise": ["egg"],
    "breadcrumbs": ["gluten", "wheat"],
    "self_raising_flour": ["gluten", "wheat"],
    "strong_white_bread_flour": ["gluten", "wheat"],
    "plain_flour": ["gluten", "wheat"],
    "pita_bread": ["gluten", "wheat"],
    "crusty_bread": ["gluten", "wheat"],
    "bread_rolls": ["gluten", "wheat"],
    "bun": ["gluten", "wheat"],
    "buns": ["gluten", "wheat"],
    "puff_pastry": ["gluten", "wheat"],
    "shortcrust_pastry": ["gluten", "wheat"],
    "filo_pastry": ["gluten", "wheat"],
    "macaroni": ["gluten", "wheat"],
    "spaghetti": ["gluten", "wheat"],
    "linguine_pasta": ["gluten", "wheat"],
    "bowtie_pasta": ["gluten", "wheat"],
    "noodles": ["gluten", "wheat"],
    "egg_noodles": ["gluten", "wheat", "egg"],
    "couscous": ["gluten", "wheat"],
    # Rye contains gluten but is not wheat; keeping them distinct matters for
    # a wheat-only allergy.
    "rye_bread": ["gluten"],
    "cod": ["fish"],
    "salt_cod": ["fish"],
    "codfish_bulljaw": ["fish"],
    "haddock": ["fish"],
    "smoked_haddock": ["fish"],
    "mackerel": ["fish"],
    "sardines": ["fish"],
    "monkfish": ["fish"],
    "white_fish": ["fish"],
    "fish_fillet": ["fish"],
    "fish_stock": ["fish"],
    "anchovy_fillet": ["fish"],
    "smoked_flaked_salmon": ["fish"],
    "king_prawns": ["shellfish"],
    "tiger_prawns": ["shellfish"],
    "frozen_prawns": ["shellfish"],
    "jumbo_shrimp": ["shellfish"],
    "dried_shrimp": ["shellfish"],
    "shrimp_paste": ["shellfish"],
    "shrimp_stock": ["shellfish"],
    "clams": ["shellfish"],
    "mussels": ["shellfish"],
    "oysters": ["shellfish"],
    "oyster_sauce": ["shellfish"],
    "crab_meay": ["shellfish"],
    "pine_nuts": ["nut", "tree_nut"],
    "pecan_nuts": ["nut", "tree_nut"],
    "cashew_nuts": ["nut", "tree_nut"],
    "flaked_almonds": ["nut", "tree_nut"],
    "roasted_peanut": ["nut", "peanut"],
    "peanut_oil": ["nut", "peanut"],
    "soya_bean": ["soy"],
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
