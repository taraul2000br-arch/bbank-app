import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { TrendingUp, ArrowRight, BarChart3, FileText, Building2, Calendar, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/investor-relations")({
  component: InvestorRelationsPage,
  head: () => ({
    meta: [
      { title: "Investor Relations — B Bank S.A." },
      { name: "description", content: "Investor relations resources, financial governance metrics, and corporate disclosures for B Bank S.A." },
    ],
  }),
});

function InvestorRelationsPage() {
  const metrics = [
    { label: "Digital Deposits Portfolio", value: "£1,250,000.00" },
    { label: "Client Accounts Monitored", value: "Institutional & Retail" },
    { label: "Domestic Settlement Engine", value: "Faster Payments Service (FPS)" },
    { label: "Currency Base", value: "100% British Pound (GBP £)" },
  ];

  const corporateDisclosures = [
    {
      title: "B Bank Portal de Relações com Investidores",
      desc: "Demonstrações financeiras, relatórios anuais e comunicados institucionais ao mercado do B Bank S.A.",
      to: "/contact",
    },
    {
      title: "Cotações e Estrutura de Capital",
      desc: "Informações sobre estrutura acionária, métricas financeiras e governança de capital do B Bank S.A.",
      to: "/contact",
    },
    {
      title: "Governança Corporativa e Diretoria",
      desc: "Perfis dos comitês executivos, diretrizes de governança e regimento institucional.",
      to: "/contact",
    },
  ];

  return (
    <PublicPageShell
      title="Investor Relations"
      subtitle="Financial governance overview, performance metrics, and corporate disclosures for B Bank S.A."
      badge="Investor Information"
      breadcrumb={[{ label: "Investor Relations" }]}
    >
      <div className="max-w-4xl space-y-10">
        {/* Regulatory Notice */}
        <div className="p-5 rounded-2xl border border-border/80 bg-secondary/30 flex items-start gap-4">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Corporate Notice:</strong> For audited financial statements, governance inquiries, or shareholder reports, contact the investor relations office directly via the links below.
          </div>
        </div>

        {/* Operational Highlights */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">Operational Highlights</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {metrics.map((m, idx) => (
              <div key={idx} className="p-5 rounded-2xl border border-border/60 bg-background shadow-sm">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-xl font-bold text-foreground mt-1.5 font-mono">{m.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Official B Bank S.A. Disclosures */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">Official B Bank S.A. Corporate Disclosures</h2>
          </div>
          <div className="space-y-3">
            {corporateDisclosures.map((item, idx) => (
              <Link
                key={idx}
                to={item.to}
                className="block p-5 rounded-2xl border border-border/60 bg-background hover:border-primary/50 hover:bg-secondary/20 transition group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition flex items-center gap-2">
                      <span>{item.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition shrink-0" />
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Corporate Governance Pillars */}
        <section className="p-7 rounded-2xl border border-border/60 bg-secondary/20 space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Corporate Governance & Financial Transparency
          </h3>
          <p>
            The B Bank Digital Banking interface provides resilient financial software engineering. System integrity is verified through continuous automated testing covering double-debit prevention, concurrency locking, and atomic settlement.
          </p>
        </section>
      </div>
    </PublicPageShell>
  );
}
