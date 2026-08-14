/**
 * Pure layout math for WindowDiagram — kept separate from the SVG markup so
 * the panel-splitting logic is easy to reason about and unit test.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fits a widthFt x heightFt rectangle into a bounding box, preserving true aspect ratio, centered. */
export function fitFrame(widthFt: number, heightFt: number, box: Rect): Rect {
  const aspect = widthFt / heightFt;
  const boxAspect = box.w / box.h;

  let w: number;
  let h: number;
  if (aspect > boxAspect) {
    w = box.w;
    h = w / aspect;
  } else {
    h = box.h;
    w = h * aspect;
  }

  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
  };
}

/** Splits a rect into `count` equal vertical columns (left to right). */
export function splitColumns(frame: Rect, count: number): Rect[] {
  const colW = frame.w / count;
  return Array.from({ length: count }, (_, i) => ({
    x: frame.x + i * colW,
    y: frame.y,
    w: colW,
    h: frame.h,
  }));
}

/** Splits a rect into rows by height fractions (must sum to 1), top to bottom. */
export function splitRows(frame: Rect, fractions: number[]): Rect[] {
  let cursor = frame.y;
  return fractions.map((frac) => {
    const h = frame.h * frac;
    const row = { x: frame.x, y: cursor, w: frame.w, h };
    cursor += h;
    return row;
  });
}

export function inset(r: Rect, amount: number): Rect {
  return { x: r.x + amount, y: r.y + amount, w: r.w - amount * 2, h: r.h - amount * 2 };
}
