import { describe, expect, it } from "vitest";
import { fitCanvas, MAX_CANVAS_PIXELS } from "../pins/process-photo";

describe("fitCanvas", () => {
  it("leaves a flat photo's full variant alone", () => {
    expect(fitCanvas({ width: 2400, height: 1800 })).toEqual({ width: 2400, height: 1800 });
  });

  it("shrinks a full-size 360° photo to what an iPhone's canvas can hold, keeping 2:1", () => {
    const { width, height } = fitCanvas({ width: 6144, height: 3072 });
    expect(width * height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect([width, height]).toEqual([5792, 2896]);
  });
});
