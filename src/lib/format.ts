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

/** "in about 3 days", "in 5 hours", how long until a hike scheduled for deletion is removed. */
export function timeLeft(deleteAfter: string, now = new Date()): string {
  const hours = (new Date(deleteAfter).getTime() - now.getTime()) / 3_600_000;
  if (hours <= 0) return "the next time the editor is opened";
  if (hours < 1) return "in under an hour";
  if (hours < 48) return `in ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  return `in about ${Math.round(hours / 24)} days`;
}
