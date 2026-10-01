import type { ComponentType } from "react";
import { Minimap } from "@/components/mdx/Minimap";
import { StepList } from "./StepList";

/**
 * Cards in the guide's sticky sidebar (desktop), top to bottom. Add a card by appending an
 * entry; `grow` cards share the leftover height and scroll internally.
 */
export type SidebarCard = { id: string; component: ComponentType; grow?: boolean };

export const sidebarCards: SidebarCard[] = [
  { id: "minimap", component: () => <Minimap height={240} /> },
  { id: "steps", component: StepList, grow: true },
];
