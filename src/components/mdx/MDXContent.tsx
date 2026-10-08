import * as runtime from "react/jsx-runtime";
import { proseComponents } from "./prose";
import { mdxComponents } from "./registry";

type MDXContentFn = (props: { components?: Record<string, unknown> }) => React.ReactNode;

/**
 * Evaluates a guide compiled on the server (lib/mdx/compile.ts) with the JSX runtime. This runs
 * the compiled guide as code, on the server while a page renders and in the visitor's browser.
 * The guide comes from the content store (the database in production), so what keeps this safe
 * is the no-code rule every guide passes before it is stored or compiled (lib/mdx/remark-no-code.ts):
 * a guide can hold text and the manifest's components, never code of its own.
 */
function getMDXContent(code: string): MDXContentFn {
  return new Function(code)({ ...runtime }).default;
}

export function MDXContent({ code }: { code: string }) {
  // Compiled MDX content is a hook-free function, so calling it directly is safe and avoids
  // declaring a new component type on every render.
  return getMDXContent(code)({ components: { ...proseComponents, ...mdxComponents } });
}
