"""Source-neutral ingestion, safety, and deterministic-release tests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from tools.catalog.pipeline import (
    ReleaseBuild,
    _deduplicate,
    build_release,
    ingest_archive,
    validate_release,
    write_release,
)
from tools.catalog.rights import RightsManifest, RightsSource
from tools.catalog.seed_loader import load_seed_recipes


def source(source_id: str = "fixture-source", archive: Path | None = None) -> RightsSource:
    return RightsSource.model_validate(
        {
            "id": source_id,
            "version": "2026-08",
            "title": "Fixture source",
            "archiveUrl": "https://example.test/catalog.jsonl",
            "sha256": hashlib.sha256(archive.read_bytes()).hexdigest() if archive else "a" * 64,
            "archiveFormat": "jsonl",
            "licenseName": "CC0",
            "licenseUrl": "https://example.test/license",
            "attribution": "Fixture source, CC0.",
            "status": "approved",
        }
    )


def record(**overrides: object) -> dict[str, object]:
    value: dict[str, object] = {
        "sourceRecipeId": "source-1",
        "title": "Scallion Rice Bowl",
        "instructions": "Microwave the rice for 3 minutes, then stir.",
        "ingredients": [
            {"name": "Scallions", "measure": "1 cup"},
            {"name": "Rice", "measure": "2 cups"},
        ],
        "cuisine": "Test",
        "totalTimeMinutes": 8,
        "imageUrl": "https://example.test/bowl.jpg",
        "equipment": ["microwave"],
        "allergenStatus": "verified",
        "dietaryStatus": "verified",
        "dietaryTags": [],
    }
    value.update(overrides)
    return value


def write_jsonl(path: Path, *records: dict[str, object]) -> None:
    path.write_text("".join(json.dumps(item) + "\n" for item in records), encoding="utf-8")


def test_ingest_normalizes_a_neutral_record_and_preserves_raw_measure(tmp_path: Path) -> None:
    """Would fail if ingestion leaked a borrowed id or discarded source measure text."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record())

    result = ingest_archive(source(archive=archive), archive)

    assert len(result.recipes) == 1
    recipe = result.recipes[0]
    assert recipe.id.startswith("hc-")
    assert recipe.id != "source-1"
    assert [item.id for item in recipe.ingredients] == ["green_onion", "rice"]
    assert recipe.ingredients[0].raw_measure == "1 cup"
    assert recipe.ingredients[0].quantity == 1.0
    assert recipe.ingredients[0].unit == "cup"
    assert recipe.provenance[0].source_recipe_id == "source-1"


def test_ingest_coerces_contradictory_equipment_to_unique_real_values(tmp_path: Path) -> None:
    """Would fail if a real appliance remained contradictory with none or unknown."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record(equipment=["none", "microwave", "microwave", "unclassified"]))

    result = ingest_archive(source(archive=archive), archive)

    assert result.quarantine == []
    assert result.recipes[0].equipment_required == ["microwave"]


def test_ingest_normalizes_dietary_tags_to_a_stable_unique_order(tmp_path: Path) -> None:
    """Would fail if duplicate dietary claims made a release artifact non-canonical."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record(dietaryTags=["vegetarian", "vegan", "vegan"]))

    result = ingest_archive(source(archive=archive), archive)

    assert result.recipes[0].dietary_tags == ["vegan", "vegetarian"]


def test_ingest_rejects_an_archive_that_does_not_match_the_manifest_pin(tmp_path: Path) -> None:
    """Would fail if a local archive could bypass checksum verification."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record())

    try:
        ingest_archive(source(), archive)
    except ValueError as error:
        assert "checksum" in str(error)
    else:
        raise AssertionError("ingestion accepted an archive with a wrong checksum")


def test_ingest_quarantines_unknown_hard_constraint_metadata(tmp_path: Path) -> None:
    """Would fail if unknown safety metadata became an implied safe value."""
    archive = tmp_path / "unsafe.jsonl"
    write_jsonl(archive, record(equipment=["unclassified"]))

    result = ingest_archive(source(archive=archive), archive)

    assert result.recipes == []
    assert [(item.code, item.coordinate) for item in result.quarantine] == [
        ("unknown_equipment", "fixture-source:source-1:1")
    ]


def test_ingest_quarantines_empty_ingredients_and_unknown_claim_statuses(tmp_path: Path) -> None:
    """Would fail if incomplete hard-constraint data were promoted to safe."""
    archive = tmp_path / "unsafe.jsonl"
    write_jsonl(
        archive,
        record(sourceRecipeId="empty", ingredients=[]),
        record(sourceRecipeId="allergens", allergenStatus="unknown"),
        record(sourceRecipeId="dietary", dietaryStatus="unknown"),
    )

    result = ingest_archive(source(archive=archive), archive)

    assert [item.code for item in result.quarantine] == [
        "unknown_allergen_status",
        "unknown_dietary_status",
        "no_ingredients",
    ]


def test_ingest_quarantines_every_row_for_a_material_source_id_conflict(tmp_path: Path) -> None:
    """Would fail if record order selected an ambiguous source row as a survivor."""
    archive = tmp_path / "conflict.jsonl"
    write_jsonl(archive, record(), record(instructions="Cook on a stove for 10 minutes."))

    result = ingest_archive(source(archive=archive), archive)

    assert result.recipes == []
    assert [(item.code, item.coordinate) for item in result.quarantine] == [
        ("duplicate_conflict", "fixture-source:source-1:1"),
        ("duplicate_conflict", "fixture-source:source-1:2"),
    ]


def test_ingest_conflict_has_no_survivor_when_input_order_reverses(tmp_path: Path) -> None:
    """Would fail if changing source order admitted a different conflicting row."""
    archive = tmp_path / "reverse-conflict.jsonl"
    first = record()
    second = record(instructions="Cook on a stove for 10 minutes.")
    write_jsonl(archive, second, first)

    result = ingest_archive(source(archive=archive), archive)

    assert result.recipes == []
    assert [item.code for item in result.quarantine] == ["duplicate_conflict", "duplicate_conflict"]


def test_release_deduplicates_identical_recipes_independent_of_source_order(tmp_path: Path) -> None:
    """Would fail if ordering changed product IDs or discarded provenance."""
    first_archive = tmp_path / "first.jsonl"
    second_archive = tmp_path / "second.jsonl"
    write_jsonl(first_archive, record(sourceRecipeId="first-id"))
    write_jsonl(second_archive, record(sourceRecipeId="second-id"))
    first = source("first", first_archive)
    second = source("second", second_archive)
    manifest = RightsManifest.model_validate(
        {
            "schemaVersion": 1,
            "sources": [second.model_dump(by_alias=True), first.model_dump(by_alias=True)],
        }
    )

    release = build_release(manifest, {"first": first_archive, "second": second_archive})

    external = [
        recipe
        for recipe in release.recipes
        if recipe.provenance[0].source_id != "homechef-authored"
    ]
    assert len(external) == 1
    assert [row.source_id for row in external[0].provenance] == ["first", "second"]
    assert release.counts == {"recipes": 21, "offlineRecipes": 21, "quarantined": 0}


def test_release_includes_homechef_authored_seeds_in_offline_and_vocabulary(tmp_path: Path) -> None:
    """Would fail if a replacement offline release dropped the microwave catalog."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record())
    item = source(archive=archive)
    manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [item.model_dump(by_alias=True)]}
    )

    release = build_release(manifest, {item.id: archive})
    seeds = load_seed_recipes()

    assert {recipe.id for recipe in seeds} <= {recipe.id for recipe in release.offline_recipes}
    assert {ingredient.id for recipe in seeds for ingredient in recipe.ingredients} <= {
        entry.id for entry in release.vocabulary
    }
    assert all(recipe.provenance[0].source_id == "homechef-authored" for recipe in seeds)


def test_release_rejects_when_approved_archives_have_no_valid_external_recipes(
    tmp_path: Path,
) -> None:
    """Would fail if authored seeds masked a fully quarantined approved archive."""
    archive = tmp_path / "unsafe.jsonl"
    write_jsonl(archive, record(equipment=["unclassified"]))
    item = source(archive=archive)
    manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [item.model_dump(by_alias=True)]}
    )

    with pytest.raises(ValueError, match="valid external"):
        build_release(manifest, {item.id: archive})


def test_offline_release_is_capped_and_stable_across_archive_order(tmp_path: Path) -> None:
    """Would fail if a broad archive bloated offline data or changed curation by input order."""
    records = [
        record(sourceRecipeId=f"source-{index:03}", title=f"External {index:03}")
        for index in range(101)
    ]
    first_archive = tmp_path / "first.jsonl"
    second_archive = tmp_path / "second.jsonl"
    write_jsonl(first_archive, *records)
    write_jsonl(second_archive, *reversed(records))
    first_source = source(archive=first_archive)
    second_source = source(archive=second_archive)
    first_manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [first_source.model_dump(by_alias=True)]}
    )
    second_manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [second_source.model_dump(by_alias=True)]}
    )

    first = build_release(first_manifest, {first_source.id: first_archive})
    second = build_release(second_manifest, {second_source.id: second_archive})

    assert len(first.offline_recipes) == 100
    assert [recipe.id for recipe in first.offline_recipes] == [
        recipe.id for recipe in second.offline_recipes
    ]
    assert {recipe.id for recipe in load_seed_recipes()} <= {
        recipe.id for recipe in first.offline_recipes
    }


def test_release_validation_rejects_a_safe_but_noncanonical_offline_swap(tmp_path: Path) -> None:
    """Would fail if a handoff could replace an intended offline candidate with a slower one."""
    records = [
        record(
            sourceRecipeId=f"source-{index:03}",
            title=f"External {index:03}",
            totalTimeMinutes=index + 1,
        )
        for index in range(81)
    ]
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, *records)
    item = source(archive=archive)
    manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [item.model_dump(by_alias=True)]}
    )
    release = build_release(manifest, {item.id: archive})
    offline_ids = {recipe.id for recipe in release.offline_recipes}
    intended = next(
        recipe
        for recipe in release.offline_recipes
        if recipe.provenance[0].source_id != "homechef-authored"
    )
    slower = next(
        recipe
        for recipe in release.recipes
        if recipe.provenance[0].source_id != "homechef-authored" and recipe.id not in offline_ids
    )
    release.offline_recipes[release.offline_recipes.index(intended)] = slower

    with pytest.raises(ValueError, match="canonical offline subset"):
        validate_release(release)


def test_release_bytes_are_stable_and_include_attribution(tmp_path: Path) -> None:
    """Would fail if equivalent input produced an unauditable or unstable release."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record())
    item = source(archive=archive)
    manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [item.model_dump(by_alias=True)]}
    )
    release = build_release(manifest, {item.id: archive})
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"

    write_release(release, first)
    write_release(release, second)

    assert first.read_bytes() == second.read_bytes()
    payload = json.loads(first.read_text(encoding="utf-8"))
    assert payload["sources"][0]["attribution"] == "Fixture source, CC0."
    assert payload["sources"][0]["sha256"] == hashlib.sha256(archive.read_bytes()).hexdigest()
    assert first.read_bytes().endswith(b"\n")


def test_written_release_round_trips_through_strict_release_validation(tmp_path: Path) -> None:
    """Would fail if artifact aliases did not reconstruct the complete release contract."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record())
    item = source(archive=archive)
    manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [item.model_dump(by_alias=True)]}
    )
    output = tmp_path / "release.json"
    write_release(build_release(manifest, {item.id: archive}), output)

    release = ReleaseBuild.model_validate(json.loads(output.read_text(encoding="utf-8")))

    validate_release(release)


def test_release_validation_rejects_unexpected_artifact_fields() -> None:
    """Would fail if misspelled release fields were silently ignored."""
    with pytest.raises(ValidationError, match="extra"):
        ReleaseBuild.model_validate({"unexpected": True})


def test_release_validation_rejects_unexpected_nested_artifact_fields(tmp_path: Path) -> None:
    """Would fail if an unknown recipe field were silently discarded at handoff."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record())
    item = source(archive=archive)
    manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [item.model_dump(by_alias=True)]}
    )
    output = tmp_path / "release.json"
    write_release(build_release(manifest, {item.id: archive}), output)
    payload = json.loads(output.read_text(encoding="utf-8"))
    payload["recipes"][0]["unexpected"] = True

    with pytest.raises(ValidationError, match="unexpected"):
        ReleaseBuild.model_validate(payload)


def test_deduplication_keeps_distinct_full_provenance_rows() -> None:
    """Would fail if provenance was reduced to a source ID and lost archive identity."""
    first = load_seed_recipes()[0]
    second = first.model_copy(deep=True)
    second.provenance[0].source_version = "microwave-seed-2"
    second.provenance[0].archive_sha256 = "d" * 64

    deduplicated, _ = _deduplicate([first, second])

    assert len(deduplicated[0].provenance) == 2


def test_release_validation_rejects_forged_homechef_authored_provenance(tmp_path: Path) -> None:
    """Would fail if a seed row could claim a different locally known archive pin."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record())
    item = source(archive=archive)
    manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [item.model_dump(by_alias=True)]}
    )
    release = build_release(manifest, {item.id: archive})
    seed = next(recipe for recipe in release.recipes if recipe.id.startswith("hc-mw-"))
    seed.provenance[0].archive_sha256 = "e" * 64

    with pytest.raises(ValueError, match="authored provenance"):
        validate_release(release)


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("equipment_required", [], "equipment"),
        ("equipment_required", ["microwave", "microwave"], "equipment"),
        ("equipment_required", ["none", "microwave"], "equipment"),
        ("equipment_required", ["unclassified"], "equipment"),
        ("allergen_status", "unknown", "allergen"),
        ("dietary_status", "unknown", "dietary status"),
        ("ingredients", [], "ingredients"),
        ("dietary_tags", ["vegan", "vegan"], "dietary tags"),
    ],
)
def test_release_validation_rejects_unsafe_candidate_invariants(
    tmp_path: Path, field: str, value: object, message: str
) -> None:
    """Would fail if unsafe candidate rows could pass through outside offline checks."""
    archive = tmp_path / "source.jsonl"
    write_jsonl(archive, record())
    item = source(archive=archive)
    manifest = RightsManifest.model_validate(
        {"schemaVersion": 1, "sources": [item.model_dump(by_alias=True)]}
    )
    release = build_release(manifest, {item.id: archive})
    candidate = next(
        recipe
        for recipe in release.recipes
        if recipe.provenance[0].source_id != "homechef-authored"
    )
    setattr(candidate, field, value)

    with pytest.raises(ValueError, match=message):
        validate_release(release)
