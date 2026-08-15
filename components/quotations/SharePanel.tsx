"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
// Imported from lib/shareLinks, NOT lib/sharing — the latter imports
// MongoDB, which a "use client" component must never pull in.
import { whatsappUrl } from "@/lib/shareLinks";

export interface SharePanelState {
  token: string;
  expiresAt: string;
  viewCount: number;
  lastViewedAt?: string;
}

export function SharePanel({
  share,
  customerName,
  customerPhone,
  quoteNo,
  grandTotal,
  companyName,
  onCreate,
  onRevoke,
}: {
  share: SharePanelState | null;
  customerName: string;
  customerPhone: string;
  quoteNo: string;
  grandTotal: number;
  companyName: string;
  onCreate: () => Promise<{ token: string } | { error: string }>;
  onRevoke: () => Promise<{ ok: true } | { error: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  // Built in the browser so the link always matches the host the user is
  // actually on — localhost during a demo, the real domain in production —
  // without needing an env var that could drift.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = share ? `${origin}/share/${share.token}` : "";

  function handleCreate() {
    startTransition(async () => {
      try {
        const result = await onCreate();
        if ("error" in result) toast.error(result.error);
        else toast.success("Share link created.");
      } catch {
        toast.error("Couldn't create the link. Check your connection and try again.");
      }
    });
  }

  function handleRevoke() {
    if (!window.confirm("Revoke this link? Anyone who already has it will lose access immediately.")) return;
    startTransition(async () => {
      try {
        const result = await onRevoke();
        if ("error" in result) toast.error(result.error);
        else toast.success("Share link revoked.");
      } catch {
        toast.error("Couldn't revoke the link. Check your connection and try again.");
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  const waHref = whatsappUrl({
    phone: customerPhone,
    customerName,
    quoteNo,
    grandTotal,
    link,
    companyName,
  });

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-neutral-700">Share with customer</h2>
        {share && (
          <button type="button" onClick={handleRevoke} disabled={pending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
            Revoke link
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        {!share ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-neutral-500">
              Create a private link the customer can open on their phone — no login needed.
            </p>
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending}
              className="shrink-0 rounded bg-[#0f3d2e] px-3 py-1.5 text-xs font-medium text-[#c9a227] disabled:opacity-50 hover:bg-[#0c3125]"
            >
              {pending ? "Creating..." : "Create share link"}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded border border-neutral-300 bg-neutral-50 px-2 py-1.5 font-mono text-xs text-neutral-600"
              />
              <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1da851]"
              >
                Send on WhatsApp
              </a>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500">
              <span>
                Expires {new Date(share.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              <span>
                {share.viewCount === 0 ? (
                  <span className="text-amber-700">Not opened yet</span>
                ) : (
                  <span className="text-green-700">
                    Opened {share.viewCount} time{share.viewCount === 1 ? "" : "s"}
                    {share.lastViewedAt && ` · last ${new Date(share.lastViewedAt).toLocaleDateString("en-IN")}`}
                  </span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
