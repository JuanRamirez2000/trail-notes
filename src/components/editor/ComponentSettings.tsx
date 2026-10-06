"use client";

import { cn } from "@/lib/cn";
import type { HikeWaypoint } from "@/lib/hike";
import { manifest, propFields, type PropField } from "@/lib/mdx/manifest";
import { PIN_STYLES } from "@/lib/pins";
import type { SourceComponent } from "./jsx-source";

/** A component and its props as currently written, whichever editor it came from. */
export type EditableComponent = Pick<SourceComponent, "name" | "props" | "raw">;

type FormProps = {
  component: EditableComponent;
  waypoints: HikeWaypoint[];
  onChange: (props: Record<string, unknown>) => void;
  onDuplicate?: () => void;
  onRemove: () => void;
};

type Props = Omit<FormProps, "component"> & {
  /** Component under the cursor or clicked in the preview; null shows the empty state. */
  component: SourceComponent | null;
};

/**
 * The settings column of the authoring view (design: Trail Guide Branded, screen 3a). The form is
 * generated from the component's schema in lib/mdx/manifest.ts, so any component added to the
 * manifest gets one with no editor work.
 */
export function ComponentSettings({ component, waypoints, onChange, onDuplicate, onRemove }: Props) {
  return (
    <aside aria-label="Component settings" className="flex min-h-0 flex-col bg-paper-deep">
      <div className="border-b border-line bg-frame px-4 py-1.5 font-mono text-[11px] font-semibold text-bark">COMPONENT SETTINGS</div>
      {component ? (
        <SettingsForm key={`${component.name}@${component.start}`} component={component} waypoints={waypoints} onChange={onChange} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : (
        <p className="px-4 py-3.5 text-[15px] text-bark">Click a component in the preview, or put the cursor inside its tag, to change its settings.</p>
      )}
    </aside>
  );
}

/** The generated form for one component. Rendered by the Markdown view's panel and, through a portal, by a selected block in the Write view. */
export function SettingsForm({ component, waypoints, onChange, onDuplicate, onRemove }: FormProps) {
  const entry = manifest[component.name];
  const fields = propFields(component.name);
  const set = (name: string, value: unknown) => onChange({ ...component.props, [name]: value });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
      <div>
        <div className="font-display text-[19px] leading-tight font-bold">{entry.title}</div>
        <p className="mt-0.5 text-[13px] text-bark">{entry.description}</p>
      </div>

      {fields.length === 0 && <p className="text-[15px] text-bark">This block has no settings.</p>}

      {fields.map((field) => (
        <Row key={field.name} field={field}>
          {field.name in component.raw ? (
            <>
              <code className="block rounded-md border border-dashed border-line-strong bg-card px-2 py-1.5 text-xs">{`{${component.raw[field.name]}}`}</code>
              <span className="text-[13px] text-bark">Written as an expression; edit it in the Markdown.</span>
            </>
          ) : (
            <Input field={field} value={component.props[field.name]} waypoints={waypoints} onChange={(v) => set(field.name, v)} />
          )}
        </Row>
      ))}

      {entry.children === "markdown" && (
        <p className="text-[13px] text-bark">
          Its text is written inside the block (in Markdown: between <code>&lt;{component.name}&gt;</code> and <code>&lt;/{component.name}&gt;</code>).
        </p>
      )}

      <div className="flex gap-2">
        {onDuplicate && (
          <button type="button" onClick={onDuplicate} className="cursor-pointer rounded-lg border border-line bg-card px-3 py-0.5">
            Duplicate
          </button>
        )}
        <button type="button" onClick={onRemove} className="cursor-pointer rounded-lg border border-line-strong px-3 py-0.5 text-bark">
          Remove
        </button>
      </div>
    </div>
  );
}

function Row({ field, children }: { field: PropField; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={`prop-${field.name}`} className="mb-[3px] block text-[13px] text-bark">
        {field.label}
        {field.required && <span className="text-pin-bailout"> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-md border border-line-strong bg-card px-2 py-1.5 text-[15px] text-graphite";

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
          <span className={cn("text-[15px]", value === undefined && "text-bark")}>{value === undefined ? `Default (${checked ? "on" : "off"})` : checked ? "On" : "Off"}</span>
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
          {range && <span className="mt-[3px] block text-[13px] text-bark">Allowed: {range}{field.default !== undefined ? `, default ${String(field.default)}` : ""}</span>}
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
