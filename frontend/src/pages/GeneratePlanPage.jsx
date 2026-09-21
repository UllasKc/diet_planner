import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestJson, requestBlob, ApiError } from "../api/client";
import { MEAL_LABELS, MEAL_ICONS, MULTI_SELECT_SLOTS, slugToLabel } from "../constants";

const ACTIVITY_OPTIONS = ["Sedentary", "Lightly Active", "Moderately Active", "Very Active"];
const GOAL_OPTIONS = ["Weight Loss", "Maintenance", "Muscle Gain"];
const PREFERENCE_OPTIONS = ["Vegetarian", "Eggetarian", "Non-Vegetarian"];

const initialClient = {
  name: "",
  gender: "Female",
  age: 30,
  height_cm: 160,
  weight_kg: 60,
  activity: "Moderately Active",
  goal: "Weight Loss",
  food_preference: "Vegetarian",
  protein_multiplier: 1.6,
  fat_multiplier: 0.8,
  notes: "",
};

export default function GeneratePlanPage() {
  const { token } = useAuth();
  const [client, setClient] = useState(initialClient);
  const [mealOptions, setMealOptions] = useState({});
  const [selections, setSelections] = useState({});
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const data = await requestJson(
          `/api/plans/meal-options?food_preference=${encodeURIComponent(client.food_preference)}`,
          { token }
        );
        if (!cancelled) {
          setMealOptions(data);
          setSelections((prev) => pruneSelections(prev, data));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load meal options");
      }
    }
    loadOptions();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.food_preference, token]);

  function pruneSelections(prevSelections, availableOptions) {
    const next = {};
    for (const slot of Object.keys(availableOptions)) {
      const availableKeys = new Set(availableOptions[slot].map((o) => o.option_key));
      const kept = (prevSelections[slot] || []).filter((key) => availableKeys.has(key));
      next[slot] = kept;
    }
    return next;
  }

  function updateClientField(field, value) {
    setClient((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSelection(slot, optionKey) {
    setSelections((prev) => {
      const current = prev[slot] || [];
      const isMulti = MULTI_SELECT_SLOTS.has(slot);
      let next;
      if (current.includes(optionKey)) {
        next = current.filter((key) => key !== optionKey);
      } else if (isMulti) {
        next = [...current, optionKey];
      } else {
        next = [optionKey];
      }
      return { ...prev, [slot]: next };
    });
  }

  const selectionPayload = useMemo(
    () =>
      Object.entries(selections)
        .filter(([, keys]) => keys.length > 0)
        .map(([meal_slot, option_keys]) => ({ meal_slot, option_keys })),
    [selections]
  );

  async function handleGenerate(event) {
    event.preventDefault();
    setError("");
    setPlan(null);

    if (selectionPayload.length === 0) {
      setError("Select at least one meal option before generating a plan.");
      return;
    }

    setLoading(true);
    try {
      const data = await requestJson("/api/plans/generate", {
        method: "POST",
        token,
        body: { client, selections: selectionPayload },
      });
      setPlan(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format) {
    setExporting(format);
    setError("");
    try {
      const blob = await requestBlob(`/api/plans/export/${format}`, {
        method: "POST",
        token,
        body: { client, selections: selectionPayload },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `diet-plan-${(client.name || "client").replace(/\s+/g, "_")}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="page">
      <h1>🥗 Generate a Diet Plan</h1>
      <p className="page-subtitle">
        Enter client details, pick meal options for each slot, and generate a personalised,
        calorie-scaled plan based on Indian nutrition guidelines.
      </p>

      <div className="grid-two">
        <form className="card" onSubmit={handleGenerate}>
          <h2>🧑‍⚕️ Client Details</h2>

          <label>Client Name</label>
          <input value={client.name} onChange={(e) => updateClientField("name", e.target.value)} placeholder="e.g. Priya Sharma" />

          <div className="field-row">
            <div>
              <label>Gender</label>
              <select value={client.gender} onChange={(e) => updateClientField("gender", e.target.value)}>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
            <div>
              <label>Age</label>
              <input
                type="number"
                min="10"
                max="100"
                value={client.age}
                onChange={(e) => updateClientField("age", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="field-row">
            <div>
              <label>Height (cm)</label>
              <input
                type="number"
                value={client.height_cm}
                onChange={(e) => updateClientField("height_cm", Number(e.target.value))}
              />
            </div>
            <div>
              <label>Weight (kg)</label>
              <input
                type="number"
                value={client.weight_kg}
                onChange={(e) => updateClientField("weight_kg", Number(e.target.value))}
              />
            </div>
          </div>

          <label>Activity Level</label>
          <select value={client.activity} onChange={(e) => updateClientField("activity", e.target.value)}>
            {ACTIVITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <label>Goal</label>
          <select value={client.goal} onChange={(e) => updateClientField("goal", e.target.value)}>
            {GOAL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <label>Food Preference</label>
          <select
            value={client.food_preference}
            onChange={(e) => updateClientField("food_preference", e.target.value)}
          >
            {PREFERENCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <div className="field-row">
            <div>
              <label>Protein (g/kg body weight)</label>
              <input
                type="number"
                step="0.1"
                value={client.protein_multiplier}
                onChange={(e) => updateClientField("protein_multiplier", Number(e.target.value))}
              />
            </div>
            <div>
              <label>Fat (g/kg body weight)</label>
              <input
                type="number"
                step="0.1"
                value={client.fat_multiplier}
                onChange={(e) => updateClientField("fat_multiplier", Number(e.target.value))}
              />
            </div>
          </div>

          <label>Notes</label>
          <textarea
            rows={2}
            value={client.notes}
            onChange={(e) => updateClientField("notes", e.target.value)}
            placeholder="Allergies, medical conditions, preferences..."
          />

          <h2>🍽️ Meal Selection</h2>
          {Object.keys(MEAL_LABELS).map((slot) => {
            const options = mealOptions[slot] || [];
            if (options.length === 0) return null;
            const isMulti = MULTI_SELECT_SLOTS.has(slot);
            return (
              <div className="meal-slot-group" key={slot}>
                <div className="meal-slot-title">
                  <span>{MEAL_ICONS[slot]}</span> {MEAL_LABELS[slot]}{" "}
                  {isMulti ? <span className="hint">(choose one or more)</span> : <span className="hint">(choose one)</span>}
                </div>
                {options.map((option) => (
                  <label key={option.option_key} className="option-checkbox">
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      name={slot}
                      checked={(selections[slot] || []).includes(option.option_key)}
                      onChange={() => toggleSelection(slot, option.option_key)}
                    />
                    {option.meal_name} <span className="hint">(~{option.base_calories} kcal)</span>
                  </label>
                ))}
              </div>
            );
          })}

          {error && <div className="error-text">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Generating..." : "Generate Plan"}
          </button>
        </form>

        <div className="card">
          <h2>📋 Result</h2>
          {!plan && <p className="hint">Fill in the client details and generate a plan to see it here.</p>}
          {plan && <PlanResult plan={plan} onExport={handleExport} exporting={exporting} />}
        </div>
      </div>
    </div>
  );
}

function PlanResult({ plan, onExport, exporting }) {
  const { nutrition, meals, guidelines } = plan;

  let lastSlot = null;

  return (
    <div>
      <div className="stat-row">
        <Stat label="BMR" value={`${nutrition.bmr} kcal`} tone="calorie" />
        <Stat label="Maintenance" value={`${nutrition.maintenance} kcal`} tone="calorie" />
        <Stat label="Target" value={`${nutrition.target} kcal`} tone="calorie" />
      </div>
      <div className="stat-row">
        <Stat label="Protein" value={`${nutrition.macros.protein_g} g`} tone="protein" />
        <Stat label="Carbs" value={`${nutrition.macros.carbs_g} g`} tone="carbs" />
        <Stat label="Fat" value={`${nutrition.macros.fat_g} g`} tone="fat" />
      </div>

      <div className="export-row">
        <button className="btn btn-secondary" disabled={exporting === "docx"} onClick={() => onExport("docx")}>
          {exporting === "docx" ? "Exporting..." : "⬇ Export DOCX"}
        </button>
        <button className="btn btn-secondary" disabled={exporting === "pdf"} onClick={() => onExport("pdf")}>
          {exporting === "pdf" ? "Exporting..." : "⬇ Export PDF"}
        </button>
      </div>

      {meals.map((meal) => {
        const showHeading = meal.meal_slot !== lastSlot;
        lastSlot = meal.meal_slot;
        return (
          <div key={`${meal.meal_slot}-${meal.option_key}`}>
            {showHeading && (
              <h3 className="meal-heading">
                <span>{MEAL_ICONS[meal.meal_slot]}</span> {MEAL_LABELS[meal.meal_slot] || meal.meal_slot}
              </h3>
            )}
            <div className="meal-card">
              <div className="meal-card-title">
                {meal.meal_name} <span className="hint">({meal.total_calories} kcal)</span>
              </div>
              <table className="ingredient-table">
                <tbody>
                  {Object.entries(meal.ingredients || {}).map(([key, ingredient]) => (
                    <tr key={key}>
                      <td>
                        {slugToLabel(key)}
                        {ingredient.is_fixed && (
                          <span className="hint" title="Fixed quantity — does not scale">
                            {" "}
                            🔒
                          </span>
                        )}
                      </td>
                      <td>
                        {ingredient.choices && ingredient.choices.length > 0
                          ? ingredient.choices
                              .map((c) => `${slugToLabel(c.name)}: ${c.quantity}${c.unit} (${c.calories} kcal)`)
                              .join(" | ")
                          : `${ingredient.quantity} ${ingredient.unit}`}
                      </td>
                      <td>{ingredient.choices?.length ? "" : `${ingredient.calories} kcal`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {guidelines?.length > 0 && (
        <div>
          <h3 className="meal-heading">
            <span>📝</span> Guidelines And Notes
          </h3>
          {guidelines.map((section) => (
            <div key={section.title} className="guideline-section">
              <div className="guideline-title">
                <span>✅</span> {section.title}
              </div>
              <ul>
                {section.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "calorie" }) {
  return (
    <div className={`stat-box stat-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
