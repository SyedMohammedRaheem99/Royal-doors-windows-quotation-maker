"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { paymentStages, summarisePayments } from "@/lib/payments";
import type { Payment, PaymentInput, PaymentMethod, PaymentScheme } from "@/models/schemas";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  online: "Online / bank transfer",
  cheque: "Cheque",
  upi: "UPI",
};

function rupees(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentsPanel({
  payments,
  grandTotal,
  scheme,
  canRecord,
  onAdd,
  onRemove,
}: {
  payments: Payment[];
  grandTotal: number;
  scheme?: PaymentScheme;
  /** False unless the quotation is approved — recording money against a draft is almost always a mistake. */
  canRecord: boolean;
  onAdd: (input: PaymentInput) => Promise<{ ok: true } | { error: string }>;
  onRemove: (paymentId: string) => Promise<{ ok: true } | { error: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("online");
  const [receivedAt, setReceivedAt] = useState(todayISO());
  const [note, setNote] = useState("");
  const toast = useToast();

  const summary = summarisePayments(payments, grandTotal);
  const stages = paymentStages(scheme, grandTotal, summary.received);

  function handleAdd() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await onAdd({ amount: parsed, method, receivedAt: new Date(receivedAt), note });
        if ("error" in result) {
          toast.error(result.error);
        } else {
          toast.success(`Recorded ${rupees(parsed)}.`);
          setAmount("");
          setNote("");
          setShowForm(false);
        }
      } catch {
        toast.error("Couldn't record the payment. Check your connection and try again.");
      }
    });
  }

  function handleRemove(paymentId: string, paymentAmount: number) {
    if (!window.confirm(`Remove the ${rupees(paymentAmount)} payment? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        const result = await onRemove(paymentId);
        if ("error" in result) toast.error(result.error);
        else toast.success("Payment removed.");
      } catch {
        toast.error("Couldn't remove the payment. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-neutral-700">Payments</h2>
        {canRecord && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded bg-[#0f3d2e] px-3 py-1.5 text-xs font-medium text-[#c9a227] hover:bg-[#0c3125]"
          >
            + Record payment
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        {/* Progress */}
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-neutral-600">
              Received <strong className="text-neutral-900">{rupees(summary.received)}</strong> of {rupees(grandTotal)}
            </span>
            {summary.overpaidBy > 0 ? (
              <span className="font-medium text-amber-700">Overpaid by {rupees(summary.overpaidBy)}</span>
            ) : summary.isFullyPaid ? (
              <span className="font-medium text-green-700">Fully paid</span>
            ) : (
              <span className="font-medium text-[#0f3d2e]">Balance {rupees(summary.balance)}</span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full ${summary.isFullyPaid ? "bg-green-600" : "bg-[#0f3d2e]"}`}
              style={{ width: `${summary.progress * 100}%` }}
            />
          </div>
        </div>

        {/* Scheme stages */}
        {stages.length > 0 && (
          <ul className="mb-3 space-y-1">
            {stages.map((stage) => (
              <li key={stage.label} className="flex items-center gap-2 text-xs">
                <span className={stage.covered ? "text-green-600" : "text-neutral-300"}>{stage.covered ? "✓" : "○"}</span>
                <span className={stage.covered ? "text-neutral-500 line-through" : "text-neutral-700"}>{stage.label}</span>
                <span className="ml-auto text-neutral-500">{rupees(stage.amount)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Add form */}
        {showForm && (
          <div className="mb-3 rounded border border-neutral-200 bg-neutral-50 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
                >
                  {Object.entries(METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Received on</label>
                <input
                  type="date"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-medium text-neutral-500">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Cheque no., reference, etc."
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]"
                />
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={handleAdd}
                className="rounded bg-[#0f3d2e] px-3 py-1.5 text-xs font-medium text-[#c9a227] disabled:opacity-50 hover:bg-[#0c3125]"
              >
                {pending ? "Saving..." : "Save payment"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Ledger */}
        {payments.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-400">
              <tr>
                <th className="py-1">Date</th>
                <th className="py-1">Method</th>
                <th className="py-1">Note</th>
                <th className="py-1 text-right">Amount</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="py-1.5 text-neutral-600">{new Date(p.receivedAt).toLocaleDateString("en-IN")}</td>
                  <td className="py-1.5 text-neutral-600">{METHOD_LABELS[p.method]}</td>
                  <td className="py-1.5 text-neutral-400">{p.note || "—"}</td>
                  <td className="py-1.5 text-right font-medium">{rupees(p.amount)}</td>
                  <td className="py-1.5 text-right">
                    {canRecord && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleRemove(p.id, p.amount)}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-2 text-sm text-neutral-400">
            {canRecord
              ? "No payments recorded yet."
              : "Payments can be recorded once this quotation is approved."}
          </p>
        )}
      </div>
    </div>
  );
}
