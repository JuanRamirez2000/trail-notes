import type { ComponentType } from "react";
import { Minimap } from "@/components/mdx/Minimap";
import { SafetyList } from "./SafetyList";
import { StepList } from "./StepList";
import type { SidebarCardId } from "@/lib/schemas";

/**
 * Cards in the guide's sticky sidebar (desktop), top to bottom.
 *  - fixed:  natural height, never shrinks
 *  - shrink: natural height, but gives way (and scrolls) when the rail runs out of room
 *  - grow:   takes the remaining height and scrolls inside
 */
export type SidebarCard = { component: ComponentType; size: "fixed" | "shrink" | "grow" };

/** Keyed by the ids a guide's frontmatter `sidebar` lists (SIDEBAR_CARDS in lib/schemas.ts). */
export const sidebarCards: Record<SidebarCardId, SidebarCard> = {
  minimap: { component: () => <Minimap height={220} />, size: "fixed" },
  safety: { component: SafetyList, size: "shrink" },
  steps: { component: StepList, size: "grow" },
};
