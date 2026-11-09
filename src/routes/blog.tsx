import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { BookOpen, Search, Clock, ArrowRight, ShieldCheck, Tag } from "lucide-react";

export const Route = createFileRoute("/blog")({
  component: BlogPage,
  head: () => ({
    meta: [
      { title: "Secure Portal Insights & Financial Education" },
      { name: "description", content: "Guides, security tips, and articles on managing your digital GBP account and international transfers." },
    ],
  }),
});

interface Article {
  id: string;
  category: "Security" | "Transfers" | "Budgeting" | "Digital Banking";
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
  content: string[];
}

const ARTICLES: Article[] = [
  {
    id: "app-fraud-protection",
    category: "Security",
    title: "How to Protect Your Account Against Authorised Push Payment (APP) Fraud",
    excerpt: "Learn how modern social engineering scams operate and how Confirmation of Payee safeguards your digital banking transfers.",
    readTime: "4 min read",
    date: "18 May 2026",
    content: [
      "Authorised Push Payment (APP) fraud occurs when criminals deceive an individual into sending money directly from their account to a scammer's destination.",
      "Always check the beneficiary's name thoroughly against the Confirmation of Payee prompt before releasing funds.",
      "B Bank security will never ask you to transfer funds to a 'safe account'. If you receive such a request, hang up and file a complaint immediately.",
    ],
  },
  {
    id: "faster-payments-vs-swift",
    category: "Transfers",
    title: "Understanding UK Faster Payments, CHAPS, and International SWIFT",
    excerpt: "A comprehensive breakdown of settlement speeds, limits, and currency routing for domestic and cross-border money movements.",
    readTime: "5 min read",
    date: "12 May 2026",
    content: [
      "Faster Payments allow real-time sterling transfers between UK financial institutions, typically settling in seconds up to standard transaction limits.",
      "SWIFT handles international correspondent banking, connecting institutions worldwide with standardized messaging codes (BIC/SWIFT).",
      "When transferring funds abroad from your GBP account, always review the commercial exchange rate, intermediary fees, and beneficiary receiving currency.",
    ],
  },
  {
    id: "mastering-gbp-budgeting",
    category: "Budgeting",
    title: "5 Proven Habits for Managing Your Digital Current Account in British Pounds",
    excerpt: "Smart cash allocation rules, emergency buffers, and digital statement tracking to take full control of your finances.",
    readTime: "3 min read",
    date: "04 May 2026",
    content: [
      "Applying the 50/30/20 budgeting rule (Needs, Wants, Savings) provides a clear framework for allocating your monthly income.",
      "Reviewing your digital bank statement weekly helps identify recurring subscriptions and prevent unexpected overdraft charges.",
      "Utilize digital banking alerts and pending payments tracking to stay proactive with bills and scheduled transfers.",
    ],
  },
  {
    id: "security-credentials-guide",
    category: "Security",
    title: "Why Password Length Beats Complexity: Protecting Your Online Banking",
    excerpt: "The science of password entropy, two-factor authentication, and keeping your banking portal bulletproof.",
    readTime: "4 min read",
    date: "28 April 2026",
    content: [
      "Length is the most significant factor in brute-force resistance. Passphrases generated with cryptographically random characters provide superior entropy.",
      "Never reuse banking passwords across social media or shopping websites.",
      "Ensure your email and mobile phone are secured with two-factor authentication to prevent session hijacking.",
    ],
  },
  {
    id: "digital-account-features",
    category: "Digital Banking",
    title: "Making the Most of Your B Bank Digital Account",
    excerpt: "From instant card freeze to biometric KYC verification, discover the capabilities built into our banking portal.",
    readTime: "3 min read",
    date: "20 April 2026",
    content: [
      "Our digital account gives you complete visibility over current balance, pending authorizations, and detailed PDF receipts.",
      "With virtual cards, you can set spending limits, view your credit limits in GBP (£), and freeze cards instantly if misplaced.",
      "Biometric liveness verification ensures your account stays protected while enabling frictionless customer onboarding.",
    ],
  },
];

function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);

  const categories = ["All", "Security", "Transfers", "Budgeting", "Digital Banking"];

  const filtered = ARTICLES.filter((a) => {
    const matchesCategory = selectedCategory === "All" || a.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <PublicPageShell
      title="Insights & Financial Education"
      subtitle="Articles, practical guides, and security best practices to empower your financial decisions."
      badge="B Bank Blog"
      breadcrumb={[{ label: "Blog" }]}
    >
      <div className="max-w-4xl space-y-8">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
                  selectedCategory === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              className="w-full h-10 pl-9 pr-3 rounded-full border border-border bg-background text-xs outline-none focus:border-primary transition"
            />
          </div>
        </div>

        {/* Modal / Expanded Article View */}
        {activeArticle && (
          <div className="p-8 rounded-3xl border border-primary/30 bg-secondary/30 shadow-md space-y-5">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                {activeArticle.category}
              </span>
              <button
                onClick={() => setActiveArticle(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Close article
              </button>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">{activeArticle.title}</h3>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{activeArticle.date}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {activeArticle.readTime}
              </span>
            </div>
            <div className="space-y-3 pt-2 text-sm text-muted-foreground leading-relaxed">
              {activeArticle.content.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        )}

        {/* Articles List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-border/60 bg-background text-muted-foreground text-sm">
              No articles match your search criteria. Try a different keyword or category.
            </div>
          ) : (
            filtered.map((art) => (
              <article
                key={art.id}
                className="p-6 rounded-2xl border border-border/60 bg-background shadow-sm hover:border-primary/40 transition group cursor-pointer"
                onClick={() => setActiveArticle(art)}
              >
                <div className="flex items-center justify-between gap-4 mb-2.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-secondary text-primary">
                    {art.category}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{art.readTime}</span>
                  </div>
                </div>

                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition">
                  {art.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                  {art.excerpt}
                </p>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/40 text-xs">
                  <span className="text-muted-foreground">{art.date}</span>
                  <span className="text-primary font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Read full guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </PublicPageShell>
  );
}
