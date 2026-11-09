import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { PiggyBank, ShieldCheck, AlertCircle, ArrowRight, BarChart2, Briefcase, Landmark } from "lucide-react";

export const Route = createFileRoute("/investments")({
  component: InvestmentsPage,
  head: () => ({
    meta: [
      { title: "Investments & Wealth Management — B Bank" },
      { name: "description", content: "Overview of British wealth management, ISAs, Gilts, and investment principles." },
    ],
  }),
});

function InvestmentsPage() {
  const topics = [
    {
      icon: Landmark,
      title: "Stocks & Shares ISAs (UK Standards)",
      desc: "An Individual Savings Account (ISA) allows UK residents to invest up to statutory annual allowances (£20,000 per tax year) free from UK income tax and capital gains tax.",
    },
    {
      icon: Briefcase,
      title: "UK Government Bonds (Gilts)",
      desc: "Fixed-income debt securities issued by HM Treasury through the Debt Management Office, offering sovereign backing and regular coupon yields.",
    },
    {
      icon: BarChart2,
      title: "Diversified Index Funds",
      desc: "Broad-market collective investment schemes tracking benchmarks like the FTSE 100, FTSE All-Share, or global equity indices to minimize single-stock risk.",
    },
    {
      icon: PiggyBank,
      title: "Treasury Cash Management",
      desc: "Disciplined short-term liquidity management providing capital preservation for institutional and high-net-worth accounts.",
    },
  ];

  return (
    <PublicPageShell
      title="Investments & Wealth Management"
      subtitle="Overview of UK investment vehicles, wealth management solutions, and disciplined portfolio strategies."
      badge="Wealth Management"
      breadcrumb={[{ label: "Investments" }]}
    >
      <div className="max-w-4xl space-y-10">
        {/* Investment Principles */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Common UK Investment Solutions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              An educational overview of typical structures available to UK banking customers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {topics.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="p-6 rounded-2xl border border-border/60 bg-background shadow-sm hover:border-primary/40 transition">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Wealth Planning Principles */}
        <section className="p-8 rounded-2xl border border-border/60 bg-secondary/30 space-y-4">
          <h3 className="text-lg font-bold text-foreground">Core Pillars of Prudent Investing</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-xs sm:text-sm text-muted-foreground">
            <div className="p-4 rounded-xl border border-border/40 bg-background">
              <h5 className="font-semibold text-foreground mb-1">1. Emergency Fund</h5>
              <p>Keep 3–6 months of living expenses in an accessible GBP cash account before committing capital to long-term markets.</p>
            </div>
            <div className="p-4 rounded-xl border border-border/40 bg-background">
              <h5 className="font-semibold text-foreground mb-1">2. Diversification</h5>
              <p>Spread investments across asset classes (equities, bonds, cash) and geographic regions to balance cyclical volatility.</p>
            </div>
            <div className="p-4 rounded-xl border border-border/40 bg-background">
              <h5 className="font-semibold text-foreground mb-1">3. Long-Term Horizon</h5>
              <p>Give your portfolio time to compound over multi-year market cycles, filtering out short-term speculative noise.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="p-6 rounded-2xl border border-border/60 bg-background flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-foreground">Have questions about your digital GBP account?</h4>
            <p className="text-xs text-muted-foreground mt-1">Our support specialists are available to assist with account features.</p>
          </div>
          <Link
            to="/help"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shrink-0"
          >
            <span>Visit Help Centre</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      </div>
    </PublicPageShell>
  );
}
