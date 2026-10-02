"use client";

import { StepList } from "@/components/sidebar/StepList";

/** `<Steps />`: the sidebar's numbered step list, placed in the guide itself. */
export function Steps() {
  return (
    <div className="my-[22px]">
      <StepList className="max-h-[520px]" />
    </div>
  );
}
