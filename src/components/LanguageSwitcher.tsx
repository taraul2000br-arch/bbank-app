import { useEffect, useRef, useState } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block z-20">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-lg hover:shadow-xl hover:scale-[1.02] transition text-sm font-semibold text-foreground"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4 text-primary" />
        <span className="text-base leading-none">{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-background border border-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-30">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code as Lang);
                setOpen(false);
              }}

              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary transition text-left ${
                l.code === lang ? "bg-secondary/60" : ""
              }`}
            >
              <span className="text-lg leading-none">{l.flag}</span>
              <span className="flex-1 font-medium">{l.name}</span>
              {l.code === lang && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
