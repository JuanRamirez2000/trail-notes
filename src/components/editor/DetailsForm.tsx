"use client";

import { useMemo } from "react";
import { z } from "zod";
import { readDetails, setDetail, yamlProblems } from "@/lib/frontmatter";
import type { HikeWaypoint } from "@/lib/hike";
import { formatIssues, frontmatterSchema, SIDEBAR_CARDS, type SidebarCardId } from "@/lib/schemas";

/**
 * The guide's details (title, stats, "Before you go", sidebar…) as a form, so nobody edits YAML.
 * Generated from `frontmatterSchema`: a plain text, number or choice field added to the schema
 * shows up here with its `.describe()` label and no change to this file. Fields that need more
 * than an input (trailhead, cover photo, hazards, sidebar order) have their own small editors below.
 *
 * Every change rewrites just that one entry in the frontmatter (lib/frontmatter.ts), so the rest
 * of the YAML, including anything hand-written, is left alone.
 */
type Props = {
  yaml: string;
  waypoints: HikeWaypoint[];
  onChange: (yaml: string) => void;
};

type JsonSchema = {
  type?: string;
  format?: string;
  enum?: string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
};

const SCHEMA = z.toJSONSchema(frontmatterSchema, { io: "input" }) as JsonSchema;
const LONG_TEXT = new Set(["summary"]);
const SIDEBAR_LABELS: Record<SidebarCardId, string> = { minimap: "Minimap", safety: "Safety points", steps: "Steps" };

const input = "w-full rounded-md border border-line-strong bg-card px-2 py-1.5 text-[15px] text-graphite";

export function DetailsForm({ yaml, waypoints, onChange }: Props) {
  const data = useMemo(() => readDetails(yaml), [yaml]);
  const problems = useMemo(() => {
    const parsed = frontmatterSchema.safeParse(data);
    const byField = new Map<string, string>();
    if (!parsed.success) {
      for (const line of formatIssues(parsed.error)) {
        const [path, ...rest] = line.split(": ");
        if (!byField.has(path)) byField.set(path, rest.join(": "));
      }
    }
    return byField;
  }, [data]);

  const set = (path: (string | number)[], value: unknown) => onChange(setDetail(yaml, path, value));
  const photos = waypoints.filter((w) => w.photo);

  // With a YAML error the details can't be read reliably, and rewriting one entry could lose the
  // rest. Say what's wrong and where to fix it, rather than showing a form that does nothing.
  const broken = yamlProblems(yaml);
  if (broken.length) {
    return (
      <div role="alert" className="mx-auto mt-6 w-full max-w-[720px] rounded-lg border-2 border-dashed border-pin-bailout bg-card p-4">
        <p className="font-semibold text-pin-bailout">The guide&rsquo;s details can&rsquo;t be shown as a form.</p>
        <p className="mt-1 text-graphite">The block between the two <code>---</code> lines at the top of the guide has a mistake. Fix it under Advanced → Markdown, then come back here.</p>
        <ul className="mt-2 font-mono text-xs text-pin-bailout">
          {broken.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 py-6" onSubmit={(e) => e.preventDefault()}>
      <h2 className="font-display text-[22px] leading-tight font-bold text-forest">Guide details</h2>
      {Object.entries(SCHEMA.properties ?? {})
        .map(([key, field]) => {
          const label = field.description ?? key;
          const required = SCHEMA.required?.includes(key) ?? false;
          const problem = problems.get(key);

          if (key === "slug") {
            return (
              <Field key={key} id={key} label={label} hint="Part of the page's web address. It can't be changed.">
                <input id={key} className={`${input} bg-paper-deep text-bark`} value={String(data.slug ?? "")} readOnly />
              </Field>
            );
          }
          if (key === "cover") {
            return (
              <Field key={key} id={key} label={label} problem={problem} hint="Shown at the top of the guide and on its gallery card.">
                <select id={key} className={input} value={typeof data.cover === "string" ? data.cover : ""} onChange={(e) => set(["cover"], e.target.value)}>
                  <option value="">None (contour placeholder)</option>
                  {typeof data.cover === "string" && data.cover && !photos.some((w) => w.photo!.key === data.cover) && <option value={data.cover}>{data.cover}</option>}
                  {photos.map((w) => (
                    <option key={w.id} value={w.photo!.key}>
                      {w.label} · {w.mile.toFixed(1)} mi
                    </option>
                  ))}
                </select>
              </Field>
            );
          }
          if (key === "trailhead") {
            const th = (data.trailhead ?? {}) as { lat?: unknown; lng?: unknown };
            return (
              <fieldset key={key} className="flex flex-col gap-1">
                <legend className="mb-[3px] text-[13px] text-bark">
                  {label} <Required />
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {(["lat", "lng"] as const).map((part) => (
                    <label key={part} className="text-[13px] text-bark">
                      {part === "lat" ? "Latitude" : "Longitude"}
                      <NumberInput id={`trailhead-${part}`} value={th[part]} onChange={(v) => set(["trailhead", part], v)} />
                      <Problem text={problems.get(`trailhead.${part}`)} />
                    </label>
                  ))}
                </div>
                <Problem text={problem} />
                <span className="text-[13px] text-bark">Where &ldquo;Get directions&rdquo; sends people.</span>
              </fieldset>
            );
          }
          if (key === "essentials") {
            const es = (data.essentials ?? {}) as Record<string, unknown>;
            return (
              <fieldset key={key} className="mt-2 flex flex-col gap-3 rounded-[10px] border border-line bg-card px-4 py-3">
                <legend className="px-1 font-display text-lg font-bold text-forest">{label}</legend>
                <p className="text-[13px] text-bark">Shown as the &ldquo;Before you go&rdquo; card. Leave a line empty to leave it out.</p>
                {Object.entries(field.properties ?? {}).map(([sub, subField]) =>
                  subField.type === "array" ? (
                    <ListEditor key={sub} id={`essentials-${sub}`} label={subField.description ?? sub} items={Array.isArray(es[sub]) ? (es[sub] as unknown[]).map(String) : []} onChange={(items) => set(["essentials", sub], items)} />
                  ) : (
                    <Field key={sub} id={`essentials-${sub}`} label={subField.description ?? sub} problem={problems.get(`essentials.${sub}`)}>
                      <textarea id={`essentials-${sub}`} rows={2} className={input} value={typeof es[sub] === "string" ? (es[sub] as string) : ""} onChange={(e) => set(["essentials", sub], e.target.value)} />
                    </Field>
                  ),
                )}
              </fieldset>
            );
          }
          if (key === "sidebar") {
            const current = Array.isArray(data.sidebar) ? (data.sidebar as SidebarCardId[]).filter((c) => SIDEBAR_CARDS.includes(c)) : [...SIDEBAR_CARDS];
            return <SidebarEditor key={key} label={label} cards={current} problem={problem} onChange={(cards) => set(["sidebar"], sameOrder(cards, SIDEBAR_CARDS) ? undefined : cards)} />;
          }

          // Generic fields: choices, numbers, dates and text.
          const value = data[key];
          return (
            <Field key={key} id={key} label={label} required={required} problem={problem}>
              {field.enum ? (
                <select id={key} className={input} value={typeof value === "string" ? value : ""} onChange={(e) => set([key], e.target.value)}>
                  {!field.enum.includes(String(value)) && <option value="">Choose…</option>}
                  {field.enum.map((o) => (
                    <option key={o} value={o}>
                      {o[0].toUpperCase() + o.slice(1)}
                    </option>
                  ))}
                </select>
              ) : field.type === "number" || field.type === "integer" ? (
                <NumberInput id={key} value={value} onChange={(v) => set([key], v)} />
              ) : field.format === "date" ? (
                <input id={key} type="date" className={input} value={typeof value === "string" ? value : ""} onChange={(e) => set([key], e.target.value)} />
              ) : LONG_TEXT.has(key) ? (
                <textarea id={key} rows={2} className={input} value={typeof value === "string" ? value : ""} onChange={(e) => set([key], e.target.value)} />
              ) : (
                <input id={key} type="text" className={input} value={typeof value === "string" ? value : value == null ? "" : String(value)} onChange={(e) => set([key], e.target.value)} />
              )}
            </Field>
          );
        })}
    </form>
  );
}

const sameOrder = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

const Required = () => <span className="text-pin-bailout">*</span>;
const Problem = ({ text }: { text?: string }) => (text ? <span className="mt-[3px] block text-[13px] text-pin-bailout">{text}</span> : null);

function Field({ id, label, required, problem, hint, children }: { id: string; label: string; required?: boolean; problem?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-[3px] block text-[13px] text-bark">
        {label} {required && <Required />}
      </label>
      {children}
      <Problem text={problem} />
      {hint && <span className="mt-[3px] block text-[13px] text-bark">{hint}</span>}
    </div>
  );
}

/** A number field that writes a number (not text) and clears the entry when emptied. */
function NumberInput({ id, value, onChange }: { id: string; value: unknown; onChange: (v: number | undefined) => void }) {
  return (
    <input
      id={id}
      type="number"
      step="any"
      className={input}
      value={typeof value === "number" ? value : ""}
      onChange={(e) => onChange(e.target.value === "" || Number.isNaN(Number(e.target.value)) ? undefined : Number(e.target.value))}
    />
  );
}

/** A list of short lines (hazards): edit, remove, add. */
function ListEditor({ id, label, items, onChange }: { id: string; label: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div>
      <span className="mb-[3px] block text-[13px] text-bark">{label}</span>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              aria-label={`${label} ${i + 1}`}
              className={input}
              value={item}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button type="button" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))} className="cursor-pointer rounded-lg border border-line-strong px-2.5 text-bark">
              ✕
            </button>
          </div>
        ))}
        <button id={id} type="button" onClick={() => onChange([...items, "New item"])} className="cursor-pointer self-start rounded-lg border border-line bg-paper px-3 py-0.5">
          ＋ Add
        </button>
      </div>
    </div>
  );
}

/** Which sidebar cards a guide shows, and in what order. */
function SidebarEditor({ label, cards, problem, onChange }: { label: string; cards: SidebarCardId[]; problem?: string; onChange: (cards: SidebarCardId[]) => void }) {
  const hidden = SIDEBAR_CARDS.filter((c) => !cards.includes(c));
  const move = (i: number, by: number) => {
    const next = [...cards];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };
  const row = "flex items-center gap-2 rounded-md border border-line bg-card px-2.5 py-1";
  const btn = "cursor-pointer rounded border border-line-strong px-2 text-bark disabled:opacity-30";
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-[3px] text-[13px] text-bark">{label}</legend>
      <span className="text-[13px] text-bark">The cards beside the guide (and in the phone&rsquo;s map bar), top to bottom.</span>
      {cards.map((c, i) => (
        <div key={c} className={row}>
          <span className="flex-1">{SIDEBAR_LABELS[c]}</span>
          <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${SIDEBAR_LABELS[c]} up`}>
            ↑
          </button>
          <button type="button" className={btn} disabled={i === cards.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${SIDEBAR_LABELS[c]} down`}>
            ↓
          </button>
          <button type="button" className={btn} disabled={cards.length === 1} onClick={() => onChange(cards.filter((x) => x !== c))}>
            Hide
          </button>
        </div>
      ))}
      {hidden.map((c) => (
        <div key={c} className={`${row} border-dashed text-bark`}>
          <span className="flex-1">{SIDEBAR_LABELS[c]} (hidden)</span>
          <button type="button" className={btn} onClick={() => onChange([...cards, c])}>
            Show
          </button>
        </div>
      ))}
      <Problem text={problem} />
    </fieldset>
  );
}
