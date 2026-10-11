/**
 * Small things the sign-in flow and the public pages share. No secrets and no authority here:
 * every real check is getEditor() and can(), on the server.
 */

/**
 * A cookie that only says "this browser signed in at some point". The session cookies themselves
 * are HttpOnly, so the public pages (static, cached, the same for everyone) can't tell a signed-in
 * editor from a visitor. With this hint the header knows when it's worth asking the server who's
 * there, and a visitor's page view never makes that request. Forging it gets you one request
 * that answers "nobody".
 */
export const SESSION_HINT = "tn_signed_in";
export const hintCookie = { path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 60 };

/** Where to go after signing in, remembered across the trip to Google in a short-lived cookie. */
export const NEXT_COOKIE = "tn_next";

/**
 * A path on this site to return to, or null. Only plain local paths pass: nothing with a scheme
 * or a second slash, so sign-in can't be used to bounce someone to another site.
 */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || next.length > 200) return null;
  return /^\/(?![/\\])[\w\-./~%]*$/.test(next) ? next : null;
}

/** What /api/session answers. */
export type SessionInfo = { editor: { name: string; role: string } | null; canEdit: boolean; canSignOut: boolean };
