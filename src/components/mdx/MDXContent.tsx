import * as runtime from "react/jsx-runtime";
import { proseComponents } from "./prose";
import { mdxComponents } from "./registry";

type MDXContentFn = (props: { components?: Record<string, unknown> }) => React.ReactNode;

/**
 * Velite compiles MDX to a function body at build time; evaluate it with the JSX runtime.
 * Runs during static generation only, on code compiled from our own content/ folder.
 */
function getMDXContent(code: string): MDXContentFn {
  return new Function(code)({ ...runtime }).default;
}

export function MDXContent({ code }: { code: string }) {
  // Compiled MDX content is a hook-free function, so calling it directly is safe and avoids
  // declaring a new component type on every render.
  return getMDXContent(code)({ components: { ...proseComponents, ...mdxComponents } });
}
