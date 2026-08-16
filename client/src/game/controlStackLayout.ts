export type ControlStackMetrics = {
  actionRowHeight: number;
  pickerRowHeight: number;
  gap: number;
};

export const CONTROL_STACK_METRICS = {
  regular: { actionRowHeight: 40, pickerRowHeight: 43, gap: 8 },
  compact: { actionRowHeight: 30, pickerRowHeight: 37, gap: 8 },
} as const satisfies Record<"regular" | "compact", ControlStackMetrics>;

export function deriveControlStackLayout(boardBottom: number, metrics: ControlStackMetrics) {
  const actionTop = boardBottom + metrics.gap;
  const difficultyTop = actionTop + metrics.actionRowHeight + metrics.gap;
  const sizeTop = difficultyTop + metrics.pickerRowHeight + metrics.gap;

  return { actionTop, difficultyTop, sizeTop };
}
