"use client";

import "@mdxeditor/editor/style.css";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  insertJsx$,
  linkDialogPlugin,
  ListsToggle,
  MDXEditor,
  NESTED_EDITOR_UPDATED_COMMAND,
  NestedLexicalEditor,
  Separator,
  toolbarPlugin,
  UndoRedo,
  useLexicalNodeRemove,
  useMdastNodeUpdater,
  useNestedEditorContext,
  usePublisher,
  type JsxEditorProps,
  type JsxProperties,
} from "@mdxeditor/editor";
import type { MdxJsxAttribute, MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { mdxComponents } from "@/components/mdx/registry";
import { cn } from "@/lib/cn";
import type { HikeWaypoint, RouteCoords } from "@/lib/hike";
import type { ProfilePoint } from "@/lib/elevation";
import { HikeProvider } from "@/lib/hike-store";
import { isComponentName, manifest, type ComponentName } from "@/lib/mdx/manifest";
import { attributeValue } from "@/lib/mdx/remark-component-props";
import type { Essentials } from "@/lib/schemas";
import { SettingsForm } from "../ComponentSettings";
import { InsertMenu } from "../InsertMenu";
import { writtenProps, type WrittenProp } from "../jsx-source";
import { editorPlugins, toMarkdownOptions } from "../mdx-editor-config";

/**
 * The Write view: the guide's body as a document. Text is edited in place, and every component
 * from the manifest is a live block that renders the real component. Clicking a block selects it
 * and shows its generated settings form in the settings column.
 *
 * It edits the MDX body only. The guide's details (frontmatter) are the Details form's job.
 */
type Props = {
  /** The MDX body to start from. Read once: remount (change `key`) to load a different document. */
  body: string;
  onChange: (body: string) => void;
  waypoints: HikeWaypoint[];
  route: RouteCoords;
  profile: ProfilePoint[] | null;
  essentials?: Essentials;
  /** Where a selected block renders its settings form. */
  panel: HTMLElement | null;
  onSelectionChange: (hasSelection: boolean) => void;
  /** Bump to clear the selection from outside (the settings sheet's "Done" on a phone). */
  deselect?: number;
  /** Where to send the author when this view can't show the guide. */
  onOpenAdvanced: () => void;
};

type WriteContext = {
  selectedId: string | null;
  select: (id: string | null) => void;
  panel: HTMLElement | null;
  waypoints: HikeWaypoint[];
  /** A sensible pin for a newly inserted component, looking at what the document already uses. */
  pickWaypoint: (name: ComponentName) => string | undefined;
};

const Ctx = createContext<WriteContext | null>(null);
const useWrite = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Write blocks must render inside <WriteView>");
  return ctx;
};

export default function WriteView({ body, onChange, waypoints, route, profile, essentials, panel, onSelectionChange, deselect, onOpenAdvanced }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seenDeselect, setSeenDeselect] = useState(deselect);
  if (deselect !== seenDeselect) {
    setSeenDeselect(deselect);
    setSelectedId(null);
  }
  const latest = useRef(body);
  const [initial] = useState(body);
  // MDXEditor can't show everything a guide may contain (images, code blocks, reference links,
  // footnotes). When it meets one it stops there: the rest of the guide is missing from the
  // screen and edits are no longer reported. Nothing typed in that state would be saved, so the
  // view steps aside instead.
  const [unsupported, setUnsupported] = useState<string | null>(null);

  useEffect(() => onSelectionChange(selectedId !== null), [selectedId, onSelectionChange]);

  const ctx = useMemo<WriteContext>(
    () => ({
      selectedId,
      select: setSelectedId,
      panel,
      waypoints,
      pickWaypoint: (name) => {
        const used = new Set([...latest.current.matchAll(/<Step\s+waypoint\s*=\s*\{?\s*["']([^"']+)["']/g)].map((m) => m[1]));
        if (name === "Step") return (waypoints.find((w) => w.stepIndex !== null && !used.has(w.id)) ?? waypoints.find((w) => !used.has(w.id)) ?? waypoints[0])?.id;
        if (name === "PanoViewer") return (waypoints.find((w) => w.photo?.kind === "pano") ?? waypoints[0])?.id;
        return (waypoints.find((w) => w.photo?.kind === "flat" && w.type !== "start") ?? waypoints[0])?.id;
      },
    }),
    [selectedId, panel, waypoints],
  );

  const plugins = useMemo(() => [...editorPlugins(Block), linkDialogPlugin(), toolbarPlugin({ toolbarContents: () => <Toolbar />, toolbarClassName: "write-toolbar" })], []);

  if (unsupported) {
    return (
      <div role="alert" className="m-6 rounded-lg border-2 border-dashed border-pin-bailout bg-card p-4">
        <p className="font-semibold text-pin-bailout">This guide can&rsquo;t be edited in the Write view.</p>
        <p className="mt-1 text-graphite">
          It contains Markdown this view doesn&rsquo;t support (an image, a code block, a reference-style link or a footnote), so part of it wouldn&rsquo;t be shown and changes made here
          wouldn&rsquo;t be saved. Nothing has been changed. Edit it under Advanced, or remove that part there to use this view again.
        </p>
        <p className="mt-2 font-mono text-xs text-bark">{unsupported}</p>
        <button type="button" onClick={onOpenAdvanced} className="mt-3 cursor-pointer rounded-lg bg-forest px-3.5 py-1 text-paper">
          Open Advanced
        </button>
      </div>
    );
  }

  return (
    // The blocks are the real guide components, so they need the same shared state as a guide page.
    <HikeProvider slug="editor" waypoints={waypoints} route={route} profile={profile} essentials={essentials}>
      <Ctx.Provider value={ctx}>
        <div
          // Clicking the text (anything that isn't a block) clears the selection. The settings
          // form is rendered elsewhere on the page but is still a React child of a block, so its
          // clicks arrive here too and must be ignored.
          onMouseDownCapture={(e) => {
            const target = e.target as HTMLElement;
            if (panel?.contains(target) || target.closest("[data-write-block]") || !target.closest(".write-prose")) return;
            setSelectedId(null);
          }}
        >
          <MDXEditor
            markdown={initial}
            className="write-editor"
            contentEditableClassName="write-prose"
            placeholder="Write the guide…"
            plugins={plugins}
            toMarkdownOptions={toMarkdownOptions}
            onChange={(markdown, initialNormalize) => {
              // A space typed at the end of a line is serialised as "&#x20;" so Markdown keeps it.
              // It means nothing in a guide, so it's dropped rather than saved.
              const clean = markdown.replace(/(?:&#x20;)+(?=\n|$)/g, "");
              latest.current = clean;
              // Loading a document can reformat it slightly (see mdx-editor-config). That isn't an edit.
              if (!initialNormalize) onChange(clean);
            }}
            onError={({ error }) => setUnsupported(error)}
          />
        </div>
      </Ctx.Provider>
    </HikeProvider>
  );
}

function Toolbar() {
  const insertJsx = usePublisher(insertJsx$);
  const { pickWaypoint } = useWrite();
  return (
    <>
      <UndoRedo />
      <Separator />
      <BlockTypeSelect />
      <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
      <ListsToggle options={["bullet", "number"]} />
      <CreateLink />
      <Separator />
      <InsertMenu
        label="＋ Insert block ▾"
        onInsert={(name) => {
          const needsPin = Object.hasOwn(manifest[name].props.shape, "waypoint");
          const pin = needsPin ? pickWaypoint(name) : undefined;
          const props: JsxProperties = pin ? { waypoint: pin } : {};
          insertJsx({ kind: "flow", name, props, children: [] });
        }}
      />
    </>
  );
}

const toAttribute = (p: WrittenProp): MdxJsxAttribute => ({
  type: "mdxJsxAttribute",
  name: p.name,
  value:
    p.kind === "flag"
      ? null
      : p.kind === "string"
        ? p.value
        : { type: "mdxJsxAttributeValueExpression", value: p.kind === "literal" ? JSON.stringify(p.value) : p.source },
});

/** One component in the document: the real thing, selectable, with its text (if it takes any) editable inside. */
function Block({ mdastNode }: JsxEditorProps) {
  const id = useId();
  const { selectedId, select, panel, waypoints } = useWrite();
  const update = useMdastNodeUpdater<MdxJsxFlowElement>();
  const remove = useLexicalNodeRemove();
  const { parentEditor, lexicalNode } = useNestedEditorContext();
  const name = mdastNode.name ?? "";

  // Moving a block swaps it with its neighbour in the document: a paragraph, a heading or
  // another block. Whether there is a neighbour either side is read after every change to the
  // document, so the buttons are right after a move or after text is added around the block.
  const [canMove, setCanMove] = useState({ up: false, down: false });
  useEffect(() => {
    const read = () =>
      parentEditor.getEditorState().read(() => {
        const node = lexicalNode.getLatest();
        const next = { up: node.getPreviousSibling() !== null, down: node.getNextSibling() !== null };
        setCanMove((now) => (now.up === next.up && now.down === next.down ? now : next));
      });
    read();
    return parentEditor.registerUpdateListener(read);
  }, [parentEditor, lexicalNode]);
  const move = (by: -1 | 1) =>
    parentEditor.update(() => {
      const node = lexicalNode.getLatest();
      if (by === -1) node.getPreviousSibling()?.insertBefore(node);
      else node.getNextSibling()?.insertAfter(node);
    });

  // MDXEditor only copies a block's own text into the document when that field loses focus, so
  // autosave wouldn't see what's being typed, and closing the tab mid-sentence would lose it.
  // Shortly after each keystroke, ask the field to commit (the command MDXEditor itself uses).
  const syncTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(syncTimer.current), []);
  const syncNested = (target: EventTarget) => {
    const field = (target as HTMLElement).closest?.<HTMLElement>(".write-nested");
    const nested = (field as (HTMLElement & { __lexicalEditor?: { dispatchCommand: (c: unknown, p: undefined) => void } }) | null)?.__lexicalEditor;
    if (!nested) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => nested.dispatchCommand(NESTED_EDITOR_UPDATED_COMMAND, undefined), 500);
  };

  if (!isComponentName(name)) {
    return <div className="my-4 rounded-lg border-2 border-dashed border-pin-bailout bg-card p-3 text-pin-bailout">Unknown component &lt;{name}&gt;. Remove it under Advanced.</div>;
  }

  const props: Record<string, unknown> = {};
  const raw: Record<string, string> = {};
  for (const attr of mdastNode.attributes) {
    if (attr.type !== "mdxJsxAttribute") continue;
    const value = attributeValue(attr);
    if (typeof value === "symbol") raw[attr.name] = (attr.value as { value: string }).value;
    else props[attr.name] = value;
  }

  const selected = selectedId === id;
  const Component = mdxComponents[name] as ComponentType<Record<string, unknown> & { children?: ReactNode }>;
  const text =
    manifest[name].children === "markdown" ? (
      <NestedLexicalEditor<MdxJsxFlowElement>
        block
        getContent={(node) => node.children}
        getUpdatedMdastNode={(node, children) => ({ ...node, children: children as MdxJsxFlowElement["children"] })}
        contentEditableProps={{ className: "write-prose write-nested", "aria-label": `${manifest[name].title} text` }}
      />
    ) : undefined;

  return (
    <div
      data-write-block={name}
      data-selected={selected ? "" : undefined}
      onMouseDown={() => select(id)}
      // Not `onInput`: Lexical handles typing in `beforeinput` and cancels it, so `input` never fires.
      onKeyUp={(e) => syncNested(e.target)}
      onPaste={(e) => syncNested(e.target)}
      onCut={(e) => syncNested(e.target)}
      onKeyDownCapture={(e) => {
        // MDXEditor deletes the whole block when Backspace is pressed in its empty text field.
        // Losing a step to one extra keystroke is too easy; blocks are removed with the Remove button.
        const field = (e.target as HTMLElement).closest?.(".write-nested");
        if (e.key === "Backspace" && field && !field.textContent) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={cn("write-block", selected && "is-selected")}
    >
      <Component {...props}>{text}</Component>
      {selected &&
        panel &&
        createPortal(
          <SettingsForm
            component={{ name, props, raw }}
            waypoints={waypoints}
            onChange={(next) => update({ attributes: writtenProps(name, next, raw).map(toAttribute) })}
            onMove={move}
            canMove={canMove}
            onRemove={() => {
              select(null);
              remove();
            }}
          />,
          panel,
        )}
    </div>
  );
}
