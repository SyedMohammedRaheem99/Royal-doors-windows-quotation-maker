import { WindowDiagram } from "@/components/diagram/WindowDiagram";
import { DIAGRAM_TYPES } from "@/models/schemas";

// Dev-only visual QA gallery — not linked from the app nav, not behind auth
// (proxy.ts only protects /dashboard, /quotations, /customers, /rates,
// /settings). Renders every diagram type at a few aspect ratios so a broken
// layout is obvious at a glance instead of found later on a real quotation.
const ASPECTS: Array<{ label: string; w: number; h: number }> = [
  { label: "square-ish 4x4", w: 4, h: 4 },
  { label: "wide 8x3", w: 8, h: 3 },
  { label: "tall 3x7 (door)", w: 3, h: 7 },
  { label: "small 2x2", w: 2, h: 2 },
];

export default function DiagramGalleryPage() {
  return (
    <div className="min-h-screen bg-neutral-100 p-8">
      <h1 className="mb-6 text-xl font-semibold">Diagram gallery — {DIAGRAM_TYPES.length} types</h1>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {DIAGRAM_TYPES.map((type) =>
          ASPECTS.map((aspect) => (
            <div key={`${type}-${aspect.label}`} className="rounded border border-neutral-300 bg-white p-3">
              <p className="mb-1 text-xs font-medium text-neutral-700">{type}</p>
              <p className="mb-2 text-[10px] text-neutral-400">{aspect.label}</p>
              <WindowDiagram
                type={type}
                widthFt={aspect.w}
                heightFt={aspect.h}
                fanPoint={type === "ventilator"}
                className="h-auto w-full"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
