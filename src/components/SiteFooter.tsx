import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { ShieldCheck } from "lucide-react";
import { getInstitutionName } from "@/config/institution";

export function SiteFooter() {
  const { t } = useI18n();

  const aboutLinks = [
    { label: getInstitutionName(), to: "/about" },
    { label: "Investor Relations", to: "/investor-relations" },
    { label: "Ethics & Compliance", to: "/compliance" },
    { label: "Investments", to: "/investments" },
    { label: "Blog", to: "/blog" },
    { label: "Newsroom", to: "/newsroom" },
  ];

  const helpLinks = [
    { label: t("conta.help") || "Help", to: "/help" },
    { label: t("footer.contact") || "Contact channels", to: "/contact" },
    { label: t("footer.complaints") || "Customer Complaints", to: "/complaints" },
    { label: t("footer.paymentsTransfers") || "Payments & Transfers", to: "/transferencia" },
    { label: t("footer.pendingPayments") || "Pending Payments", to: "/pending-payments" },
  ];

  return (
    <footer className="bg-background border-t border-border/60 mt-10 select-none">
      <div className="mx-auto max-w-7xl px-6 py-12 grid md:grid-cols-3 gap-10 text-sm">
        {/* Column 1: Privacy & Data Protection */}
        <div>
          <p className="font-bold mb-4">{t("extrato.footer.privacy") || "Privacy & Security"}</p>
          <Link
            to="/privacy"
            className="inline-flex items-center gap-3 p-3.5 rounded-xl border border-border/70 bg-secondary/40 hover:bg-secondary/70 transition group text-xs w-full max-w-xs"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground leading-tight truncate">Privacy & Data Protection</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">UK GDPR Guidelines</p>
            </div>
          </Link>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed max-w-xs">
            Digital Banking Platform. Data handling adheres to UK GDPR standards.
          </p>
          <p className="text-[10px] text-muted-foreground/80 mt-2 leading-relaxed max-w-xs">
            All services are protected by institutional encryption, two-factor authentication, and automated audit monitoring.
          </p>
        </div>

        {/* Column 2: About Us */}
        <div>
          <p className="font-bold mb-4">{t("extrato.footer.about") || "About us"}</p>
          <ul className="space-y-3 text-muted-foreground">
            {aboutLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="hover:text-primary transition inline-block">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: Need Help? */}
        <div>
          <p className="font-bold mb-4">{t("extrato.footer.help") || "Need help?"}</p>
          <ul className="space-y-3 text-muted-foreground">
            {helpLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="hover:text-primary transition inline-block">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
