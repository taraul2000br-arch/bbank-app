import { useEffect, useState } from "react";
import {
  X, Printer, Loader2, Landmark, CheckCircle2, Clock, XCircle, ShieldAlert,
  ArrowRight, Copy, Check, FileText
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyTransferReceipt,
  type TransferReceiptData,
  type TransferStatus
} from "@/lib/transfers.functions";
import { callWithRetry } from "@/lib/server-call";
import logoImg from "@/assets/logo.png";

interface Props {
  open: boolean;
  onClose: () => void;
  receipt?: TransferReceiptData | null;
  transferId?: string | null;
}

export function TransferReceiptModal({ open, onClose, receipt: initialReceipt, transferId }: Props) {
  const fetchReceiptFn = useServerFn(getMyTransferReceipt);
  const [data, setData] = useState<TransferReceiptData | null>(initialReceipt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedProtocol, setCopiedProtocol] = useState(false);

  // Lock body scroll on mount/open to prevent mobile background elastic scrolling conflicts
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (!initialReceipt) setData(null);
      setError(null);
      return;
    }

    if (initialReceipt) {
      setData(initialReceipt);
      setError(null);
      return;
    }

    if (transferId) {
      let cancelled = false;
      setLoading(true);
      setError(null);

      callWithRetry(() => fetchReceiptFn({ data: { id: transferId } }))
        .then((res) => {
          if (!cancelled) {
            setData(res);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load transfer receipt");
            setLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }
  }, [open, initialReceipt, transferId, fetchReceiptFn]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const copyProtocol = () => {
    if (!data?.protocol) return;
    navigator.clipboard.writeText(data.protocol);
    setCopiedProtocol(true);
    setTimeout(() => setCopiedProtocol(false), 2000);
  };

  const statusConfig: Record<TransferStatus, { label: string; badgeCls: string; icon: React.ComponentType<{ className?: string }> }> = {
    solicitado: {
      label: "Requested",
      badgeCls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      icon: Clock,
    },
    aprovado: {
      label: "Approved",
      badgeCls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      icon: CheckCircle2,
    },
    recusado: {
      label: "Rejected",
      badgeCls: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      icon: XCircle,
    },
    bloqueado: {
      label: "Blocked",
      badgeCls: "bg-rose-700/30 text-rose-300 border-rose-600/40",
      icon: ShieldAlert,
    },
  };

  const st = data ? statusConfig[data.status] ?? statusConfig.solicitado : statusConfig.solicitado;
  const StatusIcon = st.icon;

  return (
    <>
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #bank-transfer-receipt, #bank-transfer-receipt * {
            visibility: visible !important;
          }
          #bank-transfer-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 32px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .receipt-no-print {
            display: none !important;
          }
          .receipt-print-border {
            border-color: #e2e8f0 !important;
          }
          .receipt-print-text-dark {
            color: #0f172a !important;
          }
          .receipt-print-text-muted {
            color: #475569 !important;
          }
          .receipt-print-bg-light {
            background-color: #f8fafc !important;
          }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-6 bg-black/85 backdrop-blur-sm receipt-no-print"
        onClick={onClose}
      >
        <div
          id="bank-transfer-receipt"
          className="w-full max-w-2xl h-full max-h-[92dvh] sm:max-h-[88vh] rounded-2xl border border-white/10 bg-[oklch(0.18_0.03_240)] shadow-2xl flex flex-col overflow-hidden text-slate-100 print:text-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Action Bar (Screen Only - pinned header) */}
          <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-white/[0.04] receipt-no-print select-none">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 select-none">
              <FileText className="w-4 h-4 text-[oklch(0.7079_0.1489_234.38)]" />
              <span>Official Transfer Receipt</span>
            </div>
            <div className="flex items-center gap-2 select-none">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[oklch(0.7079_0.1489_234.38)] text-white hover:opacity-90 active:scale-95 transition text-xs font-semibold shadow-md select-none"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print / Save as PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-100 active:scale-95 transition select-none"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Receipt Body */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-8 space-y-6 print:max-h-none print:overflow-visible touch-pan-y"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                <Loader2 className="w-7 h-7 animate-spin text-[oklch(0.78_0.15_234.38)]" />
                <span className="text-sm">Loading transfer receipt…</span>
              </div>
            ) : error ? (
              <div className="text-center py-16 space-y-3">
                <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
                <h4 className="text-base font-semibold text-slate-200">Unable to load receipt</h4>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">{error}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-white/10 text-sm font-medium hover:bg-white/15 transition mt-2"
                >
                  Close
                </button>
              </div>
            ) : data ? (
              <div className="space-y-6">
                {/* Official Branding Header */}
                <div className="flex items-start justify-between border-b border-white/10 pb-5 receipt-print-border">
                  <div className="flex items-center gap-3 select-none">
                    <img src={logoImg} alt="B Bank Logo" className="h-9 w-auto object-contain brightness-110 print:brightness-100 select-none pointer-events-none" draggable={false} />
                    <div className="select-none">
                      <h1 className="text-base font-bold tracking-tight text-white print:receipt-print-text-dark select-none">B BANK</h1>
                      <p className="text-[11px] text-slate-400 print:receipt-print-text-muted select-none">Private Banking & Wealth Management</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 block print:receipt-print-text-muted">International Transfer</span>
                    <span className="text-xs font-semibold text-[oklch(0.78_0.15_234.38)] print:text-sky-700">Official Receipt</span>
                  </div>
                </div>

                {/* Status & Protocol Banner */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4.5 flex items-center justify-between flex-wrap gap-4 receipt-print-bg-light receipt-print-border">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block print:receipt-print-text-muted">Official Protocol</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-base font-bold text-white print:receipt-print-text-dark tracking-wide">
                        {data.protocol || "Not available"}
                      </span>
                      {data.protocol && (
                        <button
                          type="button"
                          onClick={copyProtocol}
                          className="text-slate-400 hover:text-slate-200 transition p-1 receipt-no-print"
                          title="Copy protocol"
                        >
                          {copiedProtocol ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${st.badgeCls}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {st.label}
                    </span>
                  </div>
                </div>

                {/* Operation Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border-b border-white/5 pb-4 receipt-print-border">
                  <div>
                    <span className="text-slate-400 block print:receipt-print-text-muted">Date & Time</span>
                    <span className="font-medium text-slate-200 print:receipt-print-text-dark mt-0.5 block">
                      {new Date(data.created_at).toLocaleString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit"
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block print:receipt-print-text-muted">Transfer ID</span>
                    <span className="font-mono text-[11px] text-slate-300 print:receipt-print-text-dark mt-0.5 block truncate" title={data.id}>
                      {data.id}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block print:receipt-print-text-muted">Network</span>
                    <span className="font-medium text-slate-200 print:receipt-print-text-dark mt-0.5 block">
                      SWIFT / International Remittance
                    </span>
                  </div>
                </div>

                {/* Section 1: SOURCE ACCOUNT */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[oklch(0.78_0.15_234.38)] print:text-sky-800 flex items-center gap-2">
                    <Landmark className="w-3.5 h-3.5" /> Source Account
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2 text-xs receipt-print-bg-light receipt-print-border">
                    <div className="flex justify-between py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Account Holder:</span>
                      <span className="font-medium text-slate-200 print:receipt-print-text-dark">{data.source_holder_name || "Not available"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Source IBAN:</span>
                      <span className="font-mono font-medium text-slate-200 print:receipt-print-text-dark">{data.source_iban || "Not available"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Source SWIFT / BIC:</span>
                      <span className="font-mono font-medium text-slate-200 print:receipt-print-text-dark">{data.source_swift || "Not available"}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400 print:receipt-print-text-muted">Account Number:</span>
                      <span className="font-mono font-medium text-slate-200 print:receipt-print-text-dark">{data.source_account_number || "Not available"}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: BENEFICIARY / DESTINATION */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[oklch(0.78_0.15_234.38)] print:text-sky-800 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5" /> Beneficiary & Destination
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2 text-xs receipt-print-bg-light receipt-print-border">
                    <div className="flex justify-between py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Beneficiary Name:</span>
                      <span className="font-semibold text-slate-200 print:receipt-print-text-dark">{data.beneficiary_name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Destination Bank:</span>
                      <span className="font-medium text-slate-200 print:receipt-print-text-dark">{data.destination_bank}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Destination SWIFT / BIC:</span>
                      <span className="font-mono font-medium text-slate-200 print:receipt-print-text-dark">{data.destination_swift}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Destination Account / IBAN:</span>
                      <span className="font-mono font-medium text-slate-200 print:receipt-print-text-dark">{data.destination_account_number}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400 print:receipt-print-text-muted">Destination Country:</span>
                      <span className="font-medium text-slate-200 print:receipt-print-text-dark">{data.destination_country}</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: AMOUNTS & EXCHANGE */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[oklch(0.78_0.15_234.38)] print:text-sky-800">
                    Amounts & FX Conversion
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs space-y-2.5 receipt-print-bg-light receipt-print-border">
                    <div className="flex justify-between items-baseline py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Amount Sent:</span>
                      <span className="text-sm font-bold text-white print:receipt-print-text-dark">
                        {data.currency_from} {data.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Applied FX Rate:</span>
                      <span className="font-mono font-medium text-slate-200 print:receipt-print-text-dark">
                        1 {data.currency_from} = {data.fx_rate.toLocaleString("en-GB", { minimumFractionDigits: 4, maximumFractionDigits: 6 })} {data.currency_to}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline py-1">
                      <span className="text-slate-400 print:receipt-print-text-muted">Converted Amount:</span>
                      <span className="text-sm font-bold text-[oklch(0.78_0.15_234.38)] print:text-sky-700">
                        {data.currency_to} {data.converted_amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 4: TRANSFER DETAILS & NOTES */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[oklch(0.78_0.15_234.38)] print:text-sky-800">
                    Operation Notes
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2 text-xs receipt-print-bg-light receipt-print-border">
                    <div className="flex justify-between py-1 border-b border-white/[0.04] receipt-print-border">
                      <span className="text-slate-400 print:receipt-print-text-muted">Reference / Note:</span>
                      <span className="font-medium text-slate-200 print:receipt-print-text-dark max-w-[65%] text-right break-words">
                        {data.reference || "None"}
                      </span>
                    </div>
                    {data.status === "recusado" && data.rejection_reason && (
                      <div className="py-2 px-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 print:text-rose-700 print:bg-rose-50 print:border-rose-200">
                        <span className="font-semibold block mb-0.5">Rejection Reason:</span>
                        <span>{data.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Official Disclaimer Footer */}
                <div className="pt-4 border-t border-white/10 text-[10px] text-slate-400 print:receipt-print-text-muted space-y-1.5 receipt-print-border">
                  <p>
                    This document is an official transfer receipt issued from persisted transaction records of the B Banking System.
                    All international remittances are processed in compliance with anti-money laundering and SWIFT financial network regulations.
                  </p>
                  <p className="text-[9px] text-slate-500 print:receipt-print-text-muted">
                    Verification Protocol: {data.protocol || "N/A"} · Internal UUID: {data.id}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
