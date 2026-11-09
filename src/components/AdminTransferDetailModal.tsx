import { useEffect, useState } from "react";
import {
  X, Loader2, FileText, Download, Shield, Landmark, ArrowRight,
  User, CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink,
  Copy, Check,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminTransferDetail,
  type AdminTransferDetail,
  type TransferStatus,
} from "@/lib/transfers.functions";
import { TransferReceiptModal } from "@/components/TransferReceiptModal";

interface Props {
  transferId: string | null;
  onClose: () => void;
}

export function AdminTransferDetailModal({ transferId, onClose }: Props) {
  const fetchTransfer = useServerFn(getAdminTransferDetail);
  const [detail, setDetail] = useState<AdminTransferDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    if (!transferId) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTransfer({ data: { id: transferId } })
      .then((res) => {
        if (!cancelled) {
          setDetail(res);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load transfer details");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [transferId, fetchTransfer]);

  if (!transferId) return null;

  const copyId = () => {
    if (!detail?.id) return;
    navigator.clipboard.writeText(detail.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div
        className="w-full max-w-3xl my-8 rounded-2xl border border-[#292929] bg-[#111111] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#F5F5F5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#292929] bg-[#141414] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1C1C1C] text-[#C6A667] border border-[#292929] grid place-items-center">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#F5F5F5]">Transfer Details</h3>
              <p className="text-xs text-[#999999]">Internal Desk & Compliance View</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-[#F5F5F5]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#999999] space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#C6A667]" />
              <span className="text-sm">Loading transfer details…</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <h4 className="font-semibold text-rose-200">Unable to open transfer</h4>
              <p className="text-xs text-rose-300/80 max-w-md mx-auto">{error}</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-1.5 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-xs text-[#F5F5F5] transition"
              >
                Close
              </button>
            </div>
          ) : detail ? (
            <>
              {/* 1. TRANSFER OVERVIEW */}
              <section className="rounded-xl border border-[#292929] bg-[#141414] p-5 space-y-3">
                <SectionHeader title="1. TRANSFER OVERVIEW" icon={Landmark} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <DetailField
                    label="Transfer ID"
                    value={
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[#F5F5F5] break-all">{detail.id}</span>
                        <button
                          type="button"
                          onClick={copyId}
                          className="text-[#999999] hover:text-[#F5F5F5] transition"
                          title="Copy ID"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    }
                  />
                  <DetailField
                    label="Current Status"
                    value={
                      <div className="pt-0.5">
                        <StatusBadge status={detail.status} />
                      </div>
                    }
                  />
                  <DetailField
                    label="Official Protocol"
                    value={
                      detail.protocol ? (
                        <span className="font-mono text-xs font-semibold text-[#C6A667]">
                          {detail.protocol}
                        </span>
                      ) : (
                        "Not available"
                      )
                    }
                    subtext={detail.protocol ? "Unique persistent operational protocol" : "Old transfer without persistent protocol"}
                  />
                  <DetailField
                    label="Reference"
                    value={detail.reference || "Not provided"}
                    mono={!!detail.reference}
                  />
                  <DetailField
                    label="Associated Client"
                    value={detail.client_name || "Not provided"}
                  />
                  <DetailField
                    label="Client User ID"
                    value={detail.user_id}
                    mono
                  />
                  <DetailField
                    label="Client Email"
                    value={detail.client_email || "Not provided"}
                  />
                  <DetailField
                    label="Client Phone"
                    value={detail.client_phone || "Not provided"}
                  />
                  <DetailField
                    label="Created At"
                    value={formatDateTime(detail.created_at)}
                  />
                  <DetailField
                    label="Last Updated At"
                    value={
                      detail.updated_at && detail.updated_at !== detail.created_at
                        ? formatDateTime(detail.updated_at)
                        : "Same as created"
                    }
                  />
                </div>
              </section>

              {/* 2. SOURCE ACCOUNT */}
              <section className="rounded-xl border border-[#292929] bg-[#141414] p-5 space-y-3">
                <SectionHeader title="2. SOURCE ACCOUNT" icon={User} />
                <p className="text-[11px] text-[#999999]">
                  Aggregated from customer's real banking account (<code className="text-[#F5F5F5]">accounts</code> table).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <DetailField
                    label="Account Holder"
                    value={detail.source_holder_name || "Not provided"}
                  />
                  <DetailField
                    label="Source IBAN"
                    value={detail.source_iban || "Not available"}
                    mono={!!detail.source_iban}
                  />
                  <DetailField
                    label="Source SWIFT / BIC"
                    value={detail.source_swift || "Not available"}
                    mono={!!detail.source_swift}
                  />
                  <DetailField
                    label="Source Account Number"
                    value={detail.source_account_number || "Not available"}
                    mono={!!detail.source_account_number}
                  />
                  <DetailField
                    label="Source Currency"
                    value={detail.source_currency || "GBP"}
                  />
                  <DetailField
                    label="Current Account Balance"
                    value={`£${formatMoney(detail.source_current_balance)}`}
                    subtext="Live balance in accounts table at query time."
                  />
                </div>
              </section>

              {/* 3. BENEFICIARY / DESTINATION */}
              <section className="rounded-xl border border-[#292929] bg-[#141414] p-5 space-y-3">
                <SectionHeader title="3. BENEFICIARY / DESTINATION" icon={ArrowRight} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <DetailField
                    label="Beneficiary Name"
                    value={detail.beneficiary_name || "Not provided"}
                  />
                  <DetailField
                    label="Beneficiary Document (ID/Tax)"
                    value={detail.beneficiary_doc || "Not provided"}
                  />
                  <DetailField
                    label="Beneficiary Email"
                    value={detail.beneficiary_email || "Not provided"}
                  />
                  <DetailField
                    label="Destination Bank"
                    value={detail.destination_bank || "Not provided"}
                  />
                  <DetailField
                    label="Destination SWIFT / BIC"
                    value={detail.destination_swift || "Not available"}
                    mono={!!detail.destination_swift}
                  />
                  <DetailField
                    label="Destination Account Number / IBAN"
                    value={detail.destination_account_number || "Not available"}
                    mono={!!detail.destination_account_number}
                  />
                  <DetailField
                    label="Destination Country"
                    value={detail.destination_country || "Not provided"}
                  />
                </div>
              </section>

              {/* 4. AMOUNTS & EXCHANGE */}
              <section className="rounded-xl border border-[#292929] bg-[#141414] p-5 space-y-3">
                <SectionHeader title="4. AMOUNTS & EXCHANGE" icon={Landmark} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <DetailField
                    label="Amount Sent"
                    value={`${formatMoney(detail.amount)} ${detail.currency_from}`}
                    highlight
                  />
                  <DetailField
                    label="Converted Amount (Beneficiary Receives)"
                    value={`${formatMoney(detail.converted_amount)} ${detail.currency_to}`}
                    highlight
                  />
                  <DetailField
                    label="Currency From"
                    value={detail.currency_from}
                  />
                  <DetailField
                    label="Currency To"
                    value={detail.currency_to}
                  />
                  <DetailField
                    label="FX Rate Applied"
                    value={`1 ${detail.currency_from} = ${detail.fx_rate.toFixed(4)} ${detail.currency_to}`}
                    mono
                  />
                </div>
              </section>

              {/* 5. TRANSFER DETAILS */}
              <section className="rounded-xl border border-[#292929] bg-[#141414] p-5 space-y-3">
                <SectionHeader title="5. TRANSFER DETAILS" icon={FileText} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <DetailField
                    label="Purpose"
                    value={formatPurpose(detail.purpose)}
                  />
                  <DetailField
                    label="Reference / Message"
                    value={detail.reference || "Not provided"}
                  />
                  {detail.status === "recusado" && (
                    <div className="md:col-span-2">
                      <DetailField
                        label="Rejection Reason"
                        value={
                          <span className="text-rose-300 font-medium">
                            {detail.rejection_reason || "No specific reason recorded."}
                          </span>
                        }
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* 6. AUDIT INFORMATION */}
              <section className="rounded-xl border border-[#292929] bg-[#141414] p-5 space-y-3">
                <SectionHeader title="6. AUDIT INFORMATION" icon={Shield} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <DetailField
                    label="Decision Status"
                    value={
                      detail.status === "solicitado"
                        ? "Pending administrative review"
                        : detail.status === "aprovado"
                        ? "Approved"
                        : detail.status === "bloqueado"
                        ? "Blocked by judicial order"
                        : "Rejected"
                    }
                  />
                  <DetailField
                    label="Decision Date / Time"
                    value={
                      detail.reviewed_at ? formatDateTime(detail.reviewed_at) : "Pending review"
                    }
                  />
                  <DetailField
                    label="Reviewed By (Admin Name / Email)"
                    value={
                      detail.reviewed_by_name ||
                      (detail.reviewed_by ? `Admin (${detail.reviewed_by.slice(0, 8)})` : "Pending review")
                    }
                  />
                  <DetailField
                    label="Reviewer User ID"
                    value={detail.reviewed_by || "Pending review"}
                    mono={!!detail.reviewed_by}
                  />
                  <DetailField
                    label="Request Created At"
                    value={formatDateTime(detail.created_at)}
                  />
                  <DetailField
                    label="Request Last Updated At"
                    value={
                      detail.updated_at ? formatDateTime(detail.updated_at) : "Not recorded"
                    }
                  />
                </div>
              </section>

              {/* 7. DOCUMENTS / RECEIPT */}
              <section className="rounded-xl border border-[#292929] bg-[#141414] p-5 space-y-3">
                <SectionHeader title="7. DOCUMENTS / RECEIPT" icon={FileText} />
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] text-[#999999] font-medium mb-1">Attached HMRC Document</div>
                    {detail.hmrc_doc_url ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-[#292929] bg-[#1C1C1C]">
                        <FileText className="w-5 h-5 text-[#C6A667] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[#F5F5F5] font-medium truncate">
                            {detail.hmrc_doc_path?.split("/").pop() ?? "HMRC Clearance Document"}
                          </div>
                          <div className="text-[10px] text-[#999999] font-mono truncate">
                            Path: {detail.hmrc_doc_path}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={detail.hmrc_doc_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#252525] hover:bg-[#2D2D2D] text-[#F5F5F5] border border-[#292929] text-xs font-medium transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> View
                          </a>
                          <a
                            href={detail.hmrc_doc_url}
                            download="HMRC-Document"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-[#999999] hover:text-[#F5F5F5] transition"
                            title="Download document"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[#999999] bg-[#1C1C1C] border border-[#292929] rounded-lg p-3">
                        <span className="font-semibold text-[#F5F5F5]">Not available</span> — No HMRC clearance document was uploaded for this transfer.
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] text-[#999999] font-medium mb-1">Official Transfer Receipt</div>
                    <div className="rounded-lg border border-[#292929] bg-[#1C1C1C] p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium text-[#F5F5F5]">
                          Transfer Receipt ({detail.protocol || "Legacy / No Protocol"})
                        </div>
                        <div className="text-[11px] text-[#999999]">
                          Official printable receipt based strictly on persisted transaction records.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReceiptOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#141414] hover:bg-[#252525] border border-[#292929] text-[#F5F5F5] text-xs font-semibold transition shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#C6A667]" /> View receipt
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#292929] bg-[#141414] flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-xs text-[#F5F5F5] font-medium transition"
          >
            Close
          </button>
        </div>
      </div>

      <TransferReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        receipt={detail}
      />
    </div>
  );
}

/* -------------------- Subcomponents -------------------- */

function SectionHeader({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#292929] pb-2">
      <Icon className="w-3.5 h-3.5 text-[#C6A667]" />
      <span className="text-xs font-semibold uppercase tracking-wider text-[#999999]">
        {title}
      </span>
    </div>
  );
}

function DetailField({
  label,
  value,
  subtext,
  mono,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="py-1">
      <div className="text-[11px] text-[#999999] font-medium">{label}</div>
      <div
        className={`text-sm mt-0.5 break-words ${
          mono ? "font-mono" : ""
        } ${highlight ? "font-semibold text-[#F5F5F5] text-base" : "text-[#F5F5F5] font-medium"}`}
      >
        {value}
      </div>
      {subtext && <div className="text-[10px] text-[#999999]/70 mt-0.5 leading-relaxed">{subtext}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: TransferStatus | string }) {
  switch (status) {
    case "solicitado":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Clock className="w-3 h-3" /> REQUESTED
        </span>
      );
    case "aprovado":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> APPROVED
        </span>
      );
    case "recusado":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <XCircle className="w-3 h-3" /> REJECTED
        </span>
      );
    case "bloqueado":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-rose-700/30 text-rose-200 border border-rose-600/40">
          <Shield className="w-3 h-3" /> BLOCKED (JUDICIAL)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-400">
          {String(status).toUpperCase()}
        </span>
      );
  }
}

function formatMoney(n: number | null | undefined): string {
  if (typeof n !== "number" || isNaN(n)) return "0.00";
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not available";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatPurpose(purpose: string | null | undefined): string {
  if (!purpose) return "Not provided";
  switch (purpose.toLowerCase()) {
    case "family":
      return "Family support";
    case "services":
      return "Service payment";
    case "goods":
      return "Goods purchase";
    case "investment":
      return "Investment";
    case "education":
      return "Education";
    case "property":
      return "Property";
    case "other":
      return "Other";
    default:
      return purpose;
  }
}
