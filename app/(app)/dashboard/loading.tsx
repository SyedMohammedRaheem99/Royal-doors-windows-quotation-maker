import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-1 h-6 w-56" />
      <Skeleton className="mb-6 h-4 w-72" />
      <div className="mb-6 grid grid-cols-4 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="grid grid-cols-3 gap-6">
        <Skeleton className="col-span-2 h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
