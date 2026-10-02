"use client";

import { SafetyList } from "@/components/sidebar/SafetyList";

/** `<SafetyPoints />`: the sidebar's safety list, placed in the guide itself. */
export function SafetyPoints() {
  return (
    <div className="my-[22px]">
      <SafetyList className="max-h-[420px]" />
    </div>
  );
}
