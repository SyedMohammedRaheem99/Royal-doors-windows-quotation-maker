"use client";

import { useId } from "react";
import { feetToArchLabel } from "@/lib/dimensions";
import type { DiagramType, Handing } from "@/models/schemas";
import { fitFrame, inset, splitColumns, splitRows, type Rect } from "./geometry";

export interface WindowDiagramProps {
  type: DiagramType;
  widthFt: number;
  heightFt: number;
  handing?: Handing;
  /** Override the default shutter/panel count for sliding & casement types. */
  panels?: number;
  /** Draws the fan-point marker on a ventilator — only the "with fan point" product variants have one. */
  fanPoint?: boolean;
  showDimensions?: boolean;
  className?: string;
}

const STROKE = "#1f3d2e";
const STROKE_WIDTH = 2.6;
/**
 * Detail strokes (glass/panel outlines, louvre slats, hardware). Scaled with
 * STROKE_WIDTH so the whole drawing keeps its weight relationships when it is
 * shrunk into an ~20mm print cell; at the previous 1u these vanished to a
 * ~0.17pt hairline that laser printers drop inconsistently.
 */
const DETAIL_STROKE = 1.7;
/** Swing-arc / dashed indicator lines — deliberately lighter than a real edge. */
const HINT_STROKE = 1.4;
const GLASS_FILL = "#e9f1f4";
const WOOD_FILL = "#c9a876";
const DIM_COLOR = "#6b7280";

const VIEW_W = 300;
const VIEW_H = 220;
const FRAME_BOX: Rect = { x: 54, y: 14, w: 208, h: 138 };
/**
 * With dimension lines hidden the 54u left / ~68u bottom gutter FRAME_BOX
 * reserves for them is dead space — on the printed schedule that gutter was
 * ~40% of an already-tiny 18mm cell. Drawing into the full canvas instead is
 * what makes the print thumbnail legible.
 */
const FULL_BOX: Rect = { x: 8, y: 8, w: 284, h: 204 };

type ColumnKind = "glass" | "mesh" | "fixedGlass";
type Opening = "none" | "slideH" | "slideV" | "hingeLeft" | "hingeRight" | "hingeTop";

function GlassFill({ r }: { r: Rect }) {
  return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={GLASS_FILL} stroke={STROKE} strokeWidth={DETAIL_STROKE} />;
}

function MeshFill({ r, patternId }: { r: Rect; patternId: string }) {
  return (
    <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={`url(#${patternId})`} stroke={STROKE} strokeWidth={DETAIL_STROKE} />
  );
}

function LouverFill({ r }: { r: Rect }) {
  const slats = Math.max(4, Math.round(r.h / 8));
  const gap = r.h / slats;
  return (
    <g>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#f4f5f0" stroke={STROKE} strokeWidth={DETAIL_STROKE} />
      {Array.from({ length: slats }).map((_, i) => (
        <line
          key={i}
          x1={r.x + 2}
          x2={r.x + r.w - 2}
          y1={r.y + (i + 0.5) * gap}
          y2={r.y + (i + 0.5) * gap}
          stroke={STROKE}
          strokeWidth={DETAIL_STROKE}
        />
      ))}
    </g>
  );
}

function SolidLeaf({ r }: { r: Rect }) {
  return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={WOOD_FILL} stroke={STROKE} strokeWidth={DETAIL_STROKE} />;
}

function Mullion({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return <line x1={x} x2={x} y1={y1} y2={y2} stroke={STROKE} strokeWidth={STROKE_WIDTH} />;
}

function HorizontalRail({ y, x1, x2 }: { y: number; x1: number; x2: number }) {
  return <line x1={x1} x2={x2} y1={y} y2={y} stroke={STROKE} strokeWidth={STROKE_WIDTH} />;
}

/**
 * Double-headed arrow — the standard symbol for a sliding sash. Arrowhead
 * size is derived from the available shaft length so that on a narrow
 * column (e.g. a 3-panel split on a tall, narrow door) the two heads
 * shrink instead of overlapping into an unreadable X.
 */
function SlideArrowH({ r }: { r: Rect }) {
  const y = r.y + r.h / 2;
  const x1 = r.x + r.w * 0.2;
  const x2 = r.x + r.w * 0.8;
  const shaft = x2 - x1;
  const head = Math.max(2, Math.min(7, shaft / 2 - 1));
  return (
    <g stroke={STROKE} strokeWidth={DETAIL_STROKE} fill="none">
      <line x1={x1} x2={x2} y1={y} y2={y} />
      <polyline points={`${x1 + head},${y - head} ${x1},${y} ${x1 + head},${y + head}`} />
      <polyline points={`${x2 - head},${y - head} ${x2},${y} ${x2 - head},${y + head}`} />
    </g>
  );
}

function SlideArrowV({ r }: { r: Rect }) {
  const x = r.x + r.w / 2;
  const y1 = r.y + r.h * 0.2;
  const y2 = r.y + r.h * 0.8;
  const shaft = y2 - y1;
  const head = Math.max(2, Math.min(7, shaft / 2 - 1));
  return (
    <g stroke={STROKE} strokeWidth={DETAIL_STROKE} fill="none">
      <line x1={x} x2={x} y1={y1} y2={y2} />
      <polyline points={`${x - head},${y1 + head} ${x},${y1} ${x + head},${y1 + head}`} />
      <polyline points={`${x - head},${y2 - head} ${x},${y2} ${x + head},${y2 - head}`} />
    </g>
  );
}

/** Architectural hinge symbol: dashed swing lines converging at the apex opposite the hinge edge. */
function HingeTriangle({ r, side }: { r: Rect; side: "left" | "right" | "top" }) {
  let apex: [number, number];
  let corners: [[number, number], [number, number]];

  if (side === "left") {
    apex = [r.x + r.w, r.y + r.h / 2];
    corners = [
      [r.x, r.y],
      [r.x, r.y + r.h],
    ];
  } else if (side === "right") {
    apex = [r.x, r.y + r.h / 2];
    corners = [
      [r.x + r.w, r.y],
      [r.x + r.w, r.y + r.h],
    ];
  } else {
    apex = [r.x + r.w / 2, r.y + r.h];
    corners = [
      [r.x, r.y],
      [r.x + r.w, r.y],
    ];
  }

  return (
    <g stroke={STROKE} strokeWidth={HINT_STROKE} strokeDasharray="4,2.5" fill="none">
      <line x1={apex[0]} y1={apex[1]} x2={corners[0][0]} y2={corners[0][1]} />
      <line x1={apex[0]} y1={apex[1]} x2={corners[1][0]} y2={corners[1][1]} />
    </g>
  );
}

/**
 * Exhaust-fan cutout on a ventilator. Sized off the rect it sits in rather
 * than a fixed radius, so it stays legible on both a 2x2ft ventilator and a
 * larger one instead of shrinking into an unreadable dot.
 */
function FanPointMarker({ r }: { r: Rect }) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const radius = Math.max(6, Math.min(r.w, r.h) / 2 - 4);
  const blade = radius * 0.62;
  return (
    <g stroke={STROKE} strokeWidth={DETAIL_STROKE} fill="none">
      <circle cx={cx} cy={cy} r={radius} />
      <circle cx={cx} cy={cy} r={radius * 0.22} fill={STROKE} stroke="none" />
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={cx + Math.cos(rad) * radius * 0.22}
            y1={cy + Math.sin(rad) * radius * 0.22}
            x2={cx + Math.cos(rad) * blade}
            y2={cy + Math.sin(rad) * blade}
          />
        );
      })}
    </g>
  );
}

function HandleMarker({ r, atRight }: { r: Rect; atRight: boolean }) {
  const x = atRight ? r.x + r.w - 6 : r.x + 3;
  const y = r.y + r.h / 2 - 8;
  return <rect x={x} y={y} width={3} height={16} rx={1.5} fill={STROKE} />;
}

function DimensionLines({
  frame,
  widthFt,
  heightFt,
}: {
  frame: Rect;
  widthFt: number;
  heightFt: number;
}) {
  const bottomY = frame.y + frame.h + 12;
  const leftX = frame.x - 12;

  return (
    <g stroke={DIM_COLOR} strokeWidth={0.75} fill={DIM_COLOR}>
      {/* width */}
      <line x1={frame.x} y1={bottomY} x2={frame.x + frame.w} y2={bottomY} />
      <line x1={frame.x} y1={bottomY - 4} x2={frame.x} y2={bottomY + 4} />
      <line x1={frame.x + frame.w} y1={bottomY - 4} x2={frame.x + frame.w} y2={bottomY + 4} />
      <text x={frame.x + frame.w / 2} y={bottomY + 14} textAnchor="middle" fontSize={10} stroke="none">
        {feetToArchLabel(widthFt)}
      </text>

      {/* height */}
      <line x1={leftX} y1={frame.y} x2={leftX} y2={frame.y + frame.h} />
      <line x1={leftX - 4} y1={frame.y} x2={leftX + 4} y2={frame.y} />
      <line x1={leftX - 4} y1={frame.y + frame.h} x2={leftX + 4} y2={frame.y + frame.h} />
      <text
        x={0}
        y={0}
        textAnchor="middle"
        fontSize={10}
        stroke="none"
        transform={`translate(${leftX - 10}, ${frame.y + frame.h / 2}) rotate(-90)`}
      >
        {feetToArchLabel(heightFt)}
      </text>
    </g>
  );
}

/** Renders a set of columns (fills + mullions + opening indicators) inside a frame. */
function Columns({
  frame,
  kinds,
  openings,
  meshPatternId,
}: {
  frame: Rect;
  kinds: ColumnKind[];
  openings: Opening[];
  meshPatternId: string;
}) {
  const cols = splitColumns(frame, kinds.length);
  return (
    <g>
      {cols.map((c, i) => {
        const kind = kinds[i];
        const inner = inset(c, 3);
        return (
          <g key={i}>
            {kind === "mesh" ? <MeshFill r={inner} patternId={meshPatternId} /> : <GlassFill r={inner} />}
            {openings[i] === "slideH" && <SlideArrowH r={inner} />}
            {openings[i] === "hingeLeft" && <HingeTriangle r={inner} side="left" />}
            {openings[i] === "hingeRight" && <HingeTriangle r={inner} side="right" />}
          </g>
        );
      })}
      {cols.slice(1).map((c, i) => (
        <Mullion key={i} x={c.x} y1={frame.y} y2={frame.y + frame.h} />
      ))}
    </g>
  );
}

export function WindowDiagram({
  type,
  widthFt,
  heightFt,
  handing = "none",
  panels,
  fanPoint = false,
  showDimensions = true,
  className,
}: WindowDiagramProps) {
  const meshPatternId = useId().replace(/[:]/g, "");
  const frame = fitFrame(widthFt, heightFt, showDimensions ? FRAME_BOX : FULL_BOX);
  const outer = inset(frame, -3);

  const content = renderByType(type, frame, { handing, panels, fanPoint, meshPatternId });

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className}
      role="img"
      aria-label={`${type.replace(/_/g, " ")} diagram, ${feetToArchLabel(widthFt)} by ${feetToArchLabel(heightFt)}`}
    >
      <defs>
        <pattern id={meshPatternId} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width={6} height={6} fill="#f2f6ee" />
          <line x1={0} y1={0} x2={0} y2={6} stroke="#9fb28c" strokeWidth={1} />
        </pattern>
      </defs>

      {/* outer sub-frame */}
      <rect x={outer.x} y={outer.y} width={outer.w} height={outer.h} fill="none" stroke={STROKE} strokeWidth={3.2} />

      {content}

      {showDimensions && <DimensionLines frame={frame} widthFt={widthFt} heightFt={heightFt} />}
    </svg>
  );
}

function renderByType(
  type: DiagramType,
  frame: Rect,
  opts: { handing: Handing; panels?: number; fanPoint: boolean; meshPatternId: string }
) {
  const { handing, panels, fanPoint, meshPatternId } = opts;

  switch (type) {
    case "sliding_2_track":
    case "aluminium_sliding": {
      const n = panels ?? 2;
      const kinds: ColumnKind[] = Array(n).fill("glass");
      const openings: Opening[] = Array(n).fill("slideH");
      return <Columns frame={frame} kinds={kinds} openings={openings} meshPatternId={meshPatternId} />;
    }

    case "sliding_2_5_track": {
      // glass panel(s) + one dedicated mesh track
      const n = panels ?? 2;
      const kinds: ColumnKind[] = [...Array(n).fill("glass"), "mesh"];
      const openings: Opening[] = [...Array(n).fill("slideH"), "slideH"];
      return <Columns frame={frame} kinds={kinds} openings={openings} meshPatternId={meshPatternId} />;
    }

    case "sliding_3_track": {
      const n = panels ?? 3;
      const kinds: ColumnKind[] = Array(n).fill("glass");
      const openings: Opening[] = Array(n).fill("slideH");
      return <Columns frame={frame} kinds={kinds} openings={openings} meshPatternId={meshPatternId} />;
    }

    case "sliding_vertical": {
      const rows = splitRows(frame, [0.5, 0.5]);
      return (
        <g>
          {rows.map((r, i) => (
            <GlassFill key={i} r={inset(r, 3)} />
          ))}
          <HorizontalRail y={rows[1].y} x1={frame.x} x2={frame.x + frame.w} />
          <SlideArrowV r={inset(frame, 6)} />
        </g>
      );
    }

    case "casement": {
      const n = panels ?? 1;
      const kinds: ColumnKind[] = Array(n).fill("glass");
      const openings: Opening[] = Array.from({ length: n }, (_, i) => {
        if (handing === "right") return "hingeRight";
        if (handing === "left") return "hingeLeft";
        return i % 2 === 0 ? "hingeLeft" : "hingeRight";
      });
      return <Columns frame={frame} kinds={kinds} openings={openings} meshPatternId={meshPatternId} />;
    }

    case "fixed": {
      return <GlassFill r={inset(frame, 3)} />;
    }

    case "top_hung": {
      const inner = inset(frame, 3);
      return (
        <g>
          <GlassFill r={inner} />
          <HingeTriangle r={inner} side="top" />
        </g>
      );
    }

    case "combination": {
      const rows = splitRows(frame, [0.35, 0.65]);
      const fixedRow = inset(rows[0], 3);
      const openRow = inset(rows[1], 3);
      return (
        <g>
          <GlassFill r={fixedRow} />
          <GlassFill r={openRow} />
          <HorizontalRail y={rows[1].y} x1={frame.x} x2={frame.x + frame.w} />
          <HingeTriangle r={openRow} side={handing === "right" ? "right" : "left"} />
        </g>
      );
    }

    case "ventilator": {
      const inner = inset(frame, 3);
      // A ventilator is not a small fixed window — it reads as one only if
      // drawn as a bare glass box, which is what it used to be here. The plain
      // unit is a louvred top-of-wall vent.
      if (!fanPoint) {
        return <LouverFill r={inner} />;
      }
      // With a fan point, the client's build is: glass and the fan side by side
      // across the top, louvres along the bottom. Top row is split so the fan
      // sits on the right and fixed glass on the left.
      const topH = inner.h * 0.58;
      const topRow: Rect = { ...inner, h: topH };
      const bottomRow: Rect = { x: inner.x, y: inner.y + topH, w: inner.w, h: inner.h - topH };
      const [glassCell, fanCell] = splitColumns(topRow, 2);
      return (
        <g>
          <GlassFill r={glassCell} />
          <GlassFill r={fanCell} />
          <FanPointMarker r={fanCell} />
          <Mullion x={fanCell.x} y1={topRow.y} y2={topRow.y + topRow.h} />
          <HorizontalRail y={bottomRow.y} x1={frame.x} x2={frame.x + frame.w} />
          <LouverFill r={bottomRow} />
        </g>
      );
    }

    case "louver": {
      return <LouverFill r={inset(frame, 3)} />;
    }

    case "sliding_door": {
      const n = panels ?? 2;
      const kinds: ColumnKind[] = Array(n).fill("glass");
      const openings: Opening[] = Array(n).fill("slideH");
      return (
        <g>
          <Columns frame={frame} kinds={kinds} openings={openings} meshPatternId={meshPatternId} />
        </g>
      );
    }

    case "french_door": {
      const cols = splitColumns(frame, 2);
      return (
        <g>
          <GlassFill r={inset(cols[0], 3)} />
          <GlassFill r={inset(cols[1], 3)} />
          <Mullion x={cols[1].x} y1={frame.y} y2={frame.y + frame.h} />
          <HingeTriangle r={inset(cols[0], 3)} side="left" />
          <HingeTriangle r={inset(cols[1], 3)} side="right" />
          <HandleMarker r={inset(cols[0], 3)} atRight />
          <HandleMarker r={inset(cols[1], 3)} atRight={false} />
        </g>
      );
    }

    case "flush_door": {
      const inner = inset(frame, 3);
      return (
        <g>
          <SolidLeaf r={inner} />
          <HandleMarker r={inner} atRight={handing !== "left"} />
        </g>
      );
    }

    case "bathroom_door": {
      const rows = splitRows(frame, [0.85, 0.15]);
      return (
        <g>
          <SolidLeaf r={inset(rows[0], 3)} />
          <LouverFill r={inset(rows[1], 2)} />
          <HandleMarker r={inset(rows[0], 3)} atRight={handing !== "left"} />
        </g>
      );
    }

    case "mesh_standalone": {
      return <MeshFill r={inset(frame, 3)} patternId={meshPatternId} />;
    }

    case "aluminium_window": {
      const n = panels ?? 2;
      const kinds: ColumnKind[] = Array(n).fill("glass");
      const openings: Opening[] = Array(n).fill("slideH");
      return <Columns frame={frame} kinds={kinds} openings={openings} meshPatternId={meshPatternId} />;
    }

    // A single openable leaf: one glazed panel, hinged on one side. Distinct
    // from french_door (two leaves) — these were previously the same drawing.
    case "openable_door_single": {
      const leaf = inset(frame, 3);
      return (
        <g>
          <GlassFill r={leaf} />
          <HingeTriangle r={leaf} side={handing === "right" ? "right" : "left"} />
          <HandleMarker r={leaf} atRight={handing !== "right"} />
        </g>
      );
    }

    // Two leaves meeting at a centre mullion, hinged on opposite outer edges.
    case "openable_door_double": {
      const cols = splitColumns(frame, 2);
      const left = inset(cols[0], 3);
      const right = inset(cols[1], 3);
      return (
        <g>
          <GlassFill r={left} />
          <GlassFill r={right} />
          <Mullion x={cols[1].x} y1={frame.y} y2={frame.y + frame.h} />
          <HingeTriangle r={left} side="left" />
          <HingeTriangle r={right} side="right" />
        </g>
      );
    }

    // A fixed glazed screen divided by vertical mullions — no opening leaf, so
    // no hinge or slide marker. Panel count follows the width.
    case "partition": {
      const n = panels ?? Math.max(2, Math.min(4, Math.round(frame.w / 46)));
      const cols = splitColumns(frame, n);
      return (
        <g>
          {cols.map((c, i) => (
            <g key={i}>
              <GlassFill r={inset(c, 3)} />
              {i > 0 && <Mullion x={c.x} y1={frame.y} y2={frame.y + frame.h} />}
            </g>
          ))}
        </g>
      );
    }

    // Concertina leaves: several narrow panels with alternating fold hinges.
    case "foldable_door":
    case "foldable_window": {
      const n = panels ?? 4;
      const cols = splitColumns(frame, n);
      return (
        <g>
          {cols.map((c, i) => (
            <g key={i}>
              <GlassFill r={inset(c, 2)} />
              {i > 0 && <Mullion x={c.x} y1={frame.y} y2={frame.y + frame.h} />}
              <HingeTriangle r={inset(c, 2)} side={i % 2 === 0 ? "left" : "right"} />
            </g>
          ))}
        </g>
      );
    }

    // A frame only — no leaf, no glazing. Drawn as the profile outline so it
    // cannot be mistaken for the door that hangs in it.
    case "door_frame": {
      const jamb = Math.max(3, Math.min(frame.w, frame.h) * 0.09);
      return (
        <g>
          <rect
            x={frame.x + jamb}
            y={frame.y + jamb}
            width={Math.max(0, frame.w - jamb * 2)}
            height={Math.max(0, frame.h - jamb)}
            fill="#ffffff"
            stroke={STROKE}
            strokeWidth={DETAIL_STROKE}
          />
          <rect x={frame.x} y={frame.y} width={frame.w} height={jamb} fill={WOOD_FILL} stroke={STROKE} strokeWidth={DETAIL_STROKE} />
          <rect x={frame.x} y={frame.y} width={jamb} height={frame.h} fill={WOOD_FILL} stroke={STROKE} strokeWidth={DETAIL_STROKE} />
          <rect
            x={frame.x + frame.w - jamb}
            y={frame.y}
            width={jamb}
            height={frame.h}
            fill={WOOD_FILL}
            stroke={STROKE}
            strokeWidth={DETAIL_STROKE}
          />
        </g>
      );
    }

    // Double-glazed unit: two panes with the sealed cavity between them, which
    // is the whole point of the product and what a plain rectangle hid.
    case "dgu_glass": {
      const outerPane = inset(frame, 3);
      const innerPane = inset(frame, 7);
      return (
        <g>
          <GlassFill r={outerPane} />
          <rect
            x={innerPane.x}
            y={innerPane.y}
            width={innerPane.w}
            height={innerPane.h}
            fill="none"
            stroke={STROKE}
            strokeWidth={DETAIL_STROKE}
            strokeDasharray="3 2"
          />
        </g>
      );
    }

    default:
      return <GlassFill r={inset(frame, 3)} />;
  }
}
