"""Equipment classification helpers with an explicit unknown outcome."""

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

    Anything unrecognised is dropped rather than passed through. A result with
    nothing recognised at all becomes ``["unclassified"]`` so the field is never
    an empty list. An explicit ``"none"`` from the caller is preserved, because
    that is an assertion someone made rather than a gap we are papering over.

    It is deliberately NOT ``["none"]``. ``none`` is a verified claim that a
    recipe needs no equipment, and the engine treats it as always satisfied --
    so falling back to it meant "we could not classify this" was indistinguishable
    from "anyone can cook this", and 76 unclassified recipes were served to
    microwave-only users as though confirmed. Unknown excludes; it does not
    admit. See docs/superpowers/specs/2026-08-06-microwave-seed-catalog-design.md.
    """
    if not isinstance(values, list):
        return ["unclassified"]

    seen: list[Equipment] = []
    for value in values:
        if not isinstance(value, str):
            continue
        candidate = value.strip().lower().replace("-", "_").replace(" ", "_")
        if candidate in EQUIPMENT_VALUES and candidate not in seen:
            seen.append(cast(Equipment, candidate))

    # "none" alongside a real appliance is contradictory; the appliance wins.
    # The same applies to "unclassified": if anything was recognised, we are no
    # longer in the dark, so the recognised value replaces the placeholder.
    # Annotated because the comprehension would otherwise narrow the Literal
    # union to exclude the values the fallback below still needs.
    real: list[Equipment] = [item for item in seen if item not in {"none", "unclassified"}]
    if real:
        return real

    # An explicit "none" that survived to here was asserted by the caller, not
    # invented by us, so it keeps its meaning. Only a genuinely empty result --
    # nothing recognised at all -- becomes "unclassified".
    return ["none"] if "none" in seen else ["unclassified"]


def tag_from_text(*texts: str | None) -> list[Equipment]:
    """Deterministic keyword pass over recipe text.

    This is advisory classification only. A release pipeline must quarantine
    ``unclassified`` instead of treating it as a verified no-equipment claim.
    """
    haystack = " ".join(t.lower() for t in texts if t)
    found: list[Equipment] = []
    for keyword, equipment in _KEYWORDS:
        if keyword in haystack and equipment not in found:
            found.append(equipment)

    return coerce_equipment(found)
