import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestJson, ApiError } from "../api/client";
import { MEAL_LABELS, MEAL_ICONS, PREFERENCE_OPTIONS, preferenceBadgeClass, slugify, slugToLabel } from "../constants";

const UNIT_PRESETS = ["g", "ml", "pieces", "tbsp", "tsp", "cup", "slices"];
const CUSTOM_UNIT_VALUE = "__custom__";

function blankOption() {
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

function blankSlot() {
  return {
    id: crypto.randomUUID(),
    slotName: "",
    is_fixed: false,
    options: [blankOption()],
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
    slots: [blankSlot()],
    isEditingExisting: false,
  };
}

function slotRepresentativeIngredient(slot) {
  const validOptions = slot.options.filter((o) => o.name.trim());
  if (validOptions.length === 0) return null;

  if (validOptions.length === 1) {
    const o = validOptions[0];
    return {
      quantity: Number(o.quantity) || 0,
      unit: o.unit,
      calories: Number(o.calories) || 0,
      protein: Number(o.protein) || 0,
      carbs: Number(o.carbs) || 0,
      fat: Number(o.fat) || 0,
      fiber: Number(o.fiber) || 0,
      is_fixed: Boolean(slot.is_fixed),
      choices: [],
    };
  }

  const avg = (field) => {
    const sum = validOptions.reduce((s, o) => s + (Number(o[field]) || 0), 0);
    return Math.round((sum / validOptions.length) * 10) / 10;
  };

  return {
    quantity: avg("quantity"),
    unit: validOptions[0].unit,
    calories: avg("calories"),
    protein: avg("protein"),
    carbs: avg("carbs"),
    fat: avg("fat"),
    fiber: avg("fiber"),
    is_fixed: Boolean(slot.is_fixed),
    choices: validOptions.map((o) => ({
      name: o.name,
      quantity: Number(o.quantity) || 0,
      unit: o.unit,
      calories: Number(o.calories) || 0,
      protein: Number(o.protein) || 0,
      carbs: Number(o.carbs) || 0,
      fat: Number(o.fat) || 0,
      fiber: Number(o.fiber) || 0,
    })),
  };
}

function ingredientsToSlots(ingredients) {
  const entries = Object.entries(ingredients || {});
  if (entries.length === 0) return [blankSlot()];

  return entries.map(([key, ing]) => {
    const hasChoices = ing.choices && ing.choices.length > 0;
    const options = hasChoices
      ? ing.choices.map((c) => ({
          id: crypto.randomUUID(),
          name: slugToLabel(c.name),
          quantity: c.quantity,
          unit: c.unit,
          calories: c.calories,
          protein: c.protein || 0,
          carbs: c.carbs || 0,
          fat: c.fat || 0,
          fiber: c.fiber || 0,
          looking: false,
        }))
      : [
          {
            id: crypto.randomUUID(),
            name: slugToLabel(key),
            quantity: ing.quantity,
            unit: ing.unit,
            calories: ing.calories,
            protein: ing.protein || 0,
            carbs: ing.carbs || 0,
            fat: ing.fat || 0,
            fiber: ing.fiber || 0,
            looking: false,
          },
        ];

    return {
      id: crypto.randomUUID(),
      slotName: slugToLabel(key),
      is_fixed: Boolean(ing.is_fixed),
      options,
    };
  });
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

  function updateSlot(slotId, field, value) {
    setForm((prev) => ({
      ...prev,
      slots: prev.slots.map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot)),
    }));
  }

  function updateOption(slotId, optionId, field, value) {
    setForm((prev) => ({
      ...prev,
      slots: prev.slots.map((slot) =>
        slot.id !== slotId
          ? slot
          : {
              ...slot,
              options: slot.options.map((option) => (option.id === optionId ? { ...option, [field]: value } : option)),
            }
      ),
    }));
  }

  function addSlot() {
    setForm((prev) => ({ ...prev, slots: [...prev.slots, blankSlot()] }));
  }

  function removeSlot(slotId) {
    setForm((prev) => ({ ...prev, slots: prev.slots.filter((slot) => slot.id !== slotId) }));
  }

  function addOption(slotId) {
    setForm((prev) => ({
      ...prev,
      slots: prev.slots.map((slot) => (slot.id === slotId ? { ...slot, options: [...slot.options, blankOption()] } : slot)),
    }));
  }

  function removeOption(slotId, optionId) {
    setForm((prev) => ({
      ...prev,
      slots: prev.slots.map((slot) =>
        slot.id !== slotId ? slot : { ...slot, options: slot.options.filter((o) => o.id !== optionId) }
      ),
    }));
  }

  function startNew() {
    setForm(blankForm());
    setStatus("");
    setError("");
  }

  async function handleEdit(slot, optionKey) {
    setError("");
    setStatus("");
    try {
      const data = await requestJson(`/api/admin/meal-options/${slot}/${optionKey}`, { token });
      setForm({
        meal_slot: data.meal_slot,
        option_key: data.option_key,
        meal_name: data.meal_name,
        food_type: data.food_type || "meal",
        preference: data.preference || "Universal",
        base_calories: data.base_calories,
        slots: ingredientsToSlots(data.ingredients),
        isEditingExisting: true,
      });
      setStatus(`Editing "${data.meal_name}" — add options to a slot, add a new slot, or edit values, then save.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load meal option for editing");
    }
  }

  async function handleLookup(slotId, option) {
    if (!option.name) {
      setError("Enter a food name before looking up nutrition.");
      return;
    }
    setError("");
    updateOption(slotId, option.id, "looking", true);
    try {
      const data = await requestJson("/api/admin/nutrition-lookup", {
        method: "POST",
        token,
        body: { food_name: option.name, quantity: option.quantity, unit: option.unit },
      });
      setForm((prev) => ({
        ...prev,
        slots: prev.slots.map((slot) =>
          slot.id !== slotId
            ? slot
            : {
                ...slot,
                options: slot.options.map((o) =>
                  o.id === option.id
                    ? { ...o, calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat, fiber: data.fiber, looking: false }
                    : o
                ),
              }
        ),
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "NVIDIA nutrition lookup failed");
      updateOption(slotId, option.id, "looking", false);
    }
  }

  const slotCaloriesKey = form.slots
    .map((slot) => slot.options.map((o) => o.calories).join(","))
    .join("|");

  useEffect(() => {
    setForm((prev) => {
      const total = prev.slots.reduce((sum, slot) => {
        const rep = slotRepresentativeIngredient(slot);
        return sum + (rep ? rep.calories : 0);
      }, 0);
      return { ...prev, base_calories: Math.round(total) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotCaloriesKey]);

  useEffect(() => {
    if (form.meal_name && !form.option_key && !form.isEditingExisting) {
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
    for (const slot of form.slots) {
      if (!slot.slotName.trim()) continue;
      const rep = slotRepresentativeIngredient(slot);
      if (!rep) continue;
      ingredientsDict[slugify(slot.slotName)] = rep;
    }

    if (Object.keys(ingredientsDict).length === 0) {
      setError("Add at least one ingredient slot with a food option.");
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
      if (form.isEditingExisting && form.meal_slot === slot && form.option_key === optionKey) {
        setForm(blankForm());
      }
      loadExisting();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete meal option");
    }
  }

  return (
    <div className="page">
      <h1>🧑‍🍳 Build Diet Plans</h1>
      <p className="page-subtitle">
        Create a brand new meal plate, or click <strong>Edit</strong> on an existing one to add more
        carb / protein / sabzi options to it. Each ingredient slot can hold several substitutable
        options — a client picks one from each. Use the NVIDIA lookup to estimate calories and macros
        for each option before saving.
      </p>

      <div className="grid-two">
        <form className="card" onSubmit={handleSave}>
          <h2>{form.isEditingExisting ? "✏️ Editing Meal Plate" : "🧪 New Meal Plate"}</h2>
          {form.isEditingExisting && (
            <button type="button" className="btn btn-ghost" onClick={startNew} style={{ marginBottom: 8 }}>
              + Start a new plate instead
            </button>
          )}

          <label>Meal Slot</label>
          <select
            value={form.meal_slot}
            disabled={form.isEditingExisting}
            onChange={(e) => updateField("meal_slot", e.target.value)}
          >
            {Object.entries(MEAL_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <label>Meal / Plate Name</label>
          <input
            value={form.meal_name}
            onChange={(e) => updateField("meal_name", e.target.value)}
            placeholder="e.g. Non-Veg Balanced Plate"
          />

          <label>Option Key (unique id, auto-filled)</label>
          <input
            value={form.option_key}
            disabled={form.isEditingExisting}
            onChange={(e) => updateField("option_key", slugify(e.target.value))}
          />

          <label>Food Preference</label>
          <select value={form.preference} onChange={(e) => updateField("preference", e.target.value)}>
            {PREFERENCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <label>Base Calories (auto-averaged from ingredient slots, editable)</label>
          <input
            type="number"
            value={form.base_calories}
            onChange={(e) => updateField("base_calories", e.target.value)}
          />

          <h3>Ingredient Slots</h3>
          <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
            Each slot (e.g. "Carb Source") can have several alternative options a client can choose
            between — add as many as you like. A slot with only one option is just a plain fixed
            ingredient. Unit isn't limited to grams — use "pieces" for count-based foods like eggs.
            Mark a slot <strong>Fixed</strong> to keep its quantity constant (e.g. always 2 eggs) while
            the rest of the plate scales around it.
          </p>

          {form.slots.map((slot) => (
            <div key={slot.id} className="slot-card">
              <div className="slot-header">
                <div className="ingredient-field slot-name-field">
                  <span className="ingredient-field-label">Slot Name</span>
                  <input
                    placeholder="e.g. Carb Source"
                    value={slot.slotName}
                    onChange={(e) => updateSlot(slot.id, "slotName", e.target.value)}
                  />
                </div>
                <label className="fixed-toggle" title="Keep this slot's quantity constant when scaling the meal">
                  <input
                    type="checkbox"
                    checked={slot.is_fixed}
                    onChange={(e) => updateSlot(slot.id, "is_fixed", e.target.checked)}
                  />
                  🔒 Fixed
                </label>
                <button type="button" className="btn btn-ghost btn-danger" onClick={() => removeSlot(slot.id)}>
                  Remove Slot
                </button>
              </div>

              {slot.options.map((option, idx) => (
                <div key={option.id} className="ingredient-row">
                  <span className="option-index-badge">Option {idx + 1}</span>
                  <div className="ingredient-field">
                    <span className="ingredient-field-label">Food</span>
                    <input
                      className="ingredient-name"
                      placeholder="Food name (e.g. paneer)"
                      value={option.name}
                      onChange={(e) => updateOption(slot.id, option.id, "name", e.target.value)}
                    />
                  </div>
                  <div className="ingredient-field">
                    <span className="ingredient-field-label">Qty</span>
                    <input
                      className="ingredient-qty"
                      type="number"
                      value={option.quantity}
                      onChange={(e) => updateOption(slot.id, option.id, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="ingredient-field">
                    <span className="ingredient-field-label">Unit</span>
                    <select
                      className="ingredient-unit-select"
                      value={UNIT_PRESETS.includes(option.unit) ? option.unit : CUSTOM_UNIT_VALUE}
                      onChange={(e) =>
                        updateOption(slot.id, option.id, "unit", e.target.value === CUSTOM_UNIT_VALUE ? "" : e.target.value)
                      }
                    >
                      {UNIT_PRESETS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                      <option value={CUSTOM_UNIT_VALUE}>Custom…</option>
                    </select>
                    {!UNIT_PRESETS.includes(option.unit) && (
                      <input
                        className="ingredient-unit-custom"
                        placeholder="unit"
                        value={option.unit}
                        onChange={(e) => updateOption(slot.id, option.id, "unit", e.target.value)}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={option.looking}
                    onClick={() => handleLookup(slot.id, option)}
                  >
                    {option.looking ? "Looking..." : "🤖 NVIDIA Lookup"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-danger"
                    disabled={slot.options.length <= 1}
                    onClick={() => removeOption(slot.id, option.id)}
                  >
                    Remove Option
                  </button>

                  <div className="ingredient-macros">
                    <MacroInput label="kcal" value={option.calories} onChange={(v) => updateOption(slot.id, option.id, "calories", v)} />
                    <MacroInput label="protein g" value={option.protein} onChange={(v) => updateOption(slot.id, option.id, "protein", v)} />
                    <MacroInput label="carbs g" value={option.carbs} onChange={(v) => updateOption(slot.id, option.id, "carbs", v)} />
                    <MacroInput label="fat g" value={option.fat} onChange={(v) => updateOption(slot.id, option.id, "fat", v)} />
                    <MacroInput label="fiber g" value={option.fiber} onChange={(v) => updateOption(slot.id, option.id, "fiber", v)} />
                  </div>
                </div>
              ))}

              <button type="button" className="btn btn-ghost slot-add-option" onClick={() => addOption(slot.id)}>
                ➕ Add Alternative Option to This Slot
              </button>
            </div>
          ))}

          <button type="button" className="btn btn-secondary" onClick={addSlot}>
            ➕ Add Ingredient Slot
          </button>

          {error && <div className="error-text">{error}</div>}
          {status && <div className="success-text">{status}</div>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : form.isEditingExisting ? "💾 Save Changes" : "💾 Save Meal Plate"}
          </button>
        </form>

        <div className="card">
          <h2>📚 Existing Meal Plates</h2>
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
                    <span className="existing-option-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => handleEdit(slot, option.option_key)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-danger"
                        onClick={() => handleDelete(slot, option.option_key)}
                      >
                        Delete
                      </button>
                    </span>
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
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    </label>
  );
}
