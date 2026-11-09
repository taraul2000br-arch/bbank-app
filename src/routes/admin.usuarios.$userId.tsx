import { createFileRoute, Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft, X, Mail, Phone, Calendar, User as UserIcon, DollarSign,
  Globe, LogIn, ShieldCheck, Shield, Plus, StickyNote, Loader2, Pencil, Check,
  FileText, Camera, AlertTriangle, Download, Unlock, Lock, Key, Trash2, UserCog,
  Eye, EyeOff, Landmark, Hash, Copy,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, useIsAdmin } from "@/lib/auth";
import {
  getAdminUserDetail, getUserAuthActivity, listAdminUserNotes, addAdminUserNote,
  updateUserBalance, unblockAccount, blockAccount, setUserTagColor, updateUserPassword,
  deleteUser, setUserTransferLock, updateUserProfile, updateUserBankingDetails,
  canReassignClients, listAssignableAdmins, reassignClientToAdmin,
  type AdminUserDetail, type UserAuthActivity, type AdminNote, type TagColor,
  type AssignableAdmin,
} from "@/lib/admin.functions";
import { parseUkAccountCredentials, generateUkIban } from "@/lib/account";

import { getKycSubmission, reviewKyc, type KycSubmissionDetail, type KycPart } from "@/lib/kyc.functions";
import { listTransferRequestsForUser, updateTransferStatus, type TransferRow } from "@/lib/transfers.functions";
import { AdminTransferDetailModal } from "@/components/AdminTransferDetailModal";
import { adminI18n as t } from "@/lib/admin-i18n";
import { callWithRetry } from "@/lib/server-call";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/usuarios/$userId")({
  component: UserDetailPage,
  head: () => ({ meta: [{ title: "FSociety — User details" }] }),
  errorComponent: DetailError,
});

function DetailError({ error, reset }: { error: unknown; reset: () => void }) {
  useEffect(() => {
    console.error("CRM detail render error", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#080808] text-[#F5F5F5] grid place-items-center p-6">
      <div className="max-w-md text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
        <h1 className="text-lg font-semibold">Não foi possível abrir os detalhes</h1>
        <p className="text-sm text-slate-400">A tela encontrou um dado antigo ou incompleto. Tente novamente; o erro foi registrado para diagnóstico.</p>
        <button onClick={reset} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm">
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

function UserDetailPage() {
  const { userId } = useParams({ from: "/admin/usuarios/$userId" });
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading, level } = useIsAdmin(user?.id, user?.email);

  const fetchDetail = useServerFn(getAdminUserDetail);
  const fetchActivity = useServerFn(getUserAuthActivity);
  const fetchNotes = useServerFn(listAdminUserNotes);
  const addNote = useServerFn(addAdminUserNote);
  const fetchKyc = useServerFn(getKycSubmission);
  const reviewKycFn = useServerFn(reviewKyc);
  const fetchTransfers = useServerFn(listTransferRequestsForUser);
  const updateTransfer = useServerFn(updateTransferStatus);
  const setTagColorFn = useServerFn(setUserTagColor);

  const saveBalance = useServerFn(updateUserBalance);
  const unblockAccountFn = useServerFn(unblockAccount);
  const blockAccountFn = useServerFn(blockAccount);
  const updatePasswordFn = useServerFn(updateUserPassword);
  const updateUserProfileFn = useServerFn(updateUserProfile);
  const updateBankingFn = useServerFn(updateUserBankingDetails);
  const deleteUserFn = useServerFn(deleteUser);
  const setTransferLockFn = useServerFn(setUserTransferLock);
  const checkReassign = useServerFn(canReassignClients);
  const fetchAssignableAdmins = useServerFn(listAssignableAdmins);
  const reassignFn = useServerFn(reassignClientToAdmin);

  const [canReassign, setCanReassign] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [assignAdmins, setAssignAdmins] = useState<AssignableAdmin[]>([]);
  const [assignTarget, setAssignTarget] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkReassign({ data: { user_id: userId } })
      .then(async (r) => {
        if (cancelled) return;
        setReadOnly(!!(r as any).readOnly);
        if (!r.allowed) return;
        setCanReassign(true);
        try {
          const rows = await fetchAssignableAdmins();
          if (!cancelled) setAssignAdmins(rows);
        } catch { /* ignore */ }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [checkReassign, fetchAssignableAdmins, userId]);



  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [activity, setActivity] = useState<UserAuthActivity | null>(null);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [kyc, setKyc] = useState<KycSubmissionDetail | null>(null);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [transferBusy, setTransferBusy] = useState<string | null>(null);
  const [kycBusy, setKycBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectedParts, setRejectedParts] = useState<KycPart[]>([]);
  const [ibanInput, setIbanInput] = useState("");
  const [showIbanBox, setShowIbanBox] = useState(false);
  const [holderNameInput, setHolderNameInput] = useState("");
  const [swiftInput, setSwiftInput] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState("");
  const [expectedBalance, setExpectedBalance] = useState<number | null>(null);
  const [savingBalance, setSavingBalance] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [showAdminPasswordDraft, setShowAdminPasswordDraft] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<{
    full_name: string;
    phone: string;
    birth_date: string;
    document_type: string;
    document_number: string;
    country: string;
  }>({
    full_name: "",
    phone: "",
    birth_date: "",
    document_type: "nif",
    document_number: "",
    country: "GB",
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingBanking, setEditingBanking] = useState(false);
  const [savingBanking, setSavingBanking] = useState(false);
  const [bankingDraft, setBankingDraft] = useState<{
    holder_name: string;
    sort_code: string;
    account_number: string;
    iban: string;
    swift: string;
    currency: string;
  }>({
    holder_name: "",
    sort_code: "",
    account_number: "",
    iban: "",
    swift: "",
    currency: "GBP",
  });
  const [selectedTransferDetailId, setSelectedTransferDetailId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant?: "danger" | "default";
    onConfirm: () => void | Promise<void>;
  }>({ open: false, title: "", description: "", confirmLabel: "Confirmar", onConfirm: () => {} });

  const askConfirm = (opts: Omit<typeof confirmState, "open">) =>
    setConfirmState({ ...opts, open: true });

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoadingData(true);
    setLoadError(null);
    setDetail(null);
    setActivity(null);
    setNotes([]);
    setKyc(null);
    setTransfers([]);

    const load = async () => {
      // O cadastro principal abre primeiro. Isso evita que cinco verificações
      // protegidas concorrentes sobrecarreguem a sessão de qualquer ADM.
      try {
        const nextDetail = await callWithRetry(() => fetchDetail({ data: { user_id: userId } }));
        if (cancelled) return;
        setDetail(nextDetail);
        setLoadingData(false);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar este cliente.");
        setLoadingData(false);
        return;
      }

      // Informações secundárias são independentes: uma falha não fecha o CRM.
      const [a, n, k, tr] = await Promise.allSettled([
        callWithRetry(() => fetchActivity({ data: { user_id: userId } })),
        callWithRetry(() => fetchNotes({ data: { user_id: userId } })),
        callWithRetry(() => fetchKyc({ data: { user_id: userId } })),
        callWithRetry(() => fetchTransfers({ data: { user_id: userId } })),
      ]);
      if (cancelled) return;
      if (a.status === "fulfilled") setActivity(a.value);
      if (n.status === "fulfilled") setNotes(Array.isArray(n.value.notes) ? n.value.notes : []);
      if (k.status === "fulfilled") {
        const nextKyc = k.value;
        setKyc(nextKyc ? { ...nextKyc, liveness_urls: Array.isArray(nextKyc.liveness_urls) ? nextKyc.liveness_urls : [] } : null);
      }
      if (tr.status === "fulfilled") setTransfers(Array.isArray(tr.value.rows) ? tr.value.rows : []);

      for (const result of [a, n, k, tr]) {
        if (result.status === "rejected") console.error("detail partial", result.reason);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [isAdmin, userId, fetchDetail, fetchActivity, fetchNotes, fetchKyc, fetchTransfers]);


  const handleTransferAction = async (id: string, status: "aprovado" | "recusado" | "bloqueado") => {
    if (status === "bloqueado" && !window.confirm("Bloquear definitivamente a conta deste cliente por ordem judicial?\n\nO saldo retido NÃO será devolvido e o cliente verá um aviso permanente ao entrar.")) return;
    let reason: string | undefined;
    if (status === "recusado") {
      const r = window.prompt("Motivo da recusa (opcional — visível para o cliente no extrato):", "");
      if (r === null) return; // cancelled
      reason = r.trim() || undefined;
    }
    setTransferBusy(id);
    try {
      await updateTransfer({ data: { id, status, ...(reason ? { reason } : {}) } });
      const [tr, d] = await Promise.all([
        fetchTransfers({ data: { user_id: userId } }),
        fetchDetail({ data: { user_id: userId } }),
      ]);
      setTransfers(tr.rows);
      setDetail(d);
    } catch (e: any) {
      console.error("update transfer", e);
      window.alert(e?.message ?? "Falha ao atualizar a transferência.");
    } finally {
      setTransferBusy(null);
    }
  };

  const decideKyc = async (decision: "approved" | "rejected") => {
    if (kycBusy) return;
    setApproveError(null);
    if (decision === "rejected") {
      if (!showRejectBox) { setShowRejectBox(true); return; }
      if (rejectedParts.length === 0) {
        setApproveError("Selecione ao menos uma parte para o cliente refazer.");
        return;
      }
      if (rejectedParts.includes("profile" as KycPart) && !rejectReason.trim()) {
        setApproveError("Descreva o motivo da recusa por dados incompletos.");
        return;
      }
    }
    if (decision === "approved") {
      const cleanedIban = ibanInput.replace(/\s+/g, "");
      const cleanedSwift = swiftInput.replace(/\s+/g, "");
      const cleanedName = holderNameInput.trim();
      if (cleanedName.length < 2) {
        setShowIbanBox(true);
        setApproveError("Informe o nome do titular.");
        return;
      }
      if (cleanedIban && !/^[A-Za-z0-9]+$/.test(cleanedIban)) {
        setShowIbanBox(true);
        setApproveError("IBAN inválido.");
        return;
      }
      if (cleanedSwift && !/^[A-Za-z0-9]+$/.test(cleanedSwift)) {
        setShowIbanBox(true);
        setApproveError("SWIFT/BIC inválido.");
        return;
      }
    }
    setKycBusy(true);
    try {
      await reviewKycFn({
        data: {
          user_id: userId,
          decision,
          reason: rejectReason.trim() || undefined,
          rejected_parts: decision === "rejected" ? rejectedParts : undefined,
          holder_name: decision === "approved" ? holderNameInput.trim() : undefined,
          iban: decision === "approved" ? ibanInput.trim() : undefined,
          swift: decision === "approved" ? swiftInput.trim() : undefined,
        },
      });
      const [k, d] = await Promise.all([
        fetchKyc({ data: { user_id: userId } }),
        fetchDetail({ data: { user_id: userId } }),
      ]);
      setKyc(k);
      setDetail(d);
      setShowRejectBox(false);
      setShowIbanBox(false);
      setRejectReason("");
      setRejectedParts([]);
    } catch (e: any) {
      console.error("review kyc", e);
      setApproveError(e?.message ?? "Falha ao aprovar.");
    } finally {
      setKycBusy(false);
    }
  };

  if (loading || roleLoading) return null;
  if (!user) return <Navigate to="/" />;
  if (!isAdmin) return <Navigate to="/conta" />;

  const submitNote = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      await addNote({ data: { user_id: userId, content: draft } });
      const n = await fetchNotes({ data: { user_id: userId } });
      setNotes(n.notes);
      setDraft("");
      setComposerOpen(false);
    } catch (e) {
      console.error("add note", e);
    } finally {
      setSubmitting(false);
    }
  };

  const formatMoney = (n: number) =>
    (Number(n) || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const parseMoney = (s: string): number => {
    const digits = s.replace(/\D/g, "");
    if (!digits) return 0;
    return Number(digits) / 100;
  };

  const handleBalanceInput = (raw: string) => {
    const value = parseMoney(raw);
    setBalanceDraft(formatMoney(value));
  };

  const startEditBalance = () => {
    if (!detail) return;
    setExpectedBalance(detail.balance);
    setBalanceDraft(formatMoney(detail.balance));
    setEditingBalance(true);
  };

  const submitBalance = async () => {
    if (!detail) return;
    const value = parseMoney(balanceDraft);
    const expected = expectedBalance !== null ? expectedBalance : detail.balance;
    setSavingBalance(true);
    try {
      const res = await saveBalance({
        data: {
          user_id: userId,
          balance: value,
          expected_current_balance: expected,
        },
      });
      setDetail({ ...detail, balance: res.new_balance });
      setEditingBalance(false);
      setExpectedBalance(null);
    } catch (e: any) {
      console.error("save balance", e);
      window.alert(e?.message ?? "Falha ao salvar o saldo.");
      // Concurrency conflict or error: re-fetch latest user detail to refresh screen with the real balance
      try {
        const fresh = await fetchDetail({ data: { user_id: userId } });
        setDetail(fresh);
      } catch { /* ignore */ }
      setEditingBalance(false);
      setExpectedBalance(null);
    } finally {
      setSavingBalance(false);
    }
  };

  const submitPassword = async () => {
    if (userId === user?.id && level !== "master") {
      window.alert("Acesso negado: Administradores dos níveis ADM Geral e ADM Comum não têm permissão para alterar a própria senha.");
      setEditingPassword(false);
      return;
    }
    if (!passwordDraft || passwordDraft.length < 6) {
      window.alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setSavingPassword(true);
    try {
      await updatePasswordFn({ data: { user_id: userId, password: passwordDraft } });
      setEditingPassword(false);
      setPasswordDraft("");
      setShowAdminPasswordDraft(false);
    } catch (e: any) {
      console.error("update password", e);
      window.alert(e?.message ?? "Falha ao alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  };

  const startEditProfile = () => {
    if (!detail) return;
    setProfileDraft({
      full_name: detail.full_name || "",
      phone: detail.phone || "",
      birth_date: detail.birth_date || "",
      document_type: detail.document_type || "nif",
      document_number: detail.document_number || "",
      country: detail.country || "GB",
    });
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!detail) return;
    setSavingProfile(true);
    try {
      await updateUserProfileFn({
        data: {
          user_id: userId,
          full_name: profileDraft.full_name.trim() || undefined,
          phone: profileDraft.phone.trim() || null,
          birth_date: profileDraft.birth_date.trim() || null,
          document_type: profileDraft.document_type.trim() || null,
          document_number: profileDraft.document_number.trim() || null,
          country: profileDraft.country.trim() || "GB",
        },
      });
      setDetail({
        ...detail,
        full_name: profileDraft.full_name.trim(),
        phone: profileDraft.phone.trim() || null,
        birth_date: profileDraft.birth_date.trim() || null,
        document_type: profileDraft.document_type.trim() || null,
        document_number: profileDraft.document_number.trim() || null,
        country: profileDraft.country.trim() || "GB",
      });
      setEditingProfile(false);
    } catch (e: any) {
      window.alert(e?.message ?? "Falha ao atualizar dados cadastrais.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCopy = (key: string, val: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const startEditBanking = () => {
    if (!detail) return;
    const creds = parseUkAccountCredentials(detail.account_number, detail.iban);
    setBankingDraft({
      holder_name: detail.holder_name || detail.full_name || "",
      sort_code: creds.sortCode || "10-80-00",
      account_number: creds.accountNumber || detail.account_number || "",
      iban: creds.iban || detail.iban || "",
      swift: detail.swift || "BBANGB2L",
      currency: detail.currency || "GBP",
    });
    setEditingBanking(true);
  };

  const handleSaveBanking = async () => {
    if (!detail) return;
    setSavingBanking(true);
    try {
      await updateBankingFn({
        data: {
          user_id: userId,
          holder_name: bankingDraft.holder_name.trim() || null,
          sort_code: bankingDraft.sort_code.trim() || null,
          account_number: bankingDraft.account_number.trim() || null,
          iban: bankingDraft.iban.trim() || null,
          swift: bankingDraft.swift.trim() || null,
          currency: detail.currency === "GBP" ? "GBP" : (detail.currency || "GBP"),
        },
      });
      const fresh = await fetchDetail({ data: { user_id: userId } });
      setDetail(fresh);
      setEditingBanking(false);
    } catch (e: any) {
      window.alert(e?.message ?? "Falha ao salvar dados bancários.");
    } finally {
      setSavingBanking(false);
    }
  };

  const bankingCreds = parseUkAccountCredentials(detail?.account_number, detail?.iban);
  const displayHolder = detail?.holder_name || detail?.full_name || "Not provided";
  const displaySortCode = bankingCreds.sortCode || "10-80-00";
  const displayAccountNumber = bankingCreds.accountNumber || detail?.account_number || "Not available";
  const displayIban = bankingCreds.prettyIban || (detail?.iban ? detail.iban.replace(/(.{4})/g, "$1 ").trim() : "Not available");
  const displaySwift = detail?.swift || "BBANGB2L";

  const currencySymbol = "£";

  return (
    <div className="min-h-screen bg-[#080808] text-[#F5F5F5]">
      <header className="sticky top-0 z-30 h-16 border-b border-[#292929] bg-[#0A0A0A] px-6 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="flex items-center gap-2 text-sm text-[#999999] hover:text-[#F5F5F5] transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t.backToAdmin}</span>
        </button>
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70" />
          {t.crmClient}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {loadingData ? (
          <div className="flex items-center justify-center py-32 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.loading}
          </div>
        ) : !detail ? (
          <div className="text-center py-32 space-y-4">
            <div className="text-slate-300">{loadError ?? t.userNotFound}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 text-sm"
            >
              Tentar novamente
            </button>
          </div>

        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-6">
            {/* Left: User details */}
            <aside className="space-y-6">
              {/* Header profile card */}
              <div className={`rounded-2xl border overflow-hidden ${detail.account_blocked ? "border-rose-500/30" : "border-[#292929]"} bg-[#141414]`}>
                <div className="p-6 flex items-start gap-4">
                  <div className={`w-16 h-16 shrink-0 rounded-full grid place-items-center shadow-lg ${detail.account_blocked ? "bg-rose-950/80 border border-rose-500/50 text-rose-400 shadow-rose-600/30" : "bg-[#1C1C1C] border border-[#292929] text-[#C6A667]"}`}>
                    <UserIcon className={`w-7 h-7 ${detail.account_blocked ? "text-rose-400" : "text-[#C6A667]"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-lg break-words flex flex-wrap items-center gap-2">
                      <span>{detail.full_name ?? t.noName}</span>
                      {detail.account_blocked && (
                        <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          BLOQUEADO
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className={`inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${detail.role === "admin" ? "bg-[#1C1C1C] border border-[#C6A667]/40 text-[#C6A667]" : "bg-[#1C1C1C] border border-[#292929] text-[#999999]"}`}>
                        {(detail.role ?? "user").toUpperCase()}
                      </span>
                      {detail.referred_by_name && (
                        <span className="text-xs text-slate-400">
                          Assigned to: <span className="text-[#F5F5F5] font-medium">{detail.referred_by_name}</span>
                          {detail.referred_by_level && ` (${detail.referred_by_level.toUpperCase()})`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {detail && !readOnly && (
                  <div className="px-6 py-3 border-t border-[#292929] flex items-center justify-between gap-2 flex-wrap bg-[#111111]">
                    <span className="text-xs text-[#999999] font-medium">Client Tag:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {([
                        { c: "none" as TagColor, label: "None", cls: "bg-slate-500" },
                        { c: "green" as TagColor, label: "Working", cls: "bg-emerald-400" },
                        { c: "red" as TagColor, label: "Blocked", cls: "bg-rose-400" },
                        { c: "yellow" as TagColor, label: "Tax pending", cls: "bg-amber-400" },
                        { c: "purple" as TagColor, label: "Awaiting payment", cls: "bg-violet-400" },
                      ]).map((o) => (
                        <button
                          key={o.c}
                          onClick={async () => {
                            setDetail({ ...detail, tag_color: o.c });
                            try { await setTagColorFn({ data: { user_id: userId, tag_color: o.c } }); }
                            catch (e: any) { window.alert(e?.message ?? "Falha ao atualizar etiqueta."); }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition ${
                            detail.tag_color === o.c ? "bg-[#1C1C1C] border border-[#C6A667]/50 text-[#F5F5F5] font-medium" : "text-[#999999] hover:text-[#F5F5F5] hover:bg-[#1C1C1C] border border-transparent"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${o.cls}`} />
                          <span>{o.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 1. Personal Information */}
              <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">
                    <UserIcon className="w-4 h-4 text-[#C6A667]" />
                    <span className="text-[#F5F5F5]">Personal Information</span>
                  </div>
                  {!readOnly && !editingProfile && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditProfile(); }}
                      className="w-6 h-6 grid place-items-center rounded-md text-[#999999] hover:text-[#C6A667] hover:bg-[#1C1C1C] transition"
                      title="Editar dados cadastrais"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {editingProfile ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}
                    className="space-y-3 pt-1 text-xs"
                  >
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Full name</label>
                      <input
                        type="text"
                        value={profileDraft.full_name}
                        onChange={(e) => setProfileDraft((p) => ({ ...p, full_name: e.target.value }))}
                        className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Phone</label>
                      <input
                        type="text"
                        value={profileDraft.phone}
                        onChange={(e) => setProfileDraft((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+44 7..."
                        className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Date of birth (YYYY-MM-DD)</label>
                      <input
                        type="text"
                        value={profileDraft.birth_date}
                        onChange={(e) => setProfileDraft((p) => ({ ...p, birth_date: e.target.value }))}
                        placeholder="1990-01-15"
                        className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Document type</label>
                        <select
                          value={profileDraft.document_type}
                          onChange={(e) => setProfileDraft((p) => ({ ...p, document_type: e.target.value }))}
                          className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none"
                        >
                          <option value="nif">NIF</option>
                          <option value="cpf">CPF</option>
                          <option value="ssn">SSN</option>
                          <option value="dni">DNI</option>
                          <option value="passport">Passport</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Document number</label>
                        <input
                          type="text"
                          value={profileDraft.document_number}
                          onChange={(e) => setProfileDraft((p) => ({ ...p, document_number: e.target.value }))}
                          className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Country</label>
                      <input
                        type="text"
                        value={profileDraft.country}
                        onChange={(e) => setProfileDraft((p) => ({ ...p, country: e.target.value }))}
                        placeholder="GB"
                        className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C6A667] text-black font-semibold text-xs hover:bg-[#D4B677] transition disabled:opacity-50"
                      >
                        {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Salvar</span>
                      </button>
                      <button
                        type="button"
                        disabled={savingProfile}
                        onClick={() => setEditingProfile(false)}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] border border-[#292929] text-xs transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-1">
                    <DeskRow label="Full name" value={detail.full_name || "Not provided"} />
                    <DeskRow label="Email" value={detail.email || "Not provided"} />
                    <DeskRow label="Phone" value={detail.phone || "Not provided"} />
                    <DeskRow label="Date of birth" value={formatDisplayDate(detail.birth_date)} />
                    <DeskRow label="Document type" value={formatDocType(detail.document_type)} />
                    <DeskRow label="Document number" value={detail.document_number || "Not provided"} />
                    <DeskRow label="Country" value={detail.country || "Not provided"} />
                    <DeskRow label="Customer since / Created at" value={formatDisplayDateTime(detail.created_at)} />
                  </div>
                )}
              </div>

              {/* 2. Account Status */}
              <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold border-b border-[#292929] pb-3">
                  <Shield className="w-4 h-4 text-[#C6A667]" />
                  <span className="text-[#F5F5F5]">Account Status</span>
                </div>
                <div className="space-y-1">
                  <DeskRow
                    label="Account status"
                    value={detail.account_blocked ? "Blocked (Judicial Order)" : "Active"}
                    badge={
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                        detail.account_blocked
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {detail.account_blocked ? "BLOCKED" : "ACTIVE"}
                      </span>
                    }
                  />
                  <DeskRow
                    label="Account blocked"
                    value={detail.account_blocked ? "Yes" : "No"}
                    subtext={detail.account_blocked_at ? `Blocked at: ${formatDisplayDateTime(detail.account_blocked_at)}` : undefined}
                  />
                  <DeskRow
                    label="Transfer lock"
                    value={detail.transfer_locked ? "Enabled" : "Disabled"}
                    badge={
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                        detail.transfer_locked
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {detail.transfer_locked ? "ENABLED" : "DISABLED"}
                      </span>
                    }
                  />
                  <DeskRow
                    label="Verification status"
                    value={formatKycStatus(detail.kyc_status)}
                    badge={
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                        detail.kyc_status === "approved"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : detail.kyc_status === "rejected"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : detail.kyc_status === "pending"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-white/5 text-slate-400"
                      }`}>
                        {formatKycStatus(detail.kyc_status).toUpperCase()}
                      </span>
                    }
                  />
                </div>

                {readOnly ? null : detail.account_blocked ? (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 space-y-2 mt-3">
                    <div className="text-xs text-rose-200 font-medium flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                      Conta bloqueada por ordem judicial
                    </div>
                    <button
                      onClick={() =>
                        askConfirm({
                          title: "Desbloquear conta",
                          description: "Deseja realmente desbloquear a conta deste cliente? O acesso será restaurado imediatamente.",
                          confirmLabel: "Desbloquear",
                          variant: "default",
                          onConfirm: async () => {
                            try {
                              await unblockAccountFn({ data: { user_id: userId } });
                              const d = await fetchDetail({ data: { user_id: userId } });
                              setDetail(d);
                            } catch (e: any) {
                              window.alert(e?.message ?? "Falha ao desbloquear conta.");
                            }
                          },
                        })
                      }
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition text-xs font-semibold"
                    >
                      <Unlock className="w-3.5 h-3.5" /> DESBLOQUEAR CONTA
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#292929] bg-[#111111] p-3 space-y-2 mt-3">
                    <div className="text-xs text-slate-300 font-medium flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      Status da conta: ativa
                    </div>
                    <button
                      onClick={() =>
                        askConfirm({
                          title: "Bloquear conta do cliente",
                          description: "O cliente verá um aviso permanente ao entrar e não poderá movimentar a conta. Esta ação pode ser revertida posteriormente.",
                          confirmLabel: "Bloquear conta",
                          variant: "danger",
                          onConfirm: async () => {
                            try {
                              await blockAccountFn({ data: { user_id: userId } });
                              const d = await fetchDetail({ data: { user_id: userId } });
                              setDetail(d);
                            } catch (e: any) {
                              window.alert(e?.message ?? "Falha ao bloquear conta.");
                            }
                          },
                        })
                      }
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition text-xs font-semibold"
                    >
                      <Lock className="w-3.5 h-3.5" /> BLOQUEAR CONTA
                    </button>
                  </div>
                )}

                {level === "master" && (
                  <div className={`rounded-lg border p-3 space-y-2 mt-3 ${detail.transfer_locked ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
                    <div className="text-xs text-slate-200 font-medium flex items-center gap-2">
                      {detail.transfer_locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-400" />}
                      Cadeado de transferências: {detail.transfer_locked ? "FECHADO" : "ABERTO"}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {detail.transfer_locked
                        ? "Ao tentar uma transferência, o cliente verá um aviso pedindo um depósito de 2,5% do saldo da conta."
                        : "O cliente poderá realizar transferências normalmente, sem aviso de depósito."}
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await setTransferLockFn({ data: { user_id: userId, locked: !detail.transfer_locked } });
                          const d = await fetchDetail({ data: { user_id: userId } });
                          setDetail(d);
                        } catch (e: any) {
                          window.alert(e?.message ?? "Falha ao alterar o cadeado.");
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-xs font-semibold ${detail.transfer_locked ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"}`}
                    >
                      {detail.transfer_locked ? <><Unlock className="w-3.5 h-3.5" /> ABRIR CADEADO</> : <><Lock className="w-3.5 h-3.5" /> FECHAR CADEADO</>}
                    </button>
                  </div>
                )}

                {canReassign && (
                  <div className="rounded-lg border border-[#292929] bg-[#111111] p-3 space-y-2 mt-3">
                    <div className="text-xs text-[#F5F5F5] font-medium flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5 text-[#C6A667]" />
                      Transferir cliente para outro ADM
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      O cliente sai completamente da base do admin atual e passa para o ADM
                      selecionado, levando todas as anotações, o KYC e o histórico.
                    </p>
                    <select
                      value={assignTarget}
                      onChange={(e) => setAssignTarget(e.target.value)}
                      className="w-full rounded-lg border border-[#292929] bg-[#1C1C1C] px-3 py-2 text-xs text-[#F5F5F5] focus:border-[#C6A667]/50"
                    >
                      <option value="">Selecione um ADM…</option>
                      {assignAdmins.map((a) => (
                        <option key={a.user_id} value={a.user_id}>
                          [{a.level === "master" ? "MASTER" : a.level === "geral" ? "GERAL" : "COMUM"}]{" "}
                          {a.full_name ?? a.email ?? a.user_id}
                          {a.referral_code ? ` (${a.referral_code})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!assignTarget || assignBusy}
                      onClick={() => {
                        const dest = assignAdmins.find((a) => a.user_id === assignTarget);
                        askConfirm({
                          title: "Transferir cliente",
                          description: `Mover este cliente para ${dest?.full_name ?? dest?.email ?? "o admin selecionado"}? Ele sairá da base do admin atual.`,
                          confirmLabel: "Transferir",
                          onConfirm: async () => {
                            setAssignBusy(true);
                            try {
                              await reassignFn({ data: { user_id: userId, admin_id: assignTarget } });
                              const [d, n] = await Promise.all([
                                fetchDetail({ data: { user_id: userId } }),
                                fetchNotes({ data: { user_id: userId } }),
                              ]);
                              setDetail(d);
                              setNotes(n.notes);
                              setAssignTarget("");
                            } catch (e: any) {
                              window.alert(e?.message ?? "Falha ao transferir cliente.");
                            } finally {
                              setAssignBusy(false);
                            }
                          },
                        });
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 hover:bg-[#252525] hover:border-[#C6A667] transition text-xs font-semibold disabled:opacity-40"
                    >
                      {assignBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserIcon className="w-3.5 h-3.5" />}
                      TRANSFERIR CLIENTE
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Banking Details */}
              <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">
                    <Landmark className="w-4 h-4 text-[#C6A667]" />
                    <span className="text-[#F5F5F5]">Banking Details</span>
                  </div>
                  {!readOnly && !editingBanking && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditBanking(); }}
                      className="w-6 h-6 grid place-items-center rounded-md text-[#999999] hover:text-[#C6A667] hover:bg-[#1C1C1C] transition cursor-pointer"
                      title="Editar dados bancários"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {editingBanking ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSaveBanking(); }}
                    className="space-y-3 pt-1 text-xs"
                  >
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Account holder</label>
                      <input
                        type="text"
                        value={bankingDraft.holder_name}
                        onChange={(e) => setBankingDraft((p) => ({ ...p, holder_name: e.target.value }))}
                        placeholder="Nome do titular"
                        className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Sort Code</label>
                        <input
                          type="text"
                          value={bankingDraft.sort_code}
                          onChange={(e) => setBankingDraft((p) => ({ ...p, sort_code: e.target.value }))}
                          placeholder="10-80-00"
                          className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Account Number</label>
                        <input
                          type="text"
                          value={bankingDraft.account_number}
                          onChange={(e) => setBankingDraft((p) => ({ ...p, account_number: e.target.value }))}
                          placeholder="8 dígitos"
                          className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-400 block">IBAN</label>
                        <button
                          type="button"
                          onClick={() => {
                            const gen = generateUkIban(bankingDraft.sort_code, bankingDraft.account_number);
                            setBankingDraft((p) => ({ ...p, iban: gen }));
                          }}
                          className="text-[10px] text-[#C6A667] hover:underline cursor-pointer"
                        >
                          Gerar IBAN B Bank
                        </button>
                      </div>
                      <input
                        type="text"
                        value={bankingDraft.iban}
                        onChange={(e) => setBankingDraft((p) => ({ ...p, iban: e.target.value.toUpperCase() }))}
                        placeholder="GB..."
                        className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] text-slate-400 block">SWIFT / BIC</label>
                          <button
                            type="button"
                            onClick={() => setBankingDraft((p) => ({ ...p, swift: "BBANGB2L" }))}
                            className="text-[10px] text-[#C6A667] hover:underline cursor-pointer"
                          >
                            Padrão
                          </button>
                        </div>
                        <input
                          type="text"
                          value={bankingDraft.swift}
                          onChange={(e) => setBankingDraft((p) => ({ ...p, swift: e.target.value.toUpperCase() }))}
                          placeholder="BBANGB2L"
                          className="w-full bg-[#1C1C1C] border border-[#292929] focus:border-[#C6A667]/50 text-[#F5F5F5] rounded-md px-2.5 py-1.5 text-xs outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Moeda (Currency)</label>
                        <input
                          type="text"
                          value={detail?.currency && detail.currency !== "GBP" ? `${detail.currency} (Inconsistência cadastral)` : "GBP (£) — Padrão B Bank"}
                          disabled
                          readOnly
                          className="w-full bg-[#141414] border border-[#292929] text-slate-300 rounded-md px-2.5 py-1.5 text-xs outline-none cursor-not-allowed font-mono"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          {detail?.currency && detail.currency !== "GBP"
                            ? `Conta legada com moeda ${detail.currency}. Requer aprovação de regularização.`
                            : "Todas as contas B Bank operam exclusivamente em GBP (£)."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#292929]">
                      <button
                        type="button"
                        onClick={() => setEditingBanking(false)}
                        disabled={savingBanking}
                        className="px-3 py-1.5 rounded-md border border-[#292929] text-[#999999] hover:text-[#F5F5F5] hover:bg-[#1C1C1C] text-xs cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="submit"
                        disabled={savingBanking}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1C1C1C] border border-[#C6A667]/50 hover:bg-[#252525] text-[#F5F5F5] text-xs font-semibold cursor-pointer"
                      >
                        {savingBanking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {t.save}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-1">
                    <DeskRow label="Account holder" value={displayHolder} />
                    <DeskRow
                      label="Sort Code"
                      value={displaySortCode}
                      mono
                      badge={
                        <button
                          type="button"
                          onClick={() => handleCopy("sortCode", displaySortCode)}
                          className="p-1 rounded text-[#999999] hover:text-[#F5F5F5] hover:bg-[#1C1C1C] transition cursor-pointer"
                          title="Copiar Sort Code"
                        >
                          {copiedKey === "sortCode" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      }
                    />
                    <DeskRow
                      label="Account number"
                      value={displayAccountNumber}
                      mono
                      badge={
                        <button
                          type="button"
                          onClick={() => handleCopy("accNumber", displayAccountNumber)}
                          className="p-1 rounded text-[#999999] hover:text-[#F5F5F5] hover:bg-[#1C1C1C] transition cursor-pointer"
                          title="Copiar Account number"
                        >
                          {copiedKey === "accNumber" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      }
                    />
                    <DeskRow
                      label="IBAN"
                      value={displayIban}
                      mono
                      badge={
                        <button
                          type="button"
                          onClick={() => handleCopy("iban", (bankingCreds.iban || detail.iban || "").replace(/\s+/g, ""))}
                          className="p-1 rounded text-[#999999] hover:text-[#F5F5F5] hover:bg-[#1C1C1C] transition cursor-pointer"
                          title="Copiar IBAN"
                        >
                          {copiedKey === "iban" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      }
                    />
                    <DeskRow
                      label="SWIFT / BIC"
                      value={displaySwift}
                      mono
                      badge={
                        <button
                          type="button"
                          onClick={() => handleCopy("swift", displaySwift)}
                          className="p-1 rounded text-[#999999] hover:text-[#F5F5F5] hover:bg-[#1C1C1C] transition cursor-pointer"
                          title="Copiar SWIFT / BIC"
                        >
                          {copiedKey === "swift" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      }
                    />
                    <DeskRow
                      label="Bank / Institution"
                      value="B Bank S.A."
                      subtext="Av. Paulista, 1000 - São Paulo, SP"
                    />
                    <DeskRow
                      label="Currency"
                      value={detail.currency && detail.currency !== "GBP" ? `${detail.currency} (Inconsistência cadastral)` : "GBP (£)"}
                      subtext={detail.currency && detail.currency !== "GBP" ? "Conta legada registrada fora do padrão britânico. Requer aprovação de regularização." : "British Pound Sterling"}
                    />
                    <div className="pt-2 border-t border-[#292929]">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-slate-400 font-medium">Current balance</div>
                          {editingBalance ? (
                            <div className="mt-1 flex items-center gap-2">
                              <div className="flex items-center gap-1 bg-[#1C1C1C] border border-[#C6A667]/50 rounded-md px-2 py-1">
                                <span className="text-xs text-slate-400">{currencySymbol}</span>
                                <input
                                  autoFocus
                                  inputMode="numeric"
                                  value={balanceDraft}
                                  onChange={(e) => handleBalanceInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); submitBalance(); }
                                    if (e.key === "Escape") { e.preventDefault(); setEditingBalance(false); }
                                  }}
                                  placeholder="00.00"
                                  className="w-28 bg-transparent text-sm font-mono outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); submitBalance(); }}
                                disabled={savingBalance}
                                className="w-7 h-7 grid place-items-center rounded-md bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 hover:bg-[#252525] disabled:opacity-50 cursor-pointer"
                                title={t.save}
                              >
                                {savingBalance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingBalance(false); }}
                                disabled={savingBalance}
                                className="w-7 h-7 grid place-items-center rounded-md bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] border border-[#292929] cursor-pointer"
                                title={t.cancel}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-lg font-semibold text-slate-100 tabular-nums">
                                {currencySymbol}{formatMoney(detail.balance)}
                              </span>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditBalance(); }}
                                  className="w-6 h-6 grid place-items-center rounded-md text-[#999999] hover:text-[#C6A667] hover:bg-[#1C1C1C] transition cursor-pointer"
                                  title={t.editData}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Verification Details */}
              <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-[#C6A667]" />
                    <span className="text-[#F5F5F5]">Verification Details</span>
                  </div>
                  <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                    detail.kyc_status === "approved"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : detail.kyc_status === "rejected"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : detail.kyc_status === "pending"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-white/5 text-slate-400"
                  }`}>
                    {formatKycStatus(detail.kyc_status).toUpperCase()}
                  </span>
                </div>
                <div className="space-y-1">
                  <DeskRow label="KYC status" value={formatKycStatus(detail.kyc_status)} />
                  <DeskRow
                    label="Submission date"
                    value={
                      detail.kyc_submission?.submitted_at
                        ? formatDisplayDateTime(detail.kyc_submission.submitted_at)
                        : detail.kyc_status === "not_started"
                        ? "Not submitted"
                        : "Not recorded"
                    }
                  />
                  <DeskRow
                    label="Approval / rejection info"
                    value={
                      detail.kyc_submission?.reviewed_at
                        ? `${detail.kyc_status === "approved" ? "Approved" : "Reviewed"} on ${formatDisplayDateTime(detail.kyc_submission.reviewed_at)}${
                            detail.kyc_submission.reviewed_by_name ? ` by ${detail.kyc_submission.reviewed_by_name}` : ""
                          }`
                        : detail.kyc_status === "approved"
                        ? "Approved (Historical)"
                        : detail.kyc_status === "rejected"
                        ? "Rejected (Historical)"
                        : detail.kyc_status === "pending"
                        ? "Pending review"
                        : "Pending"
                    }
                  />
                  <DeskRow
                    label="Rejection reason"
                    value={
                      detail.kyc_submission?.rejection_reason ||
                      (detail.kyc_status === "rejected" ? "No specific reason provided" : "None")
                    }
                  />
                  <DeskRow
                    label="Rejected parts"
                    value={
                      detail.kyc_submission?.rejected_parts && detail.kyc_submission.rejected_parts.length > 0
                        ? detail.kyc_submission.rejected_parts.map(formatKycPart).join(", ")
                        : "None"
                    }
                  />
                </div>
              </div>

              {/* Password & Security */}
              <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold border-b border-[#292929] pb-3">
                  <Key className="w-4 h-4 text-[#C6A667]" />
                  <span className="text-[#F5F5F5]">Password & Security</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-400">Password</div>
                    {editingPassword ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            autoFocus
                            type={showAdminPasswordDraft ? "text" : "password"}
                            value={passwordDraft}
                            onChange={(e) => setPasswordDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); submitPassword(); }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingPassword(false);
                                setPasswordDraft("");
                                setShowAdminPasswordDraft(false);
                              }
                            }}
                            placeholder="Nova senha"
                            className="w-full bg-[#1C1C1C] border border-[#C6A667]/50 text-[#F5F5F5] rounded-md pl-2 pr-8 py-1.5 text-sm outline-none font-mono"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowAdminPasswordDraft((v) => !v);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                            aria-label={showAdminPasswordDraft ? "Ocultar senha" : "Ver senha"}
                          >
                            {showAdminPasswordDraft ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); submitPassword(); }}
                          disabled={savingPassword}
                          className="w-8 h-8 grid place-items-center rounded-md bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 hover:bg-[#252525] disabled:opacity-50"
                          title="Salvar"
                        >
                          {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingPassword(false);
                            setPasswordDraft("");
                            setShowAdminPasswordDraft(false);
                          }}
                          disabled={savingPassword}
                          className="w-8 h-8 grid place-items-center rounded-md bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] border border-[#292929]"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="font-mono text-slate-300">••••••••</div>
                        {!readOnly && (level === "master" || (detail?.role === "user" && userId !== user?.id)) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingPassword(true);
                              setPasswordDraft("");
                              setShowAdminPasswordDraft(false);
                            }}
                            className="w-6 h-6 grid place-items-center rounded-md text-[#999999] hover:text-[#C6A667] hover:bg-[#1C1C1C] transition"
                            title="Alterar senha"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Danger Zone (Master only) */}
              {level === "master" && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-3">
                  <div className="text-xs text-rose-200 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Zona de perigo — exclusão permanente
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Excluir a conta apaga o usuário, saldo e todos os dados associados. Esta ação é irreversível.
                  </p>
                  <button
                    onClick={() =>
                      askConfirm({
                        title: "Excluir conta do cliente",
                        description: "Tem certeza? Esta ação é PERMANENTE e não pode ser desfeita. Todos os dados, saldo e histórico serão removidos.",
                        confirmLabel: "Excluir definitivamente",
                        variant: "danger",
                        onConfirm: async () => {
                          try {
                            await deleteUserFn({ data: { user_id: userId } });
                            navigate({ to: "/admin" });
                          } catch (e: any) {
                            window.alert(e?.message ?? "Falha ao excluir conta.");
                          }
                        },
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-600/20 text-rose-200 hover:bg-rose-600/30 transition text-xs font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> EXCLUIR CONTA
                  </button>
                </div>
              )}


              {activity && (
                <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{t.accessActivity}</div>
                  <Row Icon={Globe} label={t.signupIp} value={activity.signup_ip ?? t.none} />
                  <Row
                    Icon={LogIn}
                    label={t.lastLogin}
                    value={
                      activity.last_sign_in_at
                        ? `${t.ptBrDate(activity.last_sign_in_at)}${activity.last_sign_in_ip ? ` · ${activity.last_sign_in_ip}` : ""}`
                        : t.none
                    }
                  />
                  <Row Icon={ShieldCheck} label={t.provider} value={activity.provider ?? "email"} />
                  <div>
                    <div className="text-xs text-slate-400 mb-2">{t.historyCount(Array.isArray(activity.entries) ? activity.entries.length : 0)}</div>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-[#292929] divide-y divide-[#292929] bg-[#111111]">
                      {(!Array.isArray(activity.entries) || activity.entries.length === 0) && (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">{t.noRecords}</div>
                      )}
                      {(Array.isArray(activity.entries) ? activity.entries : []).slice(0, 50).map((e, i) => (
                        <div key={i} className="px-3 py-2 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-medium text-slate-200">{e.action ?? t.none}</div>
                            <div className="text-slate-500">{t.ptBrDate(e.created_at)}</div>
                          </div>
                          <div className="font-mono text-slate-400">{e.ip_address ?? t.none}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* KYC review */}
              <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{t.kycVerification}</div>
                  {kyc && (
                    <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                      kyc.status === "approved" ? "bg-emerald-500/20 text-emerald-300" :
                      kyc.status === "rejected" ? "bg-red-500/20 text-red-300" :
                      "bg-amber-500/20 text-amber-300"
                    }`}>{String(kyc.status ?? "pending").toUpperCase()}</span>
                  )}
                </div>
                {!kyc ? (
                  <div className="text-sm text-slate-400">{t.noKycYet}</div>
                ) : (
                  <>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          const items: Array<{ url: string; name: string }> = [];
                          if (kyc.statement1_url) items.push({ url: kyc.statement1_url, name: `statement-1` });
                          if (kyc.statement2_url) items.push({ url: kyc.statement2_url, name: `statement-2` });
                          (Array.isArray(kyc.liveness_urls) ? kyc.liveness_urls : []).forEach((u, i) => items.push({ url: u, name: `liveness-${i + 1}` }));
                          for (const it of items) {
                            try {
                              const r = await fetch(it.url);
                              const blob = await r.blob();
                              const ext = (blob.type.split("/")[1] || "bin").split(";")[0];
                              const a = document.createElement("a");
                              a.href = URL.createObjectURL(blob);
                              a.download = `${it.name}.${ext}`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                            } catch {}
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#C6A667]/50 text-[#F5F5F5] text-xs font-medium"
                      >
                        <Download className="w-3.5 h-3.5" /> {t.downloadAll}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-slate-400">{t.bankStatements}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {kyc.statement1_url && (
                          <div className="flex items-center gap-1">
                            <a href={kyc.statement1_url} target="_blank" rel="noreferrer" className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-[#F5F5F5] text-sm">
                              <FileText className="w-4 h-4 text-[#C6A667]" /> {t.statement1}
                            </a>
                            <a href={kyc.statement1_url} download="statement-1" target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-[#999999] hover:text-[#F5F5F5]" title={t.download}>
                              <Download className="w-4 h-4 text-slate-300" />
                            </a>
                          </div>
                        )}
                        {kyc.statement2_url && (
                          <div className="flex items-center gap-1">
                            <a href={kyc.statement2_url} target="_blank" rel="noreferrer" className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-[#F5F5F5] text-sm">
                              <FileText className="w-4 h-4 text-[#C6A667]" /> {t.statement2}
                            </a>
                            <a href={kyc.statement2_url} download="statement-2" target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-[#999999] hover:text-[#F5F5F5]" title={t.download}>
                              <Download className="w-4 h-4 text-slate-300" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-slate-400 flex items-center gap-1"><Camera className="w-3 h-3" /> {t.livenessProof} ({Array.isArray(kyc.liveness_urls) ? kyc.liveness_urls.length : 0})</div>
                      <div className="grid grid-cols-4 gap-2">
                        {(Array.isArray(kyc.liveness_urls) ? kyc.liveness_urls : []).map((url, i) => (
                          <div key={i} className="relative group">
                            <a href={url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-black/40 hover:ring-2 ring-[#C6A667]/60">
                              <img src={url} alt={`liveness-${i}`} className="w-full h-full object-cover scale-x-[-1]" />
                            </a>
                            <a href={url} download={`liveness-${i + 1}`} target="_blank" rel="noreferrer" className="absolute top-1 right-1 p-1.5 rounded-md bg-black/70 hover:bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity" title={t.download}>
                              <Download className="w-3 h-3 text-white" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                    {kyc.rejection_reason && (
                      <div className="text-xs p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 flex gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {kyc.rejection_reason}
                      </div>
                    )}
                    {(kyc.status === "pending" || kyc.status === "rejected") && readOnly && (
                      <div className="text-xs p-3 rounded-lg bg-white/5 border border-white/10 text-slate-300">
                        Perfil somente leitura: apenas visualização do KYC. Use "Transferir cliente" para mover para outro ADM.
                      </div>
                    )}
                    {(kyc.status === "pending" || kyc.status === "rejected") && !readOnly && (
                      <div className="space-y-2 pt-2 border-t border-[#292929]">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Account holder name</label>
                          <input
                            value={holderNameInput}
                            onChange={(e) => setHolderNameInput(e.target.value)}
                            placeholder="Full name"
                            maxLength={160}
                            className="w-full bg-[#1C1C1C] border border-[#292929] text-[#F5F5F5] rounded-lg p-2 text-sm placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">IBAN</label>
                          <input
                            value={ibanInput}
                            onChange={(e) => setIbanInput(e.target.value.toUpperCase())}
                            placeholder={t.ibanPlaceholder}
                            maxLength={42}
                            className="w-full bg-[#1C1C1C] border border-[#292929] text-[#F5F5F5] rounded-lg p-2 text-sm font-mono placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">SWIFT / BIC</label>
                          <input
                            value={swiftInput}
                            onChange={(e) => setSwiftInput(e.target.value.toUpperCase())}
                            placeholder="BBANGB2L"
                            maxLength={11}
                            className="w-full bg-[#1C1C1C] border border-[#292929] text-[#F5F5F5] rounded-lg p-2 text-sm font-mono placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50"
                          />
                        </div>
                        {approveError && (
                          <div className="text-[11px] text-amber-300">{approveError}</div>
                        )}
                        {showRejectBox && (
                          <div className="space-y-2 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                            <div className="text-xs font-semibold text-red-200">Selecione o que o cliente deve refazer:</div>
                            <div className="grid grid-cols-1 gap-1.5">
                              {([
                                { k: "statement1" as KycPart, label: "Extrato bancário — mês 1" },
                                { k: "statement2" as KycPart, label: "Extrato bancário — mês 2" },
                                { k: "document" as KycPart, label: "Foto do documento" },
                                { k: "liveness" as KycPart, label: "Vídeo de prova de vida" },
                              ]).map((p) => {
                                const checked = rejectedParts.includes(p.k);
                                return (
                                  <label key={p.k} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        setRejectedParts((prev) =>
                                          e.target.checked ? [...prev, p.k] : prev.filter((x) => x !== p.k),
                                        );
                                      }}
                                      className="accent-red-500"
                                    />
                                    {p.label}
                                  </label>
                                );
                              })}
                            </div>
                            <label className="flex items-start gap-2 text-xs text-amber-200 cursor-pointer p-2 rounded-lg border border-amber-400/30 bg-amber-400/5">
                              <input
                                type="checkbox"
                                checked={rejectedParts.includes("profile" as KycPart)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setRejectedParts(["statement1", "statement2", "document", "liveness", "profile"] as KycPart[]);
                                  } else {
                                    setRejectedParts((prev) => prev.filter((x) => x !== ("profile" as KycPart)));
                                  }
                                }}
                                className="accent-amber-400 mt-0.5"
                              />
                              <span>
                                <span className="font-semibold">Dados incompletos — refazer tudo do zero</span>
                                <span className="block text-[11px] text-amber-200/70">
                                  O cliente preencherá novamente nome, documento, telefone e nascimento, e reenviará todos os arquivos. Motivo obrigatório.
                                </span>
                              </span>
                            </label>
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder={rejectedParts.includes("profile" as KycPart) ? "Motivo (obrigatório) — será mostrado ao cliente" : "Motivo (opcional) — será mostrado ao cliente"}
                              rows={2}
                              className="w-full bg-[#1C1C1C] border border-[#292929] text-[#F5F5F5] rounded-lg p-2 text-sm placeholder:text-[#999999] focus:outline-none focus:border-rose-500/50 resize-none"
                            />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            disabled={kycBusy}
                            onClick={() => decideKyc("approved")}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-sm font-semibold disabled:opacity-50"
                          >
                            {kycBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t.approve}
                          </button>
                          <button
                            disabled={kycBusy}
                            onClick={() => decideKyc("rejected")}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-sm font-semibold disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" /> {t.refuse}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>


              {/* International transfers */}
              <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Transferências internacionais</div>
                  <span className="text-[10px] text-slate-500">{transfers.length}</span>
                </div>
                {transfers.length === 0 ? (
                  <div className="text-sm text-slate-400">Nenhuma transferência registrada.</div>
                ) : (
                  <div className="space-y-3">
                    {transfers.map((r) => (
                      <div key={r.id} className="rounded-xl border border-[#292929] bg-[#111111] p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${r.status === "solicitado" ? "bg-amber-500/15 text-amber-300" : r.status === "aprovado" ? "bg-emerald-500/15 text-emerald-300" : r.status === "bloqueado" ? "bg-rose-700/30 text-rose-200" : "bg-rose-500/15 text-rose-300"}`}>
                              {String(r.status ?? "solicitado").toUpperCase()}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedTransferDetailId(r.id)}
                              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-[#1C1C1C] text-[#F5F5F5] border border-[#292929] hover:border-[#C6A667]/50 hover:bg-[#252525] font-medium transition"
                            >
                              <Eye className="w-3 h-3" /> View details
                            </button>
                          </div>
                          <span className="text-[11px] text-slate-500">{new Date(r.created_at).toLocaleString("en-GB")}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                          <div><div className="text-slate-500">Beneficiário</div><div className="text-slate-200 font-medium truncate">{r.beneficiary_name}</div></div>
                          <div><div className="text-slate-500">Banco · SWIFT</div><div className="text-slate-200 truncate">{r.bank_name} · {r.swift}</div></div>
                          <div><div className="text-slate-500">Conta</div><div className="text-slate-200 font-mono truncate">{r.account_number}</div></div>
                          <div><div className="text-slate-500">País</div><div className="text-slate-200">{r.to_country}</div></div>
                          <div><div className="text-slate-500">Valor</div><div className="text-slate-200 font-semibold">{r.currency_from || "GBP"} {r.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</div></div>
                          <div><div className="text-slate-500">Convertido</div><div className="text-slate-200 font-semibold">{r.currency_to || "GBP"} {r.converted_amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</div></div>
                        </div>
                        {r.hmrc_doc_url ? (
                          <a href={r.hmrc_doc_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-[#1C1C1C] text-[#C6A667] border border-[#C6A667]/30 hover:bg-[#252525] transition w-fit">
                            <FileText className="w-3.5 h-3.5" /> Ver documento anexado
                          </a>
                        ) : null}
                        {r.status === "recusado" && r.rejection_reason && (
                          <div className="text-[11px] rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 px-2.5 py-1.5">
                            <span className="font-semibold">Motivo:</span> {r.rejection_reason}
                          </div>
                        )}
                        {r.status === "solicitado" && !readOnly && (
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <button
                              disabled={transferBusy === r.id}
                              onClick={() => handleTransferAction(r.id, "aprovado")}
                              className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition text-[11px] font-semibold disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" /> ACEITAR
                            </button>
                            <button
                              disabled={transferBusy === r.id}
                              onClick={() => handleTransferAction(r.id, "recusado")}
                              className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition text-[11px] font-semibold disabled:opacity-50"
                            >
                              <X className="w-3 h-3" /> RECUSAR
                            </button>
                            <button
                              disabled={transferBusy === r.id}
                              onClick={() => handleTransferAction(r.id, "bloqueado")}
                              className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600/35 transition text-[11px] font-semibold disabled:opacity-50 border border-rose-500/30"
                            >
                              <Shield className="w-3 h-3" /> BLOQUEAR
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>


            {/* Right: Notes / CRM panel */}
            <section className="rounded-2xl border border-[#292929] bg-[#141414] flex flex-col min-h-[600px]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#1C1C1C] border border-[#292929] text-[#C6A667] grid place-items-center">
                    <StickyNote className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{t.internalNotes}</h2>
                    <p className="text-xs text-slate-400">{t.notesPermanent} · {t.notesCount(notes.length)}</p>
                  </div>
                </div>
                {!composerOpen && !readOnly && (
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 hover:bg-[#252525] hover:border-[#C6A667] transition text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" /> {t.addNote}
                  </button>
                )}
              </div>

              {composerOpen && (
                <div className="px-6 py-4 border-b border-[#292929] bg-[#111111]">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t.notePlaceholder}
                    rows={4}
                    autoFocus
                    className="w-full bg-[#1C1C1C] border border-[#292929] text-[#F5F5F5] rounded-lg p-3 text-sm placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50 resize-none"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-xs text-slate-500">{draft.length}/5000</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setComposerOpen(false); setDraft(""); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-400 hover:bg-white/5 transition text-sm"
                      >
                        <X className="w-3.5 h-3.5" /> {t.cancel}
                      </button>
                      <button
                        disabled={submitting || !draft.trim()}
                        onClick={submitNote}
                        className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 hover:bg-[#252525] hover:border-[#C6A667] transition text-sm font-medium disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        {t.sendNote}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-[calc(100vh-260px)]">
                {notes.length === 0 ? (
                  <div className="h-full grid place-items-center text-center py-16">
                    <div>
                      <div className="w-14 h-14 rounded-full bg-white/5 grid place-items-center mx-auto mb-4">
                        <StickyNote className="w-6 h-6 text-slate-500" />
                      </div>
                      <h3 className="font-semibold mb-1">{t.noNotesYet}</h3>
                      <p className="text-sm text-slate-400 max-w-xs">{t.notesEmptyDesc}</p>
                    </div>
                  </div>
                ) : (
                  notes.map((n) => (
                    <article
                      key={n.id}
                      className="rounded-xl border border-[#292929] bg-[#111111] p-4 hover:border-[#C6A667]/30 transition"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-6 h-6 rounded-full bg-[#1C1C1C] border border-[#292929] text-[#C6A667] grid place-items-center">
                            <Shield className="w-3 h-3" />
                          </div>
                          <span className="font-medium text-slate-200">{n.author_name ?? "Admin"}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-500">{t.ptBrDate(n.created_at)}</span>
                        </div>
                        <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-slate-500 shrink-0">
                          {t.immutable}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{n.content}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      <AlertDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
      >
        <AlertDialogContent className="border-[#292929] bg-[#111111] text-[#F5F5F5]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmState.variant === "danger" ? (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              ) : (
                <Shield className="w-5 h-5 text-emerald-400" />
              )}
              {confirmState.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 leading-relaxed">
              {confirmState.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#292929] bg-[#1C1C1C] text-[#999999] hover:bg-[#252525] hover:text-[#F5F5F5]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await confirmState.onConfirm();
              }}
              className={
                confirmState.variant === "danger"
                  ? "bg-rose-500 text-white hover:bg-rose-600"
                  : "bg-emerald-500 text-white hover:bg-emerald-600"
              }
            >
              {confirmState.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminTransferDetailModal
        transferId={selectedTransferDetailId}
        onClose={() => setSelectedTransferDetailId(null)}
      />
    </div>
  );
}

function Row({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-[#141414] border border-[#292929] grid place-items-center text-[#C6A667] shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#999999]">{label}</div>
        <div className="font-medium text-[#F5F5F5] break-all">{value}</div>
      </div>
    </div>
  );
}

function DeskRow({
  label,
  value,
  subtext,
  badge,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  badge?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[#292929]/50 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-[#999999] font-medium">{label}</div>
        <div className={`text-sm font-medium text-[#F5F5F5] break-words mt-0.5 ${mono ? "font-mono" : ""}`}>
          {value}
        </div>
        {subtext && <div className="text-[10px] text-[#999999] mt-0.5">{subtext}</div>}
      </div>
      {badge && <div className="shrink-0 pt-0.5">{badge}</div>}
    </div>
  );
}

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not provided";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDisplayDateTime(dateStr: string | null | undefined): string {
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

function formatDocType(docType: string | null | undefined): string {
  if (!docType) return "Not provided";
  switch (docType.toLowerCase()) {
    case "cpf": return "CPF";
    case "passport": return "Passport";
    case "nif": return "NIF";
    case "dni": return "DNI";
    case "ssn": return "SSN";
    case "other": return "Other official ID";
    default: return docType.toUpperCase();
  }
}

function formatKycStatus(status: string | null | undefined): string {
  if (!status) return "Not submitted";
  switch (status.toLowerCase()) {
    case "approved": return "Approved";
    case "pending": return "Pending review";
    case "rejected": return "Rejected";
    case "not_started": return "Not submitted";
    default: return status.toUpperCase();
  }
}

function formatKycPart(part: string): string {
  switch (part) {
    case "statement1": return "Bank statement (Month 1)";
    case "statement2": return "Bank statement (Month 2)";
    case "document": return "Identity document";
    case "liveness": return "Liveness verification";
    case "profile": return "Personal profile data";
    default: return part;
  }
}
