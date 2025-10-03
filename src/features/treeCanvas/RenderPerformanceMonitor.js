import { DEFAULT_BATCH_SIZE, MIN_BATCH_SIZE, MAX_BATCH_SIZE, FRAME_TARGET_MS, FRAME_UPPER_BOUND_MS } from "./constants";

export default class RenderPerformanceMonitor {
  constructor() {
    this.batchSize = DEFAULT_BATCH_SIZE;
    this.overBudgetCount = 0;
    this.severeOverBudgetCount = 0;
    this.underBudgetCount = 0;
  }

  getBatchSize() {
    return this.batchSize;
  }

  recordFrame(durationMs, batchSizeOverride) {
    if (Number.isFinite(durationMs)) {
      if (durationMs > FRAME_UPPER_BOUND_MS) {
        this.severeOverBudgetCount += 1;
        this.overBudgetCount += 1;
        this.underBudgetCount = 0;
      } else if (durationMs > FRAME_TARGET_MS) {
        this.overBudgetCount += 1;
        this.underBudgetCount = 0;
        this.severeOverBudgetCount = 0;
      } else {
        this.underBudgetCount += 1;
        this.overBudgetCount = 0;
        this.severeOverBudgetCount = 0;
      }
    }

    let nextBatchSize = batchSizeOverride ?? this.batchSize;
    let adjusted = false;

    if (this.severeOverBudgetCount >= 2) {
      nextBatchSize = Math.max(MIN_BATCH_SIZE, Math.floor(nextBatchSize * 0.5));
      this.severeOverBudgetCount = 0;
      this.overBudgetCount = 0;
      this.underBudgetCount = 0;
      adjusted = true;
    } else if (this.overBudgetCount >= 3) {
      nextBatchSize = Math.max(MIN_BATCH_SIZE, Math.floor(nextBatchSize * 0.8));
      this.overBudgetCount = 0;
      this.underBudgetCount = 0;
      adjusted = true;
    } else if (this.underBudgetCount >= 4) {
      nextBatchSize = Math.min(MAX_BATCH_SIZE, Math.ceil(nextBatchSize * 1.2));
      this.underBudgetCount = 0;
      adjusted = true;
    }

    if (adjusted) {
      this.batchSize = nextBatchSize;
      return { resizeBatch: true, batchSize: this.batchSize };
    }

    this.batchSize = nextBatchSize;
    return { resizeBatch: false, batchSize: this.batchSize };
  }
}