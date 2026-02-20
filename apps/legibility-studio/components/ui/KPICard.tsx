/** Deterministic sparkline from a seed string — produces 7 points */
function seededPoints(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const pts: number[] = [];
  for (let i = 0; i < 7; i++) {
    h = (h * 16807 + 0x7fffffff) & 0x7fffffff;
    pts.push((h % 100) / 100);
  }
  return pts;
}

function Sparkline({ seed }: { seed: string }) {
  const pts = seededPoints(seed);
  const w = 120;
  const h = 32;
  const padY = 4;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;

  const points = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = padY + (1 - (v - min) / range) * (h - padY * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="mt-3" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="#9ca3af"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function KPICard({
  label,
  value,
  sub,
  sparkSeed,
}: {
  label: string;
  value: string | number;
  sub?: string;
  sparkSeed?: string;
}) {
  return (
    <div>
      <div className="text-4xl font-light tracking-tight">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      {sparkSeed && <Sparkline seed={sparkSeed} />}
    </div>
  );
}
