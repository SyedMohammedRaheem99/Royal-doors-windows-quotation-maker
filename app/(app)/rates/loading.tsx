import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-1 h-6 w-32" />
      <Skeleton className="mb-6 h-4 w-96" />
      <div className="space-y-6">
        <TableSkeleton rows={5} columns={4} />
        <TableSkeleton rows={4} columns={4} />
      </div>
    </div>
  );
}
