"use client";

import { useEffect, useState } from "react";

interface Stats {
  byStore: Record<string, number>;
  lastLog: Array<{
    ejecutado_at: string;
    tienda: string;
    status: string;
    productos: number;
  }>;
}

const STORE_LABELS: Record<string, string> = {
  oreilly: "O'Reilly",
  autozone: "AutoZone",
  lth: "LTH",
};

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const lastUpdate = stats.lastLog?.[0]?.ejecutado_at;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 bg-slate-100 rounded-xl px-5 py-3 mb-6">
      <span className="font-semibold text-slate-700">Productos en BD:</span>
      {Object.entries(stats.byStore).map(([store, count]) => (
        <span key={store} className="flex items-center gap-1">
          <span className="font-medium">{STORE_LABELS[store] ?? store}</span>
          <span className="bg-white border border-slate-200 text-xs px-1.5 py-0.5 rounded font-mono">
            {count}
          </span>
        </span>
      ))}
      {lastUpdate && (
        <span className="ml-auto text-xs text-slate-400">
          Última actualización:{" "}
          {new Date(lastUpdate).toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}
