import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestJson, ApiError } from "../api/client";
import { MEAL_LABELS, MEAL_ICONS, PREFERENCE_OPTIONS, preferenceBadgeClass, slugify } from "../constants";

function blankIngredient() {
  return {
    id: crypto.randomUUID(),
    name: "",
    quantity: 100,
    unit: "g",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    looking: false,
  };
}

function blankForm() {
  return {
    meal_slot: "breakfast",
    option_key: "",
    meal_name: "",
    food_type: "meal",
    preference: "Vegetarian",
    base_calories: 0,
    ingredients: [blankIngredient()],
  };
}

export default function BuildPlanPage() {
  const { token } = useAuth();
  const [form, setForm] = useState(blankForm);
  const [existing, setExisting] = useState({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadExisting() {
    try {
      const data = await requestJson("/api/admin/meal-options", { token });
      setExisting(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load existing meal options");
    }
  }

  useEffect(() => {
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateIngredient(id, field, value) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing)),
    }));
  }

  function addIngredient() {
    setForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, blankIngredient()] }));
  }

  function removeIngredient(id) {
    setForm((prev) => ({ ...prev, ingredients: prev.ingredients.filter((ing) => ing.id !== id) }));
  }

  function recalcBaseCalories(ingredients) {
    const total = ingredients.reduce((sum, ing) => sum + (Number(ing.calories) || 0), 0);
    setForm((prev) => ({ ...prev, base_calories: Math.round(total) }));
  }

  async function handleLookup(ingredient) {
    if (!ingredient.name) {
      setError("Enter a food name before looking up nutrition.");
      return;
    }
    setError("");
    updateIngredient(ingredient.id, "looking", true);
    try {
      const data = await requestJson("/api/admin/nutrition-lookup", {
        method: "POST",
        token,
        body: { food_name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit },
      });
      setForm((prev) => {
        const nextIngredients = prev.ingredients.map((ing) =>
          ing.id === ingredient.id
            ? {
                ...ing,
                calories: data.calories,
                protein: data.protein,
                carbs: data.carbs,
                fat: data.fat,
                fiber: data.fiber,
                looking: false,
              }
            : ing
        );
        return { ...prev, ingredients: nextIngredients };
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "NVIDIA nutrition lookup failed");
      updateIngredient(ingredient.id, "looking", false);
    }
  }

  useEffect(() => {
    recalcBaseCalories(form.ingredients);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ingredients.map((i) => i.calories).join(",")]);

  useEffect(() => {
    if (form.meal_name && !form.option_key) {
      updateField("option_key", slugify(form.meal_name));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.meal_name]);

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!form.meal_name.trim() || !form.option_key.trim()) {
      setError("Meal name and option key are required.");
      return;
    }

    const ingredientsDict = {};
    for (const ing of form.ingredients) {
      if (!ing.name.trim()) continue;
      ingredientsDict[slugify(ing.name)] = {
        quantity: Number(ing.quantity) || 0,
        unit: ing.unit,
        calories: Number(ing.calories) || 0,
        protein: Number(ing.protein) || 0,
        carbs: Number(ing.carbs) || 0,
        fat: Number(ing.fat) || 0,
        fiber: Number(ing.fiber) || 0,
        choices: [],
      };
    }

    if (Object.keys(ingredientsDict).length === 0) {
      setError("Add at least one ingredient with a name.");
      return;
    }

    setSaving(true);
    try {
      await requestJson(`/api/admin/meal-options/${form.meal_slot}/${form.option_key}`, {
        method: "PUT",
        token,
        body: {
          meal_slot: form.meal_slot,
          option_key: form.option_key,
          meal_name: form.meal_name,
          food_type: form.food_type,
          preference: form.preference,
          base_calories: Number(form.base_calories) || 0,
          ingredients: ingredientsDict,
        },
      });
      setStatus(`Saved "${form.meal_name}" to ${MEAL_LABELS[form.meal_slot]}.`);
      setForm(blankForm());
      loadExisting();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save meal option");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slot, optionKey) {
    if (!window.confirm(`Delete "${optionKey}" from ${MEAL_LABELS[slot]}?`)) return;
    setError("");
    try {
      await requestJson(`/api/admin/meal-options/${slot}/${optionKey}`, { method: "DELETE", token });
      loadExisting();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete meal option");
    }
  }

  return (
    <div className="page">
      <h1>🧑‍🍳 Build New Diet Plan</h1>
      <p className="page-subtitle">
        Add a new meal option to the food database. Use the NVIDIA lookup to estimate calories and
        macros for each ingredient — review the values before saving.
      </p>

      <div className="grid-two">
        <form className="card" onSubmit={handleSave}>
          <h2>🧪 New Meal Option</h2>

          <label>Meal Slot</label>
          <select value={form.meal_slot} onChange={(e) => updateField("meal_slot", e.target.value)}>
            {Object.entries(MEAL_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <label>Meal Name</label>
          <input
            value={form.meal_name}
            onChange={(e) => updateField("meal_name", e.target.value)}
            placeholder="e.g. Ragi Dosa + Coconut Chutney"
          />

          <label>Option Key (unique id, auto-filled)</label>
          <input value={form.option_key} onChange={(e) => updateField("option_key", slugify(e.target.value))} />

          <label>Food Preference</label>
          <select value={form.preference} onChange={(e) => updateField("preference", e.target.value)}>
            {PREFERENCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <label>Base Calories (auto-summed from ingredients, editable)</label>
          <input
            type="number"
            value={form.base_calories}
            onChange={(e) => updateField("base_calories", e.target.value)}
          />

          <h3>Ingredients</h3>
          {form.ingredients.map((ingredient) => (
            <div key={ingredient.id} className="ingredient-row">
              <input
                className="ingredient-name"
                placeholder="Food name (e.g. paneer)"
                value={ingredient.name}
                onChange={(e) => updateIngredient(ingredient.id, "name", e.target.value)}
              />
              <input
                className="ingredient-qty"
                type="number"
                value={ingredient.quantity}
                onChange={(e) => updateIngredient(ingredient.id, "quantity", e.target.value)}
              />
              <input
                className="ingredient-unit"
                value={ingredient.unit}
                onChange={(e) => updateIngredient(ingredient.id, "unit", e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={ingredient.looking}
                onClick={() => handleLookup(ingredient)}
              >
                {ingredient.looking ? "Looking..." : "🤖 NVIDIA Lookup"}
              </button>
              <button type="button" className="btn btn-ghost btn-danger" onClick={() => removeIngredient(ingredient.id)}>
                Remove
              </button>

              <div className="ingredient-macros">
                <MacroInput label="kcal" value={ingredient.calories} onChange={(v) => updateIngredient(ingredient.id, "calories", v)} />
                <MacroInput label="protein g" value={ingredient.protein} onChange={(v) => updateIngredient(ingredient.id, "protein", v)} />
                <MacroInput label="carbs g" value={ingredient.carbs} onChange={(v) => updateIngredient(ingredient.id, "carbs", v)} />
                <MacroInput label="fat g" value={ingredient.fat} onChange={(v) => updateIngredient(ingredient.id, "fat", v)} />
                <MacroInput label="fiber g" value={ingredient.fiber} onChange={(v) => updateIngredient(ingredient.id, "fiber", v)} />
              </div>
            </div>
          ))}

          <button type="button" className="btn btn-secondary" onClick={addIngredient}>
            ➕ Add Ingredient
          </button>

          {error && <div className="error-text">{error}</div>}
          {status && <div className="success-text">{status}</div>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "💾 Save Meal Option"}
          </button>
        </form>

        <div className="card">
          <h2>📚 Existing Meal Options</h2>
          {Object.entries(MEAL_LABELS).map(([slot, label]) => {
            const options = existing[slot] || [];
            if (options.length === 0) return null;
            return (
              <div key={slot} className="meal-slot-group">
                <div className="meal-slot-title">
                  <span>{MEAL_ICONS[slot]}</span> {label}
                </div>
                {options.map((option) => (
                  <div key={option.option_key} className="existing-option-row">
                    <span>
                      {option.meal_name}{" "}
                      <span className={preferenceBadgeClass(option.preference)}>{option.preference}</span>{" "}
                      <span className="hint">~{option.base_calories} kcal</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-danger"
                      onClick={() => handleDelete(slot, option.option_key)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MacroInput({ label, value, onChange }) {
  return (
    <label className="macro-input">
      <span>{label}</span>
      <input type="number" step="0.1" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
