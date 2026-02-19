"use client";

interface StateBottleneck {
  stateId: string;
  caseCount: number;
}

export default function BottleneckChart({
  bottlenecks,
}: {
  bottlenecks: StateBottleneck[];
}) {
  if (bottlenecks.length === 0) {
    return (
      <p className="text-sm text-govuk-dark-grey italic">
        No active cases stuck at any state.
      </p>
    );
  }

  const maxCount = Math.max(...bottlenecks.map((b) => b.caseCount));

  return (
    <div className="space-y-2">
      {bottlenecks.map((b) => (
        <div key={b.stateId} className="flex items-center gap-3">
          <span className="text-xs font-mono w-48 truncate text-right">
            {b.stateId}
          </span>
          <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
            <div
              className="h-full bg-govuk-blue rounded transition-all"
              style={{
                width: `${maxCount > 0 ? (b.caseCount / maxCount) * 100 : 0}%`,
                minWidth: b.caseCount > 0 ? "1.5rem" : 0,
              }}
            />
          </div>
          <span className="text-sm font-bold w-8 text-right">
            {b.caseCount}
          </span>
        </div>
      ))}
    </div>
  );
}
