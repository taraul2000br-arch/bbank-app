import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PublicPageShell } from "@/components/PublicPageShell";
import { submitCustomerComplaint, trackCustomerComplaint } from "@/lib/support.functions";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/account";
import { AlertCircle, CheckCircle2, Search, Send, Clock, Copy, Check, Lock, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/complaints")({
  component: ComplaintsPage,
  head: () => ({
    meta: [
      { title: "Customer Complaints & Tracking — Secure Portal" },
      { name: "description", content: "File a formal complaint or track the status of an existing investigation protocol under your authenticated account." },
    ],
  }),
});

const CATEGORIES = [
  { value: "transfers_payments", label: "Transfers & Faster Payments" },
  { value: "cards", label: "Credit Cards & Limits" },
  { value: "account_access", label: "Account Access & Authentication" },
  { value: "customer_service", label: "Customer Service Experience" },
  { value: "security_fraud", label: "Security & Fraud Reporting" },
  { value: "fees_charges", label: "Fees & Operational Charges" },
  { value: "other", label: "Other Inquiries" },
];

function ComplaintsPage() {
  const { user } = useAuth();
  const { profile } = useProfile();

  const submitComplaintFn = useServerFn(submitCustomerComplaint);
  const trackComplaintFn = useServerFn(trackCustomerComplaint);

  const [activeTab, setActiveTab] = useState<"file" | "track">("file");

  // Form State
  const [form, setForm] = useState({
    name: "",
    email: "",
    category: "transfers_payments",
    description: "",
    honeypot: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{ protocol: string; createdAt: string } | null>(null);

  // Tracking State
  const [trackProtocol, setTrackProtocol] = useState("");
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackedRecord, setTrackedRecord] = useState<any | null>(null);

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

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Spam honeypot detection
    if (form.honeypot.trim() !== "") {
      return;
    }

    if (!form.name.trim() || form.name.trim().length < 2) {
      setFormError("Please enter your full name.");
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (!form.description.trim() || form.description.trim().length < 15) {
      setFormError("Please provide a thorough description of the issue (at least 15 characters).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitComplaintFn({
        data: {
          name: form.name.trim(),
          email: form.email.trim(),
          category: form.category,
          description: form.description.trim(),
          honeypot: form.honeypot,
        },
      });

      setSubmittedData({ protocol: res.protocol, createdAt: res.createdAt });
      setForm({ name: "", email: "", category: "transfers_payments", description: "", honeypot: "" });
    } catch (err: any) {
      console.error("submit complaint error:", err);
      setFormError(err?.message || "Failed to register complaint. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError(null);
    setTrackedRecord(null);

    if (!user) {
      setTrackError("You must be signed in to your account to track complaints.");
      return;
    }

    if (!trackProtocol.trim()) {
      setTrackError("Please enter the complaint protocol (e.g. CMP-20261019-XXXX).");
      return;
    }

    setTracking(true);
    try {
      const res = await trackComplaintFn({
        data: {
          protocol: trackProtocol.trim(),
        },
      });

      if (!res.found || !res.complaint) {
        setTrackError(res.error || "No complaint found matching this protocol under your authenticated account.");
      } else {
        setTrackedRecord(res.complaint);
      }
    } catch (err: any) {
      console.error("track complaint error:", err);
      setTrackError(err?.message || "Error tracking complaint. Please verify your details.");
    } finally {
      setTracking(false);
    }
  };

  const copyProtocol = (proto: string) => {
    navigator.clipboard.writeText(proto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
      case "received":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Pending Review</span>;
      case "investigating":
      case "in_review":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">Under Investigation</span>;
      case "resolved":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Resolved</span>;
      case "rejected":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Rejected</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-muted-foreground">{status}</span>;
    }
  };

  return (
    <PublicPageShell
      title="Customer Complaints & Dispute Resolution"
      subtitle="B Bank Digital Banking customer resolution desk. File a dispute or track your complaint investigation securely."
      badge="Dispute Resolution Desk"
      breadcrumb={[{ label: "Complaints" }]}
    >
      <div className="max-w-4xl space-y-8">
        {/* Advisory Notice */}
        <div className="p-4 rounded-xl border border-border/60 bg-secondary/30 text-xs text-muted-foreground flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">Advisory Notice:</strong> This digital complaints desk handles formal customer inquiries and dispute investigations within your online banking account. For external disputes or statutory escalations, refer to official regulatory guidelines and Financial Ombudsman Service procedures.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border/60">
          <button
            type="button"
            onClick={() => { setActiveTab("file"); setTrackError(null); }}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition -mb-px ${
              activeTab === "file"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            File a Formal Complaint
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("track"); setFormError(null); }}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition -mb-px ${
              activeTab === "track"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Track Existing Complaint
          </button>
        </div>

        {/* Tab 1: File Complaint */}
        {activeTab === "file" && (
          <div>
            {submittedData ? (
              <div className="p-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 space-y-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-xl font-bold">Complaint Logged Officially</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Your dispute has been recorded in the database with an official protocol.</p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-background border border-emerald-500/20 text-foreground space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Official Complaint Protocol</p>
                    <div className="flex items-center justify-between gap-4 mt-1">
                      <span className="font-mono text-2xl font-bold text-primary tracking-wide select-text" data-copyable="true">
                        {submittedData.protocol}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyProtocol(submittedData.protocol)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium transition"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Date Opened: </span>
                      <span>{new Date(submittedData.createdAt).toLocaleString("en-GB")}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Resolution Target: </span>
                      <span>3 to 5 Business Days</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTrackProtocol(submittedData.protocol);
                      setActiveTab("track");
                    }}
                    className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
                  >
                    Track Status Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmittedData(null)}
                    className="px-6 py-2.5 rounded-full border border-border hover:bg-secondary/60 text-xs font-semibold transition"
                  >
                    File Another Complaint
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFileSubmit} className="p-8 rounded-3xl border border-border/60 bg-background shadow-sm space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Submit a Customer Complaint</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Provide all relevant details to allow our dispute investigation team to review the record.
                  </p>
                </div>

                {formError && (
                  <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Honeypot field (hidden from legitimate users) */}
                <input
                  type="text"
                  name="honeypot"
                  value={form.honeypot}
                  onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
                  style={{ display: "none" }}
                  tabIndex={-1}
                  autoComplete="off"
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. John Doe"
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
                    Complaint Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-secondary/30 text-xs text-foreground outline-none focus:border-primary transition"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Detailed Description of the Issue *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Include relevant transaction references, timestamps, amounts in GBP (£), and what outcome you are requesting..."
                    className="w-full p-3.5 rounded-xl border border-border bg-secondary/30 text-xs text-foreground outline-none focus:border-primary transition resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm disabled:opacity-50"
                  >
                    {submitting ? <span>Registering complaint...</span> : <><span>Submit Formal Complaint</span> <Send className="w-3.5 h-3.5" /></>}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Track Complaint */}
        {activeTab === "track" && (
          <div className="space-y-6">
            {!user ? (
              <div className="p-8 rounded-3xl border border-border/80 bg-background shadow-sm text-center max-w-lg mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Authentication Required</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In compliance with UK GDPR and banking confidentiality safeguards, tracking complaint investigations requires active authentication. This prevents third parties from viewing personal disputes simply by guessing a protocol.
                </p>
                <div className="pt-2">
                  <a
                    href="/#login"
                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm"
                  >
                    Sign In to Online Banking
                  </a>
                </div>
              </div>
            ) : (
              <>
                <form onSubmit={handleTrackSubmit} className="p-8 rounded-3xl border border-border/60 bg-background shadow-sm space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Track Your Complaint Status</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the protocol number generated when you filed your complaint.
                    </p>
                  </div>

                  {trackError && (
                    <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{trackError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Protocol Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={trackProtocol}
                      onChange={(e) => setTrackProtocol(e.target.value.toUpperCase())}
                      placeholder="CMP-20261019-XXXX"
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-secondary/30 text-xs font-mono text-foreground outline-none focus:border-primary transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={tracking}
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm disabled:opacity-50"
                  >
                    {tracking ? <span>Querying database...</span> : <><span>Search Complaint</span> <Search className="w-3.5 h-3.5" /></>}
                  </button>
                </form>

                {/* Tracked Record Card */}
                {trackedRecord && (
                  <div className="p-8 rounded-3xl border border-border/80 bg-background shadow-md space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/60">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Complaint Protocol</span>
                        <h3 className="font-mono text-2xl font-bold text-foreground mt-0.5">{trackedRecord.protocol}</h3>
                      </div>
                      <div>
                        {getStatusBadge(trackedRecord.status)}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-secondary/40 border border-border/40">
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-semibold text-foreground mt-1 capitalize">
                          {CATEGORIES.find((c) => c.value === trackedRecord.category)?.label || trackedRecord.category}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/40 border border-border/40">
                        <p className="text-muted-foreground">Date Opened</p>
                        <p className="font-semibold text-foreground mt-1">
                          {new Date(trackedRecord.created_at).toLocaleString("en-GB")}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Original Complaint Description</h4>
                      <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {trackedRecord.description}
                      </div>
                    </div>

                    {trackedRecord.resolution_notes ? (
                      <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs sm:text-sm space-y-1.5">
                        <h4 className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Official Resolution Notes
                        </h4>
                        <p className="text-foreground leading-relaxed">{trackedRecord.resolution_notes}</p>
                        {trackedRecord.resolved_at && (
                          <p className="text-[11px] text-muted-foreground pt-1">
                            Resolved on {new Date(trackedRecord.resolved_at).toLocaleString("en-GB")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-border/60 bg-secondary/30 text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span>This matter is currently under review by our complaints team. You will be notified once a formal resolution note is posted.</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </PublicPageShell>
  );
}
