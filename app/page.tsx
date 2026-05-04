"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Battery, BatteryFilters } from "@/types/battery";
import FilterBar from "@/components/FilterBar";
import BatteryCard from "@/components/BatteryCard";
import StatsBar from "@/components/StatsBar";
import { RefreshCw, AlertCircle, BatteryFull } from "lucide-react";

const DEFAULT_FILTERS: BatteryFilters = {
  tienda: "todas",
  gama: "todas",
  amperaje_min: null,
  amperaje_max: null,
  precio_max: null,
  sort_by: "precio_asc",
};

export default function HomePage() {
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [filters, setFilters] = useState<BatteryFilters>(DEFAULT_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const fetchBatteries = useCallback(
    (f: BatteryFilters) => {
      setError(null);
      const params = new URLSearchParams();
      if (f.tienda !== "todas") params.set("tienda", f.tienda);
      if (f.gama !== "todas") params.set("gama", f.gama);
      if (f.precio_max) params.set("precio_max", f.precio_max.toString());
      params.set("sort_by", f.sort_by);

      setIsLoading(true);
      fetch(`/api/batteries?${params}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => {
          setBatteries(data);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err.message ?? "Error al cargar datos");
          setIsLoading(false);
        });
    },
    []
  );

  useEffect(() => {
    fetchBatteries(filters);
  }, []);

  const handleFilterChange = (newFilters: BatteryFilters) => {
    setFilters(newFilters);
    startTransition(() => {
      fetchBatteries(newFilters);
    });
  };

  const handleRefresh = () => {
    fetchBatteries(filters);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Compara baterías de auto en México
        </h2>
        <p className="text-slate-500 max-w-xl mx-auto">
          Precios actualizados automáticamente de O&apos;Reilly, AutoZone y LTH.
          Encuentra la mejor batería para tu auto al mejor precio.
        </p>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* Filtros */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        totalCount={batteries.length}
      />

      {/* Botón refresh */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={isLoading || isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${isLoading || isPending ? "animate-spin" : ""}`}
          />
          Actualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Error al cargar datos</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 animate-pulse"
            >
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-slate-100 rounded-full" />
                <div className="h-6 w-16 bg-slate-100 rounded-full" />
              </div>
              <div className="h-28 bg-slate-100 rounded-lg" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-8 bg-slate-100 rounded-lg" />
              <div className="h-10 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Grid de baterías */}
      {!isLoading && !error && batteries.length > 0 && (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}
        >
          {batteries.map((battery) => (
            <BatteryCard key={battery.id} battery={battery} />
          ))}
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && !error && batteries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <BatteryFull className="w-16 h-16 opacity-30" />
          <div className="text-center">
            <p className="font-semibold text-slate-600">Sin resultados</p>
            <p className="text-sm mt-1">
              {filters.tienda !== "todas" ||
              filters.gama !== "todas" ||
              filters.precio_max
                ? "Prueba cambiando los filtros"
                : "El scraper aún no ha ejecutado. Dispara la Edge Function manualmente desde Supabase."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
