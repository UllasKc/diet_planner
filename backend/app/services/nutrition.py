"""BMR / TDEE / macro calculations, following standard Indian clinical nutrition
practice (Mifflin-St Jeor equation, activity multipliers, goal-based calorie
adjustment). Ported and cleaned up from the original Streamlit prototype.
"""

from copy import deepcopy

ACTIVITY_FACTORS = {
    "Sedentary": 1.2,
    "Lightly Active": 1.375,
    "Moderately Active": 1.55,
    "Very Active": 1.725,
}

GOAL_ADJUSTMENTS = {
    "Weight Loss": -500,
    "Muscle Gain": 300,
    "Maintenance": 0,
}

MEAL_LABELS = {
    "breakfast": "Breakfast",
    "morning_snack": "Morning Snack",
    "lunch": "Lunch",
    "evening_snack": "Evening Snack",
    "dinner": "Dinner",
}

MINIMUM_SAFE_CALORIES = 900


def calculate_bmr(gender: str, age: int, height_cm: float, weight_kg: float) -> float:
    if gender == "Male":
        return (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
    return (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161


def calculate_calorie_targets(gender: str, age: int, height_cm: float, weight_kg: float, activity: str, goal: str):
    bmr = calculate_bmr(gender, age, height_cm, weight_kg)
    maintenance = bmr * ACTIVITY_FACTORS[activity]
    target = max(MINIMUM_SAFE_CALORIES, maintenance + GOAL_ADJUSTMENTS[goal])
    return round(bmr), round(maintenance), round(target)


def calculate_macros(target_calories: float, weight_kg: float, protein_multiplier: float, fat_multiplier: float) -> dict:
    protein_g = round(weight_kg * protein_multiplier)
    protein_calories = protein_g * 4
    fat_g = round(weight_kg * fat_multiplier)
    fat_calories = fat_g * 9
    carb_calories = max(0, target_calories - protein_calories - fat_calories)
    carbs_g = round(carb_calories / 4)

    return {
        "protein_multiplier": protein_multiplier,
        "fat_multiplier": fat_multiplier,
        "protein_g": protein_g,
        "protein_calories": protein_calories,
        "fat_g": fat_g,
        "fat_calories": fat_calories,
        "carbs_g": carbs_g,
        "carbs_calories": carbs_g * 4,
    }


def scale_meal(meal_data: dict, target_calories: float) -> dict:
    """Scale ingredient quantities so the meal hits target_calories.

    Ingredients flagged `is_fixed` (e.g. "2 eggs") keep their original
    quantity/calories untouched — the scaling factor is computed only over
    the remaining (non-fixed) ingredients, so they absorb the difference and
    the meal still lands on target_calories overall.
    """
    scaled_meal = deepcopy(meal_data)
    base_calories = float(meal_data.get("base_calories", 0))

    if base_calories <= 0:
        return scaled_meal

    ingredients = scaled_meal.get("ingredients", {})
    fixed_base_calories = sum(
        float(ingredient.get("calories", 0)) for ingredient in ingredients.values() if ingredient.get("is_fixed")
    )
    scalable_base = base_calories - fixed_base_calories
    scalable_target = max(0.0, target_calories - fixed_base_calories)
    factor = (scalable_target / scalable_base) if scalable_base > 0 else 1.0

    total_calories = 0.0
    scalable_items = []
    for ingredient_data in ingredients.values():
        if ingredient_data.get("is_fixed"):
            total_calories += float(ingredient_data.get("calories", 0))
            continue

        ingredient_data["quantity"] = round(float(ingredient_data.get("quantity", 0)) * factor)
        ingredient_data["calories"] = round(float(ingredient_data.get("calories", 0)) * factor)
        for choice in ingredient_data.get("choices", []):
            choice["quantity"] = round(float(choice.get("quantity", 0)) * factor)
            choice["calories"] = round(float(choice.get("calories", 0)) * factor)
        total_calories += ingredient_data["calories"]
        scalable_items.append(ingredient_data)

    # Rounding each ingredient individually drifts the meal's total away from
    # its target (worse with more ingredients) — nudge the largest scalable
    # ingredient by the leftover so the displayed total always matches the
    # target exactly, the way a nutritionist reading the numbers expects.
    target_total = round(target_calories)
    residual = target_total - round(total_calories)
    if residual != 0 and scalable_items:
        largest = max(scalable_items, key=lambda ing: ing["calories"])
        largest["calories"] = max(0, largest["calories"] + residual)
        total_calories += residual

    scaled_meal["target_calories"] = target_total
    scaled_meal["total_calories"] = round(total_calories)
    scaled_meal["scaling_factor"] = round(factor, 3)
    return scaled_meal


def _adjust_meal_total(meal: dict, delta: int) -> None:
    """Nudges one ingredient's calories by delta so the meal's total_calories
    shifts by exactly delta, keeping ingredient-sum == total_calories intact."""
    if delta == 0:
        return
    ingredients = list(meal.get("ingredients", {}).values())
    candidates = [ing for ing in ingredients if not ing.get("is_fixed")] or ingredients
    if not candidates:
        return
    largest = max(candidates, key=lambda ing: ing.get("calories", 0))
    largest["calories"] = max(0, largest.get("calories", 0) + delta)
    meal["total_calories"] = meal.get("total_calories", 0) + delta
    meal["target_calories"] = meal.get("target_calories", 0) + delta


def build_scaled_plan(selected_meals: list[dict], target_calories: float) -> list[dict]:
    """Distribute target_calories across the chosen meals, proportional to each
    meal's base_calories weight, then scale ingredient quantities accordingly."""
    base_total = sum(float(meal.get("base_calories", 0)) for meal in selected_meals)
    if base_total <= 0:
        return []

    scaled_meals = []
    for selected in selected_meals:
        meal_target = target_calories * (float(selected["base_calories"]) / base_total)
        scaled_meal = scale_meal(selected, meal_target)
        scaled_meal["meal_slot"] = selected["meal_slot"]
        scaled_meal["meal_label"] = MEAL_LABELS.get(selected["meal_slot"], selected["meal_slot"].title())
        scaled_meal["option_key"] = selected["option_key"]
        scaled_meals.append(scaled_meal)

    # Each meal's total was independently rounded to match its own fractional
    # share of the day's target, so the day's sum can drift a kcal or two from
    # the overall target even though every individual meal is internally
    # exact. Nudge the largest meal to absorb the difference so the displayed
    # daily total always matches the target exactly.
    day_target = round(target_calories)
    day_total = sum(m["total_calories"] for m in scaled_meals)
    residual = day_target - day_total
    if residual != 0 and scaled_meals:
        largest_meal = max(scaled_meals, key=lambda m: m["total_calories"])
        _adjust_meal_total(largest_meal, residual)

    return scaled_meals
