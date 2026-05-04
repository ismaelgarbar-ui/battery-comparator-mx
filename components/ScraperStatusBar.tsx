"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, Clock, Database, RefreshCw } from "lucide-react";

interface ScraperLog {
  ejecutado_at: string;
  tienda: string;
  status: string;
  productos: number;
  mensaje: string | null;
}

interface ScraperStatusData {
  lastLog: ScraperLog | null;
  totalProducts: number;
  isRunning: boolean;
  recentLogs: ScraperLog[];
}

const AUTOZONE_TOTAL = 132; // productos esperados (~6 páginas x 24)

export default function ScraperStatusBar({ isScraperRunning }: { isScraperRunning: boolean }) {
  const [data, setData] = useState<ScraperStatusData | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchStatus = useCallback(() => {
    fetch("/api/scraper-status")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll cada 15s mientras el scraper está corriendo
  useEffect(() => {
    if (!isScraperRunning) return;
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [isScraperRunning, fetchStatus]);

  if (!data) return null;

  const { lastLog, totalProducts, recentLogs } = data;
  const pct = Math.min(100, Math.round((totalProducts / AUTOZONE_TOTAL) * 100));
  const lastUpdate = lastLog?.ejecutado_at
    ? new Date(lastLog.ejecutado_at).toLocaleDateString("es-MX", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;

  const statusColor =
    isScraperRunning ? "border-blue-200 bg-blue-50"
    : lastLog?.status === "error" ? "border-red-200 bg-red-50"
    : "border-slate-200 bg-white";

  return (
    <div className={`rounded-xl border ${statusColor} shadow-sm overflow-hidden`}>
      {/* Fila principal */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-3">
        {/* Icono de estado */}
        <div className="flex items-center gap-2 shrink-0">
          {isScraperRunning ? (
            <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : lastLog?.status === "error" ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : lastLog?.status === "success" ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <Clock className="w-4 h-4 text-slate-400" />
          )}
          <span className={`text-xs font-semibold ${isScraperRunning ? "text-blue-600" : lastLog?.status === "error" ? "text-red-600" : "text-slate-600"}`}>
            {isScraperRunning ? "Scraper en curso…"
              : lastLog?.status === "error" ? "Error en último scrape"
              : lastLog?.status === "success" ? "Último scrape exitoso"
              : "Sin scrapes recientes"}
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Productos en BD */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold">{totalProducts}</span>
          <span className="text-slate-400">/ {AUTOZONE_TOTAL} productos AutoZone</span>
        </div>

        {/* Barra de progreso */}
        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct >= 100 ? "bg-green-500" : isScraperRunning ? "bg-blue-400" : "bg-blue-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-slate-500 w-8 text-right">{pct}%</span>
        </div>

        {/* Última actualización */}
        {lastUpdate && (
          <>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <span className="text-xs text-slate-400 shrink-0">
              Actualizado: {lastUpdate}
            </span>
          </>
        )}

        {/* Botón historial */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          {expanded ? "Ocultar" : "Historial"}
        </button>
      </div>

      {/* Barra de progreso animada cuando corre */}
      {isScraperRunning && (
        <div className="h-0.5 bg-blue-100 overflow-hidden">
          <div className="h-full bg-blue-400 animate-indeterminate" />
        </div>
      )}

      {/* Historial expandible */}
      {expanded && recentLogs.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Historial de scrapes</p>
          {recentLogs.map((log, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-slate-600">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                log.status === "success" ? "bg-green-500"
                : log.status === "error" ? "bg-red-500"
                : "bg-blue-400"
              }`} />
              <span className="text-slate-400 shrink-0">
                {new Date(log.ejecutado_at).toLocaleDateString("es-MX", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <span className="font-medium capitalize">{log.tienda}</span>
              <span className={log.status === "error" ? "text-red-500" : "text-green-600"}>
                {log.status === "success" ? `✓ ${log.productos} productos` : `✗ ${log.mensaje ?? "error"}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
