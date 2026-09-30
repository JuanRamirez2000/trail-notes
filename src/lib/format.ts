import type { Difficulty } from "./schemas";

const mi = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const ft = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const formatMiles = (n: number) => `${mi.format(n)} mi`;
export const formatFeet = (n: number) => `${ft.format(n)} ft`;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  strenuous: "Strenuous",
};
