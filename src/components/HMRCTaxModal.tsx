import { useState } from "react";
import {
  Landmark, CheckCircle2, ShieldCheck, Info, FileText,
  AlertTriangle, Copy, Check, Printer
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
}

export function HMRCTaxModal({ open, onClose }: Props) {
  const { lang } = useI18n();

  const [taxRegime, setTaxRegime] = useState<"self-assessment" | "corporation-tax" | "vat" | "paye">("self-assessment");
  const [taxReference, setTaxReference] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [preparedDoc, setPreparedDoc] = useState<{
    regimeLabel: string;
    reference: string;
    amount: number;
    protocol: string;
    date: string;
  } | null>(null);

  const regimeLabels: Record<string, string> = {
    "self-assessment": "Self Assessment (Income Tax - 10-digit UTR + 'K')",
    "corporation-tax": "Corporation Tax (17-character reference)",
    vat: "VAT / Value Added Tax (9-digit VAT Registration)",
    paye: "PAYE / National Insurance (13-character Accounts Office Ref)",
  };

  const handlePrepare = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(taxAmount);
    if (!amt || amt <= 0) return;

    setPreparedDoc({
      regimeLabel: regimeLabels[taxRegime],
      reference: taxReference.trim() || "1234567890K",
      amount: amt,
      protocol: `HMRC-PREP-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toLocaleString("en-GB"),
    });
  };

  const reset = () => {
    setPreparedDoc(null);
    setTaxAmount("");
    setTaxReference("");
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
            <Landmark className="w-4 h-4" />
            HM Revenue & Customs (HMRC)
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground select-none">
            {lang === "pt" ? "Pagamento de Tributos HMRC" : "HMRC Tax Payment"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground select-none">
            {lang === "pt"
              ? "Emissão e conferência de guias para recolhimento de referências fiscais no Reino Unido."
              : "Payment instructions and details for UK tax references."}
          </DialogDescription>
        </DialogHeader>

        {!preparedDoc ? (
          <form onSubmit={handlePrepare} className="space-y-4 pt-2">
            {/* Tax Regime Selector */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5 select-none">
                {lang === "pt" ? "Categoria Tributária HMRC *" : "HMRC Tax Category *"}
              </label>
              <select
                value={taxRegime}
                onChange={(e) => setTaxRegime(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/30 text-xs sm:text-sm outline-none focus:bg-background focus:border-primary transition select-none"
              >
                <option value="self-assessment">Self Assessment (Income Tax / IRPF UK)</option>
                <option value="corporation-tax">Corporation Tax (Imposto sobre Empresas)</option>
                <option value="vat">VAT / IVA (Value Added Tax)</option>
                <option value="paye">PAYE / Empregador & National Insurance</option>
              </select>
            </div>

            {/* Tax Reference */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1 select-none">
                {lang === "pt" ? "Referência Fiscal HMRC (UTR / Ref) *" : "HMRC Payment Reference / UTR *"}
              </label>
              <input
                type="text"
                value={taxReference}
                onChange={(e) => setTaxReference(e.target.value)}
                placeholder="e.g. 10-digit UTR ending in 'K' (1234567890K)"
                className="w-full h-10 px-3.5 rounded-xl border border-border bg-secondary/30 text-xs sm:text-sm outline-none font-mono focus:bg-background focus:border-primary transition"
                required
              />
              <span className="text-[10px] text-muted-foreground mt-1 block select-none">
                {lang === "pt"
                  ? "Em pagamentos reais, a referência exata garante a alocação correta pelo HMRC."
                  : "On real tax payments, the exact reference ensures correct allocation by HMRC."}
              </span>
            </div>

            {/* Tax Amount */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1 select-none">
                {lang === "pt" ? "Valor em GBP (£) *" : "Amount in GBP (£) *"}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3.5 rounded-xl border border-border bg-secondary/30 text-xs sm:text-sm font-semibold outline-none focus:bg-background focus:border-primary transition"
                required
              />
            </div>

            {/* Informational Guidance regarding official UK payments */}
            <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/50 space-y-1 text-xs select-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {lang === "pt" ? "Orientações sobre Liquidação ao HMRC" : "Official HMRC Payment Guidance"}
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {lang === "pt"
                  ? "Para liquidações fiscais, utilize as coordenadas oficiais de recolhimento informadas na sua notificação no portal do governo britânico (gov.uk/pay-tax)."
                  : "For tax settlements, use the official payment credentials provided in your tax assessment on gov.uk/pay-tax."}
              </p>
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
                {lang === "pt" ? "Gerar Guia de Pagamento" : "Generate Payment Voucher"}
              </button>
            </div>
          </form>
        ) : (
          /* Tax Calculation Summary */
          <div className="space-y-4 pt-2 select-none">
            <div className="p-5 rounded-2xl bg-secondary/30 border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {lang === "pt" ? "Resumo do Pagamento" : "Payment Summary"}
                </span>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  {lang === "pt" ? "Ordem de Recolhimento" : "Settlement Order"}
                </span>
              </div>
              <div className="space-y-2 text-xs divide-y divide-border/40">
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">{lang === "pt" ? "Regime Selecionado:" : "Tax Category:"}</span>
                  <span className="font-semibold text-foreground text-right">{preparedDoc.regimeLabel}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">{lang === "pt" ? "Referência Informada:" : "Reference Entered:"}</span>
                  <span className="font-mono font-medium text-foreground">{preparedDoc.reference}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">{lang === "pt" ? "Valor:" : "Amount:"}</span>
                  <span className="font-bold tabular-nums text-foreground">{formatMoney(preparedDoc.amount, "GBP")}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">{lang === "pt" ? "Status da Operação:" : "Operation Status:"}</span>
                  <span className="font-medium text-primary">
                    {lang === "pt" ? "Pronto para Liquidação" : "Ready for Settlement"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 py-2.5 rounded-full border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition cursor-pointer"
              >
                {lang === "pt" ? "Novo Cálculo" : "New Calculation"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition cursor-pointer shadow-sm"
              >
                {lang === "pt" ? "Fechar" : "Close"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
