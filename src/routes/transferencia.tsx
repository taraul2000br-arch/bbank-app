import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowLeftRight, CheckCircle2, Globe2, Send, Shield, Loader2, AlertTriangle, FileText } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AccountShell } from "@/components/AccountShell";
import { formatMoney } from "@/lib/account";
import { useI18n, type Lang } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { TransferReceiptModal } from "@/components/TransferReceiptModal";

import { useAuth } from "@/lib/auth";
import { useProfile, useAccount } from "@/lib/account";
import { submitTransfer } from "@/lib/transfers.functions";

/* -------------------- Error helpers -------------------- */

const ERR_FIELD_LABELS: Record<Lang, Record<string, string>> = {
  en: { beneficiary_name: "Beneficiary name", beneficiary_doc: "Beneficiary document", beneficiary_email: "Beneficiary e-mail", bank_name: "Bank name", swift: "SWIFT/BIC", account_number: "Account number", to_country: "Destination country", amount: "Amount", reference: "Reference", purpose: "Purpose" },
  pt: { beneficiary_name: "Nome do beneficiário", beneficiary_doc: "Documento do beneficiário", beneficiary_email: "E-mail do beneficiário", bank_name: "Nome do banco", swift: "SWIFT/BIC", account_number: "Número da conta", to_country: "País de destino", amount: "Valor", reference: "Referência", purpose: "Finalidade" },
  es: { beneficiary_name: "Nombre del beneficiario", beneficiary_doc: "Documento del beneficiario", beneficiary_email: "Correo del beneficiario", bank_name: "Nombre del banco", swift: "SWIFT/BIC", account_number: "Número de cuenta", to_country: "País de destino", amount: "Importe", reference: "Referencia", purpose: "Finalidad" },
  fr: { beneficiary_name: "Nom du bénéficiaire", beneficiary_doc: "Document du bénéficiaire", beneficiary_email: "E-mail du bénéficiaire", bank_name: "Nom de la banque", swift: "SWIFT/BIC", account_number: "Numéro de compte", to_country: "Pays de destination", amount: "Montant", reference: "Référence", purpose: "Motif" },
  pl: { beneficiary_name: "Nazwa beneficjenta", beneficiary_doc: "Dokument beneficjenta", beneficiary_email: "E-mail beneficjenta", bank_name: "Nazwa banku", swift: "SWIFT/BIC", account_number: "Numer konta", to_country: "Kraj docelowy", amount: "Kwota", reference: "Tytuł przelewu", purpose: "Cel" },
  de: { beneficiary_name: "Name des Empfängers", beneficiary_doc: "Dokument des Empfängers", beneficiary_email: "E-Mail des Empfängers", bank_name: "Bankname", swift: "SWIFT/BIC", account_number: "Kontonummer", to_country: "Zielland", amount: "Betrag", reference: "Verwendungszweck", purpose: "Zweck" },
};

const ERR_DICT: Record<Lang, { title: string; invalid: (f: string) => string; required: (f: string) => string; tooShort: (f: string) => string; invalidEmail: (f: string) => string; insufficient: string; accountNotFound: string; generic: string; close: string }> = {
  en: { title: "We couldn't submit your transfer", invalid: (f) => `The field "${f}" is invalid.`, required: (f) => `Please fill in "${f}".`, tooShort: (f) => `"${f}" is too short.`, invalidEmail: (f) => `"${f}" is not a valid e-mail address.`, insufficient: "Insufficient balance for this transfer.", accountNotFound: "Account not found.", generic: "Something went wrong. Please review the form and try again.", close: "OK" },
  pt: { title: "Não conseguimos enviar a sua transferência", invalid: (f) => `O campo "${f}" é inválido.`, required: (f) => `Por favor, preencha "${f}".`, tooShort: (f) => `"${f}" é muito curto.`, invalidEmail: (f) => `"${f}" não é um e-mail válido.`, insufficient: "Saldo insuficiente para esta transferência.", accountNotFound: "Conta não encontrada.", generic: "Algo correu mal. Reveja o formulário e tente novamente.", close: "OK" },
  es: { title: "No pudimos enviar su transferencia", invalid: (f) => `El campo "${f}" no es válido.`, required: (f) => `Por favor, complete "${f}".`, tooShort: (f) => `"${f}" es demasiado corto.`, invalidEmail: (f) => `"${f}" no es un correo válido.`, insufficient: "Saldo insuficiente para esta transferencia.", accountNotFound: "Cuenta no encontrada.", generic: "Algo salió mal. Revise el formulario e intente de nuevo.", close: "OK" },
  fr: { title: "Impossible d'envoyer votre virement", invalid: (f) => `Le champ « ${f} » est invalide.`, required: (f) => `Veuillez remplir « ${f} ».`, tooShort: (f) => `« ${f} » est trop court.`, invalidEmail: (f) => `« ${f} » n'est pas un e-mail valide.`, insufficient: "Solde insuffisant pour ce virement.", accountNotFound: "Compte introuvable.", generic: "Une erreur s'est produite. Vérifiez le formulaire et réessayez.", close: "OK" },
  pl: { title: "Nie udało się wysłać przelewu", invalid: (f: string) => `Pole „${f}" jest nieprawidłowe.`, required: (f: string) => `Wypełnij pole „${f}".`, tooShort: (f: string) => `„${f}" jest za krótkie.`, invalidEmail: (f: string) => `„${f}" nie jest prawidłowym adresem e-mail.`, insufficient: "Niewystarczające środki na ten przelew.", accountNotFound: "Nie znaleziono konta.", generic: "Coś poszło nie tak. Sprawdź formularz i spróbuj ponownie.", close: "OK" },
  de: { title: "Überweisung konnte nicht gesendet werden", invalid: (f) => `Das Feld „${f}" ist ungültig.`, required: (f) => `Bitte „${f}" ausfüllen.`, tooShort: (f) => `„${f}" ist zu kurz.`, invalidEmail: (f) => `„${f}" ist keine gültige E-Mail-Adresse.`, insufficient: "Unzureichendes Guthaben für diese Überweisung.", accountNotFound: "Konto nicht gefunden.", generic: "Etwas ist schiefgelaufen. Bitte Formular prüfen und erneut versuchen.", close: "OK" },
};

function friendlyTransferError(raw: unknown, lang: Lang): string {
  const D = ERR_DICT[lang] ?? ERR_DICT.en;
  const FIELDS = ERR_FIELD_LABELS[lang] ?? ERR_FIELD_LABELS.en;
  const msg = (raw as any)?.message ?? String(raw ?? "");

  // Unconfirmed / transient network results
  if (/abort|timeout|failed to fetch|network|econnreset|econnrefused/i.test(msg)) {
    return lang === "pt"
      ? "Não foi possível confirmar o resultado da operação. Verifique seu extrato bancário antes de tentar novamente para evitar duplicidade."
      : "Could not confirm the result of the operation. Please verify your bank statement before trying again to avoid duplicate charges.";
  }

  // Known server errors
  if (/insufficient balance/i.test(msg)) return D.insufficient;
  if (/account not found/i.test(msg)) return D.accountNotFound;
  if (/invalid converted amount/i.test(msg)) {
    return lang === "pt"
      ? "Valor de conversão inválido. Por favor, reveja o valor inserido."
      : "Invalid converted amount. Please review the transfer values.";
  }
  if (/invalid transfer amount/i.test(msg)) {
    return lang === "pt"
      ? "Valor de transferência inválido. O valor deve ser superior às taxas aplicadas."
      : "Invalid transfer amount. The amount must cover the transaction fees.";
  }
  // Try parse Zod JSON array
  const jsonStart = msg.indexOf("[");
  if (jsonStart >= 0) {
    try {
      const issues = JSON.parse(msg.slice(jsonStart));
      if (Array.isArray(issues) && issues.length) {
        const lines = issues.slice(0, 5).map((i: any) => {
          const path = Array.isArray(i.path) ? i.path[0] : "";
          const label = FIELDS[path] ?? path ?? "";
          if (i.validation === "email" || /email/i.test(i.message ?? "")) return D.invalidEmail(label);
          if (i.code === "too_small") return D.tooShort(label);
          if (i.code === "invalid_type" && i.received === "undefined") return D.required(label);
          return D.invalid(label);
        });
        return lines.join("\n");
      }
    } catch { /* ignore */ }
  }
  return msg && msg.length < 200 ? msg : D.generic;
}

function TransferenciaErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center p-8 bg-card rounded-2xl border border-border shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Não foi possível carregar esta página.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Encontramos um problema temporário. Tente novamente ou volte para sua conta.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
          >
            Tentar novamente
          </button>
          <Link
            to="/conta"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/80 transition"
          >
            Voltar para minha conta
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/transferencia")({
  component: TransferenciaPage,
  head: () => ({ meta: [{ title: "International Transfer — Secure Portal" }] }),
  errorComponent: TransferenciaErrorComponent,
});

/* -------------------- i18n (local) -------------------- */

type TxDict = {
  metaTitle: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  step1: string;
  step2: string;
  step3: string;
  routeTitle: string;
  from: string;
  to: string;
  beneficiary: string;
  fullName: string;
  fullNamePh: string;
  document: string;
  documentPh: string;
  emailBen: string;
  emailBenPh: string;
  bankTitle: string;
  bankName: string;
  bankNamePh: string;
  amountTitle: string;
  amountLabel: (cur: string) => string;
  purpose: string;
  purposes: Record<string, string>;
  reference: string;
  referencePh: string;
  cancel: string;
  reviewBtn: string;
  simTitle: string;
  send: string;
  fxRate: string;
  iof: (p: string) => string;
  spread: (p: string) => string;
  swiftFee: string;
  totalDebit: string;
  benReceives: string;
  protectionTitle: string;
  protectionDesc: string;
  reviewTitle: string;
  reviewSubtitle: string;
  routeK: string;
  purposeK: string;
  beneficiaryK: string;
  documentK: string;
  bankK: string;
  refK: string;
  valueSent: string;
  fxApplied: string;
  feesTaxes: string;
  totalDebited: string;
  benWillReceive: string;
  back: string;
  confirm: string;
  processing: string;
  successTitle: string;
  successDesc: (amount: string, name: string, flag: string, country: string) => string;
  protocol: string;
  newTransfer: string;
  backToAccount: string;
  amountReadonlyHint: string;
  insufficientBalance: string;
  zeroBalance: string;
};

const LOCALES: Record<Lang, TxDict> = {
  en: {
    metaTitle: "International Transfer — B Bank",
    eyebrow: "International Transfer",
    title: "Send money worldwide",
    subtitle: "SWIFT network • Settlement in up to 24 business hours • Real-time B Bank FX",
    step1: "Details", step2: "Review", step3: "Confirmation",
    routeTitle: "Transfer route", from: "From", to: "To",
    beneficiary: "Beneficiary details",
    fullName: "Full name", fullNamePh: "As it appears on the document",
    document: "Document", documentPh: "ID / SSN / NIF / DNI",
    emailBen: "Beneficiary email", emailBenPh: "credit notification",
    bankTitle: "Destination bank",
    bankName: "Bank name", bankNamePh: "e.g. Santander Bank",
    amountTitle: "Amount and purpose",
    amountLabel: (cur) => `Amount to send (${cur})`,
    purpose: "Purpose",
    purposes: {
      family: "Family support", services: "Service payment", goods: "Goods purchase",
      investment: "Investment", education: "Education", property: "Property", other: "Other",
    },
    reference: "Reference / message", referencePh: "Shows on the beneficiary's statement",
    cancel: "Cancel", reviewBtn: "Review transfer",
    simTitle: "FX exchange calculation", send: "You send",
    fxRate: "B Bank FX rate",
    iof: (p) => `IOF (${p}%)`, spread: (p) => `Spread (${p}%)`,
    swiftFee: "SWIFT fee", totalDebit: "Total debited", benReceives: "Beneficiary receives",
    protectionTitle: "B Bank Protection",
    protectionDesc: "Every remittance is processed in an encrypted environment, with anti-fraud verification and dual confirmation before settlement on the SWIFT network.",
    reviewTitle: "Confirm the transfer details",
    reviewSubtitle: "Review carefully. Once confirmed, the operation will be sent for settlement on the SWIFT network.",
    routeK: "Route", purposeK: "Purpose", beneficiaryK: "Beneficiary", documentK: "Document",
    bankK: "Bank", refK: "Reference",
    valueSent: "Amount sent", fxApplied: "Applied FX rate", feesTaxes: "Fees and taxes",
    totalDebited: "Total debited from your account", benWillReceive: "Beneficiary will receive",
    back: "← Back and edit", confirm: "Confirm transfer", processing: "Processing…",
    successTitle: "Transfer under review",
    successDesc: (a, n, f, c) => `Your remittance of ${a} to ${n} in ${f} ${c} has been received and is being processed by the B Bank FX desk.`,
    protocol: "Reference", newTransfer: "New transfer", backToAccount: "Back to account",
    amountReadonlyHint: "Total account balance — cannot be edited",
    insufficientBalance: "Insufficient balance to complete this transfer. The total cost exceeds your available balance.",
    zeroBalance: "Your account balance is zero. You cannot make transfers until you have funds available.",
  },
  es: {
    metaTitle: "Transferencia Internacional — B Bank",
    eyebrow: "Transferencia Internacional",
    title: "Envía dinero al mundo",
    subtitle: "Red SWIFT • Liquidación en hasta 24h hábiles • Cambio B Bank en tiempo real",
    step1: "Datos", step2: "Revisión", step3: "Confirmación",
    routeTitle: "Ruta de la transferencia", from: "De", to: "Para",
    beneficiary: "Datos del beneficiario",
    fullName: "Nombre completo", fullNamePh: "Como aparece en el documento",
    document: "Documento", documentPh: "DNI / NIF / SSN / CPF",
    emailBen: "Correo del beneficiario", emailBenPh: "aviso de crédito",
    bankTitle: "Banco de destino",
    bankName: "Nombre del banco", bankNamePh: "Ej.: Banco Santander",
    amountTitle: "Importe y finalidad",
    amountLabel: (cur) => `Importe a enviar (${cur})`,
    purpose: "Finalidad",
    purposes: {
      family: "Ayuda familiar", services: "Pago de servicios", goods: "Compra de mercancías",
      investment: "Inversión", education: "Educación", property: "Inmueble", other: "Otros",
    },
    reference: "Referencia / mensaje", referencePh: "Aparece en el extracto del beneficiario",
    cancel: "Cancelar", reviewBtn: "Revisar transferencia",
    simTitle: "Cálculo de cambio", send: "Tú envías",
    fxRate: "Tipo de cambio B Bank",
    iof: (p) => `Impuesto (${p}%)`, spread: (p) => `Spread (${p}%)`,
    swiftFee: "Tarifa SWIFT", totalDebit: "Total debitado", benReceives: "Beneficiario recibe",
    protectionTitle: "Protección B Bank",
    protectionDesc: "Todas las remesas se procesan en entorno cifrado, con verificación antifraude y doble confirmación antes de la liquidación en la red SWIFT.",
    reviewTitle: "Confirma los datos de la transferencia",
    reviewSubtitle: "Revisa con atención. Tras confirmar, la operación seguirá para liquidación en la red SWIFT.",
    routeK: "Ruta", purposeK: "Finalidad", beneficiaryK: "Beneficiario", documentK: "Documento",
    bankK: "Banco", refK: "Referencia",
    valueSent: "Importe enviado", fxApplied: "Cambio aplicado", feesTaxes: "Tarifas e impuestos",
    totalDebited: "Total debitado de tu cuenta", benWillReceive: "El beneficiario recibirá",
    back: "← Volver y editar", confirm: "Confirmar transferencia", processing: "Procesando…",
    successTitle: "Transferencia en análisis",
    successDesc: (a, n, f, c) => `Tu remesa de ${a} para ${n} en ${f} ${c} fue recibida y está siendo procesada por la mesa de cambio B Bank.`,
    protocol: "Protocolo", newTransfer: "Nueva transferencia", backToAccount: "Volver a la cuenta",
    amountReadonlyHint: "Saldo total de la cuenta — no editable",
    insufficientBalance: "Saldo insuficiente para completar esta transferencia. El costo total supera su saldo disponible.",
    zeroBalance: "El saldo de su cuenta es cero. No puede realizar transferencias hasta tener fondos disponibles.",
  },
  pt: {
    metaTitle: "Transferência Internacional — B Bank",
    eyebrow: "Transferência Internacional",
    title: "Envie dinheiro para o mundo",
    subtitle: "Rede SWIFT • Liquidação em até 24h úteis • Câmbio B Bank em tempo real",
    step1: "Dados", step2: "Revisão", step3: "Confirmação",
    routeTitle: "Rota da transferência", from: "De", to: "Para",
    beneficiary: "Dados do beneficiário",
    fullName: "Nome completo", fullNamePh: "Como aparece no documento",
    document: "Documento", documentPh: "CPF / NIF / SSN / DNI",
    emailBen: "E-mail do beneficiário", emailBenPh: "aviso de crédito",
    bankTitle: "Banco de destino",
    bankName: "Nome do banco", bankNamePh: "Ex: Banco Santander",
    amountTitle: "Valor e finalidade",
    amountLabel: (cur) => `Valor a enviar (${cur})`,
    purpose: "Finalidade",
    purposes: {
      family: "Ajuda familiar", services: "Pagamento de serviços", goods: "Compra de mercadorias",
      investment: "Investimento", education: "Educação", property: "Imóvel", other: "Outros",
    },
    reference: "Referência / mensagem", referencePh: "Aparece no extrato do beneficiário",
    cancel: "Cancelar", reviewBtn: "Revisar transferência",
    simTitle: "Cálculo de câmbio", send: "Você envia",
    fxRate: "Câmbio B Bank",
    iof: (p) => `IOF (${p}%)`, spread: (p) => `Spread (${p}%)`,
    swiftFee: "Tarifa SWIFT", totalDebit: "Total debitado", benReceives: "Beneficiário recebe",
    protectionTitle: "Proteção B Bank",
    protectionDesc: "Todas as remessas são processadas em ambiente criptografado, com verificação anti-fraude e confirmação dupla antes da liquidação na rede SWIFT.",
    reviewTitle: "Confirme os dados da transferência",
    reviewSubtitle: "Revise com atenção. Após confirmar, a operação seguirá para liquidação na rede SWIFT.",
    routeK: "Rota", purposeK: "Finalidade", beneficiaryK: "Beneficiário", documentK: "Documento",
    bankK: "Banco", refK: "Referência",
    valueSent: "Valor enviado", fxApplied: "Câmbio aplicado", feesTaxes: "Tarifas e impostos",
    totalDebited: "Total debitado da sua conta", benWillReceive: "Beneficiário receberá",
    back: "← Voltar e editar", confirm: "Confirmar transferência", processing: "Processando…",
    successTitle: "Transferência em análise",
    successDesc: (a, n, f, c) => `Sua remessa de ${a} para ${n} em ${f} ${c} foi recebida e está sendo processada pela mesa de câmbio B Bank.`,
    protocol: "Protocolo", newTransfer: "Nova transferência", backToAccount: "Voltar à conta",
    amountReadonlyHint: "Saldo total da conta — não editável",
    insufficientBalance: "Saldo insuficiente para completar esta transferência. O custo total supera seu saldo disponível.",
    zeroBalance: "O saldo da sua conta é zero. Você não pode fazer transferências até ter fundos disponíveis.",
  },
  fr: {
    metaTitle: "Virement International — B Bank",
    eyebrow: "Virement International",
    title: "Envoyez de l'argent partout dans le monde",
    subtitle: "Réseau SWIFT • Règlement sous 24h ouvrées • Change B Bank en temps réel",
    step1: "Détails", step2: "Révision", step3: "Confirmation",
    routeTitle: "Route du virement", from: "De", to: "Vers",
    beneficiary: "Coordonnées du bénéficiaire",
    fullName: "Nom complet", fullNamePh: "Tel qu'il apparaît sur le document",
    document: "Document", documentPh: "ID / SSN / NIF / DNI",
    emailBen: "E-mail du bénéficiaire", emailBenPh: "avis de crédit",
    bankTitle: "Banque de destination",
    bankName: "Nom de la banque", bankNamePh: "Ex. : Banque Santander",
    amountTitle: "Montant et finalité",
    amountLabel: (cur) => `Montant à envoyer (${cur})`,
    purpose: "Finalité",
    purposes: {
      family: "Soutien familial", services: "Paiement de services", goods: "Achat de marchandises",
      investment: "Investissement", education: "Éducation", property: "Immobilier", other: "Autres",
    },
    reference: "Référence / message", referencePh: "Apparaît sur le relevé du bénéficiaire",
    cancel: "Annuler", reviewBtn: "Vérifier le virement",
    simTitle: "Calcul de change", send: "Vous envoyez",
    fxRate: "Taux B Bank",
    iof: (p) => `Taxe (${p}%)`, spread: (p) => `Spread (${p}%)`,
    swiftFee: "Frais SWIFT", totalDebit: "Total débité", benReceives: "Le bénéficiaire reçoit",
    protectionTitle: "Protection B Bank",
    protectionDesc: "Chaque virement est traité en environnement chiffré, avec vérification anti-fraude et double confirmation avant règlement sur le réseau SWIFT.",
    reviewTitle: "Confirmez les détails du virement",
    reviewSubtitle: "Vérifiez attentivement. Après confirmation, l'opération sera envoyée au règlement SWIFT.",
    routeK: "Route", purposeK: "Finalité", beneficiaryK: "Bénéficiaire", documentK: "Document",
    bankK: "Banque", refK: "Référence",
    valueSent: "Montant envoyé", fxApplied: "Taux appliqué", feesTaxes: "Frais et taxes",
    totalDebited: "Total débité de votre compte", benWillReceive: "Le bénéficiaire recevra",
    back: "← Retour et modifier", confirm: "Confirmer le virement", processing: "Traitement…",
    successTitle: "Virement en cours d'analyse",
    successDesc: (a, n, f, c) => `Votre virement de ${a} vers ${n} en ${f} ${c} a été reçu et est en cours de traitement par le bureau de change B Bank.`,
    protocol: "Référence", newTransfer: "Nouveau virement", backToAccount: "Retour au compte",
    amountReadonlyHint: "Solde total du compte — non modifiable",
    insufficientBalance: "Solde insuffisant pour effectuer ce virement. Le coût total dépasse votre solde disponible.",
    zeroBalance: "Le solde de votre compte est nul. Vous ne pouvez pas effectuer de virements tant que vous n'avez pas de fonds disponibles.",
  },
  de: {
    metaTitle: "Internationale Überweisung — B Bank",
    eyebrow: "Internationale Überweisung",
    title: "Senden Sie Geld weltweit",
    subtitle: "SWIFT-Netzwerk • Abwicklung in bis zu 24 Werktagsstunden • B Bank-FX in Echtzeit",
    step1: "Daten", step2: "Prüfung", step3: "Bestätigung",
    routeTitle: "Überweisungsroute", from: "Von", to: "Nach",
    beneficiary: "Empfängerdaten",
    fullName: "Vollständiger Name", fullNamePh: "Wie auf dem Ausweis",
    document: "Ausweis", documentPh: "ID / SSN / NIF / DNI",
    emailBen: "E-Mail des Empfängers", emailBenPh: "Gutschriftbenachrichtigung",
    bankTitle: "Zielbank",
    bankName: "Name der Bank", bankNamePh: "z. B. Santander Bank",
    amountTitle: "Betrag und Zweck",
    amountLabel: (cur) => `Zu sendender Betrag (${cur})`,
    purpose: "Zweck",
    purposes: {
      family: "Familienunterstützung", services: "Dienstleistungszahlung", goods: "Warenkauf",
      investment: "Investition", education: "Bildung", property: "Immobilie", other: "Sonstiges",
    },
    reference: "Referenz / Nachricht", referencePh: "Erscheint auf dem Kontoauszug des Empfängers",
    cancel: "Abbrechen", reviewBtn: "Überweisung prüfen",
    simTitle: "FX-Wechselkursrechner", send: "Sie senden",
    fxRate: "B Bank-Wechselkurs",
    iof: (p) => `Steuer (${p}%)`, spread: (p) => `Spread (${p}%)`,
    swiftFee: "SWIFT-Gebühr", totalDebit: "Gesamtbelastung", benReceives: "Empfänger erhält",
    protectionTitle: "B Bank-Schutz",
    protectionDesc: "Alle Überweisungen werden in verschlüsselter Umgebung mit Betrugsprüfung und doppelter Bestätigung vor der SWIFT-Abwicklung verarbeitet.",
    reviewTitle: "Bestätigen Sie die Überweisungsdaten",
    reviewSubtitle: "Bitte sorgfältig prüfen. Nach der Bestätigung wird der Vorgang zur SWIFT-Abwicklung weitergeleitet.",
    routeK: "Route", purposeK: "Zweck", beneficiaryK: "Empfänger", documentK: "Ausweis",
    bankK: "Bank", refK: "Referenz",
    valueSent: "Gesendeter Betrag", fxApplied: "Angewandter Kurs", feesTaxes: "Gebühren und Steuern",
    totalDebited: "Gesamtbelastung Ihres Kontos", benWillReceive: "Empfänger erhält",
    back: "← Zurück und bearbeiten", confirm: "Überweisung bestätigen", processing: "Wird verarbeitet…",
    successTitle: "Überweisung in Prüfung",
    successDesc: (a, n, f, c) => `Ihre Überweisung von ${a} an ${n} in ${f} ${c} wurde empfangen und wird vom B Bank-FX-Desk bearbeitet.`,
    protocol: "Referenz", newTransfer: "Neue Überweisung", backToAccount: "Zurück zum Konto",
    amountReadonlyHint: "Gesamtsaldo des Kontos — nicht bearbeitbar",
    insufficientBalance: "Unzureichendes Guthaben für diese Überweisung. Die Gesamtkosten übersteigen Ihr verfügbares Guthaben.",
    zeroBalance: "Ihr Kontostand ist Null. Sie können keine Überweisungen tätigen, bis Sie über verfügbare Mittel verfügen.",
  },
  pl: {
    metaTitle: "Przelew Międzynarodowy — B Bank",
    eyebrow: "Przelew Międzynarodowy",
    title: "Wyślij pieniądze na cały świat",
    subtitle: "Sieć SWIFT • Rozliczenie do 24h roboczych • Kursy B Bank w czasie rzeczywistym",
    step1: "Dane", step2: "Weryfikacja", step3: "Potwierdzenie",
    routeTitle: "Trasa przelewu", from: "Z", to: "Do",
    beneficiary: "Dane odbiorcy",
    fullName: "Imię i nazwisko", fullNamePh: "Tak jak na dokumencie",
    document: "Dokument", documentPh: "ID / SSN / NIF / DNI",
    emailBen: "E-mail odbiorcy", emailBenPh: "powiadomienie o wpływie",
    bankTitle: "Bank docelowy",
    bankName: "Nazwa banku", bankNamePh: "np. Santander Bank",
    amountTitle: "Kwota i cel",
    amountLabel: (cur) => `Kwota do wysłania (${cur})`,
    purpose: "Cel",
    purposes: {
      family: "Wsparcie rodziny", services: "Płatność za usługi", goods: "Zakup towarów",
      investment: "Inwestycja", education: "Edukacja", property: "Nieruchomość", other: "Inne",
    },
    reference: "Referencja / wiadomość", referencePh: "Pojawi się na wyciągu odbiorcy",
    cancel: "Anuluj", reviewBtn: "Sprawdź przelew",
    simTitle: "Symulacja kursu", send: "Wysyłasz",
    fxRate: "Kurs B Bank",
    iof: (p) => `Podatek (${p}%)`, spread: (p) => `Spread (${p}%)`,
    swiftFee: "Opłata SWIFT", totalDebit: "Łącznie pobrano", benReceives: "Odbiorca otrzymuje",
    protectionTitle: "Ochrona B Bank",
    protectionDesc: "Każdy przelew jest przetwarzany w środowisku szyfrowanym, z weryfikacją antyfraudową i podwójnym potwierdzeniem przed rozliczeniem w sieci SWIFT.",
    reviewTitle: "Potwierdź dane przelewu",
    reviewSubtitle: "Sprawdź uważnie. Po potwierdzeniu operacja zostanie przekazana do rozliczenia w sieci SWIFT.",
    routeK: "Trasa", purposeK: "Cel", beneficiaryK: "Odbiorca", documentK: "Dokument",
    bankK: "Bank", refK: "Referencja",
    valueSent: "Wysłana kwota", fxApplied: "Zastosowany kurs", feesTaxes: "Opłaty i podatki",
    totalDebited: "Łącznie pobrano z konta", benWillReceive: "Odbiorca otrzyma",
    back: "← Wróć i edytuj", confirm: "Potwierdź przelew", processing: "Przetwarzanie…",
    successTitle: "Przelew w trakcie weryfikacji",
    successDesc: (a, n, f, c) => `Twój przelew ${a} dla ${n} w ${f} ${c} został odebrany i jest przetwarzany przez biuro FX B Bank.`,
    protocol: "Numer", newTransfer: "Nowy przelew", backToAccount: "Wróć do konta",
    amountReadonlyHint: "Całkowite saldo konta — nieedytowalne",
    insufficientBalance: "Niewystarczające środki na realizację tego przelewu. Całkowity koszt przekracza dostępne saldo.",
    zeroBalance: "Saldo Twojego konta wynosi zero. Nie możesz dokonywać przelewów, dopóki nie będziesz mieć dostępnych środków.",
  },
};

/* -------------------- Country defs -------------------- */

type CountryDef = {
  code: string;
  flag: string;
  i18nName: Record<Lang, string>;
  currency: string;
  dial: string;
  accountLabel: Record<Lang, string>;
  accountPlaceholder: string;
  routingLabel: Record<Lang, string>;
  routingPlaceholder: string;
  rateFromGBP: number;
};

const C = (en: string, es: string, pt: string, fr: string, de: string, pl: string): Record<Lang, string> =>
  ({ en, es, pt, fr, de, pl });

const COUNTRIES: CountryDef[] = [
  { code: "PT", flag: "🇵🇹",
    i18nName: C("Portugal", "Portugal", "Portugal", "Portugal", "Portugal", "Portugalia"),
    currency: "EUR", dial: "+351",
    accountLabel: C("IBAN","IBAN","IBAN","IBAN","IBAN","IBAN"),
    accountPlaceholder: "PT50 0000 0000 0000 0000 0000 0",
    routingLabel: C("SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC"),
    routingPlaceholder: "BCOMPTPL", rateFromGBP: 1.17 },
  { code: "ES", flag: "🇪🇸",
    i18nName: C("Spain", "España", "Espanha", "Espagne", "Spanien", "Hiszpania"),
    currency: "EUR", dial: "+34",
    accountLabel: C("IBAN","IBAN","IBAN","IBAN","IBAN","IBAN"),
    accountPlaceholder: "ES91 2100 0418 4502 0005 1332",
    routingLabel: C("SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC"),
    routingPlaceholder: "CAIXESBBXXX", rateFromGBP: 1.17 },
  { code: "US", flag: "🇺🇸",
    i18nName: C("United States", "Estados Unidos", "Estados Unidos", "États-Unis", "USA", "Stany Zjednoczone"),
    currency: "USD", dial: "+1",
    accountLabel: C("Account number","Número de cuenta","Número da conta","Numéro de compte","Kontonummer","Numer konta"),
    accountPlaceholder: "0123456789",
    routingLabel: C("Routing (ABA)","Routing (ABA)","Routing (ABA)","Routing (ABA)","Routing (ABA)","Routing (ABA)"),
    routingPlaceholder: "026009593", rateFromGBP: 1.28 },
  { code: "BR", flag: "🇧🇷",
    i18nName: C("Brazil", "Brasil", "Brasil", "Brésil", "Brasilien", "Brazylia"),
    currency: "BRL", dial: "+55",
    accountLabel: C("Account number","Número de cuenta","Número da conta","Numéro de compte","Kontonummer","Numer konta"),
    accountPlaceholder: "0001 12345-6",
    routingLabel: C("SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC"),
    routingPlaceholder: "BCBRBRSP", rateFromGBP: 7.10 },
  { code: "PL", flag: "🇵🇱",
    i18nName: C("Poland", "Polonia", "Polônia", "Pologne", "Polen", "Polska"),
    currency: "PLN", dial: "+48",
    accountLabel: C("IBAN","IBAN","IBAN","IBAN","IBAN","IBAN"),
    accountPlaceholder: "PL61 1090 1014 0000 0712 1981 2874",
    routingLabel: C("SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC","SWIFT / BIC"),
    routingPlaceholder: "WBKPPLPP", rateFromGBP: 5.05 },
  { code: "PR", flag: "🇵🇷",
    i18nName: C("Puerto Rico", "Puerto Rico", "Porto Rico", "Porto Rico", "Puerto Rico", "Portoryko"),
    currency: "USD", dial: "+1",
    accountLabel: C("Account number","Número de cuenta","Número da conta","Numéro de compte","Kontonummer","Numer konta"),
    accountPlaceholder: "000123456789",
    routingLabel: C("Routing (ABA)","Routing (ABA)","Routing (ABA)","Routing (ABA)","Routing (ABA)","Routing (ABA)"),
    routingPlaceholder: "021502011", rateFromGBP: 1.28 },
  { code: "GB", flag: "🇬🇧",
    i18nName: C("United Kingdom", "Reino Unido", "Reino Unido", "Royaume-Uni", "Vereinigtes Königreich", "Wielka Brytania"),
    currency: "GBP", dial: "+44",
    accountLabel: C("Account number","Número de cuenta","Número da conta","Numéro de compte","Kontonummer","Numer konta"),
    accountPlaceholder: "12345678",
    routingLabel: C("Sort Code","Sort Code","Sort Code","Sort Code","Sort Code","Sort Code"),
    routingPlaceholder: "10-80-00", rateFromGBP: 1.0 },
];

type Step = "form" | "review" | "success";

const HMRC_COPY: Record<Lang, { title: string; subtitle: string; body: string; uploadLabel: string; uploadHint: string; selected: (n: string) => string; back: string; continueBtn: string; legal: string; processing: string; sla: string; warn: string }> = {
  en: {
    title: "HMRC clearance required",
    subtitle: "Outbound international transfer — regulatory compliance",
    body: "In accordance with the requirements of His Majesty's Revenue and Customs (HMRC) and the United Kingdom Anti-Money Laundering Regulations, every international transfer originating from a B Bank account must be accompanied by a formal tax clearance authorisation issued by the British tax authority. Please upload below the official HMRC document authorising this remittance. Your transfer will remain on hold until the document has been received and reviewed by our compliance desk.",
    uploadLabel: "HMRC authorisation document",
    uploadHint: "Accepted formats: PDF, JPG or PNG • Maximum 10 MB",
    selected: (n) => `Selected file: ${n}`,
    back: "← Back",
    continueBtn: "Submit document and finish transfer",
    legal: "By submitting this document, you declare under penalty of perjury that the authorisation is authentic and was issued by HMRC in your name.",
    processing: "Submitting…",
    sla: "Your document will be reviewed by the B Bank compliance desk within 72 hours. Once approved, the funds will be released and credited to the beneficiary.",
    warn: "If the document is found to be forged, altered or otherwise inauthentic, the full transfer amount will be permanently blocked and may be reported to the competent authorities.",
  },
  pt: {
    title: "Autorização do Fisco Britânico (HMRC) obrigatória",
    subtitle: "Transferência internacional de saída — conformidade regulatória",
    body: "Em conformidade com as exigências do His Majesty's Revenue and Customs (HMRC) e com as normas de Prevenção à Lavagem de Dinheiro do Reino Unido, toda transferência internacional originada de uma conta B Bank deve ser acompanhada de uma autorização formal de quitação fiscal emitida pela autoridade tributária britânica. Por favor, anexe abaixo o documento oficial do HMRC autorizando a presente remessa. Sua transferência permanecerá retida até que o documento seja recebido e analisado pela nossa mesa de conformidade.",
    uploadLabel: "Documento de autorização do HMRC",
    uploadHint: "Formatos aceitos: PDF, JPG ou PNG • Máximo 10 MB",
    selected: (n) => `Arquivo selecionado: ${n}`,
    back: "← Voltar",
    continueBtn: "Enviar documento e concluir transferência",
    legal: "Ao enviar este documento, você declara, sob as penas da lei, que a autorização é autêntica e foi emitida pelo HMRC em seu nome.",
    processing: "Enviando…",
    sla: "Seu documento será analisado pela mesa de conformidade do B Bank em até 72 horas. Após a aprovação, os fundos serão liberados e creditados ao beneficiário.",
    warn: "Caso o documento seja considerado falso, adulterado ou de qualquer forma inautêntico, o valor total da transferência será permanentemente bloqueado e poderá ser reportado às autoridades competentes.",
  },
  es: {
    title: "Autorización del Fisco Británico (HMRC) requerida",
    subtitle: "Transferencia internacional de salida — cumplimiento regulatorio",
    body: "De conformidad con los requisitos del His Majesty's Revenue and Customs (HMRC) y la normativa de Prevención del Blanqueo de Capitales del Reino Unido, toda transferencia internacional originada en una cuenta B Bank debe ir acompañada de una autorización formal de quita fiscal emitida por la autoridad tributaria británica. Por favor, adjunte a continuación el documento oficial del HMRC que autoriza esta remesa. Su transferencia permanecerá retenida hasta que el documento sea recibido y revisado por nuestra mesa de cumplimiento.",
    uploadLabel: "Documento de autorización del HMRC",
    uploadHint: "Formatos aceptados: PDF, JPG o PNG • Máximo 10 MB",
    selected: (n) => `Archivo seleccionado: ${n}`,
    back: "← Volver",
    continueBtn: "Enviar documento y finalizar transferencia",
    legal: "Al enviar este documento, declara bajo pena de perjurio que la autorización es auténtica y fue emitida por el HMRC a su nombre.",
    processing: "Enviando…",
    sla: "Su documento será analizado por la mesa de cumplimiento de B Bank en un plazo de 72 horas. Tras la aprobación, los fondos serán liberados y acreditados al beneficiario.",
    warn: "Si el documento resulta ser falso, alterado o de cualquier modo inauténtico, el importe total de la transferencia será bloqueado de forma permanente y podrá ser reportado a las autoridades competentes.",
  },
  fr: {
    title: "Autorisation du fisc britannique (HMRC) requise",
    subtitle: "Virement international sortant — conformité réglementaire",
    body: "Conformément aux exigences du His Majesty's Revenue and Customs (HMRC) et à la réglementation anti-blanchiment du Royaume-Uni, tout virement international émis depuis un compte B Bank doit être accompagné d'une autorisation formelle de quittance fiscale délivrée par l'administration fiscale britannique. Veuillez téléverser ci-dessous le document officiel du HMRC autorisant la présente remise. Votre virement restera suspendu jusqu'à la réception et l'examen du document par notre service de conformité.",
    uploadLabel: "Document d'autorisation du HMRC",
    uploadHint: "Formats acceptés : PDF, JPG ou PNG • 10 Mo max",
    selected: (n) => `Fichier sélectionné : ${n}`,
    back: "← Retour",
    continueBtn: "Envoyer le document et finaliser le virement",
    legal: "En soumettant ce document, vous déclarez sous peine de parjure que l'autorisation est authentique et a été émise par le HMRC en votre nom.",
    processing: "Envoi…",
    sla: "Votre document sera examiné par le service de conformité B Bank sous 72 heures. Après approbation, les fonds seront libérés et crédités au bénéficiaire.",
    warn: "Si le document s'avère falsifié, modifié ou inauthentique, le montant total du virement sera bloqué de manière permanente et pourra être signalé aux autorités compétentes.",
  },
  de: {
    title: "HMRC-Freigabe erforderlich",
    subtitle: "Ausgehende internationale Überweisung — regulatorische Compliance",
    body: "Gemäß den Anforderungen des His Majesty's Revenue and Customs (HMRC) und den britischen Geldwäschebekämpfungsvorschriften muss jeder internationalen Überweisung von einem B Bank-Konto eine formelle steuerliche Freigabebescheinigung der britischen Steuerbehörde beiliegen. Bitte laden Sie unten das offizielle HMRC-Dokument hoch, das diese Überweisung genehmigt. Ihre Überweisung bleibt zurückgehalten, bis das Dokument bei unserer Compliance-Abteilung eingegangen und geprüft wurde.",
    uploadLabel: "HMRC-Freigabedokument",
    uploadHint: "Akzeptierte Formate: PDF, JPG oder PNG • Max. 10 MB",
    selected: (n) => `Ausgewählte Datei: ${n}`,
    back: "← Zurück",
    continueBtn: "Dokument senden und Überweisung abschließen",
    legal: "Mit der Einreichung dieses Dokuments erklären Sie unter Strafe des Meineids, dass die Genehmigung echt ist und vom HMRC auf Ihren Namen ausgestellt wurde.",
    processing: "Wird gesendet…",
    sla: "Ihr Dokument wird innerhalb von 72 Stunden von der B Bank-Compliance-Abteilung geprüft. Nach Genehmigung werden die Mittel freigegeben und dem Empfänger gutgeschrieben.",
    warn: "Sollte das Dokument als gefälscht, verändert oder anderweitig nicht authentisch eingestuft werden, wird der gesamte Überweisungsbetrag dauerhaft gesperrt und kann den zuständigen Behörden gemeldet werden.",
  },
  pl: {
    title: "Wymagane zezwolenie HMRC",
    subtitle: "Wychodzący przelew międzynarodowy — zgodność regulacyjna",
    body: "Zgodnie z wymogami His Majesty's Revenue and Customs (HMRC) oraz brytyjskimi przepisami o przeciwdziałaniu praniu pieniędzy, każdy przelew międzynarodowy wychodzący z rachunku B Bank musi być opatrzony formalnym zezwoleniem podatkowym wydanym przez brytyjski organ podatkowy. Prosimy o załączenie poniżej oficjalnego dokumentu HMRC zezwalającego na niniejszy przelew. Państwa przelew pozostanie wstrzymany do czasu otrzymania i weryfikacji dokumentu przez nasz dział compliance.",
    uploadLabel: "Dokument autoryzacji HMRC",
    uploadHint: "Akceptowane formaty: PDF, JPG lub PNG • Maks. 10 MB",
    selected: (n) => `Wybrany plik: ${n}`,
    back: "← Wstecz",
    continueBtn: "Wyślij dokument i zakończ przelew",
    legal: "Przesyłając ten dokument, oświadczają Państwo pod rygorem odpowiedzialności karnej, że zezwolenie jest autentyczne i zostało wydane przez HMRC na Państwa nazwisko.",
    processing: "Wysyłanie…",
    sla: "Państwa dokument zostanie zweryfikowany przez dział compliance B Bank w ciągu 72 godzin. Po zatwierdzeniu środki zostaną zwolnione i przekazane odbiorcy.",
    warn: "Jeżeli dokument okaże się sfałszowany, zmieniony lub w inny sposób nieautentyczny, pełna kwota przelewu zostanie trwale zablokowana i może zostać zgłoszona właściwym organom.",
  },
};

function BalanceSync({ balance, setForm }: { balance: number | null; setForm: (updater: (s: any) => any) => void }) {
  useEffect(() => {
    if (balance != null && balance > 1) {
      setForm((s: any) => ({ ...s, amount: String(balance) }));
    }
  }, [balance, setForm]);
  return null;
}



function TransferenciaPage() {

  const navigate = useNavigate();
  const { lang } = useI18n();
  const L = LOCALES[lang] ?? LOCALES.en;
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [depositWarnOpen, setDepositWarnOpen] = useState(false);
  const { profile } = useProfile();
  const { balance: acctBalance, currency: acctCurrency } = useAccount();
  const transferLocked = profile?.transfer_locked === true;
  const depositRequired = Math.max(0, (acctBalance ?? 0) * 0.025);
  const ED = ERR_DICT[lang] ?? ERR_DICT.en;





  const [form, setForm] = useState({
    toCountry: "PT",
    beneficiaryName: "",
    beneficiaryDoc: "",
    beneficiaryEmail: "",
    bankName: "",
    accountNumber: "",
    swift: "",
    amount: "",
    purpose: "family",
    reference: "",
  });
  const set = <K extends keyof typeof form>(k: K) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  // Origin is fixed: B Bank GBP account
  const from = {
    flag: "🇬🇧",
    i18nName: C("B Bank (GBP)", "B Bank (GBP)", "B Bank (GBP)", "B Bank (GBP)", "B Bank (GBP)", "B Bank (GBP)"),
    currency: "GBP",
    rateFromGBP: 1,
  };
  const to = COUNTRIES.find((c) => c.code === form.toCountry)!;

  const rawAmount = Number(form.amount.replace(",", ".")) || 0;
  const amountNum = Math.round(rawAmount * 100) / 100;
  const fxRate = to.rateFromGBP / from.rateFromGBP;
  const iofPct = 0;
  const spreadPct = 0.012;
  const fixedFee = from.currency === to.currency ? 4.9 : 14.9;
  // The full amount is debited from the account; fees are deducted from it
  // and the beneficiary receives the net amount converted at the FX rate.
  const totalCost = amountNum;
  const netAmount = Math.max(0, amountNum - amountNum * (iofPct + spreadPct) - fixedFee);
  const converted = Math.round(netAmount * fxRate * 100) / 100;

  const [submittedTransferId, setSubmittedTransferId] = useState<string | null>(null);
  const [submittedProtocol, setSubmittedProtocol] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [transferIdempotencyKey, setTransferIdempotencyKey] = useState<string>(() => {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.beneficiaryEmail.trim());

  const submitFn = useServerFn(submitTransfer);
  const { user } = useAuth();
  const handleConfirm = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const res = await submitFn({ data: {
        beneficiary_name: form.beneficiaryName.trim(),
        beneficiary_doc: form.beneficiaryDoc.trim(),
        beneficiary_email: form.beneficiaryEmail.trim(),
        bank_name: form.bankName.trim(),
        swift: form.swift.trim(),
        account_number: form.accountNumber.trim(),
        to_country: form.toCountry,
        currency_from: from.currency,
        currency_to: to.currency,
        amount: amountNum,
        fx_rate: fxRate,
        converted_amount: converted,
        purpose: form.purpose,
        reference: form.reference.trim(),
        idempotency_key: transferIdempotencyKey,
      }});
      setSubmittedTransferId(res.id);
      setSubmittedProtocol(res.protocol ?? null);
      setStep("success");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      console.error("submit transfer", e);
      setErrorMsg(friendlyTransferError(e, lang));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <AccountShell>
      {({ balance, currency: accountCurrency }) => {
        const safeBalance = balance ?? 0;
        const isBalanceAvailable = balance !== null;
        const canContinue =
          isBalanceAvailable &&
          form.beneficiaryName.trim().length > 2 &&
          form.beneficiaryDoc.trim().length > 2 &&
          emailOk &&
          form.bankName.trim().length > 1 &&
          form.accountNumber.trim().length > 4 &&
          form.swift.trim().length > 4 &&
          form.reference.trim().length > 0 &&
          amountNum > 1 &&
          safeBalance > 1 &&
          safeBalance >= totalCost &&
          netAmount > 0 &&
          converted > 0;

        const balanceError = !isBalanceAvailable ? "unavailable" : safeBalance <= 1 ? "zero" : safeBalance < totalCost ? "insufficient" : null;

        // Auto-fill amount with full account balance (hook-safe via child component below)


        return (
        <div className="mx-auto max-w-5xl px-6 py-8">
          <BalanceSync balance={balance} setForm={setForm} />

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-2">
                <Globe2 className="w-4 h-4" /> {L.eyebrow}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{L.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{L.subtitle}</p>
            </div>
            <Stepper step={step} labels={[L.step1, L.step2, L.step3]} />
          </div>

          {step === "form" && (
            <div className="grid lg:grid-cols-[1fr_360px] gap-6">
              <section className="bg-background rounded-2xl border border-border/60 shadow-sm p-7 space-y-7">
                {/* Destination only — origin is fixed at B Bank GBP */}
                <div>
                  <p className="text-sm font-semibold mb-3">{L.routeTitle}</p>
                  <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                    <div>
                      <label className="text-xs text-muted-foreground">{L.from}</label>
                      <div className="mt-1 relative px-3 py-3 pr-10 rounded-xl border border-border bg-secondary/60 font-medium">
                        B Bank — GBP
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">GBP</span>
                      </div>
                    </div>
                    <div className="hidden sm:flex w-10 h-[46px] mb-0 rounded-full bg-primary/10 text-primary items-center justify-center self-end">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <CountrySelect label={L.to} value={form.toCountry} onChange={set("toCountry")} lang={lang} />
                  </div>
                </div>

                {/* Beneficiário */}
                <div>
                  <p className="text-sm font-semibold mb-3">{L.beneficiary}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label={L.fullName} value={form.beneficiaryName} onChange={set("beneficiaryName")} placeholder={L.fullNamePh} />
                    <Field label={L.document} value={form.beneficiaryDoc} onChange={set("beneficiaryDoc")} placeholder={L.documentPh} />
                    <Field className="sm:col-span-2" label={L.emailBen} value={form.beneficiaryEmail} onChange={set("beneficiaryEmail")} placeholder={L.emailBenPh} type="email" />
                  </div>
                </div>

                {/* Banco */}
                <div>
                  <p className="text-sm font-semibold mb-3">{L.bankTitle} — {to.flag} {to.i18nName[lang]}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label={L.bankName} value={form.bankName} onChange={set("bankName")} placeholder={L.bankNamePh} />
                    <Field label={to.routingLabel[lang]} value={form.swift} onChange={set("swift")} placeholder={to.routingPlaceholder} />
                    <Field className="sm:col-span-2" label={to.accountLabel[lang]} value={form.accountNumber} onChange={set("accountNumber")} placeholder={to.accountPlaceholder} />
                  </div>
                </div>

                {/* Valor — preenchido automaticamente com saldo total */}
                <div>
                  <p className="text-sm font-semibold mb-3">{L.amountTitle}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">{L.amountLabel(from.currency)}</label>
                      <div className="mt-1 flex items-stretch rounded-xl border border-border bg-secondary/60 overflow-hidden">
                        <span className="px-3 flex items-center bg-secondary text-sm font-semibold">{from.currency}</span>
                        <input
                          readOnly
                          value={form.amount ? Number(form.amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                          className="flex-1 px-3 py-3 outline-none bg-transparent text-foreground font-medium cursor-default"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{L.amountReadonlyHint}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{L.purpose}</label>
                      <select
                        value={form.purpose}
                        onChange={(e) => set("purpose")(e.target.value)}
                        className="mt-1 w-full px-3 py-3 rounded-xl border border-border bg-background outline-none focus:border-primary"
                      >
                        {Object.entries(L.purposes).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <Field className="sm:col-span-2" label={L.reference} value={form.reference} onChange={set("reference")} placeholder={L.referencePh} />
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2 border-t border-border/60">
                  {balanceError && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                      <span className="shrink-1">
                        {balanceError === "unavailable"
                          ? (lang === "pt" ? "Saldo indisponível no momento. Tente novamente mais tarde." : "Balance temporarily unavailable. Please try again later.")
                          : balanceError === "zero"
                          ? L.zeroBalance
                          : L.insufficientBalance}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <button onClick={() => navigate({ to: "/conta" })} className="text-sm text-muted-foreground hover:text-foreground transition">
                      {L.cancel}
                    </button>
                    <button
                      disabled={!canContinue}
                      onClick={() => { if (transferLocked) { setDepositWarnOpen(true); } else { setStep("review"); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); } }}
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
                    >
                      {L.reviewBtn} <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-2xl p-6 text-white shadow-xl"
                  style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #16213e 100%)" }}>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-semibold">{L.simTitle}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <Row dark k={L.send} v={amountNum > 0 ? formatMoney(amountNum, from.currency) : "—"} />
                    <Row dark k={L.fxRate} v={`1 ${from.currency} = ${fxRate.toFixed(4)} ${to.currency}`} />
                    <Row dark k={L.iof((iofPct * 100).toFixed(2))} v={amountNum > 0 ? formatMoney(amountNum * iofPct, from.currency) : "—"} />
                    <Row dark k={L.spread((spreadPct * 100).toFixed(1))} v={amountNum > 0 ? formatMoney(amountNum * spreadPct, from.currency) : "—"} />
                    <Row dark k={L.swiftFee} v={formatMoney(fixedFee, from.currency)} />
                    <div className="h-px bg-white/15 my-2" />
                    <Row dark strong k={L.totalDebit} v={amountNum > 0 ? formatMoney(totalCost, from.currency) : "—"} />
                    <Row dark strong gold k={L.benReceives} v={amountNum > 0 ? formatMoney(converted, to.currency) : "—"} />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background p-5 text-sm">
                  <div className="flex items-center gap-2 mb-2 text-primary font-semibold">
                    <Shield className="w-4 h-4" /> {L.protectionTitle}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{L.protectionDesc}</p>
                </div>
              </aside>
            </div>
          )}

          {step === "review" && (
            <section className="bg-background rounded-2xl border border-border/60 shadow-sm p-8 max-w-3xl mx-auto">
              <h2 className="text-xl font-bold">{L.reviewTitle}</h2>
              <p className="text-sm text-muted-foreground mt-1">{L.reviewSubtitle}</p>

              <div className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <ReviewItem k={L.routeK} v={`${from.flag} ${from.i18nName[lang]} → ${to.flag} ${to.i18nName[lang]}`} />
                <ReviewItem k={L.purposeK} v={L.purposes[form.purpose] ?? form.purpose} />
                <ReviewItem k={L.beneficiaryK} v={form.beneficiaryName} />
                <ReviewItem k={L.documentK} v={form.beneficiaryDoc || "—"} />
                <ReviewItem k={L.bankK} v={form.bankName} />
                <ReviewItem k={to.routingLabel[lang]} v={form.swift} />
                <ReviewItem k={to.accountLabel[lang]} v={form.accountNumber} className="sm:col-span-2" />
                <ReviewItem k={L.refK} v={form.reference || "—"} className="sm:col-span-2" />
              </div>

              <div className="mt-6 rounded-xl bg-secondary/60 border border-border/60 p-5 space-y-2 text-sm">
                <Row k={L.valueSent} v={formatMoney(amountNum, from.currency)} />
                <Row k={L.fxApplied} v={`1 ${from.currency} = ${fxRate.toFixed(4)} ${to.currency}`} />
                <Row k={L.feesTaxes} v={formatMoney(amountNum * (iofPct + spreadPct) + fixedFee, from.currency)} />
                <div className="h-px bg-border my-2" />
                <Row strong k={L.totalDebited} v={formatMoney(totalCost, from.currency)} />
                <Row strong k={L.benWillReceive} v={formatMoney(converted, to.currency)} />
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep("form")} className="text-sm text-muted-foreground hover:text-foreground transition">
                  {L.back}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {L.processing}</>
                  ) : (
                    <><Send className="w-4 h-4" /> {L.confirm}</>
                  )}
                </button>
              </div>
            </section>
          )}






          {step === "success" && (
            <section className="bg-background rounded-2xl border border-border/60 shadow-sm p-10 max-w-2xl mx-auto text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-bold mt-5">{L.successTitle}</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                {L.successDesc(formatMoney(amountNum, from.currency), form.beneficiaryName, to.flag, to.i18nName[lang])}
              </p>

              <div className="mt-6 inline-flex flex-col items-center bg-secondary/60 border border-border/60 rounded-xl px-6 py-4">
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{L.protocol}</span>
                <span className="font-mono text-lg font-semibold mt-1">
                  {submittedProtocol || "Not available"}
                </span>
              </div>

              <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
                {submittedTransferId && (
                  <button
                    type="button"
                    onClick={() => setReceiptOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-sm font-semibold transition border border-border"
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    <span>{lang === "pt" ? "Ver comprovante" : lang === "es" ? "Ver comprobante" : "View receipt"}</span>
                  </button>
                )}
                <button onClick={() => {
                  setStep("form");
                  setForm((s) => ({ ...s, amount: "", reference: "" }));
                  setSubmittedTransferId(null);
                  setSubmittedProtocol(null);
                  setTransferIdempotencyKey(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
                }}
                  className="px-5 py-2.5 rounded-full border border-border text-sm font-semibold hover:bg-secondary transition">
                  {L.newTransfer}
                </button>
                <button onClick={() => navigate({ to: "/conta" })}
                  className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition">
                  {L.backToAccount}
                </button>
              </div>
            </section>
          )}
         </div>
      );
    }}
    </AccountShell>
    <Dialog open={!!errorMsg} onOpenChange={(o) => !o && setErrorMsg(null)}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{ED.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-center text-sm text-muted-foreground">
            {errorMsg}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2 flex-wrap">
          {errorMsg && (errorMsg.includes("extrato") || errorMsg.includes("statement")) && (
            <Link
              to="/extrato"
              onClick={() => setErrorMsg(null)}
              className="px-5 py-2 rounded-full border border-border bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition"
            >
              Consultar extrato
            </Link>
          )}
          <button
            onClick={() => setErrorMsg(null)}
            className="px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
          >
            {ED.close}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={depositWarnOpen} onOpenChange={setDepositWarnOpen}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
            <Shield className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">
            {lang === "pt" ? "Depósito de segurança necessário"
              : lang === "es" ? "Depósito de seguridad requerido"
              : lang === "fr" ? "Dépôt de sécurité requis"
              : lang === "de" ? "Sicherheitseinzahlung erforderlich"
              : lang === "pl" ? "Wymagana wpłata zabezpieczająca"
              : "Security deposit required"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {lang === "pt"
              ? `Para liberar esta transferência, é necessário realizar um depósito de 2,5% do saldo da sua conta (${formatMoney(depositRequired, acctCurrency)}). Entre em contacto com o suporte para concluir.`
              : lang === "es"
              ? `Para liberar esta transferencia, debe realizar un depósito del 2,5% del saldo de su cuenta (${formatMoney(depositRequired, acctCurrency)}). Contacte con soporte para completarlo.`
              : lang === "fr"
              ? `Pour débloquer ce virement, vous devez effectuer un dépôt de 2,5% du solde de votre compte (${formatMoney(depositRequired, acctCurrency)}). Contactez le support pour finaliser.`
              : lang === "de"
              ? `Um diese Überweisung freizugeben, ist eine Einzahlung in Höhe von 2,5% Ihres Kontostands erforderlich (${formatMoney(depositRequired, acctCurrency)}). Bitte kontaktieren Sie den Support.`
              : lang === "pl"
              ? `Aby zwolnić ten przelew, należy wpłacić 2,5% salda Twojego konta (${formatMoney(depositRequired, acctCurrency)}). Skontaktuj się z obsługą.`
              : `To release this transfer, you must deposit 2.5% of your account balance (${formatMoney(depositRequired, acctCurrency)}). Please contact support to complete it.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <button
            onClick={() => setDepositWarnOpen(false)}
            className="px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
          >
            OK
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <TransferReceiptModal
      open={receiptOpen}
      onClose={() => setReceiptOpen(false)}
      transferId={submittedTransferId}
    />
    </>
  );
}

/* -------------------- Subcomponents -------------------- */

function CountrySelect({ label, value, onChange, lang }: { label: string; value: string; onChange: (v: string) => void; lang: Lang }) {
  const c = COUNTRIES.find((x) => x.code === value)!;
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none px-3 py-3 pr-10 rounded-xl border border-border bg-background outline-none focus:border-primary font-medium"
        >
          {COUNTRIES.map((opt) => (
            <option key={opt.code} value={opt.code}>{opt.flag} {opt.i18nName[lang]} — {opt.currency}</option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{c.currency}</span>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", className = "",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-3 rounded-xl border border-border bg-background outline-none focus:border-primary"
      />
    </div>
  );
}

function Row({ k, v, strong, gold, dark }: { k: string; v: string; strong?: boolean; gold?: boolean; dark?: boolean }) {
  const kCls = dark ? (strong ? "text-white/80" : "text-white/60") : "text-muted-foreground";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={kCls}>{k}</span>
      <span className={`font-semibold ${gold ? "text-amber-400" : ""} ${strong ? "text-base" : ""}`}>{v}</span>
    </div>
  );
}

function ReviewItem({ k, v, className = "" }: { k: string; v: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className="font-medium mt-0.5 break-words">{v}</p>
    </div>
  );
}

function Stepper({ step, labels }: { step: Step; labels: [string, string, string] }) {
  const steps: { key: Step; label: string }[] = [
    { key: "form", label: labels[0] },
    { key: "review", label: labels[1] },
    { key: "success", label: labels[2] },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="hidden sm:flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 ${
            i <= idx ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
          }`}>{i + 1}</div>
          <span className={`text-xs font-medium ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
          {i < steps.length - 1 && <span className="w-6 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}
