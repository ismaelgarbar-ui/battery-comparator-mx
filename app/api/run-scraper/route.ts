import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Dispara el workflow de GitHub Actions manualmente (workflow_dispatch)
export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "ismaelgarbar-ui/battery-comparator-mx";

  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN no configurado en variables de entorno" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/scraper.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );

    if (res.status === 204) {
      // 204 = workflow disparado correctamente
      return NextResponse.json({
        success: true,
        results: {
          message: "Scraper iniciado en GitHub Actions. Los resultados estarán disponibles en ~3 minutos.",
        },
      });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: data?.message ?? `GitHub API error: ${res.status}` },
      { status: res.status }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
