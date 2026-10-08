/** `"smooth"`, unless the visitor has asked their system for less motion. For scrollIntoView / scrollTo. */
export const scrollBehavior = (): ScrollBehavior =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
