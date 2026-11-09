import { VelunorLogo } from "./VelunorLogo";

type Variant = "black" | "virtual" | "orange";

interface Props {
  variant?: Variant;
  holder?: string;
  last4?: string;
  expiry?: string;
  tag?: string;
  className?: string;
  style?: React.CSSProperties;
}

const STYLES: Record<Variant, { bg: string; accent: string; chip: string; label: string }> = {
  black: {
    bg: "linear-gradient(135deg, #061527 0%, #0A2540 55%, #0F3460 100%)",
    accent: "#38BDF8",
    chip: "linear-gradient(135deg, #e5c158 0%, #b88a1e 100%)",
    label: "PREMIER NAVY",
  },
  virtual: {
    bg: "linear-gradient(135deg, #0A2540 0%, #0369A1 60%, #38BDF8 100%)",
    accent: "#E0F2FE",
    chip: "linear-gradient(135deg, #dbe4ee 0%, #8fa3b8 100%)",
    label: "VIRTUAL",
  },
  orange: {
    bg: "linear-gradient(135deg, #0284C7 0%, #0369A1 55%, #0A2540 100%)",
    accent: "#ffffff",
    chip: "linear-gradient(135deg, #f5d47a 0%, #c8992b 100%)",
    label: "DEBIT & CREDIT",
  },
};

export function VelunorCard({
  variant = "black",
  holder = "JOHN SMITH",
  last4 = "4829",
  expiry = "09/29",
  tag,
  className = "",
  style,
}: Props) {
  const s = STYLES[variant];
  return (
    <div
      style={{ background: s.bg, ...style }}
      className={`relative aspect-[1.586/1] w-full rounded-2xl p-6 text-white shadow-2xl overflow-hidden select-none border border-white/10 ${className}`}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-25 blur-2xl"
        style={{ background: s.accent }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full opacity-15 blur-2xl"
        style={{ background: s.accent }}
      />
      {/* Subtle geometric pattern */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`grid-${variant}`} width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${variant})`} />
      </svg>

      <div className="relative z-10 flex h-full flex-col justify-between">
        {/* Top row: Brand + tag */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <VelunorLogo height={24} variant="full" tone="white" />
          </div>
          <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.18em] backdrop-blur">
            {tag ?? s.label}
          </span>
        </div>

        {/* Middle: EMV chip + contactless */}
        <div className="flex items-center justify-between">
          <div
            style={{ background: s.chip }}
            className="h-9 w-12 rounded-md border border-black/20 shadow-inner relative overflow-hidden"
          >
            <div className="absolute inset-x-0 top-1/2 h-px bg-black/25" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-black/25" />
            <div className="absolute inset-2 rounded-sm border border-black/25" />
          </div>
          {/* Contactless waves */}
          <svg className="h-5 w-5 text-white/75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8.5 14.5A4 4 0 0 0 8.5 9.5" />
            <path d="M11.5 17A7.5 7.5 0 0 0 11.5 7" />
            <path d="M14.5 19.5a11 11 0 0 0 0-15" />
          </svg>
        </div>

        {/* Bottom: number + holder + Mastercard */}
        <div>
          <div className="font-mono text-base sm:text-lg tracking-[0.22em] text-white/95 mb-2">
            •••• •••• •••• {last4}
          </div>
          <div className="flex items-end justify-between">
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-widest text-white/55">Card Holder</div>
              <div className="text-xs font-semibold tracking-wider truncate">{holder}</div>
            </div>
            <div className="text-right mr-2">
              <div className="text-[9px] uppercase tracking-widest text-white/55">Valid Thru</div>
              <div className="text-xs font-semibold font-mono">{expiry}</div>
            </div>
            {/* Mastercard circles */}
            <div className="flex items-center -space-x-2">
              <span className="h-6 w-6 rounded-full bg-[#EB001B]/90 inline-block" />
              <span className="h-6 w-6 rounded-full bg-[#F79E1B]/90 inline-block" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
