import { useState } from "react";
import { Key, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ShieldAlert, Check, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { updateMasterSelfPassword, changeSelfPassword } from "@/lib/admin.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type ChangePasswordModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forced?: boolean;
  isMasterOnly?: boolean;
  onSuccess?: () => void;
};

const TEXTS: Record<Lang, {
  title: string;
  desc: string;
  forcedTitle: string;
  forcedDesc: string;
  currentPass: string;
  currentPassPh: string;
  newPass: string;
  newPassPh: string;
  confirmPass: string;
  confirmPassPh: string;
  submit: string;
  saving: string;
  success: string;
  cancel: string;
  close: string;
  signOutOthers: string;
  ruleMinLength: string;
  ruleUpperLower: string;
  ruleNumberSymbol: string;
  errEmptyCurrent: string;
  errEmptyNew: string;
  errWeakPassword: string;
  errMismatch: string;
  errSameAsCurrent: string;
  errInvalidCurrent: string;
  ariaShow: string;
  ariaHide: string;
}> = {
  en: {
    title: "Change Password",
    desc: "Enter your current password and choose a new secure password for your B Bank account.",
    forcedTitle: "Initial Security Setup Required",
    forcedDesc: "You are logging in with a temporary password. You must set a new secure password before proceeding.",
    currentPass: "Current password",
    currentPassPh: "Enter your current password",
    newPass: "New password",
    newPassPh: "At least 8 characters",
    confirmPass: "Confirm new password",
    confirmPassPh: "Repeat your new password",
    submit: "Update password",
    saving: "Updating password...",
    success: "Your password has been changed successfully.",
    cancel: "Cancel",
    close: "Continue",
    signOutOthers: "Sign out of all other active sessions and devices",
    ruleMinLength: "At least 8 characters",
    ruleUpperLower: "Upper and lower case letters",
    ruleNumberSymbol: "Numbers and symbols",
    errEmptyCurrent: "Please enter your current password.",
    errEmptyNew: "Please enter a new password.",
    errWeakPassword: "Password must meet all complexity requirements.",
    errMismatch: "The new passwords do not match.",
    errSameAsCurrent: "The new password must be different from your current password.",
    errInvalidCurrent: "Current password is incorrect.",
    ariaShow: "Show password",
    ariaHide: "Hide password",
  },
  pt: {
    title: "Alterar Senha",
    desc: "Digite sua senha atual e escolha uma nova senha segura para a sua conta B Bank.",
    forcedTitle: "Alteração Obrigatória de Primeiro Acesso",
    forcedDesc: "Você está usando uma senha temporária. Defina uma nova senha segura para continuar.",
    currentPass: "Senha atual",
    currentPassPh: "Digite a sua senha atual",
    newPass: "Nova senha",
    newPassPh: "Mínimo de 8 caracteres",
    confirmPass: "Confirmar nova senha",
    confirmPassPh: "Repita a nova senha",
    submit: "Atualizar senha",
    saving: "Atualizando...",
    success: "Sua senha foi alterada com sucesso.",
    cancel: "Cancelar",
    close: "Continuar",
    signOutOthers: "Encerrar todas as outras sessões ativas",
    ruleMinLength: "Mínimo de 8 caracteres",
    ruleUpperLower: "Letras maiúsculas e minúsculas",
    ruleNumberSymbol: "Números e caracteres especiais",
    errEmptyCurrent: "Por favor, digite sua senha atual.",
    errEmptyNew: "Por favor, digite uma nova senha.",
    errWeakPassword: "A senha deve atender a todos os requisitos de segurança.",
    errMismatch: "As senhas não coincidem.",
    errSameAsCurrent: "A nova senha deve ser diferente da senha atual.",
    errInvalidCurrent: "A senha atual está incorreta.",
    ariaShow: "Mostrar senha",
    ariaHide: "Ocultar senha",
  },
  es: {
    title: "Cambiar Contraseña",
    desc: "Introduce tu contraseña actual y elige una nueva contraseña segura para tu cuenta B Bank.",
    forcedTitle: "Cambio Obligatorio de Contraseña",
    forcedDesc: "Estás usando una contraseña temporal. Debes definir una nueva contraseña para continuar.",
    currentPass: "Contraseña actual",
    currentPassPh: "Introduce tu contraseña actual",
    newPass: "Nueva contraseña",
    newPassPh: "Mínimo 8 caracteres",
    confirmPass: "Confirmar nueva contraseña",
    confirmPassPh: "Repite la nueva contraseña",
    submit: "Actualizar contraseña",
    saving: "Actualizando...",
    success: "Tu contraseña ha sido cambiada con éxito.",
    cancel: "Cancelar",
    close: "Continuar",
    signOutOthers: "Cerrar todas las demás sesiones activas",
    ruleMinLength: "Mínimo de 8 caracteres",
    ruleUpperLower: "Mayúsculas y minúsculas",
    ruleNumberSymbol: "Números y símbolos",
    errEmptyCurrent: "Por favor, introduce tu contraseña actual.",
    errEmptyNew: "Por favor, introduce una nueva contraseña.",
    errWeakPassword: "La contraseña no cumple con los requisitos de seguridad.",
    errMismatch: "Las contraseñas no coinciden.",
    errSameAsCurrent: "La nueva contraseña debe ser diferente a la actual.",
    errInvalidCurrent: "La contraseña actual es incorrecta.",
    ariaShow: "Mostrar contraseña",
    ariaHide: "Ocultar contraseña",
  },
  fr: {
    title: "Changer le mot de passe",
    desc: "Saisissez votre mot de passe actuel et choisissez un nouveau mot de passe sécurisé.",
    forcedTitle: "Changement de mot de passe obligatoire",
    forcedDesc: "Vous utilisez un mot de passe temporaire. Vous devez le changer avant de continuer.",
    currentPass: "Mot de passe actuel",
    currentPassPh: "Saisissez votre mot de passe actuel",
    newPass: "Nouveau mot de passe",
    newPassPh: "Au moins 8 caractères",
    confirmPass: "Confirmer le mot de passe",
    confirmPassPh: "Répétez le nouveau mot de passe",
    submit: "Mettre à jour",
    saving: "Mise à jour...",
    success: "Votre mot de passe a été modifié avec succès.",
    cancel: "Annuler",
    close: "Continuer",
    signOutOthers: "Déconnecter toutes les autres sessions",
    ruleMinLength: "Au moins 8 caractères",
    ruleUpperLower: "Majuscules et minuscules",
    ruleNumberSymbol: "Chiffres et symboles",
    errEmptyCurrent: "Veuillez saisir votre mot de passe actuel.",
    errEmptyNew: "Veuillez saisir un nouveau mot de passe.",
    errWeakPassword: "Le mot de passe ne respecte pas les critères requis.",
    errMismatch: "Les mots de passe ne correspondent pas.",
    errSameAsCurrent: "Le nouveau mot de passe doit être différent de l'actuel.",
    errInvalidCurrent: "Le mot de passe actuel est incorrect.",
    ariaShow: "Afficher le mot de passe",
    ariaHide: "Masquer le mot de passe",
  },
  de: {
    title: "Passwort ändern",
    desc: "Geben Sie Ihr aktuelles Passwort ein und wählen Sie ein neues sicheres Passwort.",
    forcedTitle: "Passwortänderung erforderlich",
    forcedDesc: "Sie verwenden ein temporäres Passwort. Bitte ändern Sie es, um fortzufahren.",
    currentPass: "Aktuelles Passwort",
    currentPassPh: "Geben Sie Ihr aktuelles Passwort ein",
    newPass: "Neues Passwort",
    newPassPh: "Mindestens 8 Zeichen",
    confirmPass: "Neues Passwort bestätigen",
    confirmPassPh: "Neues Passwort wiederholen",
    submit: "Passwort aktualisieren",
    saving: "Wird aktualisiert...",
    success: "Ihr Passwort wurde erfolgreich geändert.",
    cancel: "Abbrechen",
    close: "Weiter",
    signOutOthers: "Alle anderen aktiven Sitzungen beenden",
    ruleMinLength: "Mindestens 8 Zeichen",
    ruleUpperLower: "Groß- und Kleinbuchstaben",
    ruleNumberSymbol: "Zahlen und Sonderzeichen",
    errEmptyCurrent: "Bitte geben Sie Ihr aktuelles Passwort ein.",
    errEmptyNew: "Bitte geben Sie ein neues Passwort ein.",
    errWeakPassword: "Das Passwort erfüllt nicht alle Sicherheitsanforderungen.",
    errMismatch: "Die Passwörter stimmen nicht überein.",
    errSameAsCurrent: "Das neue Passwort muss sich vom aktuellen unterscheiden.",
    errInvalidCurrent: "Das aktuelle Passwort ist falsch.",
    ariaShow: "Passwort anzeigen",
    ariaHide: "Passwort verbergen",
  },
  pl: {
    title: "Zmień hasło",
    desc: "Wpisz dotychczasowe hasło i ustaw nowe bezpieczne hasło do swojego konta B Bank.",
    forcedTitle: "Wymagana zmiana hasła",
    forcedDesc: "Używasz hasła tymczasowego. Musisz je zmienić przed kontynuowaniem.",
    currentPass: "Dotychczasowe hasło",
    currentPassPh: "Wpisz dotychczasowe hasło",
    newPass: "Nowe hasło",
    newPassPh: "Minimum 8 znaków",
    confirmPass: "Potwierdź nowe hasło",
    confirmPassPh: "Powtórz nowe hasło",
    submit: "Zaktualizuj hasło",
    saving: "Aktualizowanie...",
    success: "Twoje hasło zostało pomyślnie zmienione.",
    cancel: "Anuluj",
    close: "Kontynuuj",
    signOutOthers: "Wyloguj ze wszystkich innych sesji",
    ruleMinLength: "Minimum 8 znaków",
    ruleUpperLower: "Wielkie i małe litery",
    ruleNumberSymbol: "Cyfry i znaki specjalne",
    errEmptyCurrent: "Wprowadź dotychczasowe hasło.",
    errEmptyNew: "Wprowadź nowe hasło.",
    errWeakPassword: "Hasło nie spełnia wymagań bezpieczeństwa.",
    errMismatch: "Hasła nie są identyczne.",
    errSameAsCurrent: "Nowe hasło musi różnić się od dotychczasowego.",
    errInvalidCurrent: "Dotychczasowe hasło jest niepoprawne.",
    ariaShow: "Pokaż hasło",
    ariaHide: "Ukryj hasło",
  },
};

export function ChangePasswordModal({ open, onOpenChange, forced = false, isMasterOnly = false, onSuccess }: ChangePasswordModalProps) {
  const { lang } = useI18n();
  const tx = TEXTS[lang] ?? TEXTS.en;
  const updateMasterPasswordFn = useServerFn(updateMasterSelfPassword);
  const changeSelfPasswordFn = useServerFn(changeSelfPassword);

  const { user } = useAuth();
  const { isAdmin, level } = useIsAdmin(user?.id, user?.email);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // REGRA OBRIGATÓRIA: ADM Geral e ADM Comum NÃO podem alterar a própria senha em nenhuma hipótese
  if (isAdmin && (level === "geral" || level === "comum")) {
    return null;
  }

  // Password rules validation
  const hasMinLength = newPassword.length >= 8;
  const hasUpperLower = /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword);
  const hasNumberSymbol = /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
  const isStrong = hasMinLength && hasUpperLower && hasNumberSymbol;

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && forced && !success) {
      return; // Prevent dismissing when mandatory
    }
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCurrent = currentPassword.trim();
    if (!trimmedCurrent) {
      setError(tx.errEmptyCurrent);
      return;
    }

    const trimmedNew = newPassword.trim();
    if (!trimmedNew) {
      setError(tx.errEmptyNew);
      return;
    }

    if (!isStrong) {
      setError(tx.errWeakPassword);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(tx.errMismatch);
      return;
    }

    if (newPassword === currentPassword) {
      setError(tx.errSameAsCurrent);
      return;
    }

    setLoading(true);

    try {
      if (isMasterOnly) {
        // Enforce server-side Master authorization and atomic update
        await updateMasterPasswordFn({
          data: {
            current_password: currentPassword,
            new_password: newPassword,
            sign_out_others: signOutOthers,
          },
        });
      } else {
        // Enforce server-side self password update (blocks ADM Geral & Comum, preserves Master and regular customers)
        await changeSelfPasswordFn({
          data: {
            current_password: currentPassword,
            new_password: newPassword,
            sign_out_others: signOutOthers,
          },
        });
      }

      // 3. Optionally terminate other active sessions
      if (signOutOthers) {
        try {
          await (supabase.auth as any).signOut({ scope: "others" });
        } catch {
          // Non-fatal if unsupported by current backend
        }
      }

      setSuccess(true);
      // Immediately wipe passwords from memory
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}
        className="sm:max-w-md rounded-2xl bg-background border-border/80 shadow-2xl"
      >
        <DialogHeader className="text-left space-y-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
            <Key className="w-5 h-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {forced ? tx.forcedTitle : tx.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {forced ? tx.forcedDesc : tx.desc}
          </DialogDescription>
        </DialogHeader>

        {forced && !success && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
              {tx.forcedDesc}
            </p>
          </div>
        )}

        {success ? (
          <div className="py-4 space-y-5">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                {tx.success}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                {tx.close}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {tx.currentPass}
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={tx.currentPassPh}
                  maxLength={128}
                  autoComplete="current-password"
                  className="w-full h-10 px-4 pr-11 rounded-xl border border-border bg-secondary/40 text-sm outline-none focus:bg-background focus:border-primary transition"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  aria-label={showCurrentPassword ? tx.ariaHide : tx.ariaShow}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-1"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {tx.newPass}
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={tx.newPassPh}
                  maxLength={128}
                  autoComplete="new-password"
                  className="w-full h-10 px-4 pr-11 rounded-xl border border-border bg-secondary/40 text-sm outline-none focus:bg-background focus:border-primary transition"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? tx.ariaHide : tx.ariaShow}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-1"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password complexity checklist */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1 bg-secondary/30 p-2.5 rounded-lg border border-border/50 text-[11px]">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 opacity-50" />}
                    <span>{tx.ruleMinLength}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpperLower ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {hasUpperLower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 opacity-50" />}
                    <span>{tx.ruleUpperLower}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumberSymbol ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {hasNumberSymbol ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 opacity-50" />}
                    <span>{tx.ruleNumberSymbol}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {tx.confirmPass}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={tx.confirmPassPh}
                  maxLength={128}
                  autoComplete="new-password"
                  className="w-full h-10 px-4 pr-11 rounded-xl border border-border bg-secondary/40 text-sm outline-none focus:bg-background focus:border-primary transition"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? tx.ariaHide : tx.ariaShow}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign out other sessions checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="sign-out-others"
                checked={signOutOthers}
                onChange={(e) => setSignOutOthers(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
              />
              <label htmlFor="sign-out-others" className="text-xs text-muted-foreground cursor-pointer select-none">
                {tx.signOutOthers}
              </label>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-medium leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              {!forced && (
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  disabled={loading}
                  className="px-4 py-2 rounded-full border border-border text-xs font-semibold hover:bg-secondary transition disabled:opacity-50"
                >
                  {tx.cancel}
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !isStrong || !currentPassword || newPassword !== confirmPassword}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{tx.saving}</span>
                  </>
                ) : (
                  <span>{tx.submit}</span>
                )}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
