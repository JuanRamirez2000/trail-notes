"use client";

import { useEffect, useRef, useState } from "react";
import { COMING_LATER, registry, type RegisteredComponent } from "@/components/mdx/registry";
import type { ComponentCategory } from "@/lib/mdx/manifest";

const CATEGORIES: ComponentCategory[] = ["Guide", "Trip info", "Maps", "Photos"];

/** Lists every registered MDX component; future ones appear here automatically. */
export function InsertMenu({ onInsert, label = "＋ Insert component ▾" }: { onInsert: (name: RegisteredComponent) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="cursor-pointer rounded-lg border-2 border-forest bg-highlight px-3.5 py-0.5"
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-[70dvh] w-[330px] overflow-y-auto rounded-[10px] border border-line bg-card py-1.5 shadow-[4px_4px_0_rgb(0_0_0/0.15)]">
          <div className="px-3.5 pb-1.5 text-caption tracking-[.06em] text-bark uppercase">Insert at cursor</div>
          {CATEGORIES.map((category) => (
            <div key={category}>
              <div className="px-3.5 pt-1.5 text-caption font-semibold text-forest">{category}</div>
              {(Object.keys(registry) as RegisteredComponent[])
                .filter((name) => registry[name].category === category)
                .map((name) => {
                  const Icon = registry[name].icon;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onInsert(name);
                        setOpen(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-1.5 text-left hover:bg-highlight"
                    >
                      <span className="flex size-[30px] flex-none items-center justify-center rounded-[5px] border border-line text-forest" aria-hidden>
                        <Icon size={18} strokeWidth={1.75} />
                      </span>
                      <span className="leading-tight">
                        <span className="text-[17px]">{registry[name].title}</span>
                        <br />
                        <span className="text-caption text-bark">{registry[name].description}</span>
                      </span>
                    </button>
                  );
                })}
            </div>
          ))}
          <div className="mx-3.5 mt-1.5 border-t border-dashed border-line-strong pt-1.5 text-caption tracking-[.06em] text-bark uppercase">
            Coming later
          </div>
          {COMING_LATER.map((f) => (
            <div key={f} className="py-0.5 pr-3.5 pl-[54px] text-[15px] text-line-strong">
              {f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
