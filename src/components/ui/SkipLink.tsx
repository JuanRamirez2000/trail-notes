/** First thing a keyboard reaches: jumps past the header to the page's content (`<main id="main">`). */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-lg border-2 border-forest bg-card px-4 py-2 text-graphite focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to content
    </a>
  );
}
