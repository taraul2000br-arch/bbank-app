import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  Lock, Calculator, ShieldCheck, CheckCircle2, ArrowRight,
  Sparkles, Calendar, DollarSign, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/fixed-savings")({
  component: FixedSavingsPage,
  head: () => ({
    meta: [
      { title: "Fixed-Term Savings Bonds — Secure Portal" },
      { name: "description", content: "Lock away lump sums in GBP (£) with guaranteed fixed interest rates. 1-year, 2-year, and 3-year Secure Portal Fixed-Rate Bonds." },
    ],
  }),
});

function FixedSavingsPage() {
  const [bondAmount, setBondAmount] = useState(5000);
  const [selectedTerm, setSelectedTerm] = useState<1 | 2 | 3>(1);

  const rates = {
    1: 0.0475, // 4.75% AER
    2: 0.0450, // 4.50% AER
    3: 0.0425, // 4.25% AER
  };

  const rate = rates[selectedTerm];
  const interestEarned = bondAmount * (Math.pow(1 + rate, selectedTerm) - 1);
  const finalMaturityAmount = bondAmount + interestEarned;

  const formatGBP = (v: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);

  return (
    <PublicPageShell
      title="Fixed-Term Savings Bonds in GBP (£)"
      subtitle="Know exactly how much your money will earn. Lock away a lump sum from £500 for a fixed term with guaranteed returns and zero market risk."
      badge="Guaranteed Returns"
      breadcrumb={[{ label: "Savings & Investments", to: "/" }, { label: "Fixed-Term Savings" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Information Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Illustrative Fixed-Rate Savings Notice</h4>
            <p className="opacity-90">
              Fixed-rate yields (4.75%, 4.50%, 4.25% AER) and maturity calculations below are <strong>illustrative benchmark examples</strong> and do not constitute a formal contractual deposit agreement.
            </p>
          </div>
        </div>

        {/* Interactive Bond Returns Calculator */}
        <section className="p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Interactive Bond Maturity Calculator</h2>
              <p className="text-xs text-muted-foreground">Calculate your guaranteed return at term maturity</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-2">
                  Lump Sum Deposit: <span className="text-primary font-bold">{formatGBP(bondAmount)}</span>
                </label>
                <input
                  type="range"
                  min={500}
                  max={100000}
                  step={500}
                  value={bondAmount}
                  onChange={(e) => setBondAmount(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>£500 min</span>
                  <span>£100,000</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-2">Choose Bond Term</label>
                <div className="grid grid-cols-3 gap-3">
                  {([1, 2, 3] as const).map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedTerm(yr)}
                      className={`py-3 px-2 rounded-2xl border text-center transition ${
                        selectedTerm === yr
                          ? "border-primary bg-primary text-primary-foreground font-bold shadow-md"
                          : "border-border bg-card text-foreground hover:border-primary/50 text-xs font-semibold"
                      }`}
                    >
                      <div className="text-sm font-bold">{yr} Year</div>
                      <div className="text-[11px] opacity-90">{(rates[yr] * 100).toFixed(2)}% AER</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Output */}
            <div className="p-6 rounded-2xl bg-card border border-border/80 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-border/50 pb-3">
                  <span className="text-xs text-muted-foreground block">Guaranteed Payout at Maturity</span>
                  <span className="text-3xl font-black text-primary mt-1 block">{formatGBP(finalMaturityAmount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Interest Rate:</span>
                    <span className="font-semibold text-foreground">{(rate * 100).toFixed(2)}% AER Fixed</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Total Interest Earned:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatGBP(interestEarned)}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-border/40">
                    <span className="text-muted-foreground block">Term Duration:</span>
                    <span className="text-xs font-semibold text-foreground">{selectedTerm} year(s) with locked interest</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-border/40">
                <button
                  type="button"
                  onClick={openSignupModal}
                  className="w-full py-3 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>Open Account to Subscribe ({selectedTerm}-Year Bond)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Protection */}
        <section className="p-6 rounded-2xl border border-border/60 bg-secondary/30 flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-1" />
          <div className="text-xs sm:text-sm space-y-1 text-muted-foreground leading-relaxed">
            <h5 className="font-bold text-foreground text-sm">Capital Safety & Deposit Terms</h5>
            <p>
              Your fixed deposits are securely held under B Bank S.A. institutional custody with end-to-end auditability. Withdrawals are not permitted until the conclusion of the agreed term.
            </p>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
