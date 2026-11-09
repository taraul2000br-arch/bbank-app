import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal, openLoginModal } from "@/components/SignupModal";
import {
  Send, Users, CheckCircle2, ArrowRight, ShieldCheck,
  Building, FileSpreadsheet, Clock, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/business-payments")({
  component: BusinessPaymentsPage,
  head: () => ({
    meta: [
      { title: "Business Payments & Payroll Solutions — Secure Portal" },
      { name: "description", content: "Execute high-volume Bacs payments, same-day CHAPS, and scheduled payroll. Dual-authorisation business payment workflows in GBP (£)." },
    ],
  }),
});

function BusinessPaymentsPage() {
  const rails = [
    {
      name: "Faster Payments",
      speed: "Immediate (Under 2 Hours)",
      limit: "Up to £1,000,000 per transaction",
      desc: "Instant 24/7 UK domestic bank transfers for day-to-day supplier invoices and urgent business outgoings.",
    },
    {
      name: "Bacs Direct Credit",
      speed: "3 Working Days",
      limit: "Unlimited bulk volume",
      desc: "The cost-effective UK industry standard for regular staff payroll, pensions, and scheduled supplier batch runs.",
    },
    {
      name: "CHAPS High-Value",
      speed: "Same-Day Guaranteed",
      limit: "Unlimited amount",
      desc: "Bank of England settlement rail designed for commercial property purchases, large acquisitions, and corporate treasury transfers.",
    },
  ];

  return (
    <PublicPageShell
      title="Business Payments & Payroll"
      subtitle="Send money accurately, securely, and at scale. From employee salaries to major supplier invoices, manage your business cash flow with complete control."
      badge="UK Payment Rails"
      breadcrumb={[{ label: "Business Banking", to: "/" }, { label: "Business Payments" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Information Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Business Payment Rails Information Notice</h4>
            <p className="opacity-90">
              Bulk Bacs, CHAPS, and dual-authorisation descriptions represent standard UK commercial rails. Domestic Faster Payments and electronic transfers are available directly in your digital banking profile.
            </p>
          </div>
        </div>

        {/* Payment Rails Grid */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">Standard UK Clearing & Payment Rails</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {rails.map((r, i) => (
              <div key={i} className="p-6 rounded-3xl border border-border/70 bg-card flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg text-foreground">{r.name}</h3>
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-xs font-semibold text-primary">{r.speed}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{r.limit}</div>
                  <hr className="my-4 border-border/50" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dual-Authorisation Workflow */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Multi-User Security & Dual-Authorisation</h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Protect your company funds by requiring two independent directors or authorized finance managers to approve payments over customizable threshold limits. Safeguards against fraud, human error, and unauthorized disbursements.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={openSignupModal}
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition shadow-sm"
            >
              Open Account to Enquire
            </button>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
