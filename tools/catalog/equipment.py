"""Equipment tagging.

TheMealDB carries no equipment metadata, and equipment-aware filtering is the
product wedge no competitor addresses. Getting this wrong -- labelling an
oven recipe ``microwave`` -- is precisely the trust-destroying failure the
wedge exists to prevent.

This module holds the deterministic keyword pass and, critically, the guarantee
that whatever produces tags, the output is always inside the closed enum. The
LLM enrichment pass (Technical Spec 5.2 step 4) calls ``coerce_equipment`` on
its output, so a hallucinated appliance becomes ``none`` rather than a value the
TypeScript engine has no case for.
"""

from __future__ import annotations

from typing import cast

from tools.catalog.models import EQUIPMENT_VALUES, Equipment

# Ordered most-specific first: "toaster oven" must win over "oven".
_KEYWORDS: tuple[tuple[str, Equipment], ...] = (
    ("toaster oven", "toaster_oven"),
    ("air fryer", "air_fryer"),
    ("air-fryer", "air_fryer"),
    ("rice cooker", "rice_cooker"),
    ("microwave", "microwave"),
    ("blender", "blender"),
    ("food processor", "blender"),
    ("kettle", "kettle"),
    ("deep fry", "stove"),
    ("deep-fry", "stove"),
    ("saucepan", "stove"),
    ("frying pan", "stove"),
    ("skillet", "stove"),
    ("wok", "stove"),
    ("simmer", "stove"),
    ("boil", "stove"),
    ("saute", "stove"),
    ("sauté", "stove"),
    ("stovetop", "stove"),
    ("hob", "stove"),
    ("stove", "stove"),
    ("preheat the oven", "oven"),
    ("bake", "oven"),
    ("roast", "oven"),
    ("broil", "oven"),
    ("grill", "oven"),
    ("oven", "oven"),
)


def coerce_equipment(values: object) -> list[Equipment]:
    """Force arbitrary input into the closed enum, deduplicated and ordered.

    Anything unrecognised is dropped rather than passed through. An empty result
    becomes ``["none"]`` so the field is never an empty list -- the engine reads
    ``none`` as "always satisfied", which is the correct default for a recipe we
    could not classify, and is safe because it cannot exclude a user.
    """
    if not isinstance(values, list):
        return ["none"]

    seen: list[Equipment] = []
    for value in values:
        if not isinstance(value, str):
            continue
        candidate = value.strip().lower().replace("-", "_").replace(" ", "_")
        if candidate in EQUIPMENT_VALUES and candidate not in seen:
            seen.append(cast(Equipment, candidate))

    # "none" alongside a real appliance is contradictory; the appliance wins.
    # Annotated because the comprehension would otherwise narrow the Literal
    # union to exclude "none", which the fallback below still needs.
    real: list[Equipment] = [item for item in seen if item != "none"]
    return real if real else ["none"]


def tag_from_text(*texts: str | None) -> list[Equipment]:
    """Deterministic keyword pass over recipe text.

    A first approximation only. Milestone 2 replaces the primary path with the
    LLM enrichment and its mandatory 30-recipe human spot-check; this remains
    the fallback when that pass returns nothing usable.
    """
    haystack = " ".join(t.lower() for t in texts if t)
    found: list[Equipment] = []
    for keyword, equipment in _KEYWORDS:
        if keyword in haystack and equipment not in found:
            found.append(equipment)

    return coerce_equipment(found)
