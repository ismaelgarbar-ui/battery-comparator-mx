import { Store } from "@/types/battery";

const STORE_CONFIG: Record<
  Store,
  { label: string; bg: string; text: string; dot: string }
> = {
  oreilly: {
    label: "O'Reilly",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  autozone: {
    label: "AutoZone",
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  lth: {
    label: "LTH",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
};

export default function StoreBadge({ store }: { store: Store }) {
  const cfg = STORE_CONFIG[store];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
