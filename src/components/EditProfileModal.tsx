import { useState, useEffect } from "react";
import { User, Phone, MapPin, Calendar, IdCard, Mail, Lock, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { type Profile } from "@/lib/account";
import { updateMyProfile } from "@/lib/account.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type EditProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
  email?: string | null;
  onSuccess?: () => void;
};

const TEXTS: Record<Lang, {
  title: string;
  desc: string;
  fullName: string;
  fullNamePh: string;
  email: string;
  emailNote: string;
  phone: string;
  phonePh: string;
  country: string;
  dob: string;
  dobLocked: string;
  docType: string;
  docNumber: string;
  docLocked: string;
  save: string;
  saving: string;
  cancel: string;
  success: string;
  errGeneric: string;
  errNameRequired: string;
}> = {
  en: {
    title: "Edit Personal Details",
    desc: "Update your personal and contact information. Verified documents and access email are protected by security policy.",
    fullName: "Full legal name",
    fullNamePh: "Enter your full name",
    email: "Access email",
    emailNote: "Access email is tied to authentication and cannot be edited directly here.",
    phone: "Mobile phone number",
    phonePh: "+44 7123 456789",
    country: "Country of residence",
    dob: "Date of birth",
    dobLocked: "Verified by Identity Check (read-only)",
    docType: "Document type",
    docNumber: "Document number",
    docLocked: "Verified by KYC (read-only)",
    save: "Save changes",
    saving: "Saving...",
    cancel: "Cancel",
    success: "Your personal details have been updated successfully.",
    errGeneric: "Unable to save your details. Please check the form and try again.",
    errNameRequired: "Full legal name is required (min 2 characters).",
  },
  pt: {
    title: "Editar Dados Pessoais",
    desc: "Atualize os seus dados de contacto e residência. Documentos já verificados e o e-mail de acesso são protegidos por segurança.",
    fullName: "Nome completo",
    fullNamePh: "Digite o seu nome completo",
    email: "E-mail de acesso",
    emailNote: "O e-mail de acesso é a chave de autenticação e não pode ser alterado por este formulário.",
    phone: "Telefone de contacto",
    phonePh: "+44 7123 456789 ou +55 11 99999-9999",
    country: "País de residência",
    dob: "Data de nascimento",
    dobLocked: "Verificado pela Verificação de Identidade (somente leitura)",
    docType: "Tipo de documento",
    docNumber: "Número do documento",
    docLocked: "Verificado pelo KYC (somente leitura)",
    save: "Salvar alterações",
    saving: "A guardar...",
    cancel: "Cancelar",
    success: "Os seus dados pessoais foram atualizados com sucesso.",
    errGeneric: "Não foi possível guardar as alterações. Reveja os campos e tente novamente.",
    errNameRequired: "O nome completo é obrigatório (mínimo de 2 caracteres).",
  },
  es: {
    title: "Editar Datos Personales",
    desc: "Actualice su información de contacto. Documentos verificados y correo de acceso están protegidos por seguridad.",
    fullName: "Nombre completo",
    fullNamePh: "Ingrese su nombre completo",
    email: "Correo de acceso",
    emailNote: "El correo de acceso no se puede modificar directamente en este formulario.",
    phone: "Teléfono de contacto",
    phonePh: "+44 7123 456789",
    country: "País de residencia",
    dob: "Fecha de nacimiento",
    dobLocked: "Verificado por KYC (solo lectura)",
    docType: "Tipo de documento",
    docNumber: "Número de documento",
    docLocked: "Verificado por KYC (solo lectura)",
    save: "Guardar cambios",
    saving: "Guardando...",
    cancel: "Cancelar",
    success: "Sus datos personales han sido actualizados con éxito.",
    errGeneric: "No se pudieron guardar los cambios. Intente nuevamente.",
    errNameRequired: "El nombre completo es obligatorio.",
  },
  fr: {
    title: "Modifier les Coordonnées",
    desc: "Mettez à jour vos coordonnées personnelles. Les documents vérifiés et l'e-mail d'accès sont protégés.",
    fullName: "Nom complet",
    fullNamePh: "Entrez votre nom complet",
    email: "E-mail de connexion",
    emailNote: "L'e-mail de connexion ne peut pas être modifié ici pour des raisons de sécurité.",
    phone: "Numéro de téléphone",
    phonePh: "+44 7123 456789",
    country: "Pays de résidence",
    dob: "Date de naissance",
    dobLocked: "Vérifié par KYC (lecture seule)",
    docType: "Type de document",
    docNumber: "Numéro de document",
    docLocked: "Vérifié par KYC (lecture seule)",
    save: "Enregistrer",
    saving: "Enregistrement...",
    cancel: "Annuler",
    success: "Vos informations ont été mises à jour avec succès.",
    errGeneric: "Impossible d'enregistrer vos informations. Veuillez réessayer.",
    errNameRequired: "Le nom complet est obligatoire.",
  },
  de: {
    title: "Persönliche Daten bearbeiten",
    desc: "Aktualisieren Sie Ihre Kontaktdaten. Verifizierte Dokumente und die E-Mail-Adresse sind geschützt.",
    fullName: "Vollständiger Name",
    fullNamePh: "Geben Sie Ihren Namen ein",
    email: "Login-E-Mail",
    emailNote: "Die Login-E-Mail kann hier aus Sicherheitsgründen nicht geändert werden.",
    phone: "Telefonnummer",
    phonePh: "+44 7123 456789",
    country: "Wohnsitzland",
    dob: "Geburtsdatum",
    dobLocked: "Durch KYC verifiziert (schreibgeschützt)",
    docType: "Dokumenttyp",
    docNumber: "Dokumentnummer",
    docLocked: "Durch KYC verifiziert (schreibgeschützt)",
    save: "Änderungen speichern",
    saving: "Speichern...",
    cancel: "Abbrechen",
    success: "Ihre persönlichen Daten wurden erfolgreich aktualisiert.",
    errGeneric: "Fehler beim Speichern der Daten. Bitte prüfen Sie Ihre Eingaben.",
    errNameRequired: "Der vollständige Name ist erforderlich.",
  },
  pl: {
    title: "Edytuj Dane Osobowe",
    desc: "Zaktualizuj swoje dane kontaktowe. Zweryfikowane dokumenty i adres e-mail są chronione.",
    fullName: "Imię i nazwisko",
    fullNamePh: "Wprowadź imię i nazwisko",
    email: "Adres e-mail",
    emailNote: "Adres e-mail jest chroniony i nie może być zmieniony w tym formularzu.",
    phone: "Numer telefonu",
    phonePh: "+44 7123 456789",
    country: "Kraj zamieszkania",
    dob: "Data urodzenia",
    dobLocked: "Zweryfikowano przez KYC (tylko do odczytu)",
    docType: "Typ dokumentu",
    docNumber: "Numer dokumentu",
    docLocked: "Zweryfikowano przez KYC (tylko do odczytu)",
    save: "Zapisz zmiany",
    saving: "Zapisywanie...",
    cancel: "Anuluj",
    success: "Twoje dane zostały pomyślnie zaktualizowane.",
    errGeneric: "Nie udało się zapisać zmian. Spróbuj ponownie.",
    errNameRequired: "Imię i nazwisko jest wymagane.",
  },
};

export function EditProfileModal({
  open,
  onOpenChange,
  profile,
  email,
  onSuccess,
}: EditProfileModalProps) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateProfileFn = useServerFn(updateMyProfile);

  const T = TEXTS[lang] ?? TEXTS.en;
  const isVerified = profile?.kyc_status === "approved";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("GB");
  const [birthDate, setBirthDate] = useState("");
  const [documentType, setDocumentType] = useState("passport");
  const [documentNumber, setDocumentNumber] = useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync form state when modal opens or profile changes
  useEffect(() => {
    if (open) {
      setFullName(profile?.full_name || "");
      setPhone(profile?.phone || "");
      setCountry(profile?.country || "GB");
      setBirthDate(profile?.birth_date ? profile.birth_date.slice(0, 10) : "");
      setDocumentType(profile?.document_type || "passport");
      setDocumentNumber(profile?.document_number || "");
      setErrorMsg(null);
      setSuccess(false);
    }
  }, [open, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setErrorMsg(T.errNameRequired);
      return;
    }

    setSaving(true);
    try {
      await updateProfileFn({
        data: {
          full_name: trimmedName,
          phone: phone.trim() || null,
          country: country.trim() || "GB",
          birth_date: !isVerified && birthDate ? birthDate : undefined,
          document_type: !isVerified && documentNumber.trim() ? documentType : undefined,
          document_number: !isVerified && documentNumber.trim() ? documentNumber.trim() : undefined,
        },
      });

      // Invalidate queries so that AccountShell, conta.tsx, etc. update immediately
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: ["account-dashboard", user.id] });
      }

      setSuccess(true);
      if (onSuccess) onSuccess();

      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      setErrorMsg(err?.message && err.message.length < 120 ? err.message : T.errGeneric);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl bg-background border border-border/60 shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {T.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {T.desc}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{T.success}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>{T.fullName}</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={T.fullNamePh}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              required
              disabled={saving}
            />
          </div>

          {/* Access Email (Read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{T.email}</span>
              <Lock className="w-3 h-3 text-muted-foreground ml-auto" />
            </label>
            <input
              type="email"
              value={email || ""}
              disabled
              className="w-full h-11 px-3.5 rounded-xl border border-border/60 bg-secondary/40 text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="text-[11px] text-muted-foreground italic">
              {T.emailNote}
            </p>
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-primary" />
              <span>{T.phone}</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={T.phonePh}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              disabled={saving}
            />
          </div>

          {/* Country of Residence */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>{T.country}</span>
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              disabled={saving}
            >
              <option value="GB">United Kingdom (GB)</option>
              <option value="PT">Portugal (PT)</option>
              <option value="BR">Brasil (BR)</option>
              <option value="US">United States (US)</option>
              <option value="ES">España (ES)</option>
              <option value="FR">France (FR)</option>
              <option value="DE">Deutschland (DE)</option>
              <option value="PL">Polska (PL)</option>
              <option value="IE">Ireland (IE)</option>
              <option value="IT">Italia (IT)</option>
              <option value="CH">Switzerland (CH)</option>
            </select>
          </div>

          {/* Date of Birth */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>{T.dob}</span>
              </label>
              {isVerified && (
                <span className="text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {T.dobLocked}
                </span>
              )}
            </div>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              disabled={isVerified || saving}
              className={`w-full h-11 px-3.5 rounded-xl border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition ${
                isVerified ? "bg-secondary/40 text-muted-foreground cursor-not-allowed" : "bg-background"
              }`}
            />
          </div>

          {/* Document Type & Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <IdCard className="w-3.5 h-3.5 text-primary" />
                <span>{T.docNumber}</span>
              </label>
              {isVerified && (
                <span className="text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {T.docLocked}
                </span>
              )}
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-2">
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={isVerified || saving}
                className={`h-11 px-2.5 rounded-xl border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition uppercase ${
                  isVerified ? "bg-secondary/40 text-muted-foreground cursor-not-allowed" : "bg-background"
                }`}
              >
                <option value="passport">Passport</option>
                <option value="nif">NIF / NI</option>
                <option value="cpf">CPF</option>
                <option value="dni">DNI / ID</option>
                <option value="ssn">SSN</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="12345678"
                disabled={isVerified || saving}
                className={`h-11 px-3.5 rounded-xl border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition ${
                  isVerified ? "bg-secondary/40 text-muted-foreground cursor-not-allowed" : "bg-background"
                }`}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition"
            >
              {T.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shadow-sm flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{saving ? T.saving : T.save}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
