import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Shield, Smartphone, ShoppingBag, Globe, CreditCard, Menu, X, ChevronRight, ChevronDown } from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import securityImg from "@/assets/security.jpg";
import shopImg from "@/assets/shop.jpg";
import businessImg from "@/assets/business.jpg";
import globalImg from "@/assets/global.jpg";
import { SignupModal, openSignupModal, openLoginModal } from "@/components/SignupModal";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BancoTesteLogo } from "@/components/BankLogo";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Secure Portal — The Super App of your financial life" },
      { name: "description", content: "Free digital account, no-fee credit card, cashback shop and global account. All in one app." },
    ],
  }),
});

const navKeys = [
  { label: "nav.finance", key: "finance" },
  { label: "nav.shopping", key: "shopping" },
  { label: "nav.loop", key: "loop" },
  { label: "nav.experiences", key: "experiences" },
  { label: "nav.globalLife", key: "global" },
];

interface MegaItem {
  key: string;
  to: string;
}

interface MegaCol {
  titleKey: string;
  items: MegaItem[];
}

const megaMenuData: Record<string, MegaCol[]> = {
  finance: [
    {
      titleKey: "mega.fin.col1",
      items: [
        { key: "mega.fin.col1.1", to: "/current-account" },
        { key: "mega.fin.col1.2", to: "/savings" },
        { key: "mega.fin.col1.3", to: "/childrens-accounts" },
      ],
    },
    {
      titleKey: "mega.fin.col2",
      items: [
        { key: "mega.fin.col2.4", to: "/insurance" },
      ],
    },
    {
      titleKey: "mega.fin.col3",
      items: [
        { key: "mega.fin.col3.1", to: "/cash-isa" },
        { key: "mega.fin.col3.2", to: "/stocks-shares-isa" },
        { key: "mega.fin.col3.3", to: "/fixed-savings" },
        { key: "mega.fin.col3.4", to: "/savings-pots" },
        { key: "mega.fin.col3.5", to: "/investments" },
      ],
    },
    {
      titleKey: "mega.fin.col4",
      items: [
        { key: "mega.fin.col4.1", to: "/business-banking" },
        { key: "mega.fin.col4.2", to: "/business-payments" },
        { key: "mega.fin.col4.3", to: "/merchant-services" },
        { key: "mega.fin.col4.5", to: "/business-international" },
      ],
    },
  ],
  shopping: [
    {
      titleKey: "mega.shop.col1",
      items: [
        { key: "mega.shop.col1.2", to: "/rewards" },
        { key: "mega.shop.col1.3", to: "/premier" },
      ],
    },
    {
      titleKey: "mega.shop.col1.3",
      items: [
        { key: "mega.shop.col1.3", to: "/premier" },
        { key: "mega.fin.col3.5", to: "/investments" },
      ],
    },
    {
      titleKey: "nav.globalLife",
      items: [
        { key: "mega.glob.col1.4", to: "/travel-money" },
        { key: "mega.glob.col1.3", to: "/exchange-rates" },
      ],
    },
  ],
  loop: [
    {
      titleKey: "mega.loop.col1",
      items: [
        { key: "mega.loop.col1.1", to: "/transferencia" },
        { key: "mega.loop.col1.2", to: "/standing-orders" },
        { key: "mega.loop.col1.4", to: "/extrato" },
        { key: "mega.loop.col1.5", to: "/pending-payments" },
      ],
    },
    {
      titleKey: "mega.glob.col1",
      items: [
        { key: "mega.loop.col1.3", to: "/international-payments" },
        { key: "mega.glob.col1.1", to: "/transferencia" },
        { key: "mega.glob.col1.5", to: "/track-payment" },
      ],
    },
    {
      titleKey: "mega.fin.col4.2",
      items: [
        { key: "mega.fin.col4.2", to: "/business-payments" },
        { key: "mega.fin.col4.3", to: "/merchant-services" },
      ],
    },
    {
      titleKey: "mega.exp.col1.2",
      items: [
        { key: "mega.exp.col1.2", to: "/security" },
      ],
    },
  ],
  experiences: [
    {
      titleKey: "mega.exp.col1",
      items: [
        { key: "mega.exp.col1.1", to: "/digital-banking" },
        { key: "mega.fin.col3.4", to: "/savings-pots" },
        { key: "mega.shop.col1.2", to: "/rewards" },
      ],
    },
    {
      titleKey: "mega.exp.col1.2",
      items: [
        { key: "mega.exp.col1.2", to: "/security" },
        { key: "mega.fin.col2.4", to: "/insurance" },
        { key: "mega.shop.col1.3", to: "/premier" },
      ],
    },
    {
      titleKey: "mega.exp.col1.3",
      items: [
        { key: "mega.exp.col1.3", to: "/help" },
        { key: "mega.exp.col1.4", to: "/complaints" },
        { key: "mega.exp.col1.5", to: "/contact" },
      ],
    },
    {
      titleKey: "foot.col3",
      items: [
        { key: "compliance.title", to: "/compliance" },
        { key: "privacy.title", to: "/privacy" },
        { key: "about.title", to: "/about" },
      ],
    },
  ],
  global: [
    {
      titleKey: "mega.glob.col1",
      items: [
        { key: "mega.glob.col1.1", to: "/transferencia" },
        { key: "mega.loop.col1.3", to: "/international-payments" },
        { key: "mega.glob.col1.5", to: "/track-payment" },
      ],
    },
    {
      titleKey: "mega.glob.col1.3",
      items: [
        { key: "mega.glob.col1.3", to: "/exchange-rates" },
      ],
    },
    {
      titleKey: "mega.glob.col1.4",
      items: [
        { key: "mega.glob.col1.4", to: "/travel-money" },
        { key: "mega.glob.col1.3", to: "/exchange-rates" },
      ],
    },
    {
      titleKey: "mega.fin.col4.5",
      items: [
        { key: "mega.fin.col4.5", to: "/business-international" },
        { key: "mega.fin.col4.1", to: "/business-banking" },
      ],
    },
  ],
};

function Header() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMobileCategory, setOpenMobileCategory] = useState<string | null>(null);

  return (
    <>
      {/* Desktop / tablet header */}
      <header className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40 select-none">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center gap-8 select-none">
          <BancoTesteLogo
            size="lg"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          />
          <nav className="hidden lg:flex items-center gap-7 ml-6 flex-1 select-none">
            {navKeys.map((n) => {
              const menu = megaMenuData[n.key];
              return (
                <div key={n.key} className="relative group">
                  <span className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors py-2 inline-block cursor-pointer select-none">
                    {t(n.label)}
                  </span>
                  {menu && (
                    <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 fixed top-full left-0 right-0 mt-0 pt-2 z-50">
                      <div className="bg-background/95 backdrop-blur-2xl border-b border-border/60 shadow-2xl">
                        <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-4 gap-8 min-h-[380px]">
                          {menu.map((col, cIdx) => (
                            <div key={cIdx} className="space-y-4">
                              <h4 className="text-xs uppercase tracking-wider font-bold text-foreground/60">
                                {t(col.titleKey) || col.titleKey}
                              </h4>
                              <ul className="space-y-3.5">
                                {col.items.map((item, itemIdx) => (
                                  <li key={itemIdx}>
                                    <Link
                                      to={item.to}
                                      className="text-[14px] font-semibold text-foreground hover:text-primary transition-colors inline-block"
                                    >
                                      {t(item.key) || item.key}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button onClick={openSignupModal} className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition shadow-sm">
              {t("cta.openAccount")}
            </button>
            <button onClick={openLoginModal} className="px-5 py-2.5 rounded-full border-2 border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition">
              {t("cta.accessAccount")}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile header — Inter-style dark bar with primary CTA + hamburger */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#3a3a3a] text-white select-none">
        <div className="px-3 py-3 flex items-center gap-2 select-none">
          <BancoTesteLogo
            size="sm"
            theme="dark"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          />
          <button
            onClick={openSignupModal}
            className="flex-1 mx-1 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition text-center truncate"
          >
            {t("cta.openAccount")}
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Menu"
            className="p-2 rounded-md hover:bg-white/10 transition shrink-0"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile fullscreen drawer with interactive accordion navigation */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-[#1f1f1f]/95 backdrop-blur-sm text-white animate-in fade-in duration-200 flex flex-col">
          <div className="bg-[#3a3a3a] px-3 py-3 flex items-center gap-2">
            <BancoTesteLogo size="sm" theme="dark" asLink={false} />
            <div className="flex-1" />
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="p-2 rounded-md hover:bg-white/10 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
            {navKeys.map((n) => {
              const menu = megaMenuData[n.key];
              const isExpanded = openMobileCategory === n.key;
              return (
                <div key={n.key} className="border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => setOpenMobileCategory(isExpanded ? null : n.key)}
                    className="w-full flex items-center justify-between py-4 text-left text-lg font-semibold text-white"
                  >
                    <span>{t(n.label)}</span>
                    <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {isExpanded && menu && (
                    <div className="pb-4 pl-3 space-y-4 animate-in fade-in duration-200">
                      {menu.map((col, cIdx) => (
                        <div key={cIdx} className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                            {t(col.titleKey) || col.titleKey}
                          </span>
                          <ul className="space-y-2 border-l border-white/10 pl-3">
                            {col.items.map((item, iIdx) => (
                              <li key={iIdx}>
                                <Link
                                  to={item.to}
                                  onClick={() => setMenuOpen(false)}
                                  className="text-sm font-medium text-white/90 hover:text-primary transition block py-1"
                                >
                                  {t(item.key) || item.key}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between py-4 border-b border-white/10">
              <span className="text-lg font-semibold">Idioma</span>
              <LanguageSwitcher />
            </div>
          </nav>
          <div className="p-4 space-y-3 border-t border-white/10 bg-[#1f1f1f]">
            <button
              onClick={() => { setMenuOpen(false); openSignupModal(); }}
              className="w-full py-3.5 rounded-md bg-primary text-primary-foreground font-bold hover:opacity-90 transition"
            >
              {t("cta.openAccount")}
            </button>
            <button
              onClick={() => { setMenuOpen(false); openLoginModal(); }}
              className="w-full py-3.5 rounded-md bg-white text-primary font-bold hover:opacity-90 transition"
            >
              {t("cta.accessAccount")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative min-h-[92vh] overflow-hidden">
      <img src={heroImg} alt="Woman using the super app on phone" width={1536} height={1024} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-44 pb-20">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] tracking-tight max-w-3xl select-none pointer-events-none">
          {t("hero.title.1")}<br />{t("hero.title.2")}<br />{t("hero.title.3")}
        </h1>
        <button onClick={openSignupModal} className="mt-10 inline-flex items-center gap-2 text-white text-lg font-medium border-b-2 border-white/60 pb-1 hover:border-white transition">
          {t("hero.cta")} <ArrowRight className="w-5 h-5" />
        </button>
        <div className="md:hidden mt-5">
          <button onClick={openLoginModal} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/40 text-white text-sm font-semibold hover:bg-white/25 transition">
            {t("modal.login.submit")}
          </button>
        </div>
      </div>
    </section>
  );
}

function Security() {
  const { t } = useI18n();
  return (
    <section className="bg-foreground text-background py-24">
      <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <Shield className="w-12 h-12 text-primary mb-6" />
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight">{t("sec.title.1")}<br />{t("sec.title.2")}</h2>
          <p className="mt-6 text-lg text-background/70 max-w-md">{t("sec.desc")}</p>
          <button onClick={openSignupModal} className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition">
            {t("hero.cta")} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="rounded-3xl overflow-hidden" style={{ boxShadow: "var(--shadow-warm)" }}>
          <img src={securityImg} alt="Person using the app" width={1024} height={1024} loading="lazy" className="w-full h-full object-cover" />
        </div>
      </div>
    </section>
  );
}

function SmartChoice() {
  const { t } = useI18n();
  const items = [
    { icon: CreditCard, titleKey: "smart.item1.title", descKey: "smart.item1.desc" },
    { icon: Smartphone, titleKey: "smart.item2.title", descKey: "smart.item2.desc" },
    { icon: ShoppingBag, titleKey: "smart.item3.title", descKey: "smart.item3.desc" },
    { icon: Globe, titleKey: "smart.item4.title", descKey: "smart.item4.desc" },
  ];
  return (
    <section className="py-28 px-6">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-5xl md:text-7xl font-bold text-center tracking-tight">
          {t("smart.title.1")}<br /><span className="text-primary">{t("smart.title.2")}</span>
        </h2>
        <div className="mt-20 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="group p-8 rounded-3xl bg-secondary hover:bg-accent transition-all hover:-translate-y-1 duration-300">
              <Icon className="w-10 h-10 text-primary mb-6" />
              <h3 className="text-xl font-bold mb-2">{t(titleKey)}</h3>
              <p className="text-muted-foreground">{t(descKey)}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 text-center">
          <button onClick={openSignupModal} className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-foreground font-semibold hover:bg-foreground hover:text-background transition">
            {t("cta.know")} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ img, eyebrow, title, desc, cta, reverse }: { img: string; eyebrow: string; title: string; desc: string; cta: string; reverse?: boolean }) {
  return (
    <div className={`grid md:grid-cols-2 gap-12 items-center ${reverse ? "md:[&>div:first-child]:order-2" : ""}`}>
      <div className="rounded-3xl overflow-hidden aspect-[4/5] md:aspect-square" style={{ boxShadow: "var(--shadow-warm)" }}>
        <img src={img} alt={title} width={1024} height={1024} loading="lazy" className="w-full h-full object-cover" />
      </div>
      <div>
        <span className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</span>
        <h3 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight leading-tight">{title}</h3>
        <p className="mt-5 text-lg text-muted-foreground max-w-md">{desc}</p>
        <button onClick={openSignupModal} className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition">
          {cta} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Features() {
  const { t } = useI18n();
  return (
    <section className="py-28 px-6 bg-secondary/40">
      <div className="mx-auto max-w-7xl space-y-28">
        <FeatureCard img={businessImg} eyebrow={t("feat.biz.eyebrow")} title={t("feat.biz.title")} desc={t("feat.biz.desc")} cta={t("cta.learnMore")} />
        <FeatureCard img={shopImg} eyebrow={t("feat.shop.eyebrow")} reverse title={t("feat.shop.title")} desc={t("feat.shop.desc")} cta={t("cta.discoverNow")} />
        <FeatureCard img={globalImg} eyebrow={t("feat.glob.eyebrow")} title={t("feat.glob.title")} desc={t("feat.glob.desc")} cta={t("cta.learnMore")} />
      </div>
    </section>
  );
}

function CTA() {
  const { t } = useI18n();
  return (
    <section className="py-10 px-6 bg-background">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center mb-6">
          <BancoTesteLogo size="lg" asLink={false} />
        </div>
        <div
          className="relative overflow-hidden rounded-sm text-center text-white px-6 py-24 md:py-32 promo-card select-none"
          data-promo="true"
          style={{
            background: "linear-gradient(180deg, #1a8cd8 0%, #1577bd 100%)",
          }}
        >
          <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 1200 600" preserveAspectRatio="none" fill="none" stroke="#e6c97a" strokeWidth="0.6">
            <polyline points="0,60 120,180 40,320 180,420 60,560" />
            <polyline points="120,180 260,80 380,260 220,380 340,520" />
            <polyline points="1200,60 1080,180 1160,320 1020,420 1140,560" />
            <polyline points="1080,180 940,80 820,260 980,380 860,520" />
            <polyline points="40,320 260,80 380,260" />
            <polyline points="1160,320 940,80 820,260" />
          </svg>
          <div className="absolute inset-4 border border-[#e6c97a]/50 pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-light tracking-tight leading-[1.05]" style={{ fontFamily: "'Playfair Display', serif" }}>
              {t("cta.title.1")}<br />{t("cta.title.2")}
            </h2>
            <p className="mt-6 text-lg text-white/90">{t("cta.subtitle")}</p>
            <button onClick={openSignupModal} className="mt-10 inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-[#0a6bb5] font-semibold hover:scale-105 transition shadow-lg">
              {t("hero.cta")} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useI18n();
  const cols = [
    {
      titleKey: "foot.col1",
      links: [
        { labelKey: "foot.col1.1", to: "/current-account" },
        { labelKey: "foot.col1.4", to: "/investments" },
        { labelKey: "foot.col1.5", to: "/insurance" },
        { labelKey: "foot.col3.4", to: "/international-payments" },
      ],
    },
    {
      titleKey: "foot.col2",
      links: [
        { labelKey: "foot.col2.1", to: "/business-banking" },
        { labelKey: "foot.col2.2", to: "/merchant-services" },
        { labelKey: "foot.col2.3", to: "/business-payments" },
        { labelKey: "foot.col3.4", to: "/business-international" },
      ],
    },
    {
      titleKey: "foot.col3",
      links: [
        { labelKey: "foot.col3.1", to: "/about" },
        { labelKey: "foot.col3.2", to: "/investor-relations" },
        { labelKey: "foot.col3.3", to: "/newsroom" },
        { labelKey: "foot.col3.4", to: "/compliance" },
      ],
    },
    {
      titleKey: "foot.col4",
      links: [
        { labelKey: "foot.col4.1", to: "/help" },
        { labelKey: "foot.col4.2", to: "/security" },
        { labelKey: "foot.col4.3", to: "/complaints" },
        { labelKey: "foot.col4.4", to: "/contact" },
      ],
    },
  ];

  return (
    <footer className="bg-foreground text-background/80 py-20 px-6">
      <div className="mx-auto max-w-7xl grid md:grid-cols-2 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-1">
          <BancoTesteLogo size="xl" tone="brand" asLink={false} />
          <p className="mt-4 text-sm text-background/60">{t("foot.tag")}</p>
        </div>
        {cols.map((c) => (
          <div key={c.titleKey}>
            <h4 className="font-semibold text-[#029efb] mb-4">{t(c.titleKey)}</h4>
            <ul className="space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="hover:text-[#029efb] transition inline-block">
                    {t(l.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}

function Index() {
  return (
    <main>
      <Header />
      <Hero />
      <Security />
      <SmartChoice />
      <Features />
      <CTA />
      <Footer />
      <SignupModal />
    </main>
  );
}
