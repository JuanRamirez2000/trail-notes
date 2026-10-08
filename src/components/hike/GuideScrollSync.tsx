"use client";

import { useEffect, useRef } from "react";
import { sectionId } from "@/lib/hike";
import { useHike, useHikeApi } from "@/lib/hike-store";
import { scrollBehavior } from "@/lib/motion";

/** Scroll position (fraction of viewport height) that counts as "reading this section". */
const READING_LINE = 0.3;
/** Ignore scrollspy while a click-triggered smooth scroll passes over other sections. */
const LOCK_MS = 1200;

/**
 * Keeps the guide and the store in step, in both directions:
 *  - reveal: clicking a step/pin scrolls to its <Step> section. Pins without a section
 *    (e.g. water) scroll to the nearest section before them on the trail.
 *  - scrollspy: the section crossing the reading line becomes the active waypoint, so the
 *    minimap and step list follow along as you read.
 */
export function GuideScrollSync() {
  const api = useHikeApi();
  const reveal = useHike((s) => s.reveal);
  const lockUntil = useRef(0);

  useEffect(() => {
    if (!reveal) return;
    const target = findSection(reveal.id, api.getState().waypoints.map((w) => w.id));
    if (!target) return;
    lockUntil.current = Date.now() + LOCK_MS;
    target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }, [reveal, api]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < lockUntil.current) return;
      const line = window.innerHeight * READING_LINE;
      let current: string | undefined;
      for (const el of document.querySelectorAll<HTMLElement>("[data-step-section]")) {
        // Last section (in document order) whose top has passed the reading line.
        if (el.getBoundingClientRect().top <= line) current = el.dataset.stepSection;
      }
      if (current && current !== api.getState().activeId) api.getState().select(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const unlock = () => (lockUntil.current = 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", unlock);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", unlock);
    };
  }, [api]);

  return null;
}

function findSection(id: string, routeOrder: string[]): HTMLElement | null {
  const own = document.getElementById(sectionId(id)) ?? document.querySelector<HTMLElement>(`[data-waypoint-card="${id}"]`);
  if (own) return own;
  // No section of its own: use the closest earlier waypoint that has one.
  for (let i = routeOrder.indexOf(id) - 1; i >= 0; i--) {
    const el = document.getElementById(sectionId(routeOrder[i]));
    if (el) return el;
  }
  return null;
}
