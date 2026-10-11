"use client";

interface Point {
  date: string;
  views: number;
  leads: number;
}

export function ViewsChart({ data }: { data: Point[] }) {
  if (data.length === 0) return <div className="py-10 text-center text-sm text-navy-400">No data yet</div>;

  const max = Math.max(1, ...data.map((d) => Math.max(d.views, d.leads)));
  const width = 720;
  const height = 220;
  const padX = 32;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = innerW / Math.max(1, data.length - 1);

  const points = (key: "views" | "leads") =>
    data
      .map((d, i) => `${padX + i * stepX},${padY + innerH - (d[key] / max) * innerH}`)
      .join(" ");

  const area = (key: "views" | "leads") =>
    `${padX},${padY + innerH} ${points(key)} ${padX + (data.length - 1) * stepX},${padY + innerH}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Views and leads over time">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padX} x2={width - padX} y1={padY + innerH - f * innerH} y2={padY + innerH - f * innerH} stroke="#e9edf5" strokeWidth="1" />
      ))}
      <polygon points={area("views")} fill="rgba(124,58,237,0.10)" />
      <polyline points={points("views")} fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polygon points={area("leads")} fill="rgba(16,185,129,0.06)" />
      <polyline points={points("leads")} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function DonutChart({ parts }: { parts: { label: string; count: number }[] }) {
  const total = parts.reduce((a, b) => a + b.count, 0);
  const colors = ["#7C3AED", "#10b981", "#f59e0b", "#0ea5e9", "#ec4899", "#8b5cf6", "#64748b"];
  if (total === 0) return <div className="py-8 text-center text-sm text-navy-400">No data yet</div>;

  const size = 160;
  const r = 56;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const segments = parts.map((p, i) => {
    const before = parts.slice(0, i).reduce((s, q) => s + q.count, 0);
    return { dash: (p.count / total) * c, offset: -((before / total) * c) };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e9edf5" strokeWidth="18" />
        {parts.map((p, i) => (
          <circle
            key={p.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth="18"
            strokeDasharray={`${segments[i].dash} ${c - segments[i].dash}`}
            strokeDashoffset={segments[i].offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2 text-navy-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
            {p.label} <span className="ml-auto pl-3 font-medium text-navy-900">{Math.round((p.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}