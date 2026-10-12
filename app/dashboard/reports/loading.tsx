import { ListRowSkeleton } from "@/components/Loading";

export default function ReportsLoading() {
  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow">Archive</div>
        <h1 className="text-3xl font-semibold">Reports</h1>
        <div className="mt-4">
          <div className="shimmer rounded" style={{ width: 240, height: 14 }} />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}