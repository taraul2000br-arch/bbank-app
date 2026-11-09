import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  Shield, Home, Heart, Smartphone, Plane, CheckCircle2,
  ArrowRight, AlertCircle, FileCheck
} from "lucide-react";

export const Route = createFileRoute("/insurance")({
  component: InsurancePage,
  head: () => ({
    meta: [
      { title: "Insurance & Family Protection — Secure Portal" },
      { name: "description", content: "Protect what matters most. Home insurance, life insurance, travel and gadget cover underwritten by trusted UK insurance partners." },
    ],
  }),
});

function InsurancePage() {
  const policies = [
    {
      title: "Home Insurance",
      icon: Home,
      tagline: "Buildings and contents cover tailored for homeowners and renters",
      highlights: [
        "Up to £1,000,000 buildings cover for structural damage and subsidence",
        "Up to £100,000 contents cover with new-for-old replacement",
        "24/7 home emergency response team across the UK",
        "Optional accidental damage cover for technology and home fixtures",
      ],
      cta: "Get Home Quote",
    },
    {
      title: "Life Insurance",
      icon: Heart,
      tagline: "Financial reassurance for your loved ones if the worst should happen",
      highlights: [
        "Fixed monthly premiums that never increase over the term",
        "Lump sum payout to help pay off mortgages or cover living expenses",
        "Terminal illness benefit included at no extra cost",
        "Free UK bereavement support and counselling services",
      ],
      cta: "Explore Life Cover",
    },
    {
      title: "Travel & Gadget Cover",
      icon: Plane,
      tagline: "Worldwide protection for family trips, smartphones, and laptops",
      highlights: [
        "Medical emergency expenses up to £10,000,000 worldwide",
        "Baggage, flight delay, and holiday cancellation protection",
        "Instant smartphone screen and water damage cover with fast replacement",
        "Included automatically for B Bank Premier banking customers",
      ],
      cta: "View Travel Cover",
    },
  ];

  return (
    <PublicPageShell
      title="Insurance & Family Protection"
      subtitle="Shield your home, your family, and your valuables with comprehensive insurance policies underwritten by leading UK providers."
      badge="UK Protection"
      breadcrumb={[{ label: "Borrowing & Protection", to: "/" }, { label: "Insurance" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Illustrative Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Insurance & Cover Illustrative Notice</h4>
            <p className="opacity-90">
              Policy descriptions, coverage limits (£1,000,000 buildings, £10,000,000 travel medical) and premiums are <strong>illustrative benchmark examples</strong>. Formal policies require individual underwriting risk assessment and declaration.
            </p>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {policies.map((pol, idx) => {
            const Icon = pol.icon;
            return (
              <div
                key={idx}
                className="p-7 rounded-3xl border border-border/70 bg-card hover:border-primary/40 transition flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{pol.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {pol.tagline}
                  </p>

                  <hr className="my-5 border-border/50" />

                  <ul className="space-y-3">
                    {pol.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-border/40">
                  <button
                    type="button"
                    onClick={openSignupModal}
                    className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition shadow-sm"
                  >
                    Open Account to Enquire
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Insurance Terms Notice */}
        <section className="p-6 rounded-2xl border border-border/60 bg-secondary/30 flex items-start gap-4">
          <FileCheck className="w-6 h-6 text-primary shrink-0 mt-1" />
          <div className="text-xs sm:text-sm space-y-1 text-muted-foreground leading-relaxed">
            <h5 className="font-bold text-foreground text-sm">Insurance Intermediary & Policy Notice</h5>
            <p>
              B Bank S.A. connects account holders with accredited underwriting partners. Policy terms, exclusions, and coverage schedules are subject to underwriting verification upon contracting.
            </p>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
