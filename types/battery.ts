export type Store = "autozone";

export type BatteryGrade = "basica" | "estandar" | "premium" | "agm" | "otro";

export interface Battery {
  id: number;
  tienda: Store;
  nombre: string;
  gama: BatteryGrade;
  amperaje: number | null;
  grupo: string | null;
  garantia_meses: number | null;
  precio: number;
  precio_original: number | null;
  url: string;
  imagen_url: string | null;
  disponible: boolean;
  scraped_at: string;
  created_at: string;
}

export interface BatteryFilters {
  gama: BatteryGrade | "todas";
  precio_max: number | null;
  sort_by: "precio_asc" | "precio_desc" | "amperaje_desc" | "reciente";
  search: string;
}
