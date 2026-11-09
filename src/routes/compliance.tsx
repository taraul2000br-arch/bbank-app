import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { ShieldCheck, Lock, FileSearch, UserCheck, Scale, AlertOctagon, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/compliance")({
  component: CompliancePage,
  head: () => ({
    meta: [
      { title: "Ethics, Security & Compliance — Secure Portal" },
      { name: "description", content: "Explore our compliance policies, AML/KYC guidelines, and reporting channels." },
    ],
  }),
});

function CompliancePage() {
  const pillars = [
    {
      icon: Lock,
      title: "1. Information Security Architecture",
      items: [
        "Cryptographically generated random 24-character master credentials using CSPRNG.",
        "Role-based privilege separation isolating authenticated customers, standard staff, and Master Administrators.",
        "Zero exposure of service_role credentials to browser clients; administrative RPCs executable exclusively via backend server functions.",
        "Strict database Row-Level Security (RLS) denying tenant cross-access.",
      ],
    },
    {
      icon: ShieldCheck,
      title: "2. Anti-Money Laundering (AML) & Fraud Prevention",
      items: [
        "Automated balance threshold verification ensuring origin accounts cannot be overdrawn.",
        "Idempotency keys on all financial submissions eliminating duplicate requests.",
        "Strict HMRC compliance attachment checkpoints for international transfers.",
        "Immediate judicial freeze capabilities with automated asset lockouts.",
      ],
    },
    {
      icon: UserCheck,
      title: "3. Know Your Customer (KYC) Protocols",
      items: [
        "Mandatory biometric facial capture with live liveness verification powered by face-api.js.",
        "Document verification queue enabling reviewers to validate passports, driving licences, and national IDs.",
        "Status machine restricting unauthorized outbound transfers until identity is approved.",
      ],
    },
    {
      icon: Scale,
      title: "4. Acceptable Use Policy",
      items: [
        "The platform is dedicated to secure client account management, operational integrity, and verified digital banking workflows.",
        "Prohibition of automated credential stuffing, distributed denial of service, and unauthorized penetration testing.",
        "All transfer operations are subject to multi-tier verification before clearance.",
      ],
    },
  ];

  return (
    <PublicPageShell
      title="Ethics, Security & Compliance"
      subtitle="The governance framework, fraud prevention controls, and regulatory integrity mechanisms implemented across our digital banking platform."
      badge="Compliance Framework"
      breadcrumb={[{ label: "Ethics & Compliance" }]}
    >
      <div className="max-w-4xl space-y-10 legal-content selectable-content select-text">
        {/* Intro */}
        <section className="p-6 rounded-2xl border border-border/60 bg-background shadow-sm leading-relaxed text-sm text-muted-foreground">
          <p>
            B Bank operates on the principle that trust is the foundation of digital banking. Our digital banking platform enforces the architectural safeguards expected of Tier-1 financial institutions, including multi-tier authorization, immutable audit logging, and UK GDPR data handling standards.
          </p>
        </section>

        {/* Pillars */}
        <div className="space-y-6">
          {pillars.map((p, idx) => {
            const Icon = p.icon;
            return (
              <section key={idx} className="p-7 rounded-2xl border border-border/60 bg-background shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground">{p.title}</h3>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                  {p.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Whistleblower / Issue Reporting Channel */}
        <section className="p-8 rounded-2xl border border-border/60 bg-secondary/30 space-y-4">
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
            <AlertOctagon className="w-6 h-6 shrink-0" />
            <h3 className="text-lg font-bold text-foreground">Report an Ethical Concern or Vulnerability</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you identify a security anomaly, vulnerability, or ethical breach, our compliance officers are ready to investigate. Every report generates an official tracking protocol.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/complaints"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
            >
              <span>Submit Formal Complaint</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-border bg-background text-xs font-semibold hover:bg-secondary transition"
            >
              <span>Contact Compliance Desk</span>
            </Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
