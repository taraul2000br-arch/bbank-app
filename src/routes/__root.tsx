import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { I18nProvider } from "@/lib/i18n";
import { LangScopedOutlet } from "@/components/LangScopedOutlet";
import { logSafeError } from "@/lib/safe-logger";
import { getInstitutionName } from "@/config/institution";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  logSafeError("root", error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center p-8 bg-card rounded-2xl border border-border shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Não foi possível carregar esta página.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Encontramos um problema temporário. Tente novamente ou volte para sua conta.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
          >
            Tentar novamente
          </button>
          <Link
            to="/conta"
            className="inline-flex items-center justify-center rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/80 transition"
          >
            Voltar para minha conta
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Secure Portal" },
      { name: "description", content: "Secure portal for global financial management and digital account services." },
      { name: "author-signature", content: "´Power by Nuno 2026 " },
      { name: "author", content: "Secure Portal" },
      { property: "og:title", content: "Secure Portal" },
      { property: "og:description", content: "Secure portal for global financial management and digital account services." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@SecurePortal" },
      { name: "twitter:title", content: "Secure Portal" },
      { name: "twitter:description", content: "Secure portal for global financial management and digital account services." },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico?v=2", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon-48x48.png?v=2" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png?v=2" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png?v=2" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=2" },
      { rel: "manifest", href: "/site.webmanifest?v=2" },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Secure Portal</title>
        <meta name="description" content="Secure portal for global financial management and digital account services." />
        <meta name="author-signature" content="´Power by Nuno 2026 " />
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png?v=2" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=2" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=2" />
        <link rel="manifest" href="/site.webmanifest?v=2" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" />
        <HeadContent />
      </head>

      <body data-signature="´Power by Nuno 2026 ">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Authorship watermark registration on client window
    if (typeof window !== "undefined") {
      (window as any).__AUTHOR__ = "´Power by Nuno 2026 ";
      (window as any).getSignature = () => "´Power by Nuno 2026 ";
    }

    // Client-side only execution after JavaScript loads in the browser
    if (typeof document !== "undefined") {
      if (document.title === "Secure Portal") {
        document.title = `${getInstitutionName()} — Online Banking`;
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <LangScopedOutlet />
      </I18nProvider>
    </QueryClientProvider>
  );
}
