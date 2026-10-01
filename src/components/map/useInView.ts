"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True while the element is within `rootMargin` of the viewport.
 *
 * WebGL views (Mapbox, the 360° viewer) mount only while this is true. Browsers cap live
 * WebGL contexts per page (Safari and some GPUs fail well before Chrome's ~16), so a long
 * guide must release contexts it has scrolled past rather than keep every one alive.
 */
export function useNearViewport<T extends Element>(rootMargin = "300px") {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, near] as const;
}
