from fastapi import APIRouter, Depends, HTTPException

from app.deps import require_admin
from app.schemas import CurrentUser, MealOption, NutritionLookupRequest, NutritionLookupResponse
from app.services import plan_builder
from app.services.llm import lookup_nutrition
from app.services.nutrition import MEAL_LABELS

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/meal-slots")
def meal_slots(current_user: CurrentUser = Depends(require_admin)):
    return [{"slot": key, "label": label} for key, label in MEAL_LABELS.items()]


@router.get("/meal-options")
def all_meal_options(current_user: CurrentUser = Depends(require_admin)):
    return plan_builder.list_meal_options()


@router.get("/meal-options/full")
def all_meal_options_full(current_user: CurrentUser = Depends(require_admin)):
    return plan_builder.list_meal_options_full()


@router.get("/meal-options/{meal_slot}/{option_key}")
def get_meal_option(meal_slot: str, option_key: str, current_user: CurrentUser = Depends(require_admin)):
    meal = plan_builder.get_meal_option(meal_slot, option_key)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal option not found")
    return meal


@router.put("/meal-options/{meal_slot}/{option_key}")
def upsert_meal_option(
    meal_slot: str,
    option_key: str,
    payload: MealOption,
    current_user: CurrentUser = Depends(require_admin),
):
    if meal_slot not in MEAL_LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown meal slot '{meal_slot}'")

    option_data = payload.model_dump(exclude={"meal_slot", "option_key"})
    plan_builder.upsert_meal_option(meal_slot, option_key, option_data)
    return {"status": "saved", "meal_slot": meal_slot, "option_key": option_key}


@router.delete("/meal-options/{meal_slot}/{option_key}")
def delete_meal_option(meal_slot: str, option_key: str, current_user: CurrentUser = Depends(require_admin)):
    deleted = plan_builder.delete_meal_option(meal_slot, option_key)
    if not deleted:
        raise HTTPException(status_code=404, detail="Meal option not found")
    return {"status": "deleted"}


@router.post("/nutrition-lookup", response_model=NutritionLookupResponse)
def nutrition_lookup(payload: NutritionLookupRequest, current_user: CurrentUser = Depends(require_admin)):
    try:
        return lookup_nutrition(payload.food_name, payload.quantity, payload.unit)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface upstream LLM errors to the admin UI
        raise HTTPException(status_code=502, detail=f"LLM lookup failed: {exc}") from exc
