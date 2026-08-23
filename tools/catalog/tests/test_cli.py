"""Catalog CLI network gates and deterministic offline rebuild behavior."""

from __future__ import annotations

import json
from pathlib import Path
from typing import NoReturn

import pytest

from tools.catalog import __main__ as catalog_cli
from tools.catalog.nutrition import load_usda_cache
from tools.catalog.tests.test_build import make_meal


def fail_network(*_args: object, **_kwargs: object) -> NoReturn:
    raise AssertionError("network path must not run")


def test_default_build_uses_committed_catalog_without_network(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(catalog_cli, "fetch_all_meals", fail_network)
    monkeypatch.setattr(catalog_cli, "refresh_usda_cache", fail_network)
    monkeypatch.setattr(catalog_cli, "load_usda_cache", fail_network)

    result = catalog_cli.main(["--output-dir", str(tmp_path)])

    assert result == 0
    recipes = json.loads((tmp_path / "recipes.json").read_text(encoding="utf-8"))
    assert len(recipes) > 20
    assert all("nutritionConfidence" in recipe for recipe in recipes)


def test_limit_is_rejected_without_explicit_mealdb_refresh(tmp_path: Path) -> None:
    with pytest.raises(SystemExit) as error:
        catalog_cli.main(["--limit", "1", "--output-dir", str(tmp_path)])

    assert error.value.code == 2


def test_refresh_mealdb_is_the_only_flag_that_calls_mealdb(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    calls: list[int | None] = []

    def fetch(limit: int | None = None) -> list[dict[str, object]]:
        calls.append(limit)
        return [make_meal()]

    monkeypatch.setattr(catalog_cli, "fetch_all_meals", fetch)
    monkeypatch.setattr(catalog_cli, "refresh_usda_cache", fail_network)

    result = catalog_cli.main(["--refresh-mealdb", "--limit", "1", "--output-dir", str(tmp_path)])

    assert result == 0
    assert calls == [1]


def test_refresh_usda_cache_is_an_explicit_network_gate(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    fixture = Path(__file__).parent / "fixtures" / "usda_foods.json"
    cache = load_usda_cache(fixture)
    calls: list[tuple[Path, list[str]]] = []

    def refresh(path: Path, ingredient_ids: list[str]) -> object:
        calls.append((path, ingredient_ids))
        return cache

    monkeypatch.setattr(catalog_cli, "fetch_all_meals", fail_network)
    monkeypatch.setattr(catalog_cli, "refresh_usda_cache", refresh)
    cache_path = tmp_path / "refreshed-usda.json"

    result = catalog_cli.main(
        [
            "--refresh-usda-cache",
            str(cache_path),
            "--output-dir",
            str(tmp_path / "output"),
        ]
    )

    assert result == 0
    assert len(calls) == 1
    assert calls[0][0] == cache_path
    assert calls[0][1] == sorted(set(calls[0][1]))


def test_usda_cache_flag_enriches_offline_without_refresh(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    fixture = Path(__file__).parent / "fixtures" / "usda_foods.json"
    monkeypatch.setattr(catalog_cli, "fetch_all_meals", fail_network)
    monkeypatch.setattr(catalog_cli, "refresh_usda_cache", fail_network)

    result = catalog_cli.main(["--usda-cache", str(fixture), "--output-dir", str(tmp_path)])

    assert result == 0
    recipes = json.loads((tmp_path / "recipes.json").read_text(encoding="utf-8"))
    assert any(recipe["nutritionProvenance"] is not None for recipe in recipes)


def test_usda_cache_flags_are_mutually_exclusive(tmp_path: Path) -> None:
    with pytest.raises(SystemExit) as error:
        catalog_cli.main(
            [
                "--usda-cache",
                str(tmp_path / "one.json"),
                "--refresh-usda-cache",
                str(tmp_path / "two.json"),
            ]
        )

    assert error.value.code == 2
