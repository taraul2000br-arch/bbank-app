import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, X, Check, Clock, Users } from "lucide-react";
import { listAdminPlans, upsertAdminPlan, deleteAdminPlan, bulkUpsertAdminPlans, type AdminPlanRow } from "@/lib/admin-plans.functions";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function toDDMMYYYY(iso: string | null): string {
  const d = iso ? new Date(iso) : (() => { const x = new Date(); x.setDate(x.getDate() + 30); return x; })();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}
function parseDDMMYYYY(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 23, 59, 0);
  if (isNaN(d.getTime()) || d.getDate() !== Number(dd) || d.getMonth() !== Number(mm) - 1) return null;
  return d;
}
function maskDateInput(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 8);
  let out = digits;
  if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return out;
}


export function AdminPlansTab() {
  const fetchRows = useServerFn(listAdminPlans);
  const upsertFn = useServerFn(upsertAdminPlan);
  const deleteFn = useServerFn(deleteAdminPlan);
  const bulkFn = useServerFn(bulkUpsertAdminPlans);
  const [rows, setRows] = useState<AdminPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminPlanRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchRows().then((r) => setRows(r.rows)).catch((e) => console.error("plans", e)).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#F5F5F5]">Planos dos Administradores</h1>
          <p className="text-sm text-[#999999] mt-1">Controle a validade do acesso ao painel para cada admin (geral e comum).</p>
        </div>
        <button
          onClick={() => setBulkOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 text-sm font-medium hover:bg-[#252525] hover:border-[#C6A667] transition shadow-md"
        >
          <Users className="w-4 h-4 text-[#C6A667]" /> Ajustar plano de todos
        </button>
      </div>


      <section className="rounded-xl border border-[#292929] bg-[#111111]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#999999] border-b border-[#292929]">
                <th className="px-6 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Nível</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Expira em</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-6 py-12 text-center text-[#999999]">Carregando…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-[#999999]">Nenhum administrador encontrado.</td></tr>}
              {rows.map((r) => {
                const d = daysLeft(r.expires_at);
                const status = r.expires_at == null
                  ? { label: "SEM PLANO", cls: "bg-[#1C1C1C] text-[#999999] border border-[#292929]" }
                  : d! < 0
                    ? { label: "EXPIRADO", cls: "bg-rose-500/15 text-rose-300 border border-rose-500/30" }
                    : d! <= 5
                      ? { label: `${d}D`, cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" }
                      : { label: "ATIVO", cls: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" };
                return (
                  <tr key={r.admin_user_id} className="border-b border-[#292929] hover:bg-[#161616] transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#F5F5F5]">{r.full_name ?? "—"}</div>
                      <div className="text-xs text-[#999999]">{r.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${r.level === "geral" ? "bg-violet-500/15 text-violet-300" : "bg-[#1C1C1C] text-[#999999] border border-[#292929]"}`}>
                        ADM {r.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#F5F5F5]">{r.plan_name ?? "—"}</td>
                    <td className="px-4 py-4 font-mono text-xs text-[#999999]">{fmtDate(r.expires_at)}</td>
                    <td className="px-4 py-4">
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditing(r)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#292929] hover:bg-[#252525] hover:border-[#3D3D3D] transition text-xs font-medium"
                        >
                          {r.plan_id ? <><Pencil className="w-3.5 h-3.5 text-[#C6A667]" /> Editar</> : <><Plus className="w-3.5 h-3.5 text-[#C6A667]" /> Definir</>}
                        </button>
                        {r.plan_id && (
                          <button
                            onClick={async () => {
                              if (!window.confirm("Remover o plano deste admin? Ele perderá acesso ao painel.")) return;
                              try { await deleteFn({ data: { admin_user_id: r.admin_user_id } }); reload(); }
                              catch (e: any) { window.alert(e?.message ?? "Falha ao remover plano"); }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition text-xs font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <PlanEditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={async (plan_name, expires_at, notes) => {
            await upsertFn({ data: { admin_user_id: editing.admin_user_id, plan_name, expires_at, notes } });
            setEditing(null);
            reload();
          }}
        />
      )}

      {bulkOpen && (
        <BulkPlanModal
          onClose={() => setBulkOpen(false)}
          onSave={async (plan_name, expires_at, notes, scope) => {
            const res = await bulkFn({ data: { plan_name, expires_at, notes, scope } });
            setBulkOpen(false);
            reload();
            window.alert(`Plano aplicado a ${res.count} administrador(es).`);
          }}
        />
      )}
    </>
  );
}

function PlanEditModal({
  row, onClose, onSave,
}: {
  row: AdminPlanRow;
  onClose: () => void;
  onSave: (plan_name: string, expires_at: string, notes: string | null) => Promise<void>;
}) {
  const [planName, setPlanName] = useState(row.plan_name ?? "Plano Mensal");
  const [expires, setExpires] = useState(toDDMMYYYY(row.expires_at));
  const [notes, setNotes] = useState(row.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setExpires(toDDMMYYYY(d.toISOString()));
  };

  const submit = async () => {
    setErr(null);
    if (planName.trim().length < 1) return setErr("Informe o nome do plano.");
    const parsed = parseDDMMYYYY(expires);
    if (!parsed) return setErr("Data inválida. Use dd/mm/aaaa.");
    const iso = parsed.toISOString();
    setSaving(true);
    try { await onSave(planName.trim(), iso, notes.trim() || null); }
    catch (e: any) { setErr(e?.message ?? "Falha ao salvar."); }
    finally { setSaving(false); }
  };


  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#292929] bg-[#111111] shadow-2xl text-[#F5F5F5]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#292929] bg-[#141414]">
          <div>
            <h3 className="font-semibold flex items-center gap-2 text-[#F5F5F5]"><Clock className="w-4 h-4 text-[#C6A667]" /> Plano do administrador</h3>
            <div className="text-xs text-[#999999] mt-0.5">{row.full_name ?? row.email ?? "—"}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#999999]">Nome do plano</label>
            <input value={planName} onChange={(e) => setPlanName(e.target.value)} maxLength={80}
              className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2.5 text-sm text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#999999]">Expira em</label>
            <input type="text" inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} value={expires} onChange={(e) => setExpires(maskDateInput(e.target.value))}
              className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2.5 text-sm font-mono text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50" />

            <div className="flex flex-wrap gap-2 pt-1">
              {[7, 15, 30, 60, 90, 180, 365].map((d) => (
                <button key={d} type="button" onClick={() => addDays(d)} className="text-[11px] px-2 py-1 rounded bg-[#1C1C1C] text-[#999999] border border-[#292929] hover:bg-[#252525] hover:text-[#F5F5F5] transition">
                  +{d}d
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#999999]">Observações (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3}
              className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2.5 text-sm text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50" />
          </div>
          {err && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#999999] border border-[#292929] hover:bg-[#1C1C1C] hover:text-[#F5F5F5] transition">Cancelar</button>
            <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 text-sm font-medium hover:bg-[#252525] hover:border-[#C6A667] transition disabled:opacity-50">
              <Check className="w-4 h-4 text-[#C6A667]" /> {saving ? "Salvando…" : "Salvar plano"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkPlanModal({
  onClose, onSave,
}: {
  onClose: () => void;
  onSave: (plan_name: string, expires_at: string, notes: string | null, scope: "all" | "geral" | "comum") => Promise<void>;
}) {
  const [planName, setPlanName] = useState("Plano Mensal");
  const [expires, setExpires] = useState(toDDMMYYYY(null));
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState<"all" | "geral" | "comum">("all");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setExpires(toDDMMYYYY(d.toISOString()));
  };

  const submit = async () => {
    setErr(null);
    if (planName.trim().length < 1) return setErr("Informe o nome do plano.");
    const parsed = parseDDMMYYYY(expires);
    if (!parsed) return setErr("Data inválida. Use dd/mm/aaaa.");
    const iso = parsed.toISOString();
    if (!window.confirm("Aplicar este plano a TODOS os administradores selecionados? Os planos existentes serão sobrescritos.")) return;
    setSaving(true);
    try { await onSave(planName.trim(), iso, notes.trim() || null, scope); }
    catch (e: any) { setErr(e?.message ?? "Falha ao salvar."); }
    finally { setSaving(false); }
  };


  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#292929] bg-[#111111] shadow-2xl text-[#F5F5F5]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#292929] bg-[#141414]">
          <div>
            <h3 className="font-semibold flex items-center gap-2 text-[#F5F5F5]"><Users className="w-4 h-4 text-[#C6A667]" /> Ajustar plano de todos</h3>
            <div className="text-xs text-[#999999] mt-0.5">Aplica o mesmo plano a vários administradores de uma vez.</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#999999]">Aplicar a</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "all", l: "Todos" },
                { v: "geral", l: "ADM Geral" },
                { v: "comum", l: "ADM Comum" },
              ] as const).map((o) => (
                <button key={o.v} type="button" onClick={() => setScope(o.v)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${scope === o.v ? "bg-[#141414] border-[#C6A667]/50 text-[#F5F5F5]" : "bg-[#1C1C1C] border-[#292929] text-[#999999] hover:text-[#F5F5F5]"}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#999999]">Nome do plano</label>
            <input value={planName} onChange={(e) => setPlanName(e.target.value)} maxLength={80}
              className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2.5 text-sm text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#999999]">Expira em</label>
            <input type="text" inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} value={expires} onChange={(e) => setExpires(maskDateInput(e.target.value))}
              className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2.5 text-sm font-mono text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50" />

            <div className="flex flex-wrap gap-2 pt-1">
              {[7, 15, 30, 60, 90, 180, 365].map((d) => (
                <button key={d} type="button" onClick={() => addDays(d)} className="text-[11px] px-2 py-1 rounded bg-[#1C1C1C] text-[#999999] border border-[#292929] hover:bg-[#252525] hover:text-[#F5F5F5] transition">
                  +{d}d
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#999999]">Observações (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3}
              className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2.5 text-sm text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50" />
          </div>
          {err && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#999999] border border-[#292929] hover:bg-[#1C1C1C] hover:text-[#F5F5F5] transition">Cancelar</button>
            <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 text-sm font-medium hover:bg-[#252525] hover:border-[#C6A667] transition disabled:opacity-50">
              <Check className="w-4 h-4 text-[#C6A667]" /> {saving ? "Aplicando…" : "Aplicar a todos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
