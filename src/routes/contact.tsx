import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PublicPageShell } from "@/components/PublicPageShell";
import { submitContactRequest } from "@/lib/support.functions";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/account";
import { Mail, Send, CheckCircle2, AlertCircle, Clock, Phone, MapPin, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact Channels — Secure Portal" },
      { name: "description", content: "Submit a support inquiry and receive an official tracking protocol number." },
    ],
  }),
});

function ContactPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const submitFn = useServerFn(submitContactRequest);

  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    honeypot: "", // anti-spam field
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ protocol: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Autofill user credentials if logged in
  useEffect(() => {
    if (user?.email) {
      setForm((prev) => ({
        ...prev,
        email: prev.email || user.email || "",
        name: prev.name || profile?.full_name || "",
      }));
    }
  }, [user, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Spam honeypot check
    if (form.honeypot.trim() !== "") {
      return;
    }

    if (!form.name.trim() || form.name.trim().length < 2) {
      setErrorMsg("Please provide your full name.");
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErrorMsg("Please provide a valid email address.");
      return;
    }
    if (!form.subject.trim() || form.subject.trim().length < 3) {
      setErrorMsg("Please enter a subject.");
      return;
    }
    if (!form.message.trim() || form.message.trim().length < 10) {
      setErrorMsg("Please enter a message of at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitFn({
        data: {
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
          honeypot: form.honeypot,
        },
      });

      setSuccessData(res);
      setForm({ name: "", email: "", subject: "", message: "", honeypot: "" });
    } catch (err: any) {
      console.error("submit contact error:", err);
      setErrorMsg(err?.message || "Failed to submit request. Please verify your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyProtocol = () => {
    if (successData?.protocol) {
      navigator.clipboard.writeText(successData.protocol);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <PublicPageShell
      title="Contact Channels & Support Desk"
      subtitle="Get in touch with B Bank Digital Banking support. All inquiries receive an official reference protocol."
      badge="Direct Support"
      breadcrumb={[{ label: "Contact" }]}
    >
      <div className="max-w-4xl grid lg:grid-cols-[1fr_340px] gap-10">
        {/* Left Column: Form or Success Confirmation */}
        <div>
          {successData ? (
            <div className="p-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 space-y-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-xl font-bold">Request Submitted Successfully</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Your inquiry has been stored securely in our database.</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-background border border-emerald-500/20 text-foreground space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Your Official Support Protocol</p>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-2xl font-bold text-primary tracking-wide select-text" data-copyable="true">
                    {successData.protocol}
                  </span>
                  <button
                    type="button"
                    onClick={copyProtocol}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Save this protocol for your records. Our customer care desk responds to inquiries within 24 to 48 hours.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSuccessData(null)}
                className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 rounded-3xl border border-border/60 bg-background shadow-sm space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground">Send an Inquiry</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Fill out the form below. All fields marked with an asterisk (*) are required.
                </p>
              </div>

              {errorMsg && (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Honeypot hidden input */}
              <input
                type="text"
                name="website_honeypot"
                value={form.honeypot}
                onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Johnathan Smith"
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-secondary/30 text-xs text-foreground outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@example.co.uk"
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-secondary/30 text-xs text-foreground outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Transfer status inquiry / Account verification"
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-secondary/30 text-xs text-foreground outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Detailed Message *
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Please describe your question or issue in detail..."
                  className="w-full p-3.5 rounded-xl border border-border bg-secondary/30 text-xs text-foreground outline-none focus:border-primary transition resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm disabled:opacity-50"
              >
                {submitting ? (
                  <span>Registering inquiry...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Contact Details & Hours */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-border/60 bg-background shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-foreground">Customer Support Desk</h3>

            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Online Operating Hours</p>
                  <p className="mt-0.5">Automated inquiry routing operates 24/7.</p>
                  <p>Inquiries reviewed during business hours.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Digital Support Channel</p>
                  <p className="mt-0.5">Direct messaging via this portal (assigned reference protocol).</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/40 text-[11px] leading-relaxed">
                <strong className="text-foreground">Official Banking Channels:</strong>
                <p className="mt-1">
                  For telephone support or branches of B Bank S.A., please consult the official portal at <a href="https://www.bbank.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">bbank.com</a>.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border/60 bg-secondary/30 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">Formal Complaints</p>
            <p className="leading-relaxed">
              If your inquiry concerns a dispute, service dissatisfaction, or fee complaint, please file via our dedicated complaints portal.
            </p>
            <a href="/complaints" className="text-primary font-semibold hover:underline block pt-1">
              Go to Customer Complaints →
            </a>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
