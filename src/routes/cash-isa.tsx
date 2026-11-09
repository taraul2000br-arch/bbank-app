import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  ShieldCheck, Calculator, CheckCircle2, ArrowRight, Sparkles,
  Percent, AlertCircle, PieChart
} from "lucide-react";

export const Route = createFileRoute("/cash-isa")({
  component: CashIsaPage,
  head: () => ({
    meta: [
      { title: "Cash ISA — Tax-Free UK Savings Allowance — Secure Portal" },
      { name: "description", content: "Save up to £20,000 tax-free each year with a Secure Portal Cash ISA. Flexible withdrawals, competitive rates and HMRC statutory tax exemptions in GBP (£)." },
    ],
  }),
});

function CashIsaPage() {
  const [allocatedAllowance, setAllocatedAllowance] = useState(8500);
  const annualAllowance = 20000;
  const remainingAllowance = Math.max(0, annualAllowance - allocatedAllowance);
  const percentageUsed = ((allocatedAllowance / annualAllowance) * 100).toFixed(0);

  const formatGBP = (v: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);

  return (
    <PublicPageShell
      title="Cash ISA in GBP (£)"
      subtitle="Save up to £20,000 tax-free every tax year. Earn interest without paying UK income tax or capital gains tax on your returns."
      badge="Tax-Free UK Savings"
      breadcrumb={[{ label: "Savings & Investments", to: "/" }, { label: "Cash ISA" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Benchmark Rates Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Illustrative Cash ISA & Benchmark Rates Notice</h4>
            <p className="opacity-90">
              The statutory annual allowance (£20,000) and interest rates (4.10% variable / 4.65% fixed AER) are <strong>illustrative benchmark examples</strong>. Tax treatment depends on individual circumstances and may change in future UK legislation.
            </p>
          </div>
        </div>

        {/* Tax Year Allowance Tracker */}
        <section className="p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Interactive UK ISA Allowance Tracker</h2>
                <p className="text-xs text-muted-foreground">Statutory annual allowance: £20,000 per UK tax year</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              Tax Year 2026 / 2027
            </span>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-foreground/80 mb-2">
                <span>Estimated Deposit into Cash ISA:</span>
                <span className="text-primary font-bold">{formatGBP(allocatedAllowance)} ({percentageUsed}%)</span>
              </div>
              <input
                type="range"
                min={0}
                max={20000}
                step={500}
                value={allocatedAllowance}
                onChange={(e) => setAllocatedAllowance(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Allowance Progress Bar */}
            <div className="w-full h-3 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${percentageUsed}%` }}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-card border border-border">
                <span className="text-muted-foreground block">Allowance Utilised</span>
                <span className="text-lg font-bold text-foreground mt-0.5 block">{formatGBP(allocatedAllowance)}</span>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <span className="text-muted-foreground block">Remaining Tax-Free Allowance</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{formatGBP(remainingAllowance)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ISA Products */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-7 rounded-3xl border border-border/70 bg-card flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Instant Access</span>
              <h3 className="text-xl font-bold text-foreground mt-1">Flexible Cash ISA</h3>
              <div className="text-2xl font-black text-primary my-3">4.10% <span className="text-xs font-normal text-muted-foreground">Tax-free / AER variable (Illustrative)</span></div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deposit and withdraw money whenever you need. Because it is a <strong>Flexible ISA</strong>, you can replace cash you take out within the same tax year without reducing your allowance.
              </p>
              <ul className="mt-5 space-y-2.5 text-xs text-foreground/90">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Start from just £1</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Manage 24/7 in B Bank mobile app</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Interest paid monthly into your ISA</li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border/40">
              <button
                type="button"
                onClick={openSignupModal}
                className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
              >
                Open Account to Subscribe
              </button>
            </div>
          </div>

          <div className="p-7 rounded-3xl border border-primary bg-primary/5 flex flex-col justify-between shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Fixed Rate</span>
              <h3 className="text-xl font-bold text-foreground mt-1">1-Year Fixed Rate Cash ISA</h3>
              <div className="text-2xl font-black text-primary my-3">4.65% <span className="text-xs font-normal text-muted-foreground">Tax-free / AER fixed (Illustrative)</span></div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lock away your funds for 12 months with a guaranteed tax-free return that will not fluctuate with the Bank of England base rate.
              </p>
              <ul className="mt-5 space-y-2.5 text-xs text-foreground/90">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Fixed guaranteed interest rate</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Minimum deposit £500</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Transfer existing ISAs seamlessly</li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-border/40">
              <button
                type="button"
                onClick={openSignupModal}
                className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
              >
                Open Account to Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Tax Disclaimer */}
        <section className="p-6 rounded-2xl border border-border/60 bg-secondary/30 flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-1" />
          <div className="text-xs sm:text-sm space-y-1 text-muted-foreground leading-relaxed">
            <h5 className="font-bold text-foreground text-sm">HMRC Statutory Tax Rules</h5>
            <p>
              Tax rules can change and their benefits depend on your individual circumstances. Under UK law, ISA interest is free from UK income tax. Deposits are securely held under B Bank institutional custody.
            </p>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
