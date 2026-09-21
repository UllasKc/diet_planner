import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestJson, ApiError } from "../api/client";
import { MEAL_LABELS, MEAL_ICONS, preferenceBadgeClass, slugToLabel } from "../constants";

export default function MealLibraryPage() {
  const { token } = useAuth();
  const [data, setData] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await requestJson("/api/admin/meal-options/full", { token });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load meal library");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="page">
      <h1>📚 Meal Library</h1>
      <p className="page-subtitle">
        Every meal plate currently in the database, with every ingredient slot and every
        substitution option inside it — a full reference view before you build or edit a plan.
      </p>

      {error && <div className="error-text">{error}</div>}
      {loading && <p className="hint">Loading...</p>}

      {!loading &&
        Object.entries(MEAL_LABELS).map(([slot, label]) => {
          const options = data[slot] || [];
          if (options.length === 0) return null;
          return (
            <div key={slot} className="library-slot-section">
              <h2 className="library-slot-heading">
                <span>{MEAL_ICONS[slot]}</span> {label}
              </h2>
              <div className="library-plate-grid">
                {options.map((option) => (
                  <div key={option.option_key} className="card library-plate-card">
                    <div className="library-plate-header">
                      <div>
                        <div className="library-plate-name">{option.meal_name}</div>
                        <div className="hint">{option.option_key}</div>
                      </div>
                      <div className="library-plate-meta">
                        <span className={preferenceBadgeClass(option.preference)}>{option.preference}</span>
                        <span className="hint">~{option.base_calories} kcal</span>
                      </div>
                    </div>

                    {Object.entries(option.ingredients || {}).map(([ingKey, ingredient]) => (
                      <div key={ingKey} className="library-ingredient-block">
                        <div className="library-ingredient-name">
                          {slugToLabel(ingKey)}
                          {ingredient.is_fixed && <span className="badge badge-universal">FIXED</span>}
                        </div>
                        {ingredient.choices && ingredient.choices.length > 0 ? (
                          <ul className="library-choice-list">
                            {ingredient.choices.map((c, idx) => (
                              <li key={idx}>
                                <strong>Option {idx + 1}:</strong> {slugToLabel(c.name)} — {c.quantity}
                                {c.unit} ({c.calories} kcal)
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="hint">
                            {ingredient.quantity} {ingredient.unit} ({ingredient.calories} kcal)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      {!loading && Object.keys(data).length === 0 && !error && (
        <p className="hint">No meal options in the database yet — add one on the Build Diet Plans page.</p>
      )}
    </div>
  );
}
