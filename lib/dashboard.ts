import { ObjectId } from "mongodb";
import { quotations as quotationsCollection, users as usersCollection } from "./collections";
import { isAdminTier, ownershipFilter, type Actor } from "./authz";
import type { QuotationStatus } from "@/models/schemas";

export interface DashboardStats {
  thisMonth: { count: number; value: number };
  pipeline: { count: number; value: number }; // status: sent, awaiting a decision
  conversion: { approved: number; lost: number; rate: number | null }; // approved / (approved + lost)
  recentActivity: Array<{
    id: string;
    quoteNo: string;
    revision: number;
    customerName: string;
    status: QuotationStatus;
    updatedAt: Date;
    grandTotal: number;
  }>;
  topProducts: Array<{ description: string; totalValue: number; count: number }>;
  staleQuotations: Array<{ id: string; quoteNo: string; customerName: string; daysSinceUpdate: number }>;
  /** Admin only — per salesperson breakdown. */
  repBreakdown?: Array<{ userId: string; name: string; count: number; value: number }>;
}

const STALE_AFTER_DAYS = 7;

export async function getDashboardStats(actor: Actor): Promise<DashboardStats> {
  const col = await quotationsCollection();
  const ownership = ownershipFilter(actor);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - STALE_AFTER_DAYS);

  const [thisMonthAgg, pipelineAgg, approvedCount, lostCount, recentDocs, topProductsAgg, staleDocs, repBreakdown] =
    await Promise.all([
      col
        .aggregate([
          { $match: { ...ownership, createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$totals.grandTotal" } } },
        ])
        .toArray(),

      col
        .aggregate([
          { $match: { ...ownership, status: "sent" } },
          { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$totals.grandTotal" } } },
        ])
        .toArray(),

      col.countDocuments({ ...ownership, status: "approved" }),
      col.countDocuments({ ...ownership, status: "lost" }),

      col
        .find(ownership)
        .sort({ updatedAt: -1 })
        .limit(8)
        .toArray(),

      col
        .aggregate([
          { $match: ownership },
          { $unwind: "$items" },
          { $group: { _id: "$items.description", totalValue: { $sum: "$items.amount" }, count: { $sum: 1 } } },
          { $sort: { totalValue: -1 } },
          { $limit: 5 },
        ])
        .toArray(),

      col
        .find({ ...ownership, status: "sent", updatedAt: { $lte: staleThreshold } })
        .sort({ updatedAt: 1 })
        .limit(10)
        .toArray(),

      isAdminTier(actor)
        ? col
            .aggregate([
              // Previously had no $match stage at all — it silently scanned
              // every quotation ever created, not just this actor's. That was
              // harmless only because the old 2-role admin's ownershipFilter
              // also returned {}; it is NOT harmless now that a plain admin
              // is scoped to "own + managed workers'", so this must be scoped
              // the same way as every other query in this function.
              { $match: ownership },
              { $group: { _id: "$createdBy", count: { $sum: 1 }, value: { $sum: "$totals.grandTotal" } } },
              { $sort: { value: -1 } },
            ])
            .toArray()
        : Promise.resolve(null),
    ]);

  const now = Date.now();

  let repBreakdownResult: DashboardStats["repBreakdown"];
  if (repBreakdown) {
    const usersCol = await usersCollection();
    // Scoped to the same id set the breakdown itself covers, rather than the
    // whole users collection — an admin's repBreakdown should only resolve
    // names for themself and the workers they manage.
    const repIds = repBreakdown.map((r) => String(r._id)).filter((id) => ObjectId.isValid(id));
    const allUsers = await usersCol.find({ _id: { $in: repIds.map((id) => new ObjectId(id)) } }).toArray();
    const nameById = new Map(allUsers.map((u) => [u._id.toString(), u.name]));
    repBreakdownResult = repBreakdown.map((r) => ({
      userId: String(r._id),
      name: nameById.get(String(r._id)) ?? "Unknown",
      count: r.count,
      value: r.value,
    }));
  }

  const approved = approvedCount;
  const lost = lostCount;

  return {
    thisMonth: { count: thisMonthAgg[0]?.count ?? 0, value: thisMonthAgg[0]?.value ?? 0 },
    pipeline: { count: pipelineAgg[0]?.count ?? 0, value: pipelineAgg[0]?.value ?? 0 },
    conversion: {
      approved,
      lost,
      rate: approved + lost > 0 ? approved / (approved + lost) : null,
    },
    recentActivity: recentDocs.map((q) => ({
      id: q._id.toString(),
      quoteNo: q.quoteNo,
      revision: q.revision,
      customerName: q.customer.name,
      status: q.status,
      updatedAt: q.updatedAt ?? q.createdAt ?? q.date,
      grandTotal: q.totals.grandTotal,
    })),
    topProducts: topProductsAgg.map((p) => ({
      description: p._id ?? "(unnamed item)",
      totalValue: p.totalValue,
      count: p.count,
    })),
    staleQuotations: staleDocs.map((q) => ({
      id: q._id.toString(),
      quoteNo: q.quoteNo,
      customerName: q.customer.name,
      daysSinceUpdate: Math.floor((now - new Date(q.updatedAt ?? q.createdAt ?? q.date).getTime()) / 86400000),
    })),
    repBreakdown: repBreakdownResult,
  };
}
