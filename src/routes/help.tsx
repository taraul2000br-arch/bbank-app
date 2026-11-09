import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { HelpCircle, Search, ChevronDown, ChevronUp, Mail, ShieldAlert, ArrowRight, Lock, ArrowLeftRight, UserCheck, FileText } from "lucide-react";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({
    meta: [
      { title: "Help Centre & FAQ — Secure Portal" },
      { name: "description", content: "Find quick answers about logging in, transfers, statements, and account security." },
    ],
  }),
});

interface FAQItem {
  id: string;
  category: "Login & Access" | "Transfers" | "Statements" | "Blocked Accounts" | "General";
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: "login-trouble",
    category: "Login & Access",
    question: "Why am I seeing 'Invalid login credentials'?",
    answer: "Check that your email is typed correctly and corresponds to your verified account. In our environment, passwords are case-sensitive. If you are logging in as an administrator, ensure you are accessing via the designated admin portal or master credentials.",
  },
  {
    id: "password-recovery",
    category: "Login & Access",
    question: "How can I change or reset my password?",
    answer: "Authenticated customers can update their password via Settings in the side navigation drawer. Master Administrators can use the Change Password console in the Admin panel. If you are locked out, contact our support team via the Contact channels form.",
  },
  {
    id: "transfer-timeline",
    category: "Transfers",
    question: "How long do transfers take to reach the beneficiary?",
    answer: "Domestic transfers within the UK using Faster Payments typically settle in seconds. International transfers debited in GBP (£) to European (EUR), US (USD), Brazilian (BRL), or Polish (PLN) accounts require compliance review and settle upon administrative approval within 1–2 business days.",
  },
  {
    id: "transfer-deduction",
    category: "Transfers",
    question: "What currency is debited when I make an international transfer?",
    answer: "All transfer debits originate exclusively from your B Bank sterling balance in British Pounds (GBP £). The destination country's currency (EUR, USD, BRL, PLN), applied exchange rate, and net amount received are calculated and displayed in the transfer preview.",
  },
  {
    id: "statement-download",
    category: "Statements",
    question: "How do I download or print a proof of payment / receipt?",
    answer: "Navigate to your digital account (Extrato / Statements) and select the 'Comprovantes' tab. Click 'Ver comprovante' on any completed transfer to generate an official PDF receipt complete with protocol, FX rates, and timestamp.",
  },
  {
    id: "account-blocked",
    category: "Blocked Accounts",
    question: "My account displays 'Bloqueio Judicial' or is frozen. What should I do?",
    answer: "A judicial block indicates a legal compliance hold has been placed on the account pursuant to regulatory requirements. Navigate to the 'Bloqueio Judicial' tab in your menu to view the legal process ID and contact our compliance desk via the Contact or Complaints channel.",
  },
  {
    id: "kyc-review",
    category: "General",
    question: "How long does biometric KYC verification take?",
    answer: "Our facial liveness verification and identity document scanning usually process in under 72 hours. Once your status changes to 'approved', your account sort code and full transaction limits are activated.",
  },
];

function HelpPage() {
  const [query, setQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [openId, setOpenId] = useState<string | null>("login-trouble");

  const categories = ["All", "Login & Access", "Transfers", "Statements", "Blocked Accounts", "General"];

  const filtered = FAQS.filter((f) => {
    const matchesCat = selectedCat === "All" || f.category === selectedCat;
    const matchesQuery =
      query.trim() === "" ||
      f.question.toLowerCase().includes(query.toLowerCase()) ||
      f.answer.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <PublicPageShell
      title="Help Centre & Support"
      subtitle="Find answers to frequently asked questions regarding authentication, GBP transfers, statements, and account security."
      badge="Customer Support"
      breadcrumb={[{ label: "Help" }]}
    >
      <div className="max-w-4xl space-y-10">
        {/* Customer Support Notice */}
        <div className="p-4 rounded-xl border border-border/60 bg-secondary/30 text-xs text-muted-foreground flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">Customer Support Notice:</strong> This Help Centre provides assistance regarding features and digital account operations. For external queries or telephone banking with B Bank S.A., please visit <a href="https://www.bbank.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">bbank.com</a>.
          </p>
        </div>

        {/* Search Bar */}
        <div className="p-6 rounded-3xl border border-border/80 bg-secondary/30 space-y-4">
          <label className="text-sm font-semibold text-foreground">Search Help Topics</label>
          <div className="relative">
            <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type your question (e.g. transfers, password, blocked account, statements)..."
              className="w-full h-12 pl-12 pr-4 rounded-full border border-border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pt-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
                  selectedCat === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
            Frequently Asked Questions ({filtered.length})
          </h2>

          {filtered.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-border/60 bg-background text-sm text-muted-foreground">
              No answers found for "{query}". Try another search term or contact our support desk directly.
            </div>
          ) : (
            filtered.map((item) => {
              const isOpen = openId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/60 bg-background overflow-hidden shadow-sm transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-secondary/20 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <span className="font-semibold text-sm sm:text-base text-foreground">{item.question}</span>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 border-t border-border/40 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      <p>{item.answer}</p>
                      <div className="mt-3">
                        <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold bg-secondary text-primary">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Direct Contact Banner */}
        <section className="p-8 rounded-3xl border border-border/60 bg-gradient-to-r from-primary/10 via-secondary/40 to-background flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">Still need assistance?</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Our customer service team is ready to help. Submit a ticket and receive a real tracking protocol.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact Support</span>
            </Link>
            <Link
              to="/complaints"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-border bg-background text-xs font-semibold hover:bg-secondary transition"
            >
              <span>Customer Complaints</span>
            </Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
