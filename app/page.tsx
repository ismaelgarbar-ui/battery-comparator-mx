"use client";

import { useCallback, useEffect, useState, useTransition, useRef } from "react";
import { Battery, BatteryFilters } from "@/types/battery";
import FilterBar from "@/components/FilterBar";
import BatteryCard from "@/components/BatteryCard";
import ScraperStatusBar from "@/components/ScraperStatusBar";
import { RefreshCw, AlertCircle, BatteryFull, Play, CheckCircle } from "lucide-react";

const DEFAULT_FILTERS: BatteryFilters = {
  gama: "todas",
  precio_max: null,
  sort_by: "precio_asc",
  search: "",
};

type ScraperStatus = "idle" | "running" | "done" | "error";

export default function HomePage() {
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [filters, setFilters] = useState<BatteryFilters>(DEFAULT_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus>("idle");
  const [scraperMsg, setScraperMsg] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBatteries = useCallback((f: BatteryFilters) => {
    setError(null);
    const params = new URLSearchParams();
    if (f.gama !== "todas") params.set("gama", f.gama);
    if (f.precio_max) params.set("precio_max", f.precio_max.toString());
    if (f.search) params.set("search", f.search);
    params.set("sort_by", f.sort_by);

    setIsLoading(true);
    fetch(`/api/batteries?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { setBatteries(data); setIsLoading(false); })
      .catch((err) => { setError(err.message ?? "Error al cargar datos"); setIsLoading(false); });
  }, []);

  useEffect(() => { fetchBatteries(filters); }, []);

  const handleFilterChange = (newFilters: BatteryFilters) => {
    // Debounce solo el buscador de texto
    if (newFilters.search !== filters.search) {
      setFilters(newFilters);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        startTransition(() => fetchBatteries(newFilters));
      }, 350);
    } else {
      setFilters(newFilters);
      startTransition(() => fetchBatteries(newFilters));
    }
  };

  const handleRunScraper = async () => {
    setScraperStatus("running");
    setScraperMsg(null);
    try {
      const res = await fetch("/api/run-scraper", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setScraperStatus("error");
        setScraperMsg(data.error ?? "Error al iniciar el scraper.");
        setTimeout(() => { setScraperStatus("idle"); setScraperMsg(null); }, 5000);
        return;
      }
      setScraperStatus("done");
      setScraperMsg(data.results?.message ?? "Scraper iniciado en GitHub Actions (~3 min).");
      setTimeout(() => { setScraperStatus("idle"); setScraperMsg(null); }, 8000);
    } catch {
      setScraperStatus("error");
      setScraperMsg("No se pudo conectar con el servidor.");
      setTimeout(() => { setScraperStatus("idle"); setScraperMsg(null); }, 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Baterías AutoZone México
        </h2>
        <p className="text-slate-500 max-w-xl mx-auto">
          Precios actualizados directamente desde AutoZone MX. Busca por nombre, grupo BCI o marca.
        </p>
      </div>

      {/* Scraper status */}
      <ScraperStatusBar isScraperRunning={scraperStatus === "running"} />

      {/* Filtros + buscador */}
      <FilterBar filters={filters} onChange={handleFilterChange} totalCount={batteries.length} />

      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleRunScraper}
            disabled={scraperStatus === "running"}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm
              ${scraperStatus === "running" ? "bg-blue-400 text-white cursor-not-allowed"
              : scraperStatus === "done" ? "bg-green-500 hover:bg-green-600 text-white"
              : scraperStatus === "error" ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"}`}
          >
            {scraperStatus === "running" ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>Iniciando scraper...</>
            ) : scraperStatus === "done" ? (
              <><CheckCircle className="w-4 h-4" />Scraper iniciado</>
            ) : scraperStatus === "error" ? (
              <><AlertCircle className="w-4 h-4" />Error — reintentar</>
            ) : (
              <><Play className="w-4 h-4" />Correr scraper ahora</>
            )}
          </button>

          {scraperStatus === "running" && (
            <div className="w-48 h-1 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-indeterminate" />
            </div>
          )}
          {scraperMsg && (
            <p className={`text-xs max-w-xs ${scraperStatus === "done" ? "text-green-600" : "text-red-500"}`}>
              {scraperMsg}
            </p>
          )}
        </div>

        <button
          onClick={() => fetchBatteries(filters)}
          disabled={isLoading || isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading || isPending ? "animate-spin" : ""}`} />
          Actualizar datos
        </button>
      </div>

      {/* Banner scraper corriendo */}
      {scraperStatus === "running" && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700">
          <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
          <div>
            <p className="font-semibold text-sm">Scraper iniciado en GitHub Actions</p>
            <p className="text-xs text-blue-500 mt-0.5">Tomará ~3 minutos. Pulsa "Actualizar datos" cuando termine.</p>
          </div>
        </div>
      )}

      {/* Error de carga */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Error al cargar datos</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 animate-pulse">
              <div className="flex gap-2"><div className="h-6 w-20 bg-slate-100 rounded-full" /><div className="h-6 w-16 bg-slate-100 rounded-full" /></div>
              <div className="h-28 bg-slate-100 rounded-lg" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-10 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !error && batteries.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}>
          {batteries.map((battery) => (
            <BatteryCard key={battery.id} battery={battery} />
          ))}
        </div>
      )}

      {/* Vacío */}
      {!isLoading && !error && batteries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <BatteryFull className="w-16 h-16 opacity-30" />
          <div className="text-center">
            <p className="font-semibold text-slate-600">Sin resultados</p>
            <p className="text-sm mt-1">
              {filters.search || filters.gama !== "todas" || filters.precio_max
                ? "Prueba cambiando los filtros o el buscador"
                : 'Pulsa "Correr scraper ahora" para obtener los primeros datos.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
