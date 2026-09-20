export const MEAL_LABELS = {
  breakfast: "Breakfast",
  morning_snack: "Morning Snack",
  lunch: "Lunch",
  evening_snack: "Evening Snack",
  dinner: "Dinner",
};

export const MULTI_SELECT_SLOTS = new Set(["breakfast", "morning_snack", "evening_snack"]);

export const PREFERENCE_OPTIONS = ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Universal"];

export const MEAL_ICONS = {
  breakfast: "🍳",
  morning_snack: "🍎",
  lunch: "🍛",
  evening_snack: "🥗",
  dinner: "🌙",
};

export function preferenceBadgeClass(preference) {
  return `badge badge-${String(preference || "Universal").toLowerCase().replace(/\s+/g, "-")}`;
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function slugToLabel(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
