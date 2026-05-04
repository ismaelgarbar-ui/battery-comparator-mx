# Comparador de Baterías MX

Compara precios de baterías de auto en **O'Reilly**, **AutoZone** y **LTH** en México. Los precios se actualizan automáticamente cada 6 horas mediante una Supabase Edge Function con pg_cron.

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS → deploy en **Vercel**
- **Base de datos**: **Supabase** (PostgreSQL)
- **Scraper**: Supabase Edge Function (Deno) + pg_cron para scheduling
- **Repositorio**: GitHub

---

## Guía de deploy paso a paso

### 1. Supabase — Crear proyecto y schema

1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto
2. En el **SQL Editor**, ejecuta el contenido de `supabase/migrations/001_initial_schema.sql`
3. Activa la extensión `pg_net` si no está activa (Dashboard → Database → Extensions)

### 2. Supabase — Deploy de la Edge Function

Instala la CLI de Supabase:
```bash
npm install -g supabase
```

Autentica y vincula el proyecto:
```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
```

Deploy de la función:
```bash
supabase functions deploy battery-scraper --no-verify-jwt
```

Prueba manual:
```bash
supabase functions invoke battery-scraper
```

### 3. Supabase — Configurar pg_cron

En el **SQL Editor**, ejecuta (reemplaza con tus valores reales):

```sql
select cron.schedule(
  'battery-scraper',
  '0 */6 * * *',
  $$
    select net.http_post(
      url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/battery-scraper',
      headers := '{"Authorization": "Bearer TU_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
```

Obtén el `SERVICE_ROLE_KEY` en: Dashboard → Settings → API → `service_role` (secret).

Para verificar el cron:
```sql
select * from cron.job;
```

### 4. GitHub — Subir el repositorio

```bash
git init
git add .
git commit -m "feat: battery comparator mx"
git remote add origin https://github.com/TU_USUARIO/battery-comparator-mx.git
git push -u origin main
```

### 5. Vercel — Deploy del frontend

1. Ve a [vercel.com](https://vercel.com) → **New Project**
2. Importa tu repositorio de GitHub
3. En **Environment Variables**, agrega:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase |

4. Click en **Deploy**

Los valores los encuentras en: Supabase Dashboard → Settings → API

---

## Estructura del proyecto

```
.
├── app/
│   ├── api/
│   │   ├── batteries/route.ts   # API endpoint de baterías
│   │   └── stats/route.ts       # API endpoint de estadísticas
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                 # Página principal
├── components/
│   ├── BatteryCard.tsx          # Card de cada batería
│   ├── FilterBar.tsx            # Barra de filtros
│   ├── GradeBadge.tsx           # Badge de gama
│   ├── StatsBar.tsx             # Estadísticas de BD
│   └── StoreBadge.tsx           # Badge de tienda
├── lib/
│   └── supabase.ts
├── supabase/
│   ├── functions/
│   │   └── battery-scraper/
│   │       └── index.ts         # Edge Function (Deno)
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── config.toml
├── types/
│   └── battery.ts
└── vercel.json
```

## Notas importantes

### Sobre los scrapers
Los scrapers son resilientes: si un selector HTML cambia, el producto se omite sin romper el proceso completo. Cada tienda genera su propio log en `scraping_logs`.

Los selectores CSS pueden cambiar cuando las tiendas actualicen su frontend. Si ves 0 productos de una tienda, revisa la Edge Function y ajusta los selectores.

### Historial de precios
La tabla `baterias` mantiene historial completo. La vista `baterias_actuales` muestra solo la versión más reciente de cada URL.

### Rate limiting
El scraper incluye pausas de 1.5s entre páginas para respetar los servidores. No aumentes la frecuencia del cron por debajo de cada 2 horas.
