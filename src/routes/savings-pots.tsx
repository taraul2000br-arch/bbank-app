import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  Coins, Sparkles, CheckCircle2, ArrowRight, ShieldCheck,
  TrendingUp, Plus, Heart, Plane, Car, Gift, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/savings-pots")({
  component: SavingsPotsPage,
  head: () => ({
    meta: [
      { title: "Savings Pots & Auto Round-Ups — Secure Portal" },
      { name: "description", content: "Organise your savings into dedicated goal pots. Round up everyday debit card spare change automatically into your Secure Portal savings in GBP (£)." },
    ],
  }),
});

function SavingsPotsPage() {
  const [pots, setPots] = useState([
    { id: 1, name: "Summer Holiday in Cornwall", target: 1200, current: 850, icon: Plane },
    { id: 2, name: "Rainy Day Emergency Fund", target: 3000, current: 2450, icon: Heart },
    { id: 3, name: "Electric Vehicle Deposit", target: 5000, current: 1750, icon: Car },
  ]);

  const [roundUpDemo, setRoundUpDemo] = useState({ coffee: 3.40, rounded: 4.00, spare: 0.60 });

  const formatGBP = (v: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);

  return (
    <PublicPageShell
      title="Savings Pots & Smart Round-Ups"
      subtitle="Separate your money for specific goals. Automatically save spare change every time you spend on your B Bank debit card."
      badge="Smart UK Savings"
      breadcrumb={[{ label: "Savings & Investments", to: "/" }, { label: "Savings Pots" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Savings Pots Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Interactive Savings Pots Notice</h4>
            <p className="opacity-90">
              The goal targets, round-up visualisations, and 1.80% AER pot interest rates below are <strong>illustrative examples</strong> highlighting smart savings capabilities.
            </p>
          </div>
        </div>

        {/* Automatic Spare Change Round-Ups Showcase */}
        <section className="p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Save Without Thinking: Auto Round-Ups</h2>
              <p className="text-xs text-muted-foreground">Every purchase rounds up to the nearest £1 and drops the spare change into your pot</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 items-center bg-card p-6 rounded-2xl border border-border/80">
            <div className="text-center sm:text-left">
              <span className="text-xs text-muted-foreground block">You buy a flat white coffee:</span>
              <span className="text-2xl font-bold text-foreground mt-0.5 block">{formatGBP(roundUpDemo.coffee)}</span>
            </div>
            <div className="text-center">
              <span className="text-xs text-muted-foreground block">We round up to:</span>
              <span className="text-xl font-semibold text-foreground/80 mt-0.5 block">{formatGBP(roundUpDemo.rounded)}</span>
            </div>
            <div className="text-center sm:text-right">
              <span className="text-xs text-muted-foreground block">Sent automatically to your pot:</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">+{formatGBP(roundUpDemo.spare)}</span>
            </div>
          </div>
        </section>

        {/* Interactive Goal Pots */}
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-foreground">Your Goal Savings Pots</h3>
              <p className="text-xs text-muted-foreground">Customise targets and track real-time visual progress</p>
            </div>
            <button
              type="button"
              onClick={openSignupModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Open Account to Create Pots</span>
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {pots.map((pot) => {
              const Icon = pot.icon;
              const pct = Math.min(100, Math.round((pot.current / pot.target) * 100));
              return (
                <div key={pot.id} className="p-6 rounded-3xl border border-border/70 bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-primary">{pct}% reached</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-base text-foreground">{pot.name}</h4>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Saved: <strong className="text-foreground">{formatGBP(pot.current)}</strong></span>
                      <span>Target: {formatGBP(pot.target)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="pt-2 flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Interest: 1.80% AER</span>
                    <button
                      type="button"
                      onClick={openSignupModal}
                      className="text-primary font-semibold hover:underline"
                    >
                      Top up pot &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
