import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about the custom type scale so e.g. `text-body` and `text-sm` conflict correctly.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["h1", "h2", "body", "caption", "label"] }] } },
});

/** clsx + tailwind-merge: later classes (e.g. a caller's `absolute`) override earlier ones. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
