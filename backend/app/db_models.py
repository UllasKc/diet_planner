from sqlalchemy import Float, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class UserRecord(Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(200))


class MealOptionRecord(Base):
    __tablename__ = "meal_options"

    meal_slot: Mapped[str] = mapped_column(String(40), primary_key=True)
    option_key: Mapped[str] = mapped_column(String(80), primary_key=True)
    meal_name: Mapped[str] = mapped_column(String(160))
    base_calories: Mapped[float] = mapped_column(Float, default=0)
    food_type: Mapped[str] = mapped_column(String(20), default="meal")
    preference: Mapped[str] = mapped_column(String(20), default="Universal")
    ingredients: Mapped[dict] = mapped_column(JSON, default=dict)
