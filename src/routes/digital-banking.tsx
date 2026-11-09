import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal, openLoginModal } from "@/components/SignupModal";
import {
  Smartphone, ShieldCheck, CheckCircle2, ArrowRight, Bell,
  Lock, Laptop, ScanFace, FileText, Zap
} from "lucide-react";

export const Route = createFileRoute("/digital-banking")({
  component: DigitalBankingPage,
  head: () => ({
    meta: [
      { title: "Digital Banking App & Online Services — Secure Portal" },
      { name: "description", content: "Bank whenever and wherever you choose. Explore the Secure Portal app, biometric security, instant spending notifications, and paperless digital statements in GBP (£)." },
    ],
  }),
});

function DigitalBankingPage() {
  const features = [
    {
      title: "Biometric Login",
      desc: "Log in swiftly and securely using Apple Face ID, Touch ID, or Android Biometrics without typing passwords.",
      icon: ScanFace,
    },
    {
      title: "Instant Card Controls",
      desc: "Misplaced your debit card? Freeze and unfreeze transactions with a single tap in the app.",
      icon: Lock,
    },
    {
      title: "Real-Time Spending Notifications",
      desc: "Receive instant push alerts every time money enters or leaves your B Bank current account in GBP (£).",
      icon: Bell,
    },
    {
      title: "Paperless Statements & Tax Certificates",
      desc: "Download up to 7 years of official PDF bank statements and interest certificates whenever you need them.",
      icon: FileText,
    },
    {
      title: "Open Banking Dashboard",
      desc: "Connect accounts from other UK banks into your B Bank app for a unified view of your entire financial life.",
      icon: Laptop,
    },
    {
      title: "Instant Cheque Imaging",
      desc: "Pay UK cheques up to £2,000 directly into your current account simply by taking a photo on your smartphone.",
      icon: Zap,
    },
  ];

  return (
    <PublicPageShell
      title="Digital Banking Services"
      subtitle="Experience seamless British banking at your fingertips. Award-winning mobile app and online banking platform designed to keep you in total control."
      badge="Digital Experience"
      breadcrumb={[{ label: "Benefits & Services", to: "/" }, { label: "Digital Banking" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="p-7 rounded-3xl border border-border/70 bg-card hover:border-primary/40 transition shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Access CTA */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-foreground">Ready to access your digital account?</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Sign in with your B Bank credentials or register for online banking in just a few minutes.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={openLoginModal}
              className="px-6 py-2.5 rounded-full border border-primary text-primary text-xs sm:text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition"
            >
              Log In to Online Banking
            </button>
            <button
              type="button"
              onClick={openSignupModal}
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition shadow-sm"
            >
              Open New Account
            </button>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
