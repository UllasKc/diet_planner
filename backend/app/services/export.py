"""Renders a generated diet plan as a DOCX or PDF file for handing to a client."""

from datetime import date
from io import BytesIO

from docx import Document
from docx.shared import Pt, RGBColor
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet

HEADING_COLOR = RGBColor(0x11, 0x18, 0x27)
ACCENT_COLOR = RGBColor(0x25, 0x63, 0xEB)


def _slug_to_label(value: str) -> str:
    return str(value).replace("_", " ").replace("-", " ").title()


def _ingredient_rows(meal: dict) -> list[list[str]]:
    rows = []
    for key, ingredient in meal.get("ingredients", {}).items():
        choices = ingredient.get("choices") or []
        if choices:
            option_text = " | ".join(
                f"{_slug_to_label(c.get('name', 'Choice'))}: {c.get('quantity', 0)}{c.get('unit', ingredient.get('unit', ''))} ({c.get('calories', 0)} kcal)"
                for c in choices
            )
            rows.append([_slug_to_label(key), option_text, ""])
        else:
            rows.append(
                [
                    _slug_to_label(key),
                    f"{ingredient.get('quantity', 0)} {ingredient.get('unit', '')}".strip(),
                    f"{ingredient.get('calories', 0)} kcal",
                ]
            )
    return rows


def build_docx(plan: dict) -> BytesIO:
    client = plan["client"]
    nutrition = plan["nutrition"]

    document = Document()
    title = document.add_heading("Personalized Diet Plan", level=0)
    title.runs[0].font.color.rgb = HEADING_COLOR

    subtitle = document.add_paragraph()
    run = subtitle.add_run(f"Client: {client.get('name') or 'Client'}")
    run.bold = True
    run.font.color.rgb = ACCENT_COLOR
    run.font.size = Pt(14)

    document.add_paragraph(f"Generated on {date.today().strftime('%d %b %Y')}").italic = True

    summary_table = document.add_table(rows=2, cols=5)
    summary_table.style = "Light Grid Accent 1"
    headers = ["Gender", "Age", "Height", "Weight", "Goal"]
    values = [client["gender"], f"{client['age']} yrs", f"{client['height_cm']} cm", f"{client['weight_kg']} kg", client["goal"]]
    for idx, header in enumerate(headers):
        summary_table.rows[0].cells[idx].text = header
        summary_table.rows[1].cells[idx].text = str(values[idx])

    document.add_paragraph()
    calorie_table = document.add_table(rows=2, cols=3)
    calorie_table.style = "Light Grid Accent 1"
    for idx, (label, key) in enumerate([("BMR", "bmr"), ("Maintenance", "maintenance"), ("Target", "target")]):
        calorie_table.rows[0].cells[idx].text = label
        calorie_table.rows[1].cells[idx].text = f"{nutrition[key]} kcal"

    document.add_paragraph()
    macros = nutrition["macros"]
    macro_table = document.add_table(rows=2, cols=3)
    macro_table.style = "Light Grid Accent 1"
    macro_table.rows[0].cells[0].text = "Protein"
    macro_table.rows[0].cells[1].text = "Carbs"
    macro_table.rows[0].cells[2].text = "Fats"
    macro_table.rows[1].cells[0].text = f"{macros['protein_g']} g ({macros['protein_calories']} kcal)"
    macro_table.rows[1].cells[1].text = f"{macros['carbs_g']} g ({macros['carbs_calories']} kcal)"
    macro_table.rows[1].cells[2].text = f"{macros['fat_g']} g ({macros['fat_calories']} kcal)"

    last_slot = None
    for meal in plan["meals"]:
        if meal["meal_slot"] != last_slot:
            document.add_heading(meal["meal_label"], level=1)
            last_slot = meal["meal_slot"]

        document.add_heading(f"{meal.get('meal_name', '')} ({meal.get('total_calories', 0)} kcal)", level=2)
        rows = _ingredient_rows(meal)
        if rows:
            table = document.add_table(rows=1 + len(rows), cols=3)
            table.style = "Light List Accent 1"
            table.rows[0].cells[0].text = "Food"
            table.rows[0].cells[1].text = "Quantity / Choices"
            table.rows[0].cells[2].text = "Calories"
            for r_idx, row in enumerate(rows, start=1):
                for c_idx, value in enumerate(row):
                    table.rows[r_idx].cells[c_idx].text = str(value)

    document.add_heading("Guidelines And Notes", level=1)
    for section in plan.get("guidelines", []):
        document.add_heading(section["title"], level=2)
        for item in section["items"]:
            document.add_paragraph(item, style="List Bullet")

    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return buffer


def build_pdf(plan: dict) -> BytesIO:
    client = plan["client"]
    nutrition = plan["nutrition"]
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleCustom", parent=styles["Title"], textColor=colors.HexColor("#111827"))
    heading_style = ParagraphStyle("HeadingCustom", parent=styles["Heading2"], textColor=colors.HexColor("#111827"))
    subheading_style = ParagraphStyle("SubHeadingCustom", parent=styles["Heading3"], textColor=colors.HexColor("#2563EB"))
    body_style = styles["BodyText"]

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm)
    story = [
        Paragraph("Personalized Diet Plan", title_style),
        Paragraph(f"Client: {client.get('name') or 'Client'} | Generated {date.today().strftime('%d %b %Y')}", body_style),
        Spacer(1, 8),
    ]

    summary_data = [
        ["Gender", "Age", "Height", "Weight", "Goal"],
        [client["gender"], f"{client['age']} yrs", f"{client['height_cm']} cm", f"{client['weight_kg']} kg", client["goal"]],
    ]
    story.append(_styled_table(summary_data))
    story.append(Spacer(1, 6))

    calorie_data = [
        ["BMR", "Maintenance", "Target"],
        [f"{nutrition['bmr']} kcal", f"{nutrition['maintenance']} kcal", f"{nutrition['target']} kcal"],
    ]
    story.append(_styled_table(calorie_data))
    story.append(Spacer(1, 6))

    macros = nutrition["macros"]
    macro_data = [
        ["Protein", "Carbs", "Fats"],
        [
            f"{macros['protein_g']} g ({macros['protein_calories']} kcal)",
            f"{macros['carbs_g']} g ({macros['carbs_calories']} kcal)",
            f"{macros['fat_g']} g ({macros['fat_calories']} kcal)",
        ],
    ]
    story.append(_styled_table(macro_data))
    story.append(Spacer(1, 12))

    last_slot = None
    for meal in plan["meals"]:
        if meal["meal_slot"] != last_slot:
            story.append(Paragraph(meal["meal_label"], heading_style))
            last_slot = meal["meal_slot"]

        story.append(Paragraph(f"{meal.get('meal_name', '')} ({meal.get('total_calories', 0)} kcal)", subheading_style))
        rows = _ingredient_rows(meal)
        if rows:
            table_data = [["Food", "Quantity / Choices", "Calories"]] + rows
            story.append(_styled_table(table_data, col_widths=[110, 300, 70]))
        story.append(Spacer(1, 8))

    story.append(Paragraph("Guidelines And Notes", heading_style))
    for section in plan.get("guidelines", []):
        story.append(Paragraph(section["title"], subheading_style))
        for item in section["items"]:
            story.append(Paragraph(f"&bull; {item}", body_style))
        story.append(Spacer(1, 6))

    doc.build(story)
    buffer.seek(0)
    return buffer


def _styled_table(data: list[list[str]], col_widths: list[int] | None = None) -> Table:
    table = Table(data, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table
