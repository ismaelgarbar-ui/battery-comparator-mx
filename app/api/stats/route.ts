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

  const [{ data: counts }, { data: lastLog }] = await Promise.all([
    supabase
      .from("baterias_actuales")
      .select("tienda")
      .limit(1000),
    supabase
      .from("scraping_logs")
      .select("ejecutado_at, tienda, status, productos")
      .order("ejecutado_at", { ascending: false })
      .limit(6),
  ]);

  const byStore: Record<string, number> = {};
  for (const row of counts ?? []) {
    byStore[row.tienda] = (byStore[row.tienda] ?? 0) + 1;
  }

  return NextResponse.json(
    { byStore, lastLog },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
