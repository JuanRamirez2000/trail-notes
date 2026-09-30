import type { ComponentProps } from "react";

/** Typography for plain markdown inside hike MDX (design: H2 28/34 Zilla Slab, body 17/27). */
export const proseComponents = {
  h2: (p: ComponentProps<"h2">) => <h2 className="mt-[26px] font-display text-h2 font-bold text-forest" {...p} />,
  h3: (p: ComponentProps<"h3">) => <h3 className="mt-6 font-display text-[22px] leading-[26px] font-bold text-forest" {...p} />,
  p: (p: ComponentProps<"p">) => <p className="mt-3.5 text-body" {...p} />,
  ul: (p: ComponentProps<"ul">) => <ul className="mt-3.5 list-disc pl-6 text-body" {...p} />,
  ol: (p: ComponentProps<"ol">) => <ol className="mt-3.5 list-decimal pl-6 text-body" {...p} />,
  a: (p: ComponentProps<"a">) => <a className="underline" {...p} />,
  code: (p: ComponentProps<"code">) => <code className="rounded bg-frame px-1 font-mono text-[0.9em]" {...p} />,
};
