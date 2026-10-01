"use client";

/**
 * Checks that a WebGL2 context can be created right now (Mapbox GL v3 and Photo Sphere
 * Viewer both need WebGL2). Fails when WebGL is disabled or the page's context limit is hit.
 * The probe context is released immediately so the check itself doesn't use up the budget.
 */
export function canCreateWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
