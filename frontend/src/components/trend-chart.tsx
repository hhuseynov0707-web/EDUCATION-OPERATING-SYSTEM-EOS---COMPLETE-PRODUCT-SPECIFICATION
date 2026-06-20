'use client';

/**
 * Tiny dependency-free line chart for percentage trends (0–100).
 * Renders an SVG polyline with dots; good enough for exam/score trends.
 */
export function TrendChart({
  points,
  labels,
  height = 120,
}: {
  points: number[];
  labels?: string[];
  height?: number;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }
  const width = 480;
  const pad = 24;
  const max = 100;
  const min = 0;
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const scaleY = (v: number) => height - pad - ((v - min) / (max - min)) * (height - pad * 2);

  const coords = points.map((p, i) => ({ x: pad + i * stepX, y: scaleY(p) }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={pad} x2={width - pad} y1={scaleY(g)} y2={scaleY(g)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={4} y={scaleY(g) + 3} fontSize={9} fill="#9ca3af">{g}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#0f172a" strokeWidth={2} />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={3} fill="#0f172a" />
          {labels?.[i] && (
            <text x={c.x} y={height - 6} fontSize={8} fill="#9ca3af" textAnchor="middle">
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
