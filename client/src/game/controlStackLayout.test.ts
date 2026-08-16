import { describe, expect, it } from "vitest";
import { CONTROL_STACK_METRICS, deriveControlStackLayout } from "./controlStackLayout";

describe("control stack layout", () => {
  it.each(Object.entries(CONTROL_STACK_METRICS))("keeps equal vertical rhythm in %s viewports", (_mode, metrics) => {
    const boardBottom = 520;
    const layout = deriveControlStackLayout(boardBottom, metrics);

    expect(layout.actionTop - boardBottom).toBe(metrics.gap);
    expect(layout.difficultyTop - (layout.actionTop + metrics.actionRowHeight)).toBe(metrics.gap);
    expect(layout.sizeTop - (layout.difficultyTop + metrics.pickerRowHeight)).toBe(metrics.gap);
  });
});
