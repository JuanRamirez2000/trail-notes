"use client";

import { cn } from "@/lib/cn";
import type { HikeWaypoint } from "@/lib/hike";
import { manifest, propFields, type PropField } from "@/lib/mdx/manifest";
import { PIN_STYLES } from "@/lib/pins";
import type { SourceComponent } from "./jsx-source";

type Props = {
  component: SourceComponent;
  waypoints: HikeWaypoint[];
  onChange: (props: Record<string, unknown>) => void;
};

/**
 * Settings for the component under the cursor, generated from its schema in lib/mdx/manifest.ts.
 * Any component added to the manifest gets a form here with no editor work.
 * Styling is provisional until the Trail Guide Branded settings-panel design is in.
 */
export function ComponentSettings({ component, waypoints, onChange }: Props) {
  const entry = manifest[component.name];
  const fields = propFields(component.name);
  const set = (name: string, value: unknown) => onChange({ ...component.props, [name]: value });

  return (
    <aside aria-label={`${entry.title} settings`} className="flex min-h-0 flex-col border-l border-line bg-card">
      <div className="border-b border-line bg-frame px-4 py-1.5 font-mono text-[11px] font-semibold text-bark">COMPONENT SETTINGS</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="font-display text-lg font-bold text-forest">{entry.title}</div>
        <div className="font-mono text-xs text-bark">&lt;{component.name}&gt;</div>
        <p className="mt-1 text-sm text-bark">{entry.description}</p>

        {fields.length === 0 && <p className="mt-4 text-sm text-bark">No settings. Move it by cutting and pasting the tag.</p>}

        <div className="mt-4 flex flex-col gap-3.5">
          {fields.map((field) =>
            field.name in component.raw ? (
              <Row key={field.name} field={field}>
                <code className="block rounded-md border border-dashed border-line-strong px-2 py-1 text-xs">{`{${component.raw[field.name]}}`}</code>
                <span className="text-caption text-bark">Written as an expression; edit it in the source.</span>
              </Row>
            ) : (
              <Row key={field.name} field={field}>
                <Input field={field} value={component.props[field.name]} waypoints={waypoints} onChange={(v) => set(field.name, v)} />
              </Row>
            ),
          )}
        </div>

        {entry.children === "markdown" && (
          <p className="mt-5 border-t border-dashed border-line-strong pt-3 text-sm text-bark">
            Write this section&apos;s text between <code>&lt;{component.name}&gt;</code> and <code>&lt;/{component.name}&gt;</code>.
          </p>
        )}
      </div>
    </aside>
  );
}

function Row({ field, children }: { field: PropField; children: React.ReactNode }) {
  const id = `prop-${field.name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-caption font-semibold tracking-[.06em] text-bark uppercase">
        {field.label}
        {field.required && <span className="text-pin-bailout"> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-md border border-line-strong bg-paper px-2 py-1 text-[15px] text-graphite";

function Input({ field, value, waypoints, onChange }: { field: PropField; value: unknown; waypoints: HikeWaypoint[]; onChange: (v: unknown) => void }) {
  const id = `prop-${field.name}`;
  switch (field.kind) {
    case "waypoint": {
      const known = waypoints.some((w) => w.id === value);
      return (
        <select id={id} className={inputClass} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          {!field.required && <option value="">—</option>}
          {field.required && !value && <option value="">Choose a pin…</option>}
          {typeof value === "string" && value && !known && <option value={value}>{value} (not in waypoints.json)</option>}
          {waypoints.map((w) => (
            <option key={w.id} value={w.id}>
              {w.stepIndex !== null ? `${w.stepIndex + 1}. ` : ""}
              {w.label} · {PIN_STYLES[w.type].label} · {w.mile.toFixed(1)} mi
            </option>
          ))}
        </select>
      );
    }
    case "boolean": {
      const checked = typeof value === "boolean" ? value : field.default === true;
      return (
        <label className="flex cursor-pointer items-center gap-2">
          <input id={id} type="checkbox" className="size-4 accent-forest" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          <span className={cn("text-sm", value === undefined && "text-bark")}>{value === undefined ? `Default (${checked ? "on" : "off"})` : checked ? "On" : "Off"}</span>
        </label>
      );
    }
    case "integer":
    case "number": {
      const range = field.min !== undefined && field.max !== undefined ? `${field.min}–${field.max}` : undefined;
      return (
        <>
          <input
            id={id}
            type="number"
            className={inputClass}
            value={typeof value === "number" ? value : ""}
            placeholder={field.default !== undefined ? String(field.default) : undefined}
            min={field.min}
            max={field.max}
            step={field.kind === "integer" ? 1 : "any"}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
          {range && <span className="text-caption text-bark">Allowed: {range}{field.default !== undefined ? `, default ${String(field.default)}` : ""}</span>}
        </>
      );
    }
    case "enum":
      return (
        <select id={id} className={inputClass} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">{field.default !== undefined ? `Default (${String(field.default)})` : "—"}</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <input
          id={id}
          type="text"
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          placeholder={field.default !== undefined ? String(field.default) : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
