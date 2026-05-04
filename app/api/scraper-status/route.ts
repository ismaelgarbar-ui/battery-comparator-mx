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

  const [{ data: logs }, { count }] = await Promise.all([
    supabase
      .from("scraping_logs")
      .select("ejecutado_at, tienda, status, productos, mensaje")
      .order("ejecutado_at", { ascending: false })
      .limit(10),
    supabase
      .from("baterias_actuales")
      .select("*", { count: "exact", head: true })
      .eq("tienda", "autozone"),
  ]);

  const lastLog = logs?.[0] ?? null;
  const totalProducts = count ?? 0;

  return NextResponse.json({
    lastLog,
    totalProducts,
    recentLogs: logs ?? [],
  });
}
