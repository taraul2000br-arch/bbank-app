import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import {
  TrendingUp, ArrowRightLeft, ShieldCheck, CheckCircle2,
  Clock, RefreshCw, Calculator, ArrowRight, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/exchange-rates")({
  component: ExchangeRatesPage,
  head: () => ({
    meta: [
      { title: "Indicative Foreign Exchange Rates — Secure Portal" },
      { name: "description", content: "Illustrative commercial exchange rates and currency conversion for the British Pound (GBP) against EUR, USD, PLN, and CHF." },
    ],
  }),
});

function ExchangeRatesPage() {
  const [calcAmount, setCalcAmount] = useState(1000);
  const [direction, setDirection] = useState<"gbpToForeign" | "foreignToGbp">("gbpToForeign");
  const [selectedCurrency, setSelectedCurrency] = useState("EUR");

  const ratesTable = [
    { currency: "Euro", code: "EUR", symbol: "€", buyRate: 1.1852, sellRate: 1.1710, change: "+0.15%" },
    { currency: "US Dollar", code: "USD", symbol: "$", buyRate: 1.2954, sellRate: 1.2810, change: "-0.08%" },
    { currency: "Polish Złoty", code: "PLN", symbol: "zł", buyRate: 5.1240, sellRate: 5.0620, change: "+0.22%" },
    { currency: "Swiss Franc", code: "CHF", symbol: "CHF", buyRate: 1.1420, sellRate: 1.1290, change: "+0.04%" },
    { currency: "Japanese Yen", code: "JPY", symbol: "¥", buyRate: 198.50, sellRate: 195.20, change: "-0.31%" },
    { currency: "Canadian Dollar", code: "CAD", symbol: "CA$", buyRate: 1.7820, sellRate: 1.7610, change: "+0.11%" },
    { currency: "Australian Dollar", code: "AUD", symbol: "A$", buyRate: 1.9680, sellRate: 1.9440, change: "+0.05%" },
  ];

  const currentRateObj = ratesTable.find((r) => r.code === selectedCurrency) || ratesTable[0];
  const convertedAmount = direction === "gbpToForeign"
    ? (calcAmount * currentRateObj.buyRate).toFixed(2)
    : (calcAmount / currentRateObj.sellRate).toFixed(2);

  const formatGBP = (v: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);

  return (
    <PublicPageShell
      title="Indicative Foreign Exchange Rates"
      subtitle="Indicative currency conversion tool using illustrative foreign exchange rates for the British Pound Sterling (GBP). Rates are indicative benchmark values."
      badge="Indicative FX Rates"
      breadcrumb={[{ label: "International Banking", to: "/" }, { label: "Exchange Rates" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Illustrative Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Indicative Exchange Rates Notice</h4>
            <p className="opacity-90">
              The exchange rates and calculations displayed below are <strong>illustrative benchmark values</strong>. They provide indicative conversion estimates and do not constitute a live interbank contractual quote.
            </p>
          </div>
        </div>

        {/* Converter Tool */}
        <section className="p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Interactive FX Currency Converter</h2>
                <p className="text-xs text-muted-foreground">Indicative conversion rates for international payments and transfers</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-4 h-4 text-primary" />
              <span>Indicative Commercial Rates</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center pt-2">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-2">
                  Amount: <span className="text-primary font-bold">{calcAmount} {direction === "gbpToForeign" ? "GBP (£)" : selectedCurrency}</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={25000}
                  step={50}
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-foreground/80 block mb-1">Target Currency</label>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold"
                  >
                    {ratesTable.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code} — {r.currency}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setDirection(direction === "gbpToForeign" ? "foreignToGbp" : "gbpToForeign")}
                  className="mt-5 p-2.5 rounded-xl border border-border hover:bg-secondary text-foreground transition"
                  title="Invert conversion direction"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results box */}
            <div className="p-6 rounded-2xl bg-card border border-border/80 flex flex-col justify-between">
              <div>
                <span className="text-xs text-muted-foreground block">
                  {direction === "gbpToForeign" ? `Illustrative Amount in ${selectedCurrency}` : "Illustrative Equivalent in GBP (£)"}
                </span>
                <span className="text-3xl font-black text-primary mt-1 block">
                  {direction === "gbpToForeign" ? `${currentRateObj.symbol}${convertedAmount}` : `£${convertedAmount}`}
                </span>
                <span className="text-xs text-muted-foreground mt-2 block">
                  Illustrative rate: 1 GBP = {currentRateObj.buyRate} {currentRateObj.code}
                </span>
              </div>

              <div className="pt-5 mt-4 border-t border-border/40">
                <Link
                  to="/transferencia"
                  className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>Go to Transfers in Online Banking</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Indicative Rates Table */}
        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xl font-bold text-foreground">Illustrative Benchmark Rates vs GBP (£)</h3>
            <span className="text-xs text-muted-foreground">Indicative benchmark values</span>
          </div>
          <div className="rounded-3xl border border-border/70 overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left">
                <thead className="bg-secondary/50 text-foreground font-semibold border-b border-border/60">
                  <tr>
                    <th className="p-4 sm:p-5">Currency</th>
                    <th className="p-4 sm:p-5">Code</th>
                    <th className="p-4 sm:p-5">Indicative Buy</th>
                    <th className="p-4 sm:p-5">Indicative Sell</th>
                    <th className="p-4 sm:p-5 text-right">Illustrative 24h Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {ratesTable.map((row) => (
                    <tr key={row.code} className="hover:bg-muted/30 transition">
                      <td className="p-4 sm:p-5 font-semibold text-foreground flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center">
                          {row.symbol}
                        </span>
                        <span>{row.currency}</span>
                      </td>
                      <td className="p-4 sm:p-5 font-mono text-muted-foreground">{row.code}</td>
                      <td className="p-4 sm:p-5 font-semibold text-foreground">{row.buyRate.toFixed(4)}</td>
                      <td className="p-4 sm:p-5 text-muted-foreground">{row.sellRate.toFixed(4)}</td>
                      <td className="p-4 sm:p-5 text-right font-semibold">
                        <span className={row.change.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}>
                          {row.change}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
