import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { ShieldCheck, Lock, UserCheck, Cookie, AlertTriangle, Mail, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy & Data Protection — Secure Portal" },
      { name: "description", content: "Learn how your personal and financial data is handled and protected under UK GDPR standards." },
    ],
  }),
});

function PrivacyPage() {
  const sections = [
    {
      icon: Lock,
      title: "1. How Your Data is Used",
      content: (
        <>
          <p className="text-muted-foreground leading-relaxed">
            At B Bank Digital Banking, we collect and process information strictly necessary to provide and operate our digital banking platform. Data is processed for the following lawful purposes:
          </p>
          <ul className="mt-3 space-y-2 text-muted-foreground list-disc list-inside">
            <li><strong className="text-foreground">Account Administration:</strong> Maintaining your digital GBP account, issuing sort codes, account numbers, and statement records.</li>
            <li><strong className="text-foreground">Payment Execution:</strong> Processing domestic and international transfers via atomic ledger transactions with full audit logging.</li>
            <li><strong className="text-foreground">Identity Verification & KYC:</strong> Verifying user profiles and document numbers to meet compliance standards.</li>
            <li><strong className="text-foreground">Security & Fraud Prevention:</strong> Detecting anomalous activity, enforcing idempotency checks, and maintaining judicial hold capabilities.</li>
          </ul>
        </>
      ),
    },
    {
      icon: ShieldCheck,
      title: "2. Protection of Personal Information",
      content: (
        <>
          <p className="text-muted-foreground leading-relaxed">
            We adhere to rigorous technical and organisational measures to ensure a level of security appropriate to the risks of data processing:
          </p>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border/60 bg-secondary/30">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Cryptographic Controls
              </h4>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                24-character cryptographically random passwords, secure salting, and TLS 1.3 transport layer encryption.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-secondary/30">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Row-Level Security (RLS)
              </h4>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Database-level partition policies ensuring customers can only query and mutate their own financial records.
              </p>
            </div>
          </div>
        </>
      ),
    },
    {
      icon: UserCheck,
      title: "3. Your Rights Under UK GDPR",
      content: (
        <>
          <p className="text-muted-foreground leading-relaxed">
            Under the United Kingdom General Data Protection Regulation (UK GDPR) and Data Protection Act 2018, you have comprehensive rights over your personal data:
          </p>
          <ul className="mt-3 space-y-2 text-muted-foreground list-disc list-inside">
            <li><strong className="text-foreground">Right of Access:</strong> Request a complete copy of the data we hold regarding your account and transactions.</li>
            <li><strong className="text-foreground">Right to Rectification:</strong> Update or rectify incomplete or inaccurate personal information through your profile or our support channel.</li>
            <li><strong className="text-foreground">Right to Erasure ('Right to be Forgotten'):</strong> Request deletion of your personal account data where statutory retention does not apply.</li>
            <li><strong className="text-foreground">Right to Data Portability:</strong> Obtain your transaction history and account statements in structured, machine-readable formats.</li>
          </ul>
        </>
      ),
    },
    {
      icon: Cookie,
      title: "4. Cookie Policy",
      content: (
        <>
          <p className="text-muted-foreground leading-relaxed">
            Our platform uses cookies and similar local storage techniques solely to guarantee a seamless and secure digital banking session:
          </p>
          <ul className="mt-3 space-y-2 text-muted-foreground list-disc list-inside">
            <li><strong className="text-foreground">Strictly Necessary Cookies:</strong> Essential for user authentication, maintaining your active session, and preventing cross-site request forgery.</li>
            <li><strong className="text-foreground">Preference Cookies:</strong> Remembering your chosen language (English, Portuguese, Spanish, French, German, Polish) and interface theme settings.</li>
            <li><strong className="text-foreground">Zero Third-Party Advertising Trackers:</strong> We do not sell your personal data or host third-party marketing trackers.</li>
          </ul>
        </>
      ),
    },
    {
      icon: AlertTriangle,
      title: "5. Digital Security Guidelines for Customers",
      content: (
        <>
          <p className="text-muted-foreground leading-relaxed">
            Protecting your banking credentials requires joint vigilance. Follow these essential security rules:
          </p>
          <ul className="mt-3 space-y-2 text-muted-foreground list-disc list-inside">
            <li>Never disclose your login credentials or one-time codes to anyone—B Bank will never ask for your password via telephone or SMS.</li>
            <li>Always verify the browser address bar before signing in.</li>
            <li>Immediately notify our complaints or support desk if you detect unexpected transfers or unauthorised attempts.</li>
          </ul>
        </>
      ),
    },
  ];

  return (
    <PublicPageShell
      title="Privacy & Data Protection"
      subtitle="Comprehensive information on how personal information, digital security, and user rights are safeguarded in our banking platform."
      badge="UK GDPR & Security Standards"
      breadcrumb={[{ label: "Privacy" }]}
    >
      <div className="max-w-4xl space-y-10 legal-content selectable-content select-text">
        {/* Privacy Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-950 dark:text-sky-100 flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-semibold text-base">Digital Banking Privacy Notice</h4>
            <p className="mt-1 leading-relaxed opacity-90">
              While UK GDPR standards, cryptographic controls, and database Row-Level Security (RLS) are strictly enforced in our systems, this platform operates under digital banking terms. For statutory accounts and traditional branch services, please refer to B Bank S.A. guidelines.
            </p>
          </div>
        </div>

        {/* Policy Sections */}
        <div className="space-y-8">
          {sections.map((sec, idx) => {
            const Icon = sec.icon;
            return (
              <section key={idx} className="p-7 rounded-2xl border border-border/60 bg-background shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{sec.title}</h2>
                </div>
                <div className="text-sm">{sec.content}</div>
              </section>
            );
          })}
        </div>

        {/* Privacy Inquiries Channel */}
        <section className="p-8 rounded-2xl border border-border/60 bg-secondary/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Need to submit a Data Protection Request?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                For inquiries regarding data handled in this environment, submit a request via our support desk. For statutory requests regarding B Bank S.A. accounts, visit <a href="https://www.bbank.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">bbank.com/privacy</a>.
              </p>
            </div>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition shrink-0"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Desk</span>
            </Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
