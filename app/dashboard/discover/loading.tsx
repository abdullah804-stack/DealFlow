import { ListRowSkeleton } from "@/components/Loading";

export default function DiscoverLoading() {
  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow">Pipeline</div>
        <h1 className="text-3xl font-semibold">Discover</h1>
        <div className="mt-4">
          <div className="shimmer rounded" style={{ width: 200, height: 14 }} />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}