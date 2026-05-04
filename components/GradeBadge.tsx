import { BatteryGrade } from "@/types/battery";

const GRADE_CONFIG: Record<
  BatteryGrade,
  { label: string; bg: string; text: string }
> = {
  basica: { label: "Básica", bg: "bg-slate-100", text: "text-slate-600" },
  estandar: { label: "Estándar", bg: "bg-green-50", text: "text-green-700" },
  premium: { label: "Premium", bg: "bg-purple-50", text: "text-purple-700" },
  agm: { label: "AGM", bg: "bg-yellow-50", text: "text-yellow-700" },
  otro: { label: "Otro", bg: "bg-gray-50", text: "text-gray-500" },
};

export default function GradeBadge({ grade }: { grade: BatteryGrade }) {
  const cfg = GRADE_CONFIG[grade] ?? GRADE_CONFIG.otro;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}
