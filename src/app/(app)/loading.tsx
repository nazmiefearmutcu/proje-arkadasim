export default function Loading() {
  return (
    <div role="status" aria-label="Yükleniyor" className="flex flex-col gap-3 pt-2">
      <div className="h-8 w-2/3 animate-pulse rounded-control bg-surface-2" />
      <div className="h-4 w-full animate-pulse rounded-control bg-surface-2" />
      <div className="h-4 w-5/6 animate-pulse rounded-control bg-surface-2" />
      <div className="mt-4 h-32 animate-pulse rounded-card bg-surface-2" />
      <div className="h-32 animate-pulse rounded-card bg-surface-2" />
    </div>
  );
}
