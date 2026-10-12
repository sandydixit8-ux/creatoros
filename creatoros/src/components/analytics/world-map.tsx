"use client";

import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries from "world-countries";
import worldData from "world-atlas/countries-110m.json";

export interface MapRow {
  country: string;
  name: string;
  visitors: number;
  share: number;
}

// ISO alpha-2 -> [longitude, latitude] centroid, built once from a maintained
// country dataset. Only used to place traffic bubbles on the outline; a country
// with no centroid simply has no bubble.
const CENTROIDS: Record<string, [number, number]> = {};
for (const c of countries) {
  if (c.cca2 && Array.isArray(c.latlng) && c.latlng.length === 2) {
    CENTROIDS[c.cca2] = [c.latlng[1], c.latlng[0]];
  }
}

const WIDTH = 900;
const HEIGHT = 480;

export function WorldMap({ data }: { data: MapRow[] }) {
  const { outline, project } = useMemo(() => {
    const topo = worldData as unknown as { objects: { countries: unknown } };
    const collection = feature(worldData as never, topo.objects.countries as never) as unknown as GeoJSON.FeatureCollection;
    const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], collection);
    const path = geoPath(projection);
    return {
      outline: collection.features.map((f, i) => ({ d: path(f) ?? "", key: i })).filter((p) => p.d),
      project: (lonLat: [number, number]) => projection(lonLat),
    };
  }, []);

  const points = useMemo(() => {
    const max = Math.max(1, ...data.map((d) => d.visitors));
    return data
      .map((d) => {
        const c = CENTROIDS[d.country];
        if (!c) return null;
        const p = project(c);
        if (!p) return null;
        const intensity = d.visitors / max;
        return { ...d, x: p[0], y: p[1], r: 3 + intensity * 13, intensity };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.visitors - a.visitors);
  }, [data, project]);

  const hasData = points.length > 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Traffic by country">
        <g>
          {outline.map((p) => (
            <path key={p.key} d={p.d} fill="#1b2440" stroke="#2b3860" strokeWidth="0.5" />
          ))}
        </g>
        <g>
          {points.map((p) => (
            <g key={p.country}>
              <circle cx={p.x} cy={p.y} r={p.r} fill="rgba(139,92,246,0.28)" />
              <circle cx={p.x} cy={p.y} r={Math.max(2.5, p.r * 0.45)} fill={`rgba(34,211,238,${0.55 + p.intensity * 0.45})`} stroke="#0b1020" strokeWidth="0.75">
                <title>{`${p.name} — ${p.visitors} visitor${p.visitors === 1 ? "" : "s"} (${p.share}%)`}</title>
              </circle>
            </g>
          ))}
        </g>
      </svg>
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-navy-400">No country data in this range</div>
      )}
    </div>
  );
}
