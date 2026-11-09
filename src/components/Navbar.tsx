import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { openLoginModal, openSignupModal } from "@/components/SignupModal";
import { VelunorLogo } from "@/components/VelunorLogo";

type MegaKey = "finance" | "shopping" | "loop" | "experiences" | "globalLife";

interface MegaItem {
  labelKey: string;
  to: string;
}

interface MegaCol {
  titleKey: string;
  items: MegaItem[];
}

const MEGA: Record<MegaKey, { cols: MegaCol[] }> = {
  finance: {
    cols: [
      {
        titleKey: "mega.fin.col1",
        items: [
          { labelKey: "mega.fin.col1.1", to: "/current-account" },
          { labelKey: "mega.fin.col1.2", to: "/savings" },
          { labelKey: "mega.fin.col1.3", to: "/childrens-accounts" },
          { labelKey: "mega.fin.col1.4", to: "/credit-cards" },
          { labelKey: "mega.fin.col1.5", to: "/debit-cards" },
        ],
      },
      {
        titleKey: "mega.fin.col2",
        items: [
          { labelKey: "mega.fin.col2.1", to: "/personal-loans" },
          { labelKey: "mega.fin.col2.2", to: "/mortgages" },
          { labelKey: "mega.fin.col2.3", to: "/overdrafts" },
          { labelKey: "mega.fin.col2.4", to: "/insurance" },
        ],
      },
      {
        titleKey: "mega.fin.col3",
        items: [
          { labelKey: "mega.fin.col3.1", to: "/cash-isa" },
          { labelKey: "mega.fin.col3.2", to: "/stocks-shares-isa" },
          { labelKey: "mega.fin.col3.3", to: "/fixed-savings" },
          { labelKey: "mega.fin.col3.4", to: "/savings-pots" },
          { labelKey: "mega.fin.col3.5", to: "/investments" },
        ],
      },
      {
        titleKey: "mega.fin.col4",
        items: [
          { labelKey: "mega.fin.col4.1", to: "/business-account" },
          { labelKey: "mega.fin.col4.2", to: "/business-payments" },
          { labelKey: "mega.fin.col4.3", to: "/merchant-services" },
          { labelKey: "mega.fin.col4.4", to: "/business-loans" },
          { labelKey: "mega.fin.col4.5", to: "/international-business" },
        ],
      },
    ],
  },
  shopping: {
    cols: [
      {
        titleKey: "mega.shop.col1",
        items: [
          { labelKey: "mega.shop.col1.1", to: "/credit-cards" },
          { labelKey: "mega.shop.col1.2", to: "/rewards" },
          { labelKey: "mega.shop.col1.3", to: "/premier" },
          { labelKey: "mega.shop.col1.4", to: "/travel-cards" },
        ],
      },
    ],
  },
  loop: {
    cols: [
      {
        titleKey: "mega.loop.col1",
        items: [
          { labelKey: "mega.loop.col1.1", to: "/transferencia" },
          { labelKey: "mega.loop.col1.2", to: "/standing-orders" },
          { labelKey: "mega.loop.col1.3", to: "/international-payments" },
          { labelKey: "mega.loop.col1.4", to: "/extrato" },
          { labelKey: "mega.loop.col1.5", to: "/pending-payments" },
        ],
      },
    ],
  },
  experiences: {
    cols: [
      {
        titleKey: "mega.exp.col1",
        items: [
          { labelKey: "mega.exp.col1.1", to: "/digital-banking" },
          { labelKey: "mega.exp.col1.2", to: "/security" },
          { labelKey: "mega.exp.col1.3", to: "/help" },
          { labelKey: "mega.exp.col1.4", to: "/complaints" },
          { labelKey: "mega.exp.col1.5", to: "/contact" },
        ],
      },
    ],
  },
  globalLife: {
    cols: [
      {
        titleKey: "mega.glob.col1",
        items: [
          { labelKey: "mega.glob.col1.1", to: "/international-payments" },
          { labelKey: "mega.glob.col1.3", to: "/exchange-rates" },
          { labelKey: "mega.glob.col1.4", to: "/travel-money" },
          { labelKey: "mega.glob.col1.5", to: "/track-payment" },
        ],
      },
    ],
  },
};

const NAV_KEYS: { labelKey: string; key: MegaKey }[] = [
  { labelKey: "nav.finance", key: "finance" },
  { labelKey: "nav.shopping", key: "shopping" },
  { labelKey: "nav.loop", key: "loop" },
  { labelKey: "nav.experiences", key: "experiences" },
  { labelKey: "nav.globalLife", key: "globalLife" },
];

export function Navbar() {
  const { t } = useI18n();
  const [open, setOpen] = useState<MegaKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border/60"
      onMouseLeave={() => setOpen(null)}
    >
      <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center select-none outline-none focus:outline-none">
            <VelunorLogo height={28} variant="full" />
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_KEYS.map((item) => (
              <button
                key={item.key}
                type="button"
                onMouseEnter={() => setOpen(item.key)}
                onClick={() => setOpen(open === item.key ? null : item.key)}
                className={`px-3.5 py-2 text-sm font-medium rounded-full transition-colors cursor-pointer ${
                  open === item.key ? "text-primary bg-accent" : "text-foreground/80 hover:text-primary"
                }`}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </nav>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={openSignupModal}
            className="px-5 py-2.5 text-sm font-semibold rounded-full bg-primary text-primary-foreground hover:bg-(--primary-hover) transition-colors shadow-sm cursor-pointer"
          >
            {t("cta.openAccount")}
          </button>
          <button
            type="button"
            onClick={openLoginModal}
            className="px-5 py-2.5 text-sm font-semibold rounded-full border border-border text-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
          >
            {t("cta.accessAccount")}
          </button>
        </div>

        <div className="lg:hidden flex items-center gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            className="p-2 rounded-lg text-foreground"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="hidden lg:block border-t border-border/60 bg-background shadow-xl">
          <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-4 gap-10">
            {MEGA[open].cols.map((c) => (
              <div key={c.titleKey}>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">
                  {t(c.titleKey)}
                </p>
                <ul className="space-y-2.5">
                  {c.items.map((it) => (
                    <li key={it.labelKey}>
                      <Link
                        to={it.to}
                        onClick={() => setOpen(null)}
                        className="text-sm text-foreground/80 hover:text-primary transition-colors block py-0.5"
                      >
                        {t(it.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="lg:hidden border-t border-border/60 bg-background px-6 py-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="space-y-5">
            {NAV_KEYS.map((n) => (
              <div key={n.key} className="space-y-2">
                <p className="text-sm font-bold text-primary uppercase tracking-wider">
                  {t(n.labelKey)}
                </p>
                <div className="grid grid-cols-1 gap-1.5 pl-2 border-l-2 border-border/60">
                  {MEGA[n.key].cols.flatMap((col) =>
                    col.items.map((it) => (
                      <Link
                        key={it.labelKey}
                        to={it.to}
                        onClick={() => setMobileOpen(false)}
                        className="text-sm text-foreground/80 hover:text-primary py-1 block"
                      >
                        {t(it.labelKey)}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openSignupModal();
              }}
              className="w-full py-3 text-center text-sm font-semibold rounded-full bg-primary text-primary-foreground cursor-pointer"
            >
              {t("cta.openAccount")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openLoginModal();
              }}
              className="w-full py-3 text-center text-sm font-semibold rounded-full border border-border cursor-pointer"
            >
              {t("cta.accessAccount")}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
