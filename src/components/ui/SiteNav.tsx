"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/hikes", label: "Hikes" },
  // A section of the landing page, so it's never "the page you're on".
  { href: "/#features", label: "Features" },
];

/** The header's links. The section you're in is underlined (the gallery and every guide are "Hikes"). */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-5 text-lg">
      {LINKS.map(({ href, label }) => {
        const here = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={cn("border-b-[3px] text-graphite hover:text-bark", here ? "border-ochre" : "border-transparent")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
