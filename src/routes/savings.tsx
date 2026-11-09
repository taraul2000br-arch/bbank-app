import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  PiggyBank, Calculator, ShieldCheck, ArrowRight, CheckCircle2,
  TrendingUp, Percent, AlertCircle, Sparkles
} from "lucide-react";

export const Route = createFileRoute("/savings")({
  component: SavingsPage,
  head: () => ({
    meta: [
      { title: "Savings Accounts — Secure Portal" },
      { name: "description", content: "Grow your money with Secure Portal savings accounts. Everyday Saver, B Bank Rewards Saver and fixed rate bonds in GBP (£)." },
    ],
  }),
});

function SavingsPage() {
  const [initialDeposit, setInitialDeposit] = useState(1500);
  const [monthlyContribution, setMonthlyContribution] = useState(150);
  const [months, setMonths] = useState(12);
  const rateAER = 0.045; // 4.5% AER

  // Future value calculation with regular monthly deposits
  const calculateTotal = () => {
    let balance = initialDeposit;
    const monthlyRate = rateAER / 12;
    for (let i = 0; i < months; i++) {
      balance = (balance + monthlyContribution) * (1 + monthlyRate);
    }
    return balance;
  };

  const totalBalance = calculateTotal();
  const totalDeposited = initialDeposit + monthlyContribution * months;
  const totalInterest = Math.max(0, totalBalance - totalDeposited);

  const formatGBP = (v: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);

  return (
    <PublicPageShell
      title="Savings Accounts in GBP (£)"
      subtitle="Put your money to work with secure UK savings accounts. Instant access, monthly interest, and competitive AER rates."
      badge="UK Savings & Growth"
      breadcrumb={[{ label: "Everyday Banking", to: "/" }, { label: "Savings Accounts" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Rates Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Illustrative UK Savings & AER Benchmark Notice</h4>
            <p className="opacity-90">
              The calculator and interest rates shown (e.g. 4.50% and 5.12% AER variable) are <strong>illustrative benchmark examples</strong>. Actual interest rates fluctuate with the Bank of England base rate and product terms.
            </p>
          </div>
        </div>

        {/* Interactive Savings Calculator */}
        <section className="p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Interactive UK Savings Growth Calculator</h2>
              <p className="text-xs text-muted-foreground">Calculate estimated returns at 4.50% AER variable on GBP deposits</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-2">
            <div>
              <label className="text-xs font-semibold text-foreground/80 block mb-2">
                Initial Deposit: <span className="text-primary font-bold">{formatGBP(initialDeposit)}</span>
              </label>
              <input
                type="range"
                min={100}
                max={20000}
                step={100}
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>£100</span>
                <span>£20,000</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/80 block mb-2">
                Monthly Top-Up: <span className="text-primary font-bold">{formatGBP(monthlyContribution)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1000}
                step={25}
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>£0</span>
                <span>£1,000 / mo</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/80 block mb-2">
                Time Horizon: <span className="text-primary font-bold">{months} months ({months / 12} yrs)</span>
              </label>
              <input
                type="range"
                min={6}
                max={60}
                step={6}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>6 mos</span>
                <span>5 years</span>
              </div>
            </div>
          </div>

          {/* Calculator Output */}
          <div className="p-6 rounded-2xl bg-card border border-border/80 grid sm:grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-xs text-muted-foreground block">Total Deposits</span>
              <span className="text-lg font-bold text-foreground mt-1 block">{formatGBP(totalDeposited)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Estimated Interest Earned</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">+{formatGBP(totalInterest)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Estimated Future Total</span>
              <span className="text-2xl font-black text-primary mt-0.5 block">{formatGBP(totalBalance)}</span>
            </div>
          </div>
        </section>

        {/* Savings Accounts Comparison */}
        <section className="space-y-6">
          <h3 className="text-xl font-bold text-foreground">Explore Our Savings Range</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl border border-border/60 bg-card flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Instant Access</span>
                <h4 className="text-lg font-bold text-foreground mt-1">Everyday Saver</h4>
                <div className="text-2xl font-black text-primary my-3">1.80% <span className="text-xs font-normal text-muted-foreground">AER / Gross</span></div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Start with as little as £1. Withdraw and deposit whenever you like with no penalty fees.
                </p>
              </div>
              <button
                type="button"
                onClick={openSignupModal}
                className="mt-6 w-full py-2.5 rounded-full border border-primary text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition"
              >
                Apply for Everyday Saver
              </button>
            </div>

            <div className="p-6 rounded-3xl border border-primary bg-primary/5 shadow-md flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">High Interest</span>
                <h4 className="text-lg font-bold text-foreground mt-1">B Bank Rewards Saver</h4>
                <div className="text-2xl font-black text-primary my-3">4.50% <span className="text-xs font-normal text-muted-foreground">AER on up to £10,000</span></div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Exclusive to B Bank current account holders enrolled in Rewards. Maximise your monthly returns.
                </p>
              </div>
              <button
                type="button"
                onClick={openSignupModal}
                className="mt-6 w-full py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
              >
                Join Rewards & Save
              </button>
            </div>

            <div className="p-6 rounded-3xl border border-border/60 bg-card flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Guaranteed Growth</span>
                <h4 className="text-lg font-bold text-foreground mt-1">Fixed-Rate Bond</h4>
                <div className="text-2xl font-black text-primary my-3">4.75% <span className="text-xs font-normal text-muted-foreground">AER (1 Year)</span></div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Lock away £500 or more for 1 or 2 years with a guaranteed fixed return paid at maturity.
                </p>
              </div>
              <Link
                to="/fixed-savings"
                className="mt-6 w-full py-2.5 rounded-full border border-primary text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition text-center inline-block"
              >
                View Fixed Bonds
              </Link>
            </div>
          </div>
        </section>

        {/* Protection information */}
        <section className="p-6 rounded-2xl border border-border/60 bg-secondary/30 flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-1" />
          <div className="text-xs sm:text-sm space-y-1 text-muted-foreground leading-relaxed">
            <h5 className="font-bold text-foreground text-sm">Institutional Security & Account Protection</h5>
            <p>
              Deposits with B Bank S.A. are maintained under strict encrypted digital custody with continuous transaction monitoring and multi-factor authorization.
            </p>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
