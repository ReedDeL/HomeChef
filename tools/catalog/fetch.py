"""TheMealDB client.

The only module in the package that touches the network, so everything else
stays testable without a request.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import requests

logger = logging.getLogger(__name__)

# "1" is TheMealDB's free public test key. A supporter key lifts the rate limit
# and is on the Notion board for Aug 17.
_API_KEY = os.environ.get("THEMEALDB_API_KEY", "1")
_BASE_URL = f"https://www.themealdb.com/api/json/v1/{_API_KEY}"

_TIMEOUT_SECONDS = 20
_POLITENESS_DELAY_SECONDS = 0.2


def _get(path: str, **params: str) -> dict[str, Any]:
    response = requests.get(f"{_BASE_URL}/{path}", params=params, timeout=_TIMEOUT_SECONDS)
    response.raise_for_status()
    time.sleep(_POLITENESS_DELAY_SECONDS)
    payload: Any = response.json()
    return payload if isinstance(payload, dict) else {}


def fetch_categories() -> list[str]:
    payload = _get("list.php", c="list")
    rows = payload.get("meals") or []
    return [row["strCategory"] for row in rows if isinstance(row, dict) and "strCategory" in row]


def fetch_meal_ids(category: str) -> list[str]:
    payload = _get("filter.php", c=category)
    rows = payload.get("meals") or []
    return [row["idMeal"] for row in rows if isinstance(row, dict) and "idMeal" in row]


def fetch_meal(meal_id: str) -> dict[str, Any] | None:
    payload = _get("lookup.php", i=meal_id)
    rows = payload.get("meals") or []
    first = rows[0] if rows else None
    return first if isinstance(first, dict) else None


def fetch_all_meals(limit: int | None = None) -> list[dict[str, Any]]:
    """Walk every category and pull full detail for each meal."""
    meals: list[dict[str, Any]] = []
    seen: set[str] = set()

    for category in fetch_categories():
        logger.info("fetching category %s", category)
        for meal_id in fetch_meal_ids(category):
            if meal_id in seen:
                continue
            seen.add(meal_id)

            try:
                meal = fetch_meal(meal_id)
            except requests.RequestException:
                logger.warning("failed to fetch meal %s, skipping", meal_id)
                continue

            if meal is not None:
                meals.append(meal)

            if limit is not None and len(meals) >= limit:
                return meals

    return meals
