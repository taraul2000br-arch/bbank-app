import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import {
  Compass, CreditCard, AlertCircle, ShieldCheck, CheckCircle2,
  HelpCircle, ArrowRight, Banknote, Globe
} from "lucide-react";

export const Route = createFileRoute("/travel-money")({
  component: TravelMoneyPage,
  head: () => ({
    meta: [
      { title: "Travel Money & Overseas Spending Guide — Secure Portal" },
      { name: "description", content: "Essential travel money tips for UK travellers. How to avoid ATM fees abroad, dynamic currency conversion tricks, and using debit/credit cards overseas safely." },
    ],
  }),
});

function TravelMoneyPage() {
  const tips = [
    {
      title: "Always Choose to Pay in Local Currency",
      desc: "When paying with your debit or credit card abroad, card terminals will often ask if you want to pay in GBP (£) or the local currency (e.g., EUR or USD). Always choose the local currency to avoid poor dynamic currency conversion (DCC) markups.",
      badge: "Crucial Tip",
    },
    {
      title: "Beware of Independent Foreign ATMs",
      desc: "Independent ATM operators (like Euronet) often charge high local withdrawal convenience fees. Where possible, withdraw cash from ATMs operated by major established international banks.",
      badge: "Save Money",
    },
    {
      title: "Tell Us You're Travelling — No Need Anymore!",
      desc: "With modern B Bank smart security monitoring, you no longer need to inform us before you fly abroad. Your contactless debit and credit cards work automatically worldwide.",
      badge: "Good to Know",
    },
    {
      title: "Emergency Overseas Assistance",
      desc: "If your B Bank card is lost, stolen, or swallowed by a machine while abroad, contact our 24/7 international helpline at +44 2476 842 100 for instant card cancellation and emergency cash disbursement.",
      badge: "24/7 Security",
    },
  ];

  return (
    <PublicPageShell
      title="Travel Money Guide & Overseas Spending"
      subtitle="Planning a holiday or business trip abroad? Follow our expert UK banking guidelines to make the most of your money and avoid costly overseas fees."
      badge="Travel Knowledge"
      breadcrumb={[{ label: "International Banking", to: "/" }, { label: "Travel Money" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Tips Grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {tips.map((tip, idx) => (
            <div key={idx} className="p-7 rounded-3xl border border-border/70 bg-card hover:border-primary/40 transition shadow-sm space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{tip.badge}</span>
              <h3 className="text-xl font-bold text-foreground">{tip.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{tip.desc}</p>
            </div>
          ))}
        </div>

        {/* Informative Travel Disclaimer */}
        <section className="p-6 rounded-2xl border border-border/60 bg-secondary/30 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-1" />
          <div className="text-xs sm:text-sm space-y-1 text-muted-foreground leading-relaxed">
            <h5 className="font-bold text-foreground text-sm">Informational Travel Money Notice</h5>
            <p>
              B Bank does not supply physical foreign currency banknotes over the counter at retail branch counters without prior order. Customers are encouraged to use contactless debit and credit cards for superior exchange rates and fraud protection.
            </p>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
