from typing import Literal

from pydantic import BaseModel, Field

Gender = Literal["Male", "Female"]
Activity = Literal["Sedentary", "Lightly Active", "Moderately Active", "Very Active"]
Goal = Literal["Weight Loss", "Muscle Gain", "Maintenance"]
FoodPreference = Literal["Vegetarian", "Eggetarian", "Non-Vegetarian"]


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    """Public self-registration — always creates a 'viewer' (client) account.
    There's no role field here on purpose: admin accounts are never created
    through this endpoint, only by an existing admin via the backend."""

    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.]+$")
    password: str = Field(min_length=6, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    display_name: str
    username: str


class CurrentUser(BaseModel):
    username: str
    display_name: str
    role: str


class ClientInfo(BaseModel):
    name: str = "Client"
    gender: Gender
    age: int = Field(ge=10, le=100)
    height_cm: float = Field(gt=0, le=260)
    weight_kg: float = Field(gt=0, le=350)
    activity: Activity
    goal: Goal
    food_preference: FoodPreference = "Vegetarian"
    protein_multiplier: float = Field(default=1.6, ge=0.5, le=3.0)
    fat_multiplier: float = Field(default=0.8, ge=0.3, le=2.0)
    notes: str = ""


class MealSelection(BaseModel):
    meal_slot: str
    option_keys: list[str]


class GeneratePlanRequest(BaseModel):
    client: ClientInfo
    selections: list[MealSelection] = Field(default_factory=list)


class PlanExportRequest(BaseModel):
    """Exports render exactly this plan object — the same shape /generate
    returns — rather than recomputing from client+selections. This keeps the
    exported document in sync with any display-only pruning the frontend did
    (e.g. hiding some ingredient substitution choices) after generating."""

    client: dict
    nutrition: dict
    meals: list[dict]
    guidelines: list[dict] = Field(default_factory=list)


class IngredientChoice(BaseModel):
    name: str
    quantity: float
    unit: str
    calories: float
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fiber: float = 0


class Ingredient(BaseModel):
    quantity: float = 0
    unit: str = ""
    calories: float = 0
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fiber: float = 0
    is_fixed: bool = False
    choices: list[IngredientChoice] = Field(default_factory=list)


class MealOption(BaseModel):
    meal_slot: str
    option_key: str
    meal_name: str
    base_calories: float
    food_type: str = "meal"
    preference: str = "Universal"
    ingredients: dict[str, Ingredient] = Field(default_factory=dict)


class NutritionLookupRequest(BaseModel):
    food_name: str
    quantity: float = 100
    unit: str = "g"


class NutritionLookupResponse(BaseModel):
    food_name: str
    quantity: float
    unit: str
    calories: float
    protein: float
    carbs: float
    fat: float
    fiber: float
    source: str = "llm"
