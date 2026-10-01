import type { ComponentType } from "react";
import { Minimap } from "@/components/mdx/Minimap";
import { SafetyList } from "./SafetyList";
import { StepList } from "./StepList";

/**
 * Cards in the guide's sticky sidebar (desktop), top to bottom.
 *  - fixed:  natural height, never shrinks
 *  - shrink: natural height, but gives way (and scrolls) when the rail runs out of room
 *  - grow:   takes the remaining height and scrolls inside
 */
export type SidebarCard = { id: string; component: ComponentType; size: "fixed" | "shrink" | "grow" };

export const sidebarCards: SidebarCard[] = [
  { id: "minimap", component: () => <Minimap height={220} />, size: "fixed" },
  { id: "safety", component: SafetyList, size: "shrink" },
  { id: "steps", component: StepList, size: "grow" },
];
