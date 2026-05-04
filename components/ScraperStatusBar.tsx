"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

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
  recentLogs: ScraperLog[];
}

export default function ScraperStatusBar({ isScraperRunning }: { isScraperRunning: boolean }) {
  const [data, setData] = useState<ScraperStatusData | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchStatus = useCallback(() => {
    fetch("/api/scraper-status")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (!isScraperRunning) return;
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [isScraperRunning, fetchStatus]);

  if (!data) return null;

  const { lastLog, totalProducts, recentLogs } = data;

  const lastUpdate = lastLog?.ejecutado_at
    ? new Date(lastLog.ejecutado_at).toLocaleDateString("es-MX", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">

        {/* Estado del scraper */}
        <div className="flex items-center gap-2 shrink-0">
          {isScraperRunning ? (
            <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : lastLog?.status === "error" ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : lastLog?.status === "success" ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <Clock className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-sm font-medium text-slate-700">
            {isScraperRunning ? "Scraper corriendo…"
              : lastLog?.status === "error" ? "Error en último scrape"
              : "AutoZone"}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Contador */}
        <span className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{totalProducts}</span>
          <span className="text-slate-400"> productos en BD</span>
        </span>

        {/* Última actualización */}
        {lastUpdate && (
          <>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <span className="text-xs text-slate-400">
              Actualizado: <span className="text-slate-500">{lastUpdate}</span>
            </span>
          </>
        )}

        {/* Botón historial */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Historial
        </button>
      </div>

      {/* Barra animada mientras corre */}
      {isScraperRunning && (
        <div className="h-0.5 bg-blue-100 overflow-hidden">
          <div className="h-full bg-blue-400 animate-indeterminate" />
        </div>
      )}

      {/* Historial expandible */}
      {expanded && recentLogs.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Historial de scrapes</p>
          {recentLogs.map((log, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-slate-600">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                log.status === "success" ? "bg-green-400" : "bg-red-400"
              }`} />
              <span className="text-slate-400 shrink-0 w-28">
                {new Date(log.ejecutado_at).toLocaleDateString("es-MX", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <span className={log.status === "error" ? "text-red-500" : "text-green-600"}>
                {log.status === "success"
                  ? `${log.productos} productos guardados`
                  : log.mensaje ?? "error desconocido"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
