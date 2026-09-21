from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.deps import get_current_user
from app.schemas import CurrentUser, GeneratePlanRequest, PlanExportRequest
from app.services import plan_builder
from app.services.export import build_docx, build_pdf
from app.services.nutrition import build_scaled_plan, calculate_calorie_targets, calculate_macros

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.get("/meal-options")
def meal_options(
    food_preference: str | None = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
):
    return plan_builder.list_meal_options(food_preference)


def _compute_plan(payload: GeneratePlanRequest):
    client = payload.client
    bmr, maintenance, target = calculate_calorie_targets(
        client.gender, client.age, client.height_cm, client.weight_kg, client.activity, client.goal
    )
    macros = calculate_macros(target, client.weight_kg, client.protein_multiplier, client.fat_multiplier)

    selected_meals = []
    for selection in payload.selections:
        for option_key in selection.option_keys:
            meal = plan_builder.get_meal_option(selection.meal_slot, option_key)
            if meal is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Meal option '{option_key}' not found in '{selection.meal_slot}'",
                )
            selected_meals.append(meal)

    if not selected_meals:
        raise HTTPException(status_code=400, detail="Select at least one meal option to generate a plan")

    scaled_meals = build_scaled_plan(selected_meals, target)
    guidelines = plan_builder.get_guidelines()

    return {
        "client": client.model_dump(),
        "nutrition": {"bmr": bmr, "maintenance": maintenance, "target": target, "macros": macros},
        "meals": scaled_meals,
        "guidelines": guidelines,
    }


@router.post("/generate")
def generate_plan(payload: GeneratePlanRequest, current_user: CurrentUser = Depends(get_current_user)):
    return _compute_plan(payload)


@router.post("/export/docx")
def export_docx(payload: PlanExportRequest, current_user: CurrentUser = Depends(get_current_user)):
    plan = payload.model_dump()
    buffer = build_docx(plan)
    filename = f"diet-plan-{(plan['client'].get('name') or 'client').replace(' ', '_')}.docx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/export/pdf")
def export_pdf(payload: PlanExportRequest, current_user: CurrentUser = Depends(get_current_user)):
    plan = payload.model_dump()
    buffer = build_pdf(plan)
    filename = f"diet-plan-{(plan['client'].get('name') or 'client').replace(' ', '_')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
