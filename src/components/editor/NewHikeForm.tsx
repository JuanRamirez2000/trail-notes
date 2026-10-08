"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buildTrack, parseGpx } from "@/lib/gpx";
import { buildNewHike, slugify, type NewHikeForm as Form } from "@/lib/new-hike";
import { DIFFICULTIES, RESERVED_SLUGS, SLUG, type Difficulty, type Track } from "@/lib/schemas";

const input = "w-full rounded-md border border-line-strong bg-card px-2 py-1.5 text-[15px] text-graphite";

/**
 * The "New hike" form. A GPX recording is optional and is read here, in the browser: only the
 * route's positions and elevations are kept and sent, so timestamps, heart rate and device data
 * never leave the device. With a recording, distance, climbing and the trailhead come from it.
 */
export function NewHikeForm({ taken }: { taken: string[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slugEdited, setSlugEdited] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const [summary, setSummary] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("moderate");
  // Today in the author's own timezone (toISOString would give the UTC date, which is tomorrow in the evening).
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [distance, setDistance] = useState("");
  const [gain, setGain] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [track, setTrack] = useState<{ data: Track; file: string; rawPoints: number } | null>(null);
  const [gpxProblem, setGpxProblem] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const slug = slugEdited ?? slugify(title);
  const slugProblem = !slug ? null : !SLUG.test(slug) ? "Use lowercase letters, digits and dashes." : taken.includes(slug) || RESERVED_SLUGS.includes(slug) ? "That address is already used." : null;

  const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
  const form: Form = useMemo(
    () => ({
      title,
      slug,
      region,
      summary,
      difficulty,
      date,
      distanceMi: num(distance),
      elevationGainFt: num(gain),
      trailhead: num(lat) !== undefined && num(lng) !== undefined ? { lat: num(lat)!, lng: num(lng)! } : undefined,
    }),
    [title, slug, region, summary, difficulty, date, distance, gain, lat, lng],
  );

  const missing = [
    !title.trim() && "a title",
    !slug && "an address",
    !region.trim() && "a region",
    !summary.trim() && "a summary",
    !track && form.distanceMi === undefined && "a distance (or a GPX recording)",
    !track && form.elevationGainFt === undefined && "the elevation gain (or a GPX recording)",
    !track && !form.trailhead && "the trailhead position (or a GPX recording)",
  ].filter(Boolean) as string[];
  const ready = missing.length === 0 && !slugProblem && !busy;

  async function onGpx(file: File | undefined) {
    setGpxProblem(null);
    if (!file) return setTrack(null);
    try {
      const raw = parseGpx(await file.text());
      const built = buildTrack(raw);
      if (!built.success) throw new Error("The recording couldn't be read as a route.");
      setTrack({ data: built.data, file: file.name, rawPoints: raw.length });
    } catch (e) {
      setTrack(null);
      setGpxProblem(e instanceof Error ? e.message : "That file couldn't be read as a GPX recording.");
    }
  }

  async function create() {
    setBusy(true);
    setProblems([]);
    const hike = buildNewHike(form, track?.data ?? null);
    const res = await fetch("/api/editor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...hike, track: track?.data ?? null }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { ok?: boolean; problems?: string[] }) : null;
    if (res?.ok && data?.ok) {
      router.push(`/editor/${hike.slug}`);
      return;
    }
    setBusy(false);
    setProblems(data?.problems ?? [res ? (res.status === 404 ? "You're no longer signed in. Sign in again in another tab, then try again." : `Something went wrong (HTTP ${res.status}).`) : "Couldn't reach the server."]);
  }

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void create();
      }}
    >
      <Field id="new-title" label="Title" required>
        <input id="new-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Strawberry Peak" autoFocus />
      </Field>

      <Field id="new-slug" label="Address" required problem={slugProblem} hint={slug ? `The guide will live at /hikes/${slug}. It can't be changed later.` : "Part of the page's web address. Filled in from the title."}>
        <input id="new-slug" className={`${input} font-mono`} value={slug} onChange={(e) => setSlugEdited(e.target.value.toLowerCase())} />
      </Field>

      <Field id="new-region" label="Region" required>
        <input id="new-region" className={input} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Angeles National Forest" />
      </Field>

      <Field id="new-summary" label="Summary" required hint="One or two sentences. Shown on the gallery card and at the top of the guide.">
        <textarea id="new-summary" rows={2} className={input} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="new-difficulty" label="Difficulty" required>
          <select id="new-difficulty" className={input} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d[0].toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="new-date" label="Date hiked" required>
          <input id="new-date" type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-[10px] border border-line bg-card px-4 py-3">
        <legend className="px-1 font-display text-lg font-bold text-forest">The route</legend>
        <Field
          id="new-gpx"
          label="GPX recording (optional)"
          problem={gpxProblem}
          hint="From Garmin, Strava, Gaia and the like. It's read on this device: only the route's positions and elevations are uploaded, never times, heart rate or device details."
        >
          <input id="new-gpx" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="text-[15px]" onChange={(e) => void onGpx(e.target.files?.[0])} />
        </Field>
        {track ? (
          <p className="rounded-md border border-line bg-paper px-3 py-2 text-[15px]" role="status">
            <strong>{track.file}</strong>: {track.data.distanceMi} mi, {track.data.elevationGainFt.toLocaleString()} ft of climbing, {track.data.minElevationFt.toLocaleString()}–{track.data.maxElevationFt.toLocaleString()} ft.
            The trailhead is where the recording starts. ({track.rawPoints.toLocaleString()} recorded points, {track.data.points.length} kept.)
          </p>
        ) : (
          <>
            <p className="text-[13px] text-bark">Without a recording, fill these in. The map will draw straight lines between pins.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field id="new-distance" label="Distance (mi)" required>
                <input id="new-distance" type="number" min={0} step="any" className={input} value={distance} onChange={(e) => setDistance(e.target.value)} />
              </Field>
              <Field id="new-gain" label="Elevation gain (ft)" required>
                <input id="new-gain" type="number" min={0} step="any" className={input} value={gain} onChange={(e) => setGain(e.target.value)} />
              </Field>
              <Field id="new-lat" label="Trailhead latitude" required>
                <input id="new-lat" type="number" step="any" className={input} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="34.2591" />
              </Field>
              <Field id="new-lng" label="Trailhead longitude" required>
                <input id="new-lng" type="number" step="any" className={input} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-118.1041" />
              </Field>
            </div>
          </>
        )}
      </fieldset>

      {problems.length > 0 && (
        <ul role="alert" className="rounded-lg border border-pin-bailout bg-card px-3 py-2 text-sm text-pin-bailout">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!ready} className="cursor-pointer rounded-[10px] bg-forest px-5 py-2 text-lg text-paper disabled:cursor-default disabled:opacity-40">
          {busy ? "Creating…" : "Create draft"}
        </button>
        {missing.length > 0 && <span className="text-[13px] text-bark">Still needed: {missing.join(", ")}.</span>}
      </div>
      <p className="text-[13px] text-bark">Next you&rsquo;ll land in the editor: add pins on the map under Pins, write under Write. Photos are added afterwards with pnpm ingest.</p>
    </form>
  );
}

function Field({ id, label, required, problem, hint, children }: { id: string; label: string; required?: boolean; problem?: string | null; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-[3px] block text-[13px] text-bark">
        {label} {required && <span className="text-pin-bailout">*</span>}
      </label>
      {children}
      {problem && <span className="mt-[3px] block text-[13px] text-pin-bailout">{problem}</span>}
      {hint && <span className="mt-[3px] block text-[13px] text-bark">{hint}</span>}
    </div>
  );
}
