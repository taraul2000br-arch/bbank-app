import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  TrendingUp, BarChart3, AlertCircle, ShieldCheck, CheckCircle2,
  ArrowRight, Sparkles, PieChart, Layers
} from "lucide-react";

export const Route = createFileRoute("/stocks-shares-isa")({
  component: StocksSharesIsaPage,
  head: () => ({
    meta: [
      { title: "Stocks & Shares ISA — B Bank Investor" },
      { name: "description", content: "Invest in shares, ETFs, and funds tax-free with a B Bank Stocks & Shares ISA. Choose ready-made portfolios or pick your own UK investments in GBP (£)." },
    ],
  }),
});

function StocksSharesIsaPage() {
  const portfolios = [
    {
      name: "Defensive Portfolio",
      risk: "Low-Medium Risk",
      assetMix: "70% Bonds & Cash, 30% Global Equities",
      aim: "Capital preservation and inflation protection with lower market volatility.",
    },
    {
      name: "Balanced Portfolio",
      risk: "Medium Risk",
      assetMix: "50% Equities, 40% Bonds, 10% Alternatives",
      aim: "Steady long-term capital growth with balanced cyclical exposure.",
      popular: true,
    },
    {
      name: "Growth Portfolio",
      risk: "Higher Risk",
      assetMix: "85% Global Equities, 15% Emerging Markets",
      aim: "Maximum long-term capital appreciation for investment horizons of 7+ years.",
    },
  ];

  return (
    <PublicPageShell
      title="Stocks & Shares ISA"
      subtitle="Invest up to £20,000 tax-free each year. Grow your wealth through UK and international funds, shares, and bonds with B Bank Smart Investor."
      badge="Tax-Efficient Investing"
      breadcrumb={[{ label: "Savings & Investments", to: "/" }, { label: "Stocks & Shares ISA" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Risk Warning Notice */}
        <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <h4 className="font-bold text-sm">Capital at Risk Notice</h4>
            <p className="opacity-90 leading-relaxed">
              <strong>The value of investments and the income from them can go down as well as up.</strong> You may not get back the full amount you invested. Tax rules can change and their benefits depend on individual circumstances.
            </p>
          </div>
        </div>

        {/* Ready-Made Portfolios */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-foreground">B Bank Ready-Made Investment Funds</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Professionally managed portfolios diversified across world markets to match your appetite for risk.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {portfolios.map((p, idx) => (
              <div
                key={idx}
                className={`p-7 rounded-3xl border flex flex-col justify-between transition ${
                  p.popular
                    ? "border-primary bg-primary/5 shadow-lg ring-1 ring-primary/20"
                    : "border-border/70 bg-card hover:border-primary/40 shadow-sm"
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{p.risk}</span>
                  <h3 className="text-xl font-bold text-foreground mt-1">{p.name}</h3>
                  <div className="my-4 p-3 rounded-xl bg-background/80 border border-border/50 text-xs">
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">Target Asset Mix</span>
                    <span className="font-semibold text-foreground mt-0.5 block">{p.assetMix}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.aim}</p>
                </div>

                <div className="pt-6 mt-6 border-t border-border/40">
                  <button
                    type="button"
                    onClick={openSignupModal}
                    className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
                  >
                    Open Account to Explore Portfolios
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Transparent UK Pricing */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 space-y-4">
          <h3 className="text-lg font-bold text-foreground">Transparent UK Account & Custody Fees</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-xs sm:text-sm text-muted-foreground">
            <div className="p-4 rounded-2xl bg-background border border-border/40">
              <span className="font-bold text-foreground block text-base">0.20% p.a.</span>
              <p className="mt-1">Customer custody fee on funds up to £500,000 (minimum £4/month).</p>
            </div>
            <div className="p-4 rounded-2xl bg-background border border-border/40">
              <span className="font-bold text-foreground block text-base">£0.00</span>
              <p className="mt-1">Zero dealing commission on regular monthly fund investments in GBP.</p>
            </div>
            <div className="p-4 rounded-2xl bg-background border border-border/40">
              <span className="font-bold text-foreground block text-base">£3.00</span>
              <p className="mt-1">Competitive flat online dealing fee on UK shares and investment trusts.</p>
            </div>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
