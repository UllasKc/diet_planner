"""NVIDIA NIM (OpenAI-compatible) integration used to help the nutritionist
look up calorie/macro estimates for Indian foods while building new meal
options. This is an assistive estimate, not a certified lab value — the
nutritionist reviews and can edit every field before saving.
"""

import json

from openai import OpenAI

from app.config import get_settings
from app.schemas import NutritionLookupResponse

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    settings = get_settings()
    if not settings.llm_api_key:
        raise RuntimeError("LLM_API_KEY is not configured in .env")
    if _client is None:
        _client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)
    return _client


SYSTEM_PROMPT = (
    "You are a certified Indian clinical nutritionist's reference assistant. "
    "Given a food item (often an Indian dish or ingredient) and a quantity, "
    "return your best estimate of its nutrition, grounded in standard Indian "
    "food composition references (such as IFCT/ICMR-NIN data) where possible. "
    "Reply with ONLY a compact JSON object, no prose, no markdown fences, using "
    "exactly these keys: calories, protein, carbs, fat, fiber. All values are "
    "numbers (grams for macros, kcal for calories) for the given quantity."
)


def lookup_nutrition(food_name: str, quantity: float, unit: str) -> NutritionLookupResponse:
    settings = get_settings()
    client = _get_client()

    user_prompt = f"Food: {food_name}\nQuantity: {quantity} {unit}\nReturn the JSON now."

    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        extra_body=settings.llm_extra_body_dict or None,
    )

    raw_content = response.choices[0].message.content or "{}"
    parsed = _parse_json_object(raw_content)

    return NutritionLookupResponse(
        food_name=food_name,
        quantity=quantity,
        unit=unit,
        calories=_to_number(parsed.get("calories")),
        protein=_to_number(parsed.get("protein")),
        carbs=_to_number(parsed.get("carbs")),
        fat=_to_number(parsed.get("fat")),
        fiber=_to_number(parsed.get("fiber")),
        source="llm",
    )


def _parse_json_object(text: str) -> dict:
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return {}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}


def _to_number(value) -> float:
    try:
        return round(float(value), 1)
    except (TypeError, ValueError):
        return 0.0
