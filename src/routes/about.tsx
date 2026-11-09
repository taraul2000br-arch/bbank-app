import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { Landmark, ArrowRight, Shield, CreditCard, ArrowLeftRight, Users, Sparkles, Server } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Secure Portal" },
      { name: "description", content: "Learn about the architecture, security features, and engineering behind Secure Portal." },
    ],
  }),
});

function AboutPage() {
  const capabilities = [
    {
      icon: Landmark,
      title: "Digital Current Account in GBP (£)",
      desc: "Instant digital account with Sort Code, Account Number, and live balance formatted to British standards (en-GB).",
    },
    {
      icon: ArrowLeftRight,
      title: "Global & Domestic Transfers",
      desc: "Instant debiting in GBP (£) with applied commercial exchange rates and automated HMRC compliance attachment verification.",
    },
    {
      icon: CreditCard,
      title: "Credit Card Management",
      desc: "Personalised card management with real-time limit controls, spending insights, and administrative approval workflow.",
    },
    {
      icon: Shield,
      title: "Automated KYC Verification",
      desc: "Facial biometric detection via face-api.js with document scanning, instant validation, and reviewer approval queues.",
    },
    {
      icon: Users,
      title: "Admin Master Control Console",
      desc: "Centralized administration with role-based permissions, atomic transfer approvals, refund processing, and audit logs.",
    },
    {
      icon: Server,
      title: "Resilient PostgreSQL Architecture",
      desc: "Engineered on Supabase PostgreSQL with strict Row-Level Security, atomic stored procedures, and idempotency guarantees.",
    },
  ];

  return (
    <PublicPageShell
      title="About B Bank Digital Banking"
      subtitle="A modern, high-security digital banking platform engineered to support UK banking operations, compliance workflows, and multi-currency international transfers."
      badge="Platform Overview"
      breadcrumb={[{ label: "About Us" }]}
    >
      <div className="max-w-4xl space-y-12">
        {/* Intro Hero Card */}
        <section className="p-8 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-secondary/30 space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="w-4 h-4" />
            <span>Next-Generation Banking Platform</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Reimagining the British Banking Experience
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            The B Bank Digital Banking platform provides modern web banking, incorporating full client-side reactivity, strict server-side transaction atomicity, automated compliance review workflows, and rigorous adherence to British financial standards.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/compliance"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
            >
              <span>Explore Security & Compliance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-background text-xs font-semibold hover:bg-secondary transition"
            >
              <span>Contact Client Support</span>
            </Link>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section className="space-y-6">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-foreground">Available Banking Features</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Every banking module is fully functional within our secure financial ledger.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div key={i} className="p-6 rounded-2xl border border-border/60 bg-background shadow-sm hover:border-primary/40 transition">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-base text-foreground">{cap.title}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                    {cap.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Technical Architecture */}
        <section className="p-8 rounded-2xl border border-border/60 bg-secondary/30 space-y-4">
          <h3 className="text-lg font-bold text-foreground">Engineering Principles</h3>
          <ul className="space-y-3 text-xs sm:text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span><strong>Atomic Transactions:</strong> All debits, balance adjustments, and refunds execute inside ACID PostgreSQL functions with row locking to eliminate race conditions.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span><strong>Idempotency Guarantees:</strong> Unique idempotency keys prevent duplicate payments on connection drops or repeated form submissions.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span><strong>Universal GBP (£) Denomination:</strong> All customer balances, statements, and debit operations are standardized in British Pounds.</span>
            </li>
          </ul>
        </section>
      </div>
    </PublicPageShell>
  );
}
