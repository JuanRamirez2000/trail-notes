import { ChartArea, ClipboardList, Download, Image as ImageIcon, LifeBuoy, ListChecks, ListOrdered, Locate, Map as MapIcon, MapPinned, Rotate3d, Signpost, type LucideIcon } from "lucide-react";
import type { ComponentName } from "@/lib/mdx/manifest";

/**
 * One icon per component (lucide-react: line icons in the text colour), shown in the editor's
 * insert menu and in the header of the component's frame on the page. In a file of its own so
 * the components can read it without importing the registry, which imports them. A new component
 * has to be given one: the type fails otherwise.
 */
export const componentIcons = {
  Step: Signpost,
  BeforeYouGo: ClipboardList,
  RouteMap: MapIcon,
  SafetyPins: MapPinned,
  Minimap: Locate,
  ElevationProfile: ChartArea,
  GpxDownload: Download,
  SafetyPoints: LifeBuoy,
  Steps: ListOrdered,
  StepByStep: ListChecks,
  PhotoCard: ImageIcon,
  PanoViewer: Rotate3d,
} satisfies Record<ComponentName, LucideIcon>;
