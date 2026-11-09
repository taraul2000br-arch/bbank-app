import { useEffect, useState } from "react";
import { ShieldOff, AlertTriangle, Clock, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getMyAdminPlan, type MyAdminPlan } from "@/lib/admin-plans.functions";

export function useAdminPlan(enabled: boolean) {
  const fetchPlan = useServerFn(getMyAdminPlan);
  const [plan, setPlan] = useState<MyAdminPlan>(null);
  const [loading, setLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchPlan()
      .then((p) => {
        if (cancelled) return;
        setPlan(p);
        setIsExpired(!p || new Date(p.expires_at).getTime() <= Date.now());
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPlan(null); setIsExpired(true); setLoading(false);
      });
    return () => { cancelled = true; };
  }, [enabled, fetchPlan]);

  useEffect(() => {
    if (!plan) return;
    const t = setInterval(() => {
      setIsExpired(new Date(plan.expires_at).getTime() <= Date.now());
    }, 60_000);
    return () => clearInterval(t);
  }, [plan]);

  return { plan, loading, isExpired };
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function AdminPlanExpiredScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#080808]/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-[#111111] border border-rose-500/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center">
              <ShieldOff className="w-12 h-12 text-rose-400" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <h1 className="text-2xl font-bold text-rose-400">Plano Expirado</h1>
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <p className="text-slate-400 text-sm">
              O seu plano de acesso ao painel administrativo expirou.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-slate-100 font-semibold text-base">
              Seu plano expirou, entre em contato com o suporte master para renovar o acesso.
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="w-full px-4 py-2.5 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 transition text-sm font-semibold"
          >
            Sair do sistema
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminCountdownBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const days = daysUntil(expiresAt);
  const isExpired = days < 0;
  const dateStr = new Date(expiresAt).toLocaleDateString("pt-BR");
  const cls = isExpired
    ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
    : days <= 5
    ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${cls}`}>
      <Clock className="w-3.5 h-3.5" />
      <span>{isExpired ? "Plano expirado" : `Expira em ${days}d (${dateStr})`}</span>
    </div>
  );
}

export function AdminCountdownPopup({ expiresAt }: { expiresAt: string | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!expiresAt) return;
    const d = daysUntil(expiresAt);
    if (d <= 5 && d >= 0) setShow(true);
  }, [expiresAt]);
  if (!show || !expiresAt) return null;
  const days = daysUntil(expiresAt);
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-[#141414] border border-[#292929] rounded-xl p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-300 text-sm">Plano prestes a expirar</p>
            <p className="text-xs text-slate-400 mt-1">
              Seu plano expira em {days} dia{days !== 1 ? "s" : ""}. Contate o master para renovar.
            </p>
          </div>
          <button onClick={() => setShow(false)} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
