import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comparador de Baterías MX",
  description:
    "Compara precios de baterías de auto en O'Reilly, AutoZone y LTH en México",
  openGraph: {
    title: "Comparador de Baterías MX",
    description: "Encuentra el mejor precio de batería para tu auto en México",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">B</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">
                  Baterías MX
                </h1>
                <p className="text-xs text-slate-500">Comparador de precios</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Precios actualizados cada 6h
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 mt-16 py-8 text-center text-xs text-slate-400">
          Los precios son orientativos. Verifica en tienda antes de comprar.
        </footer>
      </body>
    </html>
  );
}
