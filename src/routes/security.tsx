import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal, openLoginModal } from "@/components/SignupModal";
import {
  ShieldAlert, ShieldCheck, Lock, PhoneCall, AlertCircle,
  CheckCircle2, ArrowRight, Eye, UserCheck, Key
} from "lucide-react";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
  head: () => ({
    meta: [
      { title: "Fraud & Security Centre — Secure Portal" },
      { name: "description", content: "Learn how Secure Portal protects your money from scams, fraud and cybercrime. Confirmation of Payee, APP scam reimbursement rules, and reporting suspicious activity in the UK." },
    ],
  }),
});

function SecurityPage() {
  const protections = [
    {
      title: "Confirmation of Payee (CoP)",
      desc: "Whenever you set up a new UK payment, our systems verify that the recipient's name matches their bank records before any money leaves your account.",
      icon: UserCheck,
    },
    {
      title: "Authorised Push Payment (APP) Reimbursement",
      desc: "Under the UK Payment Systems Regulator (PSR) rules, eligible customers who are tricked into sending money to scammers are reimbursed up to statutory limits.",
      icon: ShieldCheck,
    },
    {
      title: "24/7 Intelligent Fraud Monitoring",
      desc: "Our machine learning systems analyze millions of transactions continuously to identify and block abnormal spending patterns immediately.",
      icon: Eye,
    },
    {
      title: "B Bank Direct Call Verification",
      desc: "If an unexpected caller claims to be from B Bank, you can verify their identity instantly using the 'Call us' feature inside the authentic B Bank app.",
      icon: PhoneCall,
    },
  ];

  return (
    <PublicPageShell
      title="Fraud & Security Centre"
      subtitle="Keeping your money and personal data safe is our utmost priority. Learn how our advanced British banking security safeguards your accounts 24/7."
      badge="UK Fraud Protection"
      breadcrumb={[{ label: "Benefits & Services", to: "/" }, { label: "Fraud & Security" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Urgent fraud alert */}
        <section className="p-6 rounded-3xl border border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-100 flex items-start gap-4">
          <ShieldAlert className="w-7 h-7 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-2 leading-relaxed">
            <h4 className="font-bold text-base text-foreground">Golden Rule of British Banking Safety</h4>
            <p>
              <strong>B Bank or the police will NEVER ask you to transfer money to a "safe account",</strong> ask for your full online PIN or password, or ask you to hand over cards to a courier. If someone tells you to do this, hang up immediately.
            </p>
          </div>
        </section>

        {/* Core Protection Systems */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">How B Bank Protects You</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {protections.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} className="p-7 rounded-3xl border border-border/70 bg-card hover:border-primary/40 transition shadow-sm space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{p.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Immediate Support */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-lg font-bold text-foreground">Suspect fraud or spotted an unusual charge?</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Report suspicious activity immediately. Our fraud response team is available 24 hours a day, 365 days a year across the UK.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/contact"
              className="px-6 py-2.5 rounded-full bg-red-600 text-white text-xs sm:text-sm font-semibold hover:bg-red-700 transition shadow-sm"
            >
              Contact Fraud Team Now
            </Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
