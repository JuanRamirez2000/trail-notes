import type { LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { BeforeYouGo } from "@/components/hike/BeforeYouGo";
import { COMPONENT_NAMES, manifest, type ComponentName, type ManifestEntry, type ManifestProps } from "@/lib/mdx/manifest";
import { ElevationProfile } from "./ElevationProfile";
import { GpxDownload } from "./GpxDownload";
import { componentIcons } from "./icons";
import { Minimap } from "./Minimap";
import { PanoViewer } from "./PanoViewer";
import { PhotoCard } from "./PhotoCard";
import { RouteMap } from "./RouteMap";
import { SafetyPins } from "./SafetyPins";
import { SafetyPoints } from "./SafetyPoints";
import { Step } from "./Step";
import { StepByStep } from "./StepByStep";
import { Steps } from "./Steps";

/**
 * Every component usable inside a hike's index.mdx: the React side of lib/mdx/manifest.ts.
 *
 * To add a feature (a video overlay, a sun and shade view…):
 *   1. build the component (wrap it in <Frame> and read shared state with useHike)
 *   2. describe its props in lib/mdx/manifest.ts
 *   3. add it below, and give it an icon in ./icons.ts
 * The MDX renderer, the build-time prop check and the /editor (insert menu, settings, blocks)
 * all pick it up from there. The type below fails if a component's props drift from its schema.
 */
type PropsFor<K extends ComponentName> = ManifestProps<K> & ((typeof manifest)[K]["children"] extends "markdown" ? { children?: ReactNode } : unknown);

export const mdxComponents = {
  Step,
  BeforeYouGo,
  RouteMap,
  SafetyPins,
  Minimap,
  ElevationProfile,
  GpxDownload,
  SafetyPoints,
  Steps,
  StepByStep,
  PhotoCard,
  PanoViewer,
} satisfies { [K in ComponentName]: ComponentType<PropsFor<K>> };

export type RegisteredComponent = ComponentName;
export type RegistryEntry = ManifestEntry & { component: ComponentType<never>; icon: LucideIcon };

/** Manifest entry + component, in manifest order (the insert menu's order). */
export const registry = Object.fromEntries(
  COMPONENT_NAMES.map((name) => [name, { ...manifest[name], component: mdxComponents[name] as ComponentType<never>, icon: componentIcons[name] }]),
) as Record<ComponentName, RegistryEntry>;

export { COMING_LATER } from "@/lib/mdx/manifest";
