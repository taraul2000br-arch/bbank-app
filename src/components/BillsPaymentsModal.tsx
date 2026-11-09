import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ScrollText, Landmark, Clock, ArrowRight, CheckCircle2,
  AlertCircle, ShieldCheck, Zap, Droplets, Home, Wifi, Phone
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/account";

interface Props {
  open: boolean;
  onClose: () => void;
  balance: number;
  currency: string;
}

interface UKBiller {
  id: string;
  name: string;
  category: string;
  icon: typeof Zap;
  sortCode: string;
  accountNumber: string;
}

const UK_BILLERS: UKBiller[] = [
  { id: "bgas", name: "British Gas", category: "Energy & Gas", icon: Zap, sortCode: "20-04-15", accountNumber: "40918234" },
  { id: "thames", name: "Thames Water", category: "Water Utilities", icon: Droplets, sortCode: "20-26-74", accountNumber: "31829012" },
  { id: "council", name: "London Borough Council Tax", category: "Local Authority", icon: Home, sortCode: "10-80-00", accountNumber: "55192834" },
  { id: "ee", name: "BT & EE Telecom", category: "Broadband & TV", icon: Wifi, sortCode: "20-14-33", accountNumber: "77291038" },
  { id: "voda", name: "Vodafone UK", category: "Mobile Network", icon: Phone, sortCode: "20-03-53", accountNumber: "89123490" },
];

export function BillsPaymentsModal({ open, onClose, balance, currency }: Props) {
  const { lang } = useI18n();
  const navigate = useNavigate();

  const [selectedBillerId, setSelectedBillerId] = useState<string>("bgas");
  const [billReference, setBillReference] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [submittedVoucher, setSubmittedVoucher] = useState<{
    billerName: string;
    reference: string;
    amount: number;
    protocol: string;
    createdAt: string;
  } | null>(null);

  const currentBiller = UK_BILLERS.find((b) => b.id === selectedBillerId) ?? UK_BILLERS[0];

  const handlePrepare = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(billAmount);
    if (!amt || amt <= 0) return;

    setSubmittedVoucher({
      billerName: currentBiller.name,
      reference: billReference.trim() || `BILL-${Math.floor(100000 + Math.random() * 900000)}`,
      amount: amt,
      protocol: `BB-BILL-${Math.floor(1000000 + Math.random() * 9000000)}`,
      createdAt: new Date().toLocaleString("en-GB"),
    });
  };

  const reset = () => {
    setSubmittedVoucher(null);
    setBillAmount("");
    setBillReference("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-7 bg-card border border-border shadow-2xl">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider select-none">
            <ScrollText className="w-4 h-4" />
            UK Biller Directory
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground select-none">
            {lang === "pt" ? "Faturas & Pagamentos de Concessionárias" : "Bills & UK Utility Payments"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground select-none">
            {lang === "pt"
              ? "Prepare o pagamento de contas de energia, água, internet e tributos municipais no Reino Unido."
              : "Set up utility, broadband, council tax and merchant bill payments in GBP."}
          </DialogDescription>
        </DialogHeader>

        {!submittedVoucher ? (
          <form onSubmit={handlePrepare} className="space-y-4 pt-2">
            {/* Biller selector */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2 select-none">
                {lang === "pt" ? "Selecione a Concessionária / Empresa *" : "Select UK Biller / Organisation *"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 select-none">
                {UK_BILLERS.map((biller) => {
                  const Icon = biller.icon;
                  const isSelected = biller.id === selectedBillerId;
                  return (
                    <button
                      key={biller.id}
                      type="button"
                      onClick={() => setSelectedBillerId(biller.id)}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border/60 bg-secondary/30 hover:bg-secondary/60 text-foreground"
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate">{biller.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{biller.category}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reference Number */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1 select-none">
                {lang === "pt" ? "Número da Fatura / Referência do Cliente *" : "Bill Account / Customer Reference *"}
              </label>
              <input
                type="text"
                value={billReference}
                onChange={(e) => setBillReference(e.target.value)}
                placeholder="e.g. BG-891029381 or 12-digit Council Ref"
                className="w-full h-10 px-3.5 rounded-xl border border-border bg-secondary/30 text-xs sm:text-sm outline-none font-mono focus:bg-background focus:border-primary transition"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1 select-none">
                {lang === "pt" ? "Valor da Fatura em GBP (£) *" : "Payment Amount in GBP (£) *"}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3.5 rounded-xl border border-border bg-secondary/30 text-xs sm:text-sm font-semibold outline-none focus:bg-background focus:border-primary transition"
                required
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-full border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition cursor-pointer select-none"
              >
                {lang === "pt" ? "Cancelar" : "Dismiss"}
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition cursor-pointer shadow-sm select-none"
              >
                {lang === "pt" ? "Preparar Pagamento" : "Prepare Bill Payment"}
              </button>
            </div>
          </form>
        ) : (
          /* Success Voucher View */
          <div className="space-y-4 pt-2 select-none">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-bold text-foreground">
                  {lang === "pt" ? "Ordem de Fatura Preparada com Sucesso" : "Bill Payment Order Prepared"}
                </span>
              </div>
              <div className="space-y-2 text-xs divide-y divide-border/40">
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Biller:</span>
                  <span className="font-semibold text-foreground">{submittedVoucher.billerName}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-mono font-medium text-foreground">{submittedVoucher.reference}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold tabular-nums text-foreground">{formatMoney(submittedVoucher.amount, currency)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Protocol:</span>
                  <span className="font-mono text-muted-foreground">{submittedVoucher.protocol}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  navigate({ to: "/standing-orders" });
                }}
                className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>{lang === "pt" ? "Agendar como Standing Order" : "Schedule as Standing Order"}</span>
              </button>
              <button
                type="button"
                onClick={reset}
                className="w-full py-2.5 rounded-full border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition cursor-pointer"
              >
                {lang === "pt" ? "Preparar outra fatura" : "Prepare another bill"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
