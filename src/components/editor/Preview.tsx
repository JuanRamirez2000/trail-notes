"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { proseComponents } from "@/components/mdx/prose";
import { mdxComponents } from "@/components/mdx/registry";
import { HikeProvider } from "@/lib/hike-store";
import { compilePreview, parseWaypoints, type CompiledPreview } from "./compile";

export function Preview({ slug, mdx, waypoints }: { slug: string; mdx: string; waypoints: string }) {
  const deferredMdx = useDeferredValue(mdx);
  const [compiled, setCompiled] = useState<CompiledPreview | null>(null);
  const wp = useMemo(() => parseWaypoints(waypoints), [waypoints]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(
      () => compilePreview(deferredMdx, wp.ok ? wp.waypoints : null).then((r) => !cancelled && setCompiled(r)),
      250,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [deferredMdx, wp]);

  if (!compiled) return <p className="p-6 text-bark">Compiling…</p>;
  return (
    <div className="px-[22px] py-[18px]">
      {!compiled.ok && <ErrorBox title="MDX error" message={compiled.error} />}
      {!wp.ok && <ErrorBox title="waypoints.json" message={wp.error} />}
      {compiled.ok && (
        <>
          <h1 className="font-display text-[30px] leading-[34px] font-bold text-forest">{String(compiled.frontmatter.title ?? slug)}</h1>
          {/* Keyed on the JSON so edits to waypoints rebuild the shared store. */}
          <HikeProvider key={waypoints} slug={slug} waypoints={wp.ok ? wp.waypoints : []}>
            <compiled.Content components={{ ...proseComponents, ...mdxComponents }} />
          </HikeProvider>
        </>
      )}
    </div>
  );
}

function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <div className="mb-4 rounded-lg border-2 border-dashed border-pin-bailout bg-card p-3">
      <div className="font-semibold text-pin-bailout">{title}</div>
      <pre className="mt-1 font-mono text-xs whitespace-pre-wrap">{message}</pre>
    </div>
  );
}
