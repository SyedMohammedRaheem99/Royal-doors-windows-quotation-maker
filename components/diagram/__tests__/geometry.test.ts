import { describe, expect, it } from "vitest";
import { fitFrame, inset, splitColumns, splitRows, type Rect } from "../geometry";

const BOX: Rect = { x: 54, y: 14, w: 208, h: 138 };

/**
 * The diagram engine is what makes a quotation legible to a customer — a
 * drawing that misrepresents the shape of a window is worse than no drawing.
 * These cover the geometry, which is pure math; the visual output is checked
 * separately via the /dev/diagrams gallery.
 */

describe("fitFrame — a window must be drawn in its TRUE proportions", () => {
  it("preserves aspect ratio for a wide window", () => {
    // 8ft x 3ft is wider than the box, so width is the constraint.
    const r = fitFrame(8, 3, BOX);
    expect(r.w / r.h).toBeCloseTo(8 / 3, 5);
    expect(r.w).toBeLessThanOrEqual(BOX.w);
    expect(r.h).toBeLessThanOrEqual(BOX.h);
  });

  it("preserves aspect ratio for a tall window (a door)", () => {
    const r = fitFrame(3, 7, BOX);
    expect(r.w / r.h).toBeCloseTo(3 / 7, 5);
    expect(r.h).toBeLessThanOrEqual(BOX.h);
  });

  it("preserves aspect ratio for a square window", () => {
    const r = fitFrame(4, 4, BOX);
    expect(r.w).toBeCloseTo(r.h, 5);
  });

  it("never overflows the bounding box, at any aspect ratio", () => {
    // Regression guard: an overflowing frame would draw outside the SVG
    // viewBox and be clipped on the printed quotation.
    const ratios: Array<[number, number]> = [
      [1, 20], [20, 1], [1, 1], [8, 3], [3, 7], [2, 2], [14, 4], [0.5, 6],
    ];
    for (const [w, h] of ratios) {
      const r = fitFrame(w, h, BOX);
      expect(r.w, `${w}x${h} width`).toBeLessThanOrEqual(BOX.w + 0.001);
      expect(r.h, `${w}x${h} height`).toBeLessThanOrEqual(BOX.h + 0.001);
      expect(r.x, `${w}x${h} left edge`).toBeGreaterThanOrEqual(BOX.x - 0.001);
      expect(r.y, `${w}x${h} top edge`).toBeGreaterThanOrEqual(BOX.y - 0.001);
      expect(r.x + r.w, `${w}x${h} right edge`).toBeLessThanOrEqual(BOX.x + BOX.w + 0.001);
      expect(r.y + r.h, `${w}x${h} bottom edge`).toBeLessThanOrEqual(BOX.y + BOX.h + 0.001);
    }
  });

  it("centres the frame within the box", () => {
    const r = fitFrame(4, 4, BOX);
    const leftGap = r.x - BOX.x;
    const rightGap = BOX.x + BOX.w - (r.x + r.w);
    expect(leftGap).toBeCloseTo(rightGap, 5);
  });
});

describe("splitColumns — sliding tracks and shutters", () => {
  const frame: Rect = { x: 0, y: 0, w: 300, h: 100 };

  it("produces the requested number of columns", () => {
    expect(splitColumns(frame, 2)).toHaveLength(2);
    expect(splitColumns(frame, 3)).toHaveLength(3);
    expect(splitColumns(frame, 4)).toHaveLength(4);
  });

  it("divides the width evenly with no gaps or overlaps", () => {
    const cols = splitColumns(frame, 3);
    for (const c of cols) expect(c.w).toBeCloseTo(100, 5);
    // Each column starts exactly where the previous ended.
    expect(cols[1].x).toBeCloseTo(cols[0].x + cols[0].w, 5);
    expect(cols[2].x).toBeCloseTo(cols[1].x + cols[1].w, 5);
    // The last column ends exactly at the frame's right edge.
    expect(cols[2].x + cols[2].w).toBeCloseTo(frame.x + frame.w, 5);
  });

  it("keeps every column at full frame height", () => {
    for (const c of splitColumns(frame, 4)) {
      expect(c.h).toBe(frame.h);
      expect(c.y).toBe(frame.y);
    }
  });
});

describe("splitRows — combination frames and bathroom doors", () => {
  const frame: Rect = { x: 10, y: 20, w: 200, h: 120 };

  it("divides height by the given fractions", () => {
    const rows = splitRows(frame, [0.35, 0.65]);
    expect(rows[0].h).toBeCloseTo(42, 5);
    expect(rows[1].h).toBeCloseTo(78, 5);
  });

  it("stacks rows contiguously from the top with no gaps", () => {
    const rows = splitRows(frame, [0.5, 0.5]);
    expect(rows[0].y).toBe(frame.y);
    expect(rows[1].y).toBeCloseTo(rows[0].y + rows[0].h, 5);
    expect(rows[1].y + rows[1].h).toBeCloseTo(frame.y + frame.h, 5);
  });

  it("keeps every row at full frame width", () => {
    for (const r of splitRows(frame, [0.85, 0.15])) {
      expect(r.w).toBe(frame.w);
      expect(r.x).toBe(frame.x);
    }
  });
});

describe("inset", () => {
  it("shrinks a rect symmetrically on all sides", () => {
    const r = inset({ x: 10, y: 10, w: 100, h: 100 }, 3);
    expect(r).toEqual({ x: 13, y: 13, w: 94, h: 94 });
  });

  it("expands when given a negative amount (used for the outer sub-frame)", () => {
    const r = inset({ x: 10, y: 10, w: 100, h: 100 }, -3);
    expect(r).toEqual({ x: 7, y: 7, w: 106, h: 106 });
  });
});
