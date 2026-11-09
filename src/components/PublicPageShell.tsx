import React from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { SignupModal, openLoginModal, openSignupModal } from "@/components/SignupModal";
import { BancoTesteLogo } from "@/components/BankLogo";
import { User, ArrowRight, ChevronRight, Home } from "lucide-react";

interface PublicPageShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  badge?: string;
  breadcrumb?: { label: string; to?: string }[];
}

export function PublicPageShell({
  children,
  title,
  subtitle,
  badge,
  breadcrumb,
}: PublicPageShellProps) {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60 select-none">
        <div className="mx-auto max-w-7xl px-6 h-18 flex items-center justify-between gap-4">
          <BancoTesteLogo to={user ? "/conta" : "/"} size="md" />

          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {user ? (
              <Link
                to="/conta"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
              >
                <User className="w-3.5 h-3.5" />
                <span>{t("conta.tab.digital") || "My Account"}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openLoginModal}
                  className="px-4 py-2 rounded-full border border-primary text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition"
                >
                  {t("cta.accessAccount") || "Log in"}
                </button>
                <button
                  type="button"
                  onClick={openSignupModal}
                  className="hidden sm:inline-flex px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
                >
                  {t("cta.openAccount") || "Open account"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero / Header banner if title is provided */}
      {title && (
        <section className="bg-secondary/40 border-b border-border/60 py-10 px-6">
          <div className="mx-auto max-w-7xl">
            {breadcrumb && breadcrumb.length > 0 && (
              <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-4 select-none">
                <Link to={user ? "/conta" : "/"} className="hover:text-primary transition flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  <span>Home</span>
                </Link>
                {breadcrumb.map((bc, idx) => (
                  <React.Fragment key={idx}>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
                    {bc.to ? (
                      <Link to={bc.to} className="hover:text-primary transition">
                        {bc.label}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">{bc.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            )}

            <div className="max-w-3xl">
              {badge && (
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-primary/10 text-primary mb-3">
                  {badge}
                </span>
              )}
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-6 py-10">
        {children}
      </main>

      {/* Universal Footer */}
      <SiteFooter />

      {/* Signup / Login Modal */}
      <SignupModal />
    </div>
  );
}
