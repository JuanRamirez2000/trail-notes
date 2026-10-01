"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import { routeCoords, type HikeWaypoint, type RouteCoords } from "./hike";

/**
 * Per-page store shared by every map, step list and photo on a hike guide.
 * One store per <HikeProvider> (not a global singleton) so the editor preview
 * and the real page never share selection state.
 */
export type HikeState = {
  slug: string;
  waypoints: HikeWaypoint[];
  /** Line drawn on every map: the GPX track if the hike has one. */
  route: RouteCoords;
  steps: HikeWaypoint[];
  activeId: string | null;
  /** Live look direction from an open 360° viewer, keyed to the waypoint it belongs to. */
  view: { waypointId: string; heading: number } | null;
  /** Bumped to ask <GuideScrollSync> to scroll the guide to a waypoint's section. */
  reveal: { id: string; nonce: number } | null;

  /** `reveal: true` also scrolls the guide to the waypoint's section. */
  select: (id: string | null, opts?: { reveal?: boolean }) => void;
  stepBy: (delta: 1 | -1, opts?: { reveal?: boolean }) => void;
  setView: (view: HikeState["view"]) => void;
};

function createHikeStore(slug: string, waypoints: HikeWaypoint[], route?: RouteCoords) {
  const steps = waypoints.filter((w) => w.stepIndex !== null);
  return createStore<HikeState>()((set, get) => ({
    slug,
    waypoints,
    route: route ?? routeCoords(waypoints),
    steps,
    activeId: steps[0]?.id ?? null,
    view: null,
    reveal: null,

    select: (id, opts) =>
      set((s) => ({
        activeId: id,
        reveal: id && opts?.reveal ? { id, nonce: (s.reveal?.nonce ?? 0) + 1 } : s.reveal,
      })),

    stepBy: (delta, opts) => {
      const { steps, activeId, select } = get();
      if (!steps.length) return;
      const i = steps.findIndex((s) => s.id === activeId);
      const next = i === -1 ? 0 : Math.min(steps.length - 1, Math.max(0, i + delta));
      select(steps[next].id, opts);
    },

    setView: (view) => set({ view }),
  }));
}

const HikeStoreContext = createContext<StoreApi<HikeState> | null>(null);

export function HikeProvider({
  slug,
  waypoints,
  route,
  children,
}: {
  slug: string;
  waypoints: HikeWaypoint[];
  route?: RouteCoords;
  children: ReactNode;
}) {
  // Lazy init keeps one store per mount even across re-renders.
  const [store] = useState(() => createHikeStore(slug, waypoints, route));
  return <HikeStoreContext.Provider value={store}>{children}</HikeStoreContext.Provider>;
}

export function useHike<T>(selector: (s: HikeState) => T): T {
  const store = useContext(HikeStoreContext);
  if (!store) throw new Error("useHike must be used inside <HikeProvider>");
  return useStore(store, selector);
}

/** Imperative access (read state inside event handlers without subscribing). */
export function useHikeApi(): StoreApi<HikeState> {
  const store = useContext(HikeStoreContext);
  if (!store) throw new Error("useHikeApi must be used inside <HikeProvider>");
  return store;
}

export function useWaypoint(id: string | undefined) {
  return useHike((s) => (id ? s.waypoints.find((w) => w.id === id) : undefined));
}

export function useActiveWaypoint() {
  return useHike((s) => s.waypoints.find((w) => w.id === s.activeId));
}

/** Heading to draw for a waypoint: live 360° look direction if it's being viewed, else its photo heading. */
export function useEffectiveHeading(wp: HikeWaypoint | undefined): number | null {
  const view = useHike((s) => s.view);
  if (!wp) return null;
  if (view && view.waypointId === wp.id) return view.heading;
  return wp.heading;
}
