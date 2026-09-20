"""One-off seed script: creates tables (if missing) and loads the starter
users + food database from the seed_*.yaml files into whatever DATABASE_URL
points at. Safe to re-run — upserts by primary key rather than duplicating.

Usage (from backend/):
    .venv/Scripts/python.exe scripts/seed_db.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import yaml

from app.config import SEED_FOOD_DATABASE_FILE, SEED_USERS_FILE
from app.db import Base, engine, get_session
from app.db_models import MealOptionRecord, UserRecord


def infer_preference(option_key: str, meal_name: str) -> str:
    text = f"{option_key} {meal_name}".lower()
    if "non_veg" in text or "non-veg" in text:
        return "Non-Vegetarian"
    if "egg" in text:
        return "Eggetarian"
    if "veg" in text:
        return "Vegetarian"
    return "Universal"


def seed_users(session):
    """Only creates users that don't exist yet — never overwrites an existing
    password_hash, so a password changed in production survives redeploys."""
    data = yaml.safe_load(SEED_USERS_FILE.read_text(encoding="utf-8")) or {}
    created = 0
    for user in data.get("users", []):
        exists = session.query(UserRecord).filter_by(username=user["username"]).one_or_none()
        if exists is not None:
            continue
        session.add(
            UserRecord(
                username=user["username"],
                display_name=user.get("display_name", user["username"]),
                role=user.get("role", "viewer"),
                password_hash=user["password_hash"],
            )
        )
        created += 1
    print(f"Created {created} new users (existing users left untouched)")


def seed_meal_options(session):
    """Only creates meal options that don't exist yet — never overwrites an
    existing row, so edits/additions made through the admin UI in production
    survive redeploys (which re-run this script)."""
    data = yaml.safe_load(SEED_FOOD_DATABASE_FILE.read_text(encoding="utf-8")) or {}
    created = 0
    for meal_slot, options in data.items():
        if not isinstance(options, dict):
            continue
        for option_key, option_data in options.items():
            if not isinstance(option_data, dict):
                continue

            exists = (
                session.query(MealOptionRecord)
                .filter_by(meal_slot=meal_slot, option_key=option_key)
                .one_or_none()
            )
            if exists is not None:
                continue

            meal_name = option_data.get("meal_name", option_key)
            session.add(
                MealOptionRecord(
                    meal_slot=meal_slot,
                    option_key=option_key,
                    meal_name=meal_name,
                    base_calories=option_data.get("base_calories", 0),
                    food_type=option_data.get("food_type", "meal"),
                    preference=option_data.get("preference") or infer_preference(option_key, meal_name),
                    ingredients=option_data.get("ingredients", {}),
                )
            )
            created += 1
    print(f"Created {created} new meal options (existing rows left untouched)")


def main():
    print(f"Creating tables on {engine.url.render_as_string(hide_password=True)} ...")
    Base.metadata.create_all(engine)

    with get_session() as session:
        seed_users(session)
        seed_meal_options(session)

    print("Done.")


if __name__ == "__main__":
    main()
