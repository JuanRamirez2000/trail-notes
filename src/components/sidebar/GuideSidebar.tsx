import { cn } from "@/lib/cn";
import { SIDEBAR_CARDS, type SidebarCardId } from "@/lib/schemas";
import { sidebarCards } from "./registry";

/** Desktop rail: sticky, viewport-tall, cards stacked in the guide's order; `grow` cards scroll inside. */
export function GuideSidebar({ cards = [...SIDEBAR_CARDS] }: { cards?: SidebarCardId[] }) {
  return (
    <aside className="hidden lg:block" aria-label="Guide navigation">
      <div className="sticky top-4 mt-[22px] flex max-h-[calc(100dvh-2rem)] flex-col gap-3">
        {cards.map((id) => {
          const { component: Card, size } = sidebarCards[id];
          return (
            <div
              key={id}
              className={cn(
                "flex min-h-0 flex-col",
                size === "fixed" && "flex-none",
                // Safety stays visible but caps at ~a third of the viewport when space is tight.
                size === "shrink" && "max-h-[30dvh] flex-[0_1_auto]",
                size === "grow" && "flex-1",
              )}
            >
              <Card />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
