import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-1 h-6 w-28" />
      <Skeleton className="mb-6 h-4 w-96" />
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
