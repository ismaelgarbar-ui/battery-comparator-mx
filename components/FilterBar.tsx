"use client";

import { BatteryFilters } from "@/types/battery";

interface FilterBarProps {
  filters: BatteryFilters;
  onChange: (filters: BatteryFilters) => void;
  totalCount: number;
}

const STORES = [
  { value: "todas", label: "Todas las tiendas" },
  { value: "oreilly", label: "O'Reilly" },
  { value: "autozone", label: "AutoZone" },
  { value: "lth", label: "LTH" },
];

const GRADES = [
  { value: "todas", label: "Todas las gamas" },
  { value: "basica", label: "Básica" },
  { value: "estandar", label: "Estándar" },
  { value: "premium", label: "Premium" },
  { value: "agm", label: "AGM" },
];

const SORT_OPTIONS = [
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
  { value: "amperaje_desc", label: "Mayor amperaje" },
  { value: "reciente", label: "Más recientes" },
];

export default function FilterBar({
  filters,
  onChange,
  totalCount,
}: FilterBarProps) {
  const set = <K extends keyof BatteryFilters>(key: K, value: BatteryFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const selectClass =
    "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Tienda */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Tienda
          </label>
          <select
            className={selectClass}
            value={filters.tienda}
            onChange={(e) => set("tienda", e.target.value as BatteryFilters["tienda"])}
          >
            {STORES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Gama */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Gama
          </label>
          <select
            className={selectClass}
            value={filters.gama}
            onChange={(e) => set("gama", e.target.value as BatteryFilters["gama"])}
          >
            {GRADES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        {/* Precio máximo */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Precio máximo (MXN)
          </label>
          <input
            type="number"
            className={selectClass}
            placeholder="Sin límite"
            min={0}
            step={100}
            value={filters.precio_max ?? ""}
            onChange={(e) =>
              set("precio_max", e.target.value ? parseFloat(e.target.value) : null)
            }
          />
        </div>

        {/* Ordenar */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Ordenar por
          </label>
          <select
            className={selectClass}
            value={filters.sort_by}
            onChange={(e) => set("sort_by", e.target.value as BatteryFilters["sort_by"])}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resultado count */}
      <p className="mt-3 text-xs text-slate-400">
        {totalCount === 0
          ? "Sin resultados con estos filtros"
          : `${totalCount} bater${totalCount === 1 ? "ía" : "ías"} encontradas`}
      </p>
    </div>
  );
}
