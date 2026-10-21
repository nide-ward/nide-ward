/** Loading placeholders shown instantly on navigation while a page's data streams in. */

function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded-xl bg-surface-muted motion-safe:animate-pulse ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading">
      <Block className="h-8 w-48" />
      <Block className="h-4 w-80 max-w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Block key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading patient chart">
      <Block className="h-8 w-64" />
      <Block className="h-11 w-full max-w-xl" />
      <Block className="h-56" />
      <Block className="h-40" />
    </div>
  );
}
