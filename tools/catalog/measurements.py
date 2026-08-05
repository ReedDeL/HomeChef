"""Measurement parsing.

Input is messy by nature -- "1 cup or so", "a pinch", "2 1/2 tbsp", "". This
module never raises: an unparsed measure is normal and is preserved verbatim
for display, because showing the source text is better than showing nothing.
"""

from __future__ import annotations

import re
from fractions import Fraction

from tools.catalog.models import ParsedMeasure

# Canonical unit spellings, keyed by every surface form we have seen.
_UNIT_ALIASES: dict[str, str] = {
    "tsp": "tsp",
    "tsps": "tsp",
    "teaspoon": "tsp",
    "teaspoons": "tsp",
    "tbs": "tbsp",
    "tbsp": "tbsp",
    "tbsps": "tbsp",
    "tablespoon": "tbsp",
    "tablespoons": "tbsp",
    "cup": "cup",
    "cups": "cup",
    "g": "g",
    "gram": "g",
    "grams": "g",
    "kg": "kg",
    "kilogram": "kg",
    "ml": "ml",
    "milliliter": "ml",
    "millilitre": "ml",
    "l": "l",
    "liter": "l",
    "litre": "l",
    "oz": "oz",
    "ounce": "oz",
    "ounces": "oz",
    "lb": "lb",
    "lbs": "lb",
    "pound": "lb",
    "pounds": "lb",
    "pinch": "pinch",
    "dash": "dash",
    "clove": "clove",
    "cloves": "clove",
    "slice": "slice",
    "slices": "slice",
    "can": "can",
    "cans": "can",
    "tin": "can",
    "sprig": "sprig",
    "sprigs": "sprig",
}

_UNICODE_FRACTIONS: dict[str, str] = {
    "¼": "1/4",
    "½": "1/2",
    "¾": "3/4",
    "⅓": "1/3",
    "⅔": "2/3",
    "⅛": "1/8",
    "⅜": "3/8",
    "⅝": "5/8",
    "⅞": "7/8",
}

# "2 1/2", "1/2", "2.5", or "3" -- optionally followed by a unit word.
#
# Alternation order is load-bearing. A bare-integer branch placed first would
# match the "2" of "2.5" and the "1" of "1/2", silently reporting the wrong
# quantity, so the more specific forms are tried before the general one.
_QUANTITY = re.compile(
    r"^\s*(?:"
    r"(?P<dec>\d*\.\d+)"  # 2.5
    r"|(?P<mixed_whole>\d+)\s+(?P<mixed_num>\d+)\s*/\s*(?P<mixed_den>\d+)"  # 2 1/2
    r"|(?P<num>\d+)\s*/\s*(?P<den>\d+)"  # 1/2
    r"|(?P<whole>\d+)"  # 3
    r")?\s*(?P<rest>.*)$"
)


def parse_measure(raw: str | None) -> ParsedMeasure:
    """Split a measurement into quantity and unit. Never raises."""
    original = (raw or "").strip()
    if not original:
        return ParsedMeasure(quantity=None, unit=None, raw="")

    text = original
    for symbol, ascii_form in _UNICODE_FRACTIONS.items():
        text = text.replace(symbol, f" {ascii_form}")

    match = _QUANTITY.match(text)
    if match is None:  # pragma: no cover - the trailing .* makes this total
        return ParsedMeasure(quantity=None, unit=None, raw=original)

    quantity = _to_quantity(match)
    unit = _to_unit(match.group("rest") or "")

    return ParsedMeasure(quantity=quantity, unit=unit, raw=original)


def _to_quantity(match: re.Match[str]) -> float | None:
    """Resolve whichever quantity branch matched. ``None`` means unparsed.

    Note the ``is not None`` checks: "0 cups" is a real quantity of zero, and a
    truthiness test would discard it.
    """
    if (dec := match.group("dec")) is not None:
        return float(dec)

    if (mixed_whole := match.group("mixed_whole")) is not None:
        fraction = _safe_fraction(match.group("mixed_num"), match.group("mixed_den"))
        return None if fraction is None else float(mixed_whole) + fraction

    if match.group("num") is not None:
        return _safe_fraction(match.group("num"), match.group("den"))

    if (whole := match.group("whole")) is not None:
        return float(whole)

    return None


def _safe_fraction(numerator: str | None, denominator: str | None) -> float | None:
    """A denominator of zero is malformed source text, not a crash."""
    if numerator is None or denominator is None:
        return None
    try:
        return float(Fraction(int(numerator), int(denominator)))
    except (ValueError, ZeroDivisionError):
        return None


def _to_unit(rest: str) -> str | None:
    tokens = re.findall(r"[a-zA-Z]+", rest.lower())
    for token in tokens:
        if token in _UNIT_ALIASES:
            return _UNIT_ALIASES[token]
    return None
