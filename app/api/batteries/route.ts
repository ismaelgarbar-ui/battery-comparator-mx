import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const tienda = searchParams.get("tienda");
  const gama = searchParams.get("gama");
  const precio_max = searchParams.get("precio_max");
  const sort_by = searchParams.get("sort_by") ?? "precio_asc";

  const supabase = getSupabase();
  let query = supabase.from("baterias_actuales").select("*");

  if (tienda && tienda !== "todas") query = query.eq("tienda", tienda);
  if (gama && gama !== "todas") query = query.eq("gama", gama);
  if (precio_max) query = query.lte("precio", parseFloat(precio_max));

  switch (sort_by) {
    case "precio_desc":
      query = query.order("precio", { ascending: false });
      break;
    case "amperaje_desc":
      query = query.order("amperaje", { ascending: false, nullsFirst: false });
      break;
    case "reciente":
      query = query.order("scraped_at", { ascending: false });
      break;
    default:
      query = query.order("precio", { ascending: true });
  }

  query = query.limit(200);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
