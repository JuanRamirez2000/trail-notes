"use client";

import { useEffect } from "react";

/**
 * Last resort: the root layout itself failed, so this renders its own document, without the
 * site's stylesheet or fonts. Colours are the brand tokens' values, written out because
 * globals.css isn't loaded here.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9f6", color: "#1f2421", fontFamily: "system-ui, sans-serif" }}>
        <title>Something went wrong · Trailnotes</title>
        <main role="alert" style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ color: "#3a7a1e", fontSize: 28, margin: 0 }}>Trailnotes couldn&apos;t load</h1>
          <p style={{ fontSize: 17, lineHeight: 1.6 }}>Something went wrong on our side. It&apos;s usually temporary: try again in a moment.</p>
          <button type="button" onClick={() => retry()} style={{ cursor: "pointer", border: 0, borderRadius: 8, padding: "10px 20px", fontSize: 18, background: "#3a7a1e", color: "#f8f9f6" }}>
            Try again
          </button>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#5e655a" }}>Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
