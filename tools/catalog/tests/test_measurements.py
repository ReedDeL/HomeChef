"""Measurement input is messy by nature. The binding requirement is that
parsing never raises -- an unparsed measure is a normal outcome."""

from __future__ import annotations

import pytest

from tools.catalog.measurements import parse_measure


class TestParseMeasure:
    @pytest.mark.parametrize(
        ("raw", "quantity", "unit"),
        [
            ("1 cup", 1.0, "cup"),
            ("2 tbsp", 2.0, "tbsp"),
            ("3 teaspoons", 3.0, "tsp"),
            ("250 g", 250.0, "g"),
            ("1/2 cup", 0.5, "cup"),
            ("2 1/2 tbsp", 2.5, "tbsp"),
            ("2.5 cups", 2.5, "cup"),
            ("1 lb", 1.0, "lb"),
            ("4 cloves", 4.0, "clove"),
        ],
    )
    def test_parses_well_formed_measures(self, raw: str, quantity: float, unit: str) -> None:
        result = parse_measure(raw)
        assert result.quantity == pytest.approx(quantity)
        assert result.unit == unit

    def test_parses_unicode_fractions(self) -> None:
        result = parse_measure("½ cup")
        assert result.quantity == pytest.approx(0.5)
        assert result.unit == "cup"

    def test_handles_hedged_quantities(self) -> None:
        result = parse_measure("1 cup or so")
        assert result.quantity == pytest.approx(1.0)
        assert result.unit == "cup"

    def test_handles_a_unit_with_no_number(self) -> None:
        result = parse_measure("a pinch")
        assert result.quantity is None
        assert result.unit == "pinch"
        assert result.is_parsed is False

    @pytest.mark.parametrize("raw", ["", "   ", None])
    def test_handles_absent_input(self, raw: str | None) -> None:
        result = parse_measure(raw)
        assert result.quantity is None
        assert result.unit is None
        assert result.raw == ""

    def test_always_preserves_the_original_text(self) -> None:
        assert parse_measure("  1 cup or so  ").raw == "1 cup or so"

    @pytest.mark.parametrize(
        "raw",
        ["to taste", "1/0 cup", "???", "1 2 3 4", "cup", "0", "-1 cup", "999999 cups"],
    )
    def test_never_raises_on_hostile_input(self, raw: str) -> None:
        # The contract that matters: a bad measure degrades, it does not crash
        # a 300-recipe build on recipe 147.
        result = parse_measure(raw)
        assert result.raw == raw.strip()

    def test_zero_is_parsed_as_zero_not_none(self) -> None:
        assert parse_measure("0 cups").quantity == pytest.approx(0.0)

    def test_division_by_zero_fraction_degrades_to_unparsed(self) -> None:
        assert parse_measure("1/0 cup").quantity is None
