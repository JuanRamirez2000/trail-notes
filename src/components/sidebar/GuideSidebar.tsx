import { cn } from "@/lib/cn";
import { sidebarCards } from "./registry";

/** Desktop rail: sticky, viewport-tall, cards stacked; `grow` cards scroll inside. */
export function GuideSidebar() {
  return (
    <aside className="hidden lg:block" aria-label="Guide navigation">
      <div className="sticky top-4 mt-[22px] flex max-h-[calc(100dvh-2rem)] flex-col gap-3">
        {sidebarCards.map(({ id, component: Card, grow }) => (
          <div key={id} className={cn("flex min-h-0 flex-col", grow ? "flex-1" : "flex-none")}>
            <Card />
          </div>
        ))}
      </div>
    </aside>
  );
}
