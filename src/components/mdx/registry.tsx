import type { ComponentType } from "react";
import { Minimap } from "./Minimap";
import { PanoViewer } from "./PanoViewer";
import { PhotoCard } from "./PhotoCard";
import { RouteMap } from "./RouteMap";
import { SafetyPins } from "./SafetyPins";
import { Step } from "./Step";
import { StepByStep } from "./StepByStep";

/**
 * Every component usable inside a hike's index.mdx.
 *
 * To add a feature in a later phase (video overlay, elevation scrubber, GPX export…):
 *   1. build the component (wrap it in <Frame> and read shared state with useHike)
 *   2. add one entry below
 * The MDX renderer and the /editor insert menu both read from this list.
 */
export type RegistryEntry = {
  component: ComponentType<never>;
  title: string;
  description: string;
  /** Snippet inserted by the editor. `{{waypoint}}` is replaced with a real waypoint id. */
  snippet: string;
};

export const registry = {
  Step: {
    component: Step,
    title: "Guide section",
    description: "Section for a pin: number, photo, your notes",
    snippet: '<Step waypoint="{{waypoint}}">\n\nWrite this part of the guide.\n\n</Step>',
  },
  RouteMap: {
    component: RouteMap,
    title: "Route map",
    description: "Turn, viewpoint, water and bail-out pins",
    snippet: "<RouteMap />",
  },
  PhotoCard: {
    component: PhotoCard,
    title: "Turning-point photo card",
    description: "Photo, caption, link to map",
    snippet: '<PhotoCard waypoint="{{waypoint}}" />',
  },
  PanoViewer: {
    component: PanoViewer,
    title: "360° viewer",
    description: "Pan photo, heading cone on mini map",
    snippet: '<PanoViewer waypoint="{{waypoint}}" />',
  },
  StepByStep: {
    component: StepByStep,
    title: "Step-by-step list",
    description: "Inline step list (the sidebar already has one)",
    snippet: "<StepByStep />",
  },
  Minimap: {
    component: Minimap,
    title: "Minimap",
    description: "Small map showing current step",
    snippet: "<Minimap />",
  },
  SafetyPins: {
    component: SafetyPins,
    title: "Safety pins",
    description: "Water and bail-out points",
    snippet: "<SafetyPins />",
  },
} satisfies Record<string, RegistryEntry>;

export type RegisteredComponent = keyof typeof registry;

/** Components map handed to MDX. */
export const mdxComponents = Object.fromEntries(
  Object.entries(registry).map(([name, entry]) => [name, entry.component]),
) as { [K in RegisteredComponent]: (typeof registry)[K]["component"] };

/** Shown greyed-out in the editor's insert menu. */
export const COMING_LATER = ["Video overlay", "Elevation scrubber", "Sun / shade simulator", "Viewshed map", "GPX export"];
