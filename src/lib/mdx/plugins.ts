import type { CompileOptions } from "@mdx-js/mdx";
import type { Waypoint } from "../schemas";
import { remarkComponentProps } from "./remark-component-props";
import { remarkDefaultBlocks } from "./remark-default-blocks";
import { remarkNoCode } from "./remark-no-code";
import { remarkStepSections } from "./remark-step-sections";

/**
 * The remark passes every guide goes through, in order. One list, used by the save gate
 * (check.ts), the server compile that renders pages (compile.ts) and the editor preview:
 *  1. no code: refuse imports, expressions and raw HTML (before anything is generated)
 *  2. step sections: stub `<Step auto>` for required pins
 *  3. default blocks: `<BeforeYouGo auto />` first if the guide doesn't place it
 *  4. component props: unknown components and props, types and ranges, pin references
 */
export function guideRemarkPlugins(waypoints: Waypoint[] | null): NonNullable<CompileOptions["remarkPlugins"]> {
  const getWaypoints = () => waypoints;
  return [remarkNoCode, [remarkStepSections, { getWaypoints }], remarkDefaultBlocks, [remarkComponentProps, { getWaypoints }]];
}
