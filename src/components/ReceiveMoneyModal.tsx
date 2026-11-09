import { useState } from "react";
import {
  Landmark, Copy, Check, ShieldCheck, ArrowDownLeft
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  sortCode: string;
  accountNumber: string;
  iban: string;
  prettyIban: string;
  holderName: string;
}

export function ReceiveMoneyModal({
  open,
  onClose,
  sortCode,
  accountNumber,
  iban,
  prettyIban,
  holderName,
}: Props) {
  const { lang } = useI18n();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyAll = () => {
    const text = [
      `Beneficiary: ${holderName}`,
      `Sort Code: ${sortCode}`,
      `Account Number: ${accountNumber}`,
      `IBAN: ${iban}`,
      `Bank: B Bank S.A.`,
      `Payment Network: UK Faster Payments Service (FPS) / Bacs`,
    ].join("\n");
    copy("all", text);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-7 bg-card border border-border shadow-2xl">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider select-none">
            <ArrowDownLeft className="w-4 h-4" />
            UK Faster Payments Service
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground select-none">
            {lang === "pt" ? "Receber Dinheiro na Conta B Bank" : "Receive Money into B Bank"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground select-none">
            {lang === "pt"
              ? "Dados bancários britânicos para transferências instantâneas via Faster Payments ou Bacs."
              : "UK bank routing credentials for instant transfers via Faster Payments or Bacs."}
          </DialogDescription>
        </DialogHeader>

        {/* Credentials Details Box */}
        <div className="space-y-3 pt-2">
          {/* Holder Name */}
          <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between">
            <div className="select-text">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block select-none">
                {lang === "pt" ? "Titular da Conta" : "Account Holder"}
              </span>
              <span className="text-sm font-bold text-foreground mt-0.5 block select-text">
                {holderName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copy("holder", holderName)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition cursor-pointer select-none"
              title="Copy holder name"
            >
              {copiedKey === "holder" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Sort Code & Account Number Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between">
              <div className="select-text">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block select-none">
                  Sort Code
                </span>
                <span className="font-mono text-base font-bold text-foreground mt-0.5 block select-text" data-copyable="true">
                  {sortCode || "10-80-00"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copy("sortCode", sortCode || "10-80-00")}
                className="p-1.5 text-muted-foreground hover:text-foreground transition cursor-pointer select-none"
                title="Copy Sort Code"
              >
                {copiedKey === "sortCode" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between">
              <div className="select-text">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block select-none">
                  Account Number
                </span>
                <span className="font-mono text-base font-bold text-foreground mt-0.5 block select-text" data-copyable="true">
                  {accountNumber || "88392019"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copy("accountNumber", accountNumber || "88392019")}
                className="p-1.5 text-muted-foreground hover:text-foreground transition cursor-pointer select-none"
                title="Copy Account Number"
              >
                {copiedKey === "accountNumber" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* IBAN */}
          <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between">
            <div className="min-w-0 pr-2 select-text">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block select-none">
                IBAN (International)
              </span>
              <span className="font-mono text-xs font-bold text-foreground mt-0.5 block truncate select-text" data-copyable="true">
                {prettyIban || iban}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copy("iban", iban)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition cursor-pointer select-none shrink-0"
              title="Copy IBAN"
            >
              {copiedKey === "iban" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Bank institution */}
          <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 flex items-center justify-between text-xs select-none">
            <span className="text-muted-foreground">{lang === "pt" ? "Instituição Bancária" : "Bank Name"}</span>
            <span className="font-semibold text-foreground">B Bank S.A.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={copyAll}
            className="flex-1 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition cursor-pointer shadow-sm select-none flex items-center justify-center gap-1.5"
          >
            {copiedKey === "all" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === "pt" ? "Todos os dados copiados!" : "Copied to clipboard!"}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{lang === "pt" ? "Copiar todos os dados bancários" : "Copy all bank details"}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition cursor-pointer select-none"
          >
            {lang === "pt" ? "Fechar" : "Close"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
