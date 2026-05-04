import { Battery } from "@/types/battery";
import StoreBadge from "./StoreBadge";
import GradeBadge from "./GradeBadge";
import { ExternalLink, Zap, Shield, Tag } from "lucide-react";

export default function BatteryCard({ battery }: { battery: Battery }) {
  const hasDiscount =
    battery.precio_original && battery.precio_original > battery.precio;
  const discountPct = hasDiscount
    ? Math.round(
        ((battery.precio_original! - battery.precio) /
          battery.precio_original!) *
          100
      )
    : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <StoreBadge store={battery.tienda} />
        <GradeBadge grade={battery.gama} />
      </div>

      {/* Imagen */}
      {battery.imagen_url && (
        <div className="flex justify-center h-28 overflow-hidden">
          <img
            src={battery.imagen_url}
            alt={battery.nombre}
            className="object-contain h-full"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Nombre */}
      <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
        {battery.nombre}
      </h3>

      {/* Specs */}
      <div className="flex flex-wrap gap-2">
        {battery.amperaje && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Zap className="w-3 h-3" />
            {battery.amperaje} CCA
          </span>
        )}
        {battery.grupo && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Tag className="w-3 h-3" />
            Grupo {battery.grupo}
          </span>
        )}
        {battery.garantia_meses && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Shield className="w-3 h-3" />
            {battery.garantia_meses >= 12
              ? `${battery.garantia_meses / 12} año${battery.garantia_meses / 12 > 1 ? "s" : ""}`
              : `${battery.garantia_meses} meses`}
          </span>
        )}
      </div>

      {/* Precio */}
      <div className="mt-auto">
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-slate-900">
            ${battery.precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </span>
          {hasDiscount && (
            <span className="text-sm text-slate-400 line-through mb-0.5">
              ${battery.precio_original!.toLocaleString("es-MX")}
            </span>
          )}
        </div>
        {hasDiscount && (
          <span className="inline-block mt-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
            -{discountPct}% descuento
          </span>
        )}
      </div>

      {/* CTA */}
      <a
        href={battery.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 mt-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Ver en tienda
        <ExternalLink className="w-3.5 h-3.5" />
      </a>

      <p className="text-center text-xs text-slate-400">
        Actualizado{" "}
        {new Date(battery.scraped_at).toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
