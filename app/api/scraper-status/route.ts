import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  const supabase = getSupabase();

  const [{ data: logs }, { data: counts }] = await Promise.all([
    supabase
      .from("scraping_logs")
      .select("ejecutado_at, tienda, status, productos, mensaje")
      .order("ejecutado_at", { ascending: false })
      .limit(10),
    supabase
      .from("baterias_actuales")
      .select("tienda")
      .eq("tienda", "autozone")
      .limit(500),
  ]);

  const lastLog = logs?.[0] ?? null;
  const totalProducts = counts?.length ?? 0;

  // Detectar si hay un scrape en curso (log reciente sin completar o muy reciente)
  const isRunning =
    lastLog?.status === "running" ||
    (lastLog &&
      lastLog.status === "success" &&
      Date.now() - new Date(lastLog.ejecutado_at).getTime() < 60_000);

  return NextResponse.json({
    lastLog,
    totalProducts,
    isRunning,
    recentLogs: logs ?? [],
  });
}
