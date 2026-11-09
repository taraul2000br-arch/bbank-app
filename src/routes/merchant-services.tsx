import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  CreditCard, Smartphone, ShoppingCart, CheckCircle2, ArrowRight,
  ShieldCheck, Zap, Globe, Sparkles, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/merchant-services")({
  component: MerchantServicesPage,
  head: () => ({
    meta: [
      { title: "Merchant Solutions — Merchant Services & Card Readers" },
      { name: "description", content: "Accept customer card payments in-person, online, and on the go with Merchant Solutions. Smart card terminals, payment gateways and next-day settlement in GBP (£)." },
    ],
  }),
});

function MerchantServicesPage() {
  const solutions = [
    {
      title: "Smart Card Machines",
      tag: "In-Store & Hospitality",
      desc: "Fast, countertop and portable touchscreen card readers with built-in thermal printers and contactless NFC.",
      perks: [
        "Accepts Visa, Mastercard, Amex, Apple Pay and Google Pay",
        "Wi-Fi and roaming 4G multi-network SIM included",
        "Next-business-day settlement directly into your B Bank account",
      ],
    },
    {
      title: "Online Payment Gateway",
      tag: "E-Commerce Checkout",
      desc: "Seamless, secure web checkout integration for online stores and digital platforms with built-in fraud screening.",
      perks: [
        "Plugins for WooCommerce, Shopify, Magento and custom APIs",
        "3D Secure 2 compliance with frictionless customer authentication",
        "Accept payments in 40+ currencies with automatic conversion to GBP",
      ],
    },
    {
      title: "Virtual Terminal & Pay by Link",
      tag: "Remote & Phone Orders",
      desc: "Take card orders securely over the phone or email a branded one-click payment link directly to your customer.",
      perks: [
        "No hardware or card machine needed",
        "Real-time payment confirmation and automated digital receipts",
        "PCI-DSS Level 1 certified security infrastructure",
      ],
    },
  ];

  return (
    <PublicPageShell
      title="Merchant Services"
      subtitle="Power your retail, restaurant, or e-commerce business with UK industry-leading payment acceptance. Never miss a customer sale."
      badge="Merchant Solutions"
      breadcrumb={[{ label: "Business Banking", to: "/" }, { label: "Merchant Services" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Information Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Merchant Services Information Notice</h4>
            <p className="opacity-90">
              Terminal solutions, hardware descriptions, and transaction rates (from 1.25%) are <strong>illustrative commercial benchmark examples</strong>. Live merchant acquiring requires a formal merchant agreement under Merchant Solutions.
            </p>
          </div>
        </div>

        {/* Solutions Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {solutions.map((s, idx) => (
            <div key={idx} className="p-7 rounded-3xl border border-border/70 bg-card hover:border-primary/40 transition flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{s.tag}</span>
                <h3 className="text-xl font-bold text-foreground mt-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{s.desc}</p>
                <hr className="my-5 border-border/50" />
                <ul className="space-y-3">
                  {s.perks.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{p}</span>
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
          ))}
        </div>

        {/* Pricing Transparency */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h4 className="text-lg font-bold text-foreground">Clear, Competitive Transaction Pricing</h4>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Illustrative rates from 1.25% per UK card transaction with tailored plans for growing business trading volume.
            </p>
          </div>
          <Link
            to="/contact"
            className="px-6 py-3 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition shrink-0"
          >
            Enquire via Support Centre
          </Link>
        </section>
      </div>
    </PublicPageShell>
  );
}
