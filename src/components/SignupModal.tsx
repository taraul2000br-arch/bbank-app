import { useEffect, useState } from "react";
import { X, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { recordLoginEvent, validateReferralCode } from "@/lib/admin.functions";
import { loginStepOne, completeRegistrationLogin } from "@/lib/two-factor-auth.functions";
import { fetchKycStatus } from "@/lib/kyc";
import { useI18n } from "@/lib/i18n";

export const OPEN_SIGNUP_EVENT = "open-signup-modal";
export const OPEN_LOGIN_EVENT = "open-login-modal";

export function openSignupModal() {
  window.dispatchEvent(new CustomEvent(OPEN_SIGNUP_EVENT));
}
export function openLoginModal() {
  window.dispatchEvent(new CustomEvent(OPEN_LOGIN_EVENT));
}

type Country = { code: string; label: string; docLabel: string; docType: "cpf" | "ssn" | "nif" | "dni" | "passport" | "other"; dial: string };
const COUNTRIES: Country[] = [
  { code: "BR", label: "🇧🇷 Brasil", docLabel: "CPF", docType: "cpf", dial: "+55" },
  { code: "PT", label: "🇵🇹 Portugal", docLabel: "NIF", docType: "nif", dial: "+351" },
  { code: "ES", label: "🇪🇸 España", docLabel: "DNI", docType: "dni", dial: "+34" },
  { code: "PR", label: "🇵🇷 Puerto Rico", docLabel: "SSN", docType: "ssn", dial: "+1" },
  { code: "PL", label: "🇵🇱 Polska", docLabel: "PESEL", docType: "other", dial: "+48" },
  { code: "US", label: "🇺🇸 United States", docLabel: "SSN", docType: "ssn", dial: "+1" },
];

function maskDate(v: string) {
  return v.replace(/\D/g, "").slice(0, 8)
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\d{2})(\d)/, "$1/$2");
}

// ====== Document validators (real checksum-based when possible) ======
function onlyDigits(v: string) { return v.replace(/\D/g, ""); }

function validateCPF(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(cpf[9]) && calc(10) === parseInt(cpf[10]);
}

function validateNIF_PT(raw: string): boolean {
  const n = onlyDigits(raw);
  if (n.length !== 9) return false;
  if (!"125689".includes(n[0]) && n.substring(0, 2) !== "30" && n.substring(0, 2) !== "45" && n.substring(0, 2) !== "70" && n.substring(0, 2) !== "71" && n.substring(0, 2) !== "72" && n.substring(0, 2) !== "74" && n.substring(0, 2) !== "75" && n.substring(0, 2) !== "77" && n.substring(0, 2) !== "79" && n.substring(0, 2) !== "90" && n.substring(0, 2) !== "91" && n.substring(0, 2) !== "98" && n.substring(0, 2) !== "99") return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += parseInt(n[i]) * (9 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return check === parseInt(n[8]);
}

function validateDNI_ES(raw: string): boolean {
  const v = raw.toUpperCase().replace(/\s/g, "");
  // DNI: 8 digits + letter; NIE: X/Y/Z + 7 digits + letter
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  let num: number | null = null;
  let letter = "";
  if (/^\d{8}[A-Z]$/.test(v)) {
    num = parseInt(v.substring(0, 8));
    letter = v[8];
  } else if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const map: Record<string, string> = { X: "0", Y: "1", Z: "2" };
    num = parseInt(map[v[0]] + v.substring(1, 8));
    letter = v[8];
  } else return false;
  return letters[num % 23] === letter;
}

function validateSSN(raw: string): boolean {
  const n = onlyDigits(raw);
  if (n.length !== 9) return false;
  const area = n.substring(0, 3);
  const group = n.substring(3, 5);
  const serial = n.substring(5);
  if (area === "000" || area === "666" || parseInt(area) >= 900) return false;
  if (group === "00" || serial === "0000") return false;
  return true;
}

function validatePESEL(raw: string): boolean {
  const n = onlyDigits(raw);
  if (n.length !== 11) return false;
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(n[i]) * w[i];
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(n[10]);
}

function validateDocument(country: string, value: string): boolean {
  // Validação leve apenas de formato — o KYC verifica o documento de verdade
  const v = value.trim();
  const digits = onlyDigits(v);
  switch (country) {
    case "BR": return digits.length === 11;            // CPF: 11 dígitos
    case "PT": return digits.length === 9;             // NIF: 9 dígitos
    case "ES": return /^[XYZ]?\d{7,8}[A-Za-z]?$/.test(v.replace(/\s/g, "")); // DNI/NIE
    case "US":
    case "PR": return digits.length === 9;             // SSN: 9 dígitos
    case "PL": return digits.length === 11;            // PESEL: 11 dígitos
    default: return v.length >= 3;
  }
}

function docErrorMsg(country: string): string {
  switch (country) {
    case "BR": return "CPF inválido";
    case "PT": return "NIF inválido";
    case "ES": return "DNI/NIE inválido";
    case "US":
    case "PR": return "Invalid SSN";
    case "PL": return "PESEL inválido";
    default: return "Documento inválido";
  }
}

export function SignupModal() {
  const navigate = useNavigate();
  const recordEvent = useServerFn(recordLoginEvent);
  const checkCode = useServerFn(validateReferralCode);
  const stepOneFn = useServerFn(loginStepOne);
  const completeRegFn = useServerFn(completeRegistrationLogin);
  const { t, lang } = useI18n();
  const isPt = lang === "pt";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "", telefone: "", email: "", nascimento: "",
    senha: "", confirmar: "", country: "BR", document: "", referral: "",
  });
  const [login, setLogin] = useState({ email: "", senha: "" });
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    const sHandler = () => {
      setOpen(true);
      setMode("signup");
      setDone(false);
      setError("");
      setResendSent(false);
      setResendLoading(false);
    };
    const lHandler = () => {
      setOpen(true);
      setMode("login");
      setDone(false);
      setError("");
    };
    window.addEventListener(OPEN_SIGNUP_EVENT, sHandler);
    window.addEventListener(OPEN_LOGIN_EVENT, lHandler);

    return () => {
      window.removeEventListener(OPEN_SIGNUP_EVENT, sHandler);
      window.removeEventListener(OPEN_LOGIN_EVENT, lHandler);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const country = COUNTRIES.find((c) => c.code === form.country) ?? COUNTRIES[0];
  const senhasOk = form.senha.length >= 6 && form.senha === form.confirmar;
  const docValid = validateDocument(form.country, form.document);
  const valid =
    form.nome.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    form.nascimento.length === 10 &&
    docValid &&
    form.referral.trim().length >= 2 &&
    senhasOk && agree;
  const loginValid = /\S+@\S+\.\S+/.test(login.email) && login.senha.length >= 6;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let v = e.target.value;
    if (k === "nascimento") v = maskDate(v);
    setForm({ ...form, [k]: v });
  };
  const setL = (k: keyof typeof login) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogin({ ...login, [k]: e.target.value });
  };

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || loading) return;
    setLoading(true); setError("");
    const [dd, mm, yyyy] = form.nascimento.split("/");
    const birth_date = `${yyyy}-${mm}-${dd}`;
    const referralCode = form.referral.trim().toUpperCase();

    // valida código de referência antes de criar
    try {
      const res = await checkCode({ data: { code: referralCode } });
      if (!res.ok) { setError(t("modal.signup.referralInvalid")); setLoading(false); return; }
    } catch {
      setError(t("modal.signup.referralValidateFail")); setLoading(false); return;
    }

    const { data, error: signErr } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/conta`,
        data: {
          full_name: form.nome.trim(),
          country: form.country,
          document_type: country.docType,
          document_number: form.document.trim(),
          phone: `${country.dial} ${form.telefone.trim()}`,
          birth_date,
          referral_code: referralCode,
          currency: "GBP",
        },
      },
    });
    if (signErr) {
      const msg = signErr.message || "";
      if (msg.toLowerCase().includes("user already registered") || msg.toLowerCase().includes("already registered")) {
        setError(isPt ? "Este e-mail já está cadastrado. Por favor, acesse a aba de login." : "This email address is already registered. Please sign in instead.");
      } else {
        setError(msg);
      }
      setLoading(false);
      return;
    }

    // Proteção contra duplicação: se a confirmação de e-mail estiver ativa no GoTrue e o usuário já existir,
    // o Supabase mascara a resposta retornando identities vazio.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError(isPt ? "Este e-mail já está cadastrado. Por favor, acesse a aba de login." : "This email address is already registered. Please sign in instead.");
      setLoading(false);
      return;
    }

    // O trigger PostgreSQL handle_new_user persiste automaticamente perfil e dados bancários.
    // Completa a autenticação imediata e segura do cadastro recém-criado sem exigir Sort Code
    try {
      const regRes = await completeRegFn({
        data: {
          email: form.email.trim(),
          password: form.senha,
        },
      });

      if (!regRes.success) {
        setLoading(false);
        if (regRes.error?.toLowerCase().includes("email not confirmed")) {
          setError(
            isPt
              ? "Confirmação de e-mail pendente. Por favor, verifique a sua caixa de entrada ou tente novamente mais tarde."
              : "Email verification required. Please check your inbox and follow the confirmation instructions to continue."
          );
          return;
        }
        setError(regRes.error || (isPt ? "Cadastro realizado, mas não foi possível iniciar a sessão. Por favor, faça login." : "Account created, but could not start session. Please sign in."));
        return;
      }

      if (regRes.session) {
        await supabase.auth.setSession({
          access_token: regRes.session.access_token,
          refresh_token: regRes.session.refresh_token,
        });

        if (regRes.verificationProof && typeof window !== "undefined") {
          sessionStorage.setItem("bancoteste_sc_proof", regRes.verificationProof);
          localStorage.setItem("bancoteste_sc_proof", regRes.verificationProof);
          sessionStorage.removeItem("bancoteste_auth_challenge");
          sessionStorage.removeItem("bancoteste_auth_email");
        }

        setLoading(false);
        setOpen(false);

        if (regRes.isAdmin) {
          navigate({ to: "/admin" });
        } else {
          // Cliente novo com cadastro autenticado segue diretamente para o KYC sem solicitar Sort Code
          navigate({ to: "/kyc" });
        }
        return;
      }

      setLoading(false);
      setError(isPt ? "Falha ao obter sessão do usuário. Por favor, faça login." : "Failed to obtain user session. Please sign in.");
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || (isPt ? "Erro ao processar autenticação do cadastro." : "Error processing registration authentication."));
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginValid || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await stepOneFn({
        data: {
          email: login.email.trim(),
          password: login.senha,
        },
      });

      if (!res.success) {
        setLoading(false);
        if (res.error?.toLowerCase().includes("email not confirmed")) {
          setError(
            isPt
              ? "E-mail não confirmado. Por favor, verifique a sua caixa de entrada para confirmar o seu endereço de e-mail."
              : "Email address not confirmed. Please check your inbox and verify your email address to continue."
          );
          return;
        }
        setError(res.error || (isPt ? "E-mail ou senha inválidos." : "Invalid email address or password."));
        return;
      }

      if (res.session) {
        await supabase.auth.setSession({
          access_token: res.session.access_token,
          refresh_token: res.session.refresh_token,
        });

        if (res.verificationProof && typeof window !== "undefined") {
          sessionStorage.setItem("bancoteste_sc_proof", res.verificationProof);
          localStorage.setItem("bancoteste_sc_proof", res.verificationProof);
          }

        try {
          await recordEvent({
            data: { event_type: "login" },
            headers: { Authorization: `Bearer ${res.session.access_token}` },
          });
        } catch {}

        setLoading(false);
        setOpen(false);

        if (res.isAdmin) {
          navigate({ to: "/admin" });
          return;
        }

        if ((res as any).requiresKyc) {
          navigate({ to: "/kyc" });
          return;
        }

        navigate({ to: "/conta" });
        return;
      }

      setLoading(false);
      setError(isPt ? "Falha ao obter sessão do usuário." : "Failed to obtain user session.");
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Failed to continue. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40">
      <aside
        className="w-full sm:max-w-md bg-background h-full overflow-y-auto overscroll-contain shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-6 sm:p-8 pb-16">
          <div className="flex justify-end">
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 hover:bg-secondary rounded-full transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {done && mode === "signup" ? (
            <div className="text-center pt-6 pb-4 animate-in fade-in duration-500">
              <div className="relative mx-auto mb-8 w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                <div className="absolute inset-2 rounded-full bg-primary/20" />
                <div className="relative w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-primary-foreground">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-3 tracking-tight">{t("modal.welcome.title")}</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
                {t("modal.welcome.desc")}
              </p>
              {error && <p className="text-sm text-destructive mb-4">{error}</p>}
              <button onClick={() => { setMode("login"); setDone(false); setResendSent(false); setError(""); }} className="w-full py-4 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition shadow-lg shadow-primary/20">
                {t("modal.welcome.cta")}
              </button>
            </div>
          ) : mode === "login" ? (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1.5">
                Sign in to Online Banking
              </h2>
              <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                Enter your registered email address and password to continue.
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <Field
                  label="Email address"
                  placeholder="you@email.com"
                  value={login.email}
                  onChange={setL("email")}
                  type="email"
                  maxLength={255}
                  autoComplete="email"
                />
                <Field
                  label="Password"
                  placeholder="Enter your password"
                  value={login.senha}
                  onChange={setL("senha")}
                  type="password"
                  maxLength={72}
                  autoComplete="current-password"
                />

                {error && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs leading-relaxed">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!loginValid || loading}
                  className="w-full py-3.5 rounded-md bg-primary text-primary-foreground font-semibold disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition hover:opacity-95 shadow-sm cursor-pointer text-sm"
                >
                  {loading ? "Checking credentials..." : "Sign in securely"}
                </button>

                <p className="text-center text-sm text-muted-foreground pt-3">
                  {t("modal.login.noAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signup"); setError(""); }}
                    className="text-primary font-semibold hover:underline cursor-pointer"
                  >
                    {t("modal.login.openFree")}
                  </button>
                </p>
              </form>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-center mt-2 mb-8">{t("modal.signup.title")}</h2>
              <form onSubmit={handleSignup} className="space-y-5">
                <Field label={t("modal.signup.name")} placeholder={t("modal.signup.namePh")} value={form.nome} onChange={set("nome")} maxLength={100} />

                <div>
                  <label className="block text-sm font-semibold mb-2">{t("modal.signup.country")}</label>
                  <select
                    value={form.country}
                    onChange={set("country")}
                    className="w-full px-4 py-3 rounded-md bg-secondary border border-transparent focus:border-primary focus:bg-background outline-none transition"
                  >
                    {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <Field
                    label={country.docLabel}
                    placeholder={`Enter your ${country.docLabel}`}
                    value={form.document}
                    onChange={set("document")}
                    maxLength={30}
                  />
                  {form.document.length > 0 && !docValid && (
                    <p className="text-xs text-destructive mt-1">{docErrorMsg(form.country)}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">{t("modal.signup.phone")}</label>
                  <div className="flex gap-2">
                    <div className="px-4 py-3 rounded-md bg-secondary font-semibold text-sm flex items-center min-w-[72px] justify-center">
                      {country.dial}
                    </div>
                    <input
                      value={form.telefone}
                      onChange={(e) => setForm({ ...form, telefone: e.target.value.replace(/\D/g, "").slice(0, 15) })}
                      inputMode="tel"
                      placeholder={t("modal.signup.phonePh")}
                      className="flex-1 px-4 py-3 rounded-md bg-secondary border border-transparent focus:border-primary focus:bg-background outline-none transition placeholder:text-muted-foreground/70"
                    />
                  </div>
                </div>
                <Field label={t("modal.signup.email")} placeholder={t("modal.signup.emailPh")} value={form.email} onChange={set("email")} type="email" maxLength={255} autoComplete="email" />
                <Field label={t("modal.signup.dob")} placeholder={t("modal.signup.dobPh")} value={form.nascimento} onChange={set("nascimento")} inputMode="numeric" />
                <Field label={t("modal.signup.pass")} placeholder={t("modal.signup.passPh")} value={form.senha} onChange={set("senha")} type="password" maxLength={72} autoComplete="new-password" />
                <div>
                  <Field label={t("modal.signup.confirm")} placeholder={t("modal.signup.confirmPh")} value={form.confirmar} onChange={set("confirmar")} type="password" maxLength={72} autoComplete="new-password" />
                  {form.confirmar.length > 0 && form.senha !== form.confirmar && (
                    <p className="text-xs text-destructive mt-1">{t("modal.signup.mismatch")}</p>
                  )}
                </div>

                <div>
                  <Field
                    label={t("modal.signup.referral")}
                    placeholder={t("modal.signup.referralPh")}
                    value={form.referral}
                    onChange={(e) => setForm({ ...form, referral: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20) })}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t("modal.signup.referralHelp")}</p>
                </div>

                <label className="flex gap-3 text-sm text-muted-foreground pt-2">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-primary w-4 h-4 shrink-0" />
                  <span>
                    {t("modal.signup.agree")} <a href="#" className="text-primary font-semibold">{t("modal.signup.privacy")}</a>
                  </span>
                </label>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <button
                  type="submit"
                  disabled={!valid || loading}
                  className="w-full py-4 rounded-md bg-primary text-primary-foreground font-semibold disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition"
                >
                  {loading ? "..." : t("modal.signup.continue")}
                </button>

                <p className="text-center text-sm text-muted-foreground pt-2">
                  {t("modal.signup.haveAccount")}{" "}
                  <button type="button" onClick={() => { setMode("login"); setError(""); }} className="text-primary font-semibold">
                    {t("modal.signup.accessAccount")}
                  </button>
                </p>
              </form>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, type, className, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label className="block text-sm font-semibold mb-2">{label}</label>
      <div className="relative">
        <input
          {...props}
          type={isPassword ? (showPassword ? "text" : "password") : type}
          className={`w-full px-4 py-3 rounded-md bg-secondary border border-transparent focus:border-primary focus:bg-background outline-none transition placeholder:text-muted-foreground/70 text-base ${isPassword ? "pr-11" : ""} ${className || ""}`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-1"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
