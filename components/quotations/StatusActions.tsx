"use client";

import { useState, useTransition } from "react";
import { STATUS_TRANSITIONS, type QuotationStatus } from "@/models/schemas";

const LABELS: Partial<Record<QuotationStatus, string>> = {
  sent: "Mark as sent",
  approved: "Mark approved",
  lost: "Mark lost",
  draft: "Back to draft",
};

const BUTTON_STYLES: Partial<Record<QuotationStatus, string>> = {
  sent: "bg-blue-600 text-white hover:bg-blue-700",
  approved: "bg-green-600 text-white hover:bg-green-700",
  lost: "border border-red-300 text-red-700 hover:bg-red-50",
  draft: "border border-neutral-300 text-neutral-700 hover:bg-neutral-50",
};

export function StatusActions({
  status,
  onChange,
}: {
  status: QuotationStatus;
  onChange: (to: QuotationStatus) => Promise<{ ok: true } | { error: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const available = STATUS_TRANSITIONS[status] ?? [];

  function handle(to: QuotationStatus) {
    setError(null);
    startTransition(async () => {
      const result = await onChange(to);
      if ("error" in result) setError(result.error);
    });
  }

  if (available.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {available.map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => handle(to)}
            className={`rounded px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
              BUTTON_STYLES[to] ?? BUTTON_STYLES.draft
            }`}
          >
            {LABELS[to] ?? to}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
