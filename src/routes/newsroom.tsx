import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { Newspaper, Bell, ShieldAlert, Sparkles, Calendar, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/newsroom")({
  component: NewsroomPage,
  head: () => ({
    meta: [
      { title: "Secure Portal Newsroom & Announcements" },
      { name: "description", content: "Official platform updates, security advisories, and corporate announcements." },
    ],
  }),
});

interface NewsItem {
  id: string;
  type: "platform_release" | "security_advisory" | "official_press";
  badge: string;
  title: string;
  date: string;
  summary: string;
  isOfficial?: boolean;
}

const NEWS: NewsItem[] = [
  {
    id: "gbp-standardization",
    type: "platform_release",
    badge: "Platform Engineering Update",
    title: "100% Currency Standardization to British Pound (GBP £) Completed",
    date: "19 October 2026",
    summary:
      "All client accounts, financial suites, top balances, and international transfer origins are now officially denominated in GBP (£) using British locale (en-GB) punctuation.",
    isOfficial: false,
  },
  {
    id: "complaints-and-support",
    type: "platform_release",
    badge: "Feature Release",
    title: "New Automated Customer Complaints and Contact Channels System Deployed",
    date: "15 October 2026",
    summary:
      "Customers can now file formal inquiries and track resolution progress in real time using automated protocol identifiers (CT and CMP).",
    isOfficial: false,
  },
  {
    id: "security-advisory-phishing",
    type: "security_advisory",
    badge: "Security Advisory",
    title: "Industry Warning: Surge in Impersonation and Remote Access Scams",
    date: "02 October 2026",
    summary:
      "B Bank warns customers never to install remote access tools (such as AnyDesk or TeamViewer) at the request of unsolicited callers claiming to represent fraud teams.",
    isOfficial: false,
  },
  {
    id: "bancoteste-plc-results",
    type: "official_press",
    badge: "Official B Bank Announcement",
    title: "B Bank Delivers Strong Quarterly Performance Across Digital Divisions",
    date: "25 September 2026",
    summary:
      "B Bank released its quarterly results reporting strong capital ratios, disciplined risk allocation, and accelerated digital banking adoption.",
    isOfficial: true,
  },
];

function NewsroomPage() {
  return (
    <PublicPageShell
      title="Newsroom & Press Releases"
      subtitle="Stay up to date with digital banking updates, security advisories, and official B Bank corporate news."
      badge="Media & Announcements"
      breadcrumb={[{ label: "Newsroom" }]}
    >
      <div className="max-w-4xl space-y-10">
        {/* Transparency Banner */}
        <div className="p-5 rounded-2xl border border-border/80 bg-secondary/30 flex items-start gap-4">
          <Bell className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Transparency Notice:</strong> News tagged with{" "}
            <span className="font-semibold text-primary">"Platform Engineering Update"</span> reflects technical enhancements made to our digital banking services. Items tagged with{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">"Official B Bank PLC Announcement"</span> correspond to publicly verifiable corporate disclosures.
          </div>
        </div>

        {/* News Feed */}
        <div className="space-y-5">
          {NEWS.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-2xl border border-border/60 bg-background shadow-sm hover:border-primary/40 transition space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    item.isOfficial
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : item.type === "security_advisory"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-primary/10 text-primary border border-primary/20"
                  }`}
                >
                  {item.badge}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {item.date}
                </span>
              </div>

              <h3 className="text-lg font-bold text-foreground">
                {item.title}
              </h3>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.summary}
              </p>

              {item.isOfficial && (
                <div className="pt-2">
                  <a
                    href="#"
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                  >
                    <span>Read on B Bank Newsroom</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
