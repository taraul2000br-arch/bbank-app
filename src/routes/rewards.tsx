import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  Gift, Sparkles, CheckCircle2, ArrowRight, ShoppingBag,
  Percent, Star, ShieldCheck, HeartHandshake, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/rewards")({
  component: RewardsPage,
  head: () => ({
    meta: [
      { title: "Rewards & Cashback — Secure Portal" },
      { name: "description", content: "Earn cash rewards and retailer cashback every month. Join Rewards & Cashback with your Secure Portal current account in GBP (£)." },
    ],
  }),
});

function RewardsPage() {
  const [estimatedSpend, setEstimatedSpend] = useState(600);
  const cashbackRate = 0.03; // average 3% partner cashback
  const monthlyCashback = estimatedSpend * cashbackRate;
  const annualCashback = monthlyCashback * 12;

  const formatGBP = (v: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);

  const partners = [
    { name: "Sainsbury's & Asda", offer: "Up to 5% Cashback", cat: "Groceries" },
    { name: "BP & Shell", offer: "3% Cashback on Fuel", cat: "Fuel & Travel" },
    { name: "Boots UK", offer: "4% Cashback", cat: "Health & Beauty" },
    { name: "John Lewis & M&S", offer: "Up to 6% Cashback", cat: "Retail" },
  ];

  return (
    <PublicPageShell
      title="B Bank Rewards & Cashback"
      subtitle="Turn your everyday grocery, fuel, and shopping spending into cash rewards paid straight into your B Bank account in GBP (£)."
      badge="Loyalty & Cashback"
      breadcrumb={[{ label: "Cards & Rewards", to: "/" }, { label: "Rewards & Cashback" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Rewards Rates Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Illustrative Rewards & Cashback Notice</h4>
            <p className="opacity-90">
              Retailer names, cashback percentages, and annual return estimates are <strong>illustrative benchmark examples</strong>. Actual cashback offers are subject to merchant agreements and program terms.
            </p>
          </div>
        </div>

        {/* Interactive Cashback Calculator */}
        <section className="p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Interactive Cashback Calculator</h2>
              <p className="text-xs text-muted-foreground">Illustrative return estimate based on typical monthly UK retail spending</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-2">
                  Monthly spending at partner brands: <span className="text-primary font-bold">{formatGBP(estimatedSpend)}</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={2500}
                  step={50}
                  value={estimatedSpend}
                  onChange={(e) => setEstimatedSpend(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>£100</span>
                  <span>£2,500 / month</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 flex justify-between items-center text-center">
              <div>
                <span className="text-xs text-muted-foreground block">Illustrative Monthly Return</span>
                <span className="text-xl font-bold text-foreground mt-1 block">+{formatGBP(monthlyCashback)}</span>
              </div>
              <div className="h-10 w-px bg-border/60" />
              <div>
                <span className="text-xs text-muted-foreground block">Illustrative Annual Return</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">+{formatGBP(annualCashback)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Participating Retailers */}
        <section className="space-y-6">
          <h3 className="text-xl font-bold text-foreground">Featured UK Cashback Retailers</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {partners.map((p, i) => (
              <div key={i} className="p-5 rounded-2xl border border-border/70 bg-card hover:border-primary/40 transition">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{p.cat}</span>
                <h4 className="font-bold text-sm text-foreground mt-1">{p.name}</h4>
                <div className="text-xs font-semibold text-primary mt-2">{p.offer}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Requirements */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 space-y-4">
          <h4 className="text-lg font-bold text-foreground">How to Join B Bank Rewards</h4>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Available to all B Bank Current Account holders. Pay in at least £800 each month and manage your account digitally. The £5 monthly fee is easily offset by cash rewards and exclusive high-interest savings rates.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={openSignupModal}
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition shadow-sm"
            >
              Open Account to Explore Rewards
            </button>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
