"""Reads/writes meal options from the database and turns them into meal-slot
option lists the frontend can render, and into the raw meal dicts the
nutrition service can scale to a client's calorie target.
"""

from app.data.guidelines import DIET_GUIDELINES
from app.db import get_session
from app.db_models import MealOptionRecord
from app.services.nutrition import MEAL_LABELS

MEAL_SLOTS = list(MEAL_LABELS.keys())


def list_meal_options(food_preference: str | None = None) -> dict[str, list[dict]]:
    """Return {meal_slot: [{option_key, meal_name, base_calories, preference}, ...]}

    Keys are built in MEAL_SLOTS order (breakfast -> dinner) rather than
    however the database happens to return rows — otherwise dict key order
    (and everything downstream that relies on it, like the generated plan's
    meal order) ends up alphabetical by accident, putting dinner/evening
    snack before lunch.
    """
    by_slot: dict[str, list[dict]] = {}

    with get_session() as session:
        records = session.query(MealOptionRecord).all()
        for record in records:
            if food_preference and record.preference not in (food_preference, "Universal"):
                continue

            by_slot.setdefault(record.meal_slot, []).append(
                {
                    "option_key": record.option_key,
                    "meal_name": record.meal_name,
                    "base_calories": record.base_calories,
                    "preference": record.preference,
                }
            )

    return {slot: by_slot[slot] for slot in MEAL_SLOTS if slot in by_slot}


def list_meal_options_full() -> dict[str, list[dict]]:
    """Return every meal option with full ingredient/choice detail, for the
    admin-only meal library view. Unlike list_meal_options(), not filtered
    by preference and not summarized."""
    result: dict[str, list[dict]] = {}

    with get_session() as session:
        records = session.query(MealOptionRecord).order_by(MealOptionRecord.meal_slot, MealOptionRecord.meal_name).all()
        for record in records:
            result.setdefault(record.meal_slot, []).append(
                {
                    "option_key": record.option_key,
                    "meal_name": record.meal_name,
                    "base_calories": record.base_calories,
                    "food_type": record.food_type,
                    "preference": record.preference,
                    "ingredients": record.ingredients,
                }
            )

    return result


def get_meal_option(meal_slot: str, option_key: str) -> dict | None:
    with get_session() as session:
        record = (
            session.query(MealOptionRecord)
            .filter_by(meal_slot=meal_slot, option_key=option_key)
            .one_or_none()
        )
        if record is None:
            return None

        return {
            "meal_slot": record.meal_slot,
            "option_key": record.option_key,
            "meal_name": record.meal_name,
            "base_calories": record.base_calories,
            "food_type": record.food_type,
            "preference": record.preference,
            "ingredients": record.ingredients,
        }


def get_guidelines() -> list[dict]:
    return DIET_GUIDELINES


def upsert_meal_option(meal_slot: str, option_key: str, option_data: dict) -> None:
    with get_session() as session:
        record = (
            session.query(MealOptionRecord)
            .filter_by(meal_slot=meal_slot, option_key=option_key)
            .one_or_none()
        )
        if record is None:
            record = MealOptionRecord(meal_slot=meal_slot, option_key=option_key)
            session.add(record)

        record.meal_name = option_data.get("meal_name", option_key)
        record.base_calories = option_data.get("base_calories", 0)
        record.food_type = option_data.get("food_type", "meal")
        record.preference = option_data.get("preference", "Universal")
        record.ingredients = option_data.get("ingredients", {})


def delete_meal_option(meal_slot: str, option_key: str) -> bool:
    with get_session() as session:
        record = (
            session.query(MealOptionRecord)
            .filter_by(meal_slot=meal_slot, option_key=option_key)
            .one_or_none()
        )
        if record is None:
            return False
        session.delete(record)
        return True
