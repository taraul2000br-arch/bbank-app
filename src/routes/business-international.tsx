import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  Globe, ArrowRightLeft, ShieldCheck, CheckCircle2, ArrowRight,
  Landmark, DollarSign, Euro, PoundSterling, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/business-international")({
  component: BusinessInternationalPage,
  head: () => ({
    meta: [
      { title: "International Business Payments & Multi-Currency Accounts — Secure Portal" },
      { name: "description", content: "Trade globally with Secure Portal international business banking. Multi-currency accounts in USD, EUR and GBP, SWIFT payments and commercial FX risk management." },
    ],
  }),
});

function BusinessInternationalPage() {
  const currencies = [
    { code: "USD", name: "US Dollar Account", desc: "Pay US suppliers and receive client payments via domestic ACH and Fedwire without double conversion." },
    { code: "EUR", name: "Euro Account", desc: "Send and receive SEPA payments across the European Union with dedicated European IBAN credentials." },
    { code: "GBP", name: "Sterling Master Account", desc: "Your primary domestic clearing hub connected directly to the Bank of England and UK Faster Payments." },
  ];

  return (
    <PublicPageShell
      title="International Business Payments"
      subtitle="Connect your UK business to suppliers and clients worldwide. Multi-currency cash management, transparent exchange rates, and reliable SWIFT settlement."
      badge="Global Business Trade"
      breadcrumb={[{ label: "Business Banking", to: "/" }, { label: "International Business" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Information Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">International Business Accounts Notice</h4>
            <p className="opacity-90">
              Commercial multi-currency facilities and FX hedging contracts are <strong>illustrative corporate capabilities</strong>. Cross-border payments and currency transfers are accessible directly via Online Banking.
            </p>
          </div>
        </div>

        {/* Multi-Currency Hub */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Multi-Currency Business Accounts</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Hold, convert, and pay in major international currencies directly from your B Bank business banking platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {currencies.map((c, i) => (
              <div key={i} className="p-7 rounded-3xl border border-border/70 bg-card flex flex-col justify-between shadow-sm">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-black text-lg flex items-center justify-center mb-3">
                    {c.code}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{c.name}</h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{c.desc}</p>
                </div>
                <div className="pt-6 mt-6 border-t border-border/40">
                  <button
                    type="button"
                    onClick={openSignupModal}
                    className="w-full py-2.5 rounded-full border border-primary text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition"
                  >
                    Open Account to Enquire ({c.code})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Global Payment Capabilities */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 space-y-4">
          <h3 className="text-lg font-bold text-foreground">Hedging & Commercial FX Management</h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Protect your business profit margins from adverse exchange rate movements. Lock in rates with Forward Contracts or set automated target orders that execute when the market reaches your preferred level.
          </p>
          <div className="pt-2">
            <Link
              to="/transferencia"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition shadow-sm"
            >
              <span>Make an International Transfer</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
