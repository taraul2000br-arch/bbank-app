import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { TransferReceiptModal } from "@/components/TransferReceiptModal";
import {
  Search, ShieldCheck, CheckCircle2, Clock, Globe,
  ArrowRight, Landmark, FileText, AlertCircle, Copy, Check
} from "lucide-react";

export const Route = createFileRoute("/track-payment")({
  component: TrackPaymentPage,
  head: () => ({
    meta: [
      { title: "Track Payment — Secure Portal" },
      { name: "description", content: "Payment tracking service. Follow the clearing progression of cross-border transfers within Secure Portal digital banking." },
    ],
  }),
});

function TrackPaymentPage() {
  const [protocolInput, setProtocolInput] = useState("");
  const [searched, setSearched] = useState(false);
  const [activeReceiptModal, setActiveReceiptModal] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!protocolInput.trim()) return;
    setSearched(true);
  };

  const sampleProtocol = "BB-INT-8941-GB";

  return (
    <PublicPageShell
      title="Track Payment"
      subtitle="Follow the clearing lifecycle of cross-border and domestic transfers within B Bank Online Banking. Real-time updates from internal validation to correspondent settlement."
      badge="Payment Tracker"
      breadcrumb={[{ label: "International Banking", to: "/" }, { label: "Track Payment" }]}
    >
      <div className="max-w-4xl space-y-12">
        {/* Information Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Payment Tracking Information Notice</h4>
            <p className="opacity-90">
              This tracking tool illustrates how cross-border transfers move through compliance, dispatch, and settlement. Transfers can be verified directly in your <Link to="/extrato" className="underline font-semibold">Account Statements</Link>.
            </p>
          </div>
        </div>

        {/* Search Input Box */}
        <section className="p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <label className="text-sm font-bold text-foreground block">
              Enter your Transfer Reference, Protocol Number, or Specimen Code:
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. BB-INT-8941-GB or transfer UUID"
                  value={protocolInput}
                  onChange={(e) => setProtocolInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border border-border bg-background text-foreground text-sm font-mono placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                type="submit"
                className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition shadow-sm shrink-0"
              >
                Track Status
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Try sample reference:</span>
              <button
                type="button"
                onClick={() => { setProtocolInput(sampleProtocol); setSearched(true); }}
                className="font-mono text-primary font-semibold hover:underline"
              >
                {sampleProtocol}
              </button>
            </div>
          </form>

          {/* Results Timeline */}
          {searched && (
            <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/50 pb-4">
                <div>
                  <span className="text-xs text-muted-foreground block font-mono">Reference: {protocolInput}</span>
                  <h3 className="text-lg font-bold text-foreground mt-0.5">Clearing Lifecycle Progression</h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/20">
                  Settlement Complete
                </span>
              </div>

              {/* Step progression */}
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Step 1 — Instruction Initiated & Debited</h4>
                    <p className="text-xs text-muted-foreground">Debited from B Bank Current Account in GBP (£). Funds earmarked.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Step 2 — Internal Compliance Verification</h4>
                    <p className="text-xs text-muted-foreground">Sanctions screening and Confirmation of Payee verification checks completed.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Step 3 — Outbound Dispatch (International Clearing Rails)</h4>
                    <p className="text-xs text-muted-foreground">Correspondent dispatch queue acknowledged.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-600 dark:text-emerald-400">Step 4 — Settlement Confirmed</h4>
                    <p className="text-xs text-muted-foreground">Funds cleared in beneficiary ledger in target currency.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/40 flex justify-between items-center flex-wrap gap-3">
                <span className="text-xs text-muted-foreground">Audit record logged in database ledger.</span>
                <Link
                  to="/extrato"
                  className="px-5 py-2 rounded-full border border-border text-foreground text-xs font-semibold hover:bg-secondary transition"
                >
                  View in Account Statements
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Informative Guidance */}
        <section className="p-6 rounded-2xl border border-border/60 bg-secondary/30 flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-1" />
          <div className="text-xs sm:text-sm space-y-1 text-muted-foreground leading-relaxed">
            <h5 className="font-bold text-foreground text-sm">Where do I find my reference?</h5>
            <p>
              Your official protocol reference is printed on your downloadable PDF transfer receipt and is also visible within your <Link to="/extrato" className="text-primary underline">Account Statements</Link> under each executed transfer entry.
            </p>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
