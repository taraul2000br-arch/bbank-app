import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  RefreshCw,
  Mail,
  AlertCircle,
  CheckCircle2,
  Clock,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  Headphones,
  X,
  FileText,
  Filter,
  ArrowUpDown,
  Send,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import {
  listAdminSupportData,
  updateAdminContactRequest,
  updateAdminCustomerComplaint,
  type AdminContactRequestRow,
  type AdminCustomerComplaintRow,
  type ContactRequestStatus,
  type CustomerComplaintStatus,
} from "@/lib/admin-support.functions";
import { useI18n } from "@/lib/i18n";
import type { AdminLevel } from "@/lib/admin.functions";

const CATEGORY_LABELS: Record<string, string> = {
  transfers_payments: "Transfers & Faster Payments",
  account_management: "Account Operations & Settings",
  cards: "Account Operations & Settings",
  account_access: "Account Access & Auth",
  customer_service: "Customer Service",
  security_fraud: "Security & Fraud Reporting",
  fees_charges: "Fees & Operational Charges",
  other: "Other Inquiries",
};

interface AdminSupportTabProps {
  effectiveViewerLevel: AdminLevel | null;
  adminId?: string;
}

export function AdminSupportTab({ effectiveViewerLevel }: AdminSupportTabProps) {
  const { lang } = useI18n();
  const isPt = lang === "pt";

  const fetchSupportData = useServerFn(listAdminSupportData);
  const updateContactFn = useServerFn(updateAdminContactRequest);
  const updateComplaintFn = useServerFn(updateAdminCustomerComplaint);

  const [activeTab, setActiveTab] = useState<"contacts" | "complaints">("contacts");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contacts, setContacts] = useState<AdminContactRequestRow[]>([]);
  const [complaints, setComplaints] = useState<AdminCustomerComplaintRow[]>([]);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [contactStatusFilter, setContactStatusFilter] = useState<string>("all");
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Selected Detail Modal
  const [selectedContact, setSelectedContact] = useState<AdminContactRequestRow | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<AdminCustomerComplaintRow | null>(null);

  // Edit form state inside modal
  const [editContactStatus, setEditContactStatus] = useState<ContactRequestStatus>("received");
  const [editContactNotes, setEditContactNotes] = useState("");

  const [editComplaintStatus, setEditComplaintStatus] = useState<CustomerComplaintStatus>("pending");
  const [editComplaintNotes, setEditComplaintNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [copiedProtocol, setCopiedProtocol] = useState<string | null>(null);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetchSupportData();
      setContacts(res.contacts || []);
      setComplaints(res.complaints || []);
    } catch (e: any) {
      console.error("[AdminSupportTab] load error:", e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedProtocol(text);
    setTimeout(() => setCopiedProtocol(null), 2000);
  };

  // Open Contact modal
  const handleOpenContact = (item: AdminContactRequestRow) => {
    setSelectedContact(item);
    setEditContactStatus(item.status);
    setEditContactNotes(item.admin_notes || "");
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
  };

  // Open Complaint modal
  const handleOpenComplaint = (item: AdminCustomerComplaintRow) => {
    setSelectedComplaint(item);
    setEditComplaintStatus(item.status);
    setEditComplaintNotes(item.resolution_notes || "");
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
  };

  // Save Contact
  const handleSaveContact = async () => {
    if (!selectedContact) return;
    setSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const res = await updateContactFn({
        data: {
          id: selectedContact.id,
          status: editContactStatus,
          admin_notes: editContactNotes,
        },
      });

      if (res?.ok && res.contact) {
        setSaveSuccessMsg(
          isPt ? "Contacto atualizado com sucesso no PostgreSQL!" : "Contact request updated successfully in PostgreSQL!"
        );
        setSelectedContact(res.contact);
        // update list
        setContacts((prev) =>
          prev.map((c) => (c.id === res.contact.id ? res.contact : c))
        );
      }
    } catch (err: any) {
      console.error("Save contact failed:", err);
      setSaveErrorMsg(err?.message || (isPt ? "Erro ao salvar alterações no banco." : "Failed to save changes to database."));
    } finally {
      setSaving(false);
    }
  };

  // Save Complaint
  const handleSaveComplaint = async () => {
    if (!selectedComplaint) return;
    setSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const res = await updateComplaintFn({
        data: {
          id: selectedComplaint.id,
          status: editComplaintStatus,
          resolution_notes: editComplaintNotes,
        },
      });

      if (res?.ok && res.complaint) {
        setSaveSuccessMsg(
          isPt
            ? "Reclamação e notas de resolução salvas no PostgreSQL!"
            : "Complaint and resolution notes saved to PostgreSQL!"
        );
        setSelectedComplaint(res.complaint);
        // update list
        setComplaints((prev) =>
          prev.map((c) => (c.id === res.complaint.id ? res.complaint : c))
        );
      }
    } catch (err: any) {
      console.error("Save complaint failed:", err);
      setSaveErrorMsg(err?.message || (isPt ? "Erro ao salvar alterações no banco." : "Failed to save changes to database."));
    } finally {
      setSaving(false);
    }
  };

  // Filtered Contacts
  const filteredContacts = useMemo(() => {
    return contacts
      .filter((c) => {
        const matchesStatus =
          contactStatusFilter === "all" || c.status === contactStatusFilter;
        const q = search.trim().toLowerCase();
        const matchesSearch =
          q === "" ||
          c.protocol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
      });
  }, [contacts, contactStatusFilter, search, sortOrder]);

  // Filtered Complaints
  const filteredComplaints = useMemo(() => {
    return complaints
      .filter((c) => {
        const matchesStatus =
          complaintStatusFilter === "all" || c.status === complaintStatusFilter;
        const q = search.trim().toLowerCase();
        const matchesSearch =
          q === "" ||
          c.protocol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
      });
  }, [complaints, complaintStatusFilter, search, sortOrder]);

  // Quick stats
  const pendingComplaintsCount = complaints.filter(
    (c) => c.status === "pending" || c.status === "investigating"
  ).length;
  const openContactsCount = contacts.filter(
    (c) => c.status === "received" || c.status === "in_review"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isPt ? "Central de Atendimento" : "Support Centre"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isPt
              ? "Gerencie os pedidos de contacto, dúvidas e reclamações formais dos clientes."
              : "Manage customer contact inquiries, support tickets, and dispute complaints."}
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>{isPt ? "Atualizar Dados" : "Refresh Records"}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-[#292929] bg-[#141414]">
          <div className="flex items-center justify-between text-[#999999] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {isPt ? "Total de Contactos" : "Total Inquiries"}
            </span>
            <Mail className="w-4 h-4 text-[#C6A667]" />
          </div>
          <div className="text-2xl font-bold text-[#F5F5F5]">{contacts.length}</div>
          <p className="text-xs text-[#999999] mt-1">
            {openContactsCount} {isPt ? "aguardando resposta" : "awaiting review"}
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#292929] bg-[#141414]">
          <div className="flex items-center justify-between text-[#999999] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {isPt ? "Reclamações em Aberto" : "Active Complaints"}
            </span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">
            {pendingComplaintsCount}
          </div>
          <p className="text-xs text-[#999999] mt-1">
            {complaints.length} {isPt ? "disputas totais registradas" : "total disputes logged"}
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#292929] bg-[#141414]">
          <div className="flex items-center justify-between text-[#999999] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {isPt ? "Reclamações Resolvidas" : "Resolved Complaints"}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300">
            {complaints.filter((c) => c.status === "resolved").length}
          </div>
          <p className="text-xs text-[#999999] mt-1">
            {isPt ? "Com notas de resolução oficiais" : "With formal resolution notes"}
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#292929] bg-[#141414]">
          <div className="flex items-center justify-between text-[#999999] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {isPt ? "Segurança RLS" : "Security & Audit"}
            </span>
            <ShieldAlert className="w-4 h-4 text-[#C6A667]" />
          </div>
          <div className="text-2xl font-bold text-[#F5F5F5]">PostgreSQL</div>
          <p className="text-xs text-[#999999] mt-1">
            {isPt ? "Restrito a administradores" : "Strict role-based isolation"}
          </p>
        </div>
      </div>

      {/* Main Section Card */}
      <section className="rounded-xl border border-[#292929] bg-[#111111] overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#292929] px-6 pt-4 gap-4">
          <button
            onClick={() => {
              setActiveTab("contacts");
              setSearch("");
            }}
            className={`pb-4 px-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "contacts"
                ? "border-[#C6A667] text-[#F5F5F5]"
                : "border-transparent text-[#999999] hover:text-[#F5F5F5]"
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>{isPt ? "Contactos" : "Contact Requests"}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-[#1C1C1C] border border-[#292929] text-[#999999]">
              {contacts.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("complaints");
              setSearch("");
            }}
            className={`pb-4 px-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "complaints"
                ? "border-[#C6A667] text-[#F5F5F5]"
                : "border-transparent text-[#999999] hover:text-[#F5F5F5]"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>{isPt ? "Reclamações" : "Customer Complaints"}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                pendingComplaintsCount > 0
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-[#1C1C1C] border border-[#292929] text-[#999999]"
              }`}
            >
              {complaints.length}
            </span>
          </button>
        </div>

        {/* Toolbar: Search, Filters & Sorting */}
        <div className="p-6 border-b border-[#292929] flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isPt
                  ? "Buscar por protocolo, nome ou e-mail..."
                  : "Search protocol, client name or email..."
              }
              className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg pl-9 pr-3 py-2 text-sm text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50"
            />
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            {activeTab === "contacts" ? (
              <select
                value={contactStatusFilter}
                onChange={(e) => setContactStatusFilter(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#C6A667]/50 [&>option]:bg-[#1C1C1C] [&>option]:text-[#F5F5F5]"
              >
                <option value="all">{isPt ? "Todos os Status" : "All Statuses"}</option>
                <option value="received">{isPt ? "Received (Recebido)" : "Received"}</option>
                <option value="in_review">{isPt ? "In Review (Em Análise)" : "In Review"}</option>
                <option value="resolved">{isPt ? "Resolved (Resolvido)" : "Resolved"}</option>
                <option value="closed">{isPt ? "Closed (Fechado)" : "Closed"}</option>
              </select>
            ) : (
              <select
                value={complaintStatusFilter}
                onChange={(e) => setComplaintStatusFilter(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#C6A667]/50 [&>option]:bg-[#1C1C1C] [&>option]:text-[#F5F5F5]"
              >
                <option value="all">{isPt ? "Todos os Status" : "All Statuses"}</option>
                <option value="pending">{isPt ? "Pending (Pendente)" : "Pending"}</option>
                <option value="investigating">{isPt ? "Investigating (Em Investigação)" : "Investigating"}</option>
                <option value="resolved">{isPt ? "Resolved (Resolvido)" : "Resolved"}</option>
                <option value="rejected">{isPt ? "Rejected (Rejeitado)" : "Rejected"}</option>
              </select>
            )}

            {/* Sort Direction */}
            <button
              onClick={() =>
                setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1C1C1C] hover:bg-[#252525] rounded-lg text-xs text-[#999999] hover:text-[#F5F5F5] border border-[#292929] transition"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>
                {sortOrder === "newest"
                  ? isPt
                    ? "Mais Recentes"
                    : "Newest First"
                  : isPt
                  ? "Mais Antigos"
                  : "Oldest First"}
              </span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: CONTACTS TABLE
            ========================================================================= */}
        {activeTab === "contacts" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#999999] border-b border-[#292929] bg-[#141414]">
                  <th className="px-6 py-3 font-medium">
                    {isPt ? "Protocolo" : "Protocol"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isPt ? "Cliente" : "Client"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isPt ? "Assunto" : "Subject"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isPt ? "Data" : "Date"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isPt ? "Status" : "Status"}
                  </th>
                  <th className="px-6 py-3 font-medium text-right">
                    {isPt ? "Ações" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292929]">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#999999]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#C6A667]" />
                      <span>{isPt ? "Carregando contactos..." : "Loading contact inquiries..."}</span>
                    </td>
                  </tr>
                )}
                {!loading && filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#999999]">
                      {isPt ? "Nenhum pedido de contacto encontrado." : "No contact inquiries found."}
                    </td>
                  </tr>
                )}
                {filteredContacts.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-[#161616] transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#C6A667] select-text" data-copyable="true">
                          {c.protocol}
                        </span>
                        <button
                          onClick={() => copyToClipboard(c.protocol)}
                          className="text-[#999999] hover:text-[#F5F5F5] transition"
                          title="Copy protocol"
                        >
                          {copiedProtocol === c.protocol ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-[#F5F5F5]">{c.name}</div>
                      <div className="text-xs text-[#999999]">{c.email}</div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-[#F5F5F5] max-w-xs truncate" title={c.subject}>
                        {c.subject}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs text-[#999999]">
                      {new Date(c.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="px-4 py-4">
                      <ContactStatusBadge status={c.status} isPt={isPt} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenContact(c)}
                        className="px-3 py-1.5 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-xs font-medium text-[#F5F5F5] transition"
                      >
                        {isPt ? "Ver detalhes" : "View details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================================
            TAB 2: COMPLAINTS TABLE
            ========================================================================= */}
        {activeTab === "complaints" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#999999] border-b border-[#292929] bg-[#141414]">
                  <th className="px-6 py-3 font-medium">
                    {isPt ? "Protocolo" : "Protocol"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isPt ? "Cliente" : "Client"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isPt ? "Categoria" : "Category"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isPt ? "Data" : "Date"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isPt ? "Status" : "Status"}
                  </th>
                  <th className="px-6 py-3 font-medium text-right">
                    {isPt ? "Ações" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292929]">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#999999]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#C6A667]" />
                      <span>{isPt ? "Carregando reclamações..." : "Loading complaints..."}</span>
                    </td>
                  </tr>
                )}
                {!loading && filteredComplaints.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#999999]">
                      {isPt ? "Nenhuma reclamação encontrada." : "No customer complaints found."}
                    </td>
                  </tr>
                )}
                {filteredComplaints.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-[#161616] transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#C6A667] select-text" data-copyable="true">
                          {c.protocol}
                        </span>
                        <button
                          onClick={() => copyToClipboard(c.protocol)}
                          className="text-[#999999] hover:text-[#F5F5F5] transition"
                          title="Copy protocol"
                        >
                          {copiedProtocol === c.protocol ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-[#F5F5F5]">{c.name}</div>
                      <div className="text-xs text-[#999999]">{c.email}</div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-block px-2.5 py-1 rounded bg-[#1C1C1C] border border-[#292929] text-xs text-[#999999]">
                        {CATEGORY_LABELS[c.category] || c.category}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs text-[#999999]">
                      {new Date(c.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="px-4 py-4">
                      <ComplaintStatusBadge status={c.status} isPt={isPt} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenComplaint(c)}
                        className="px-3 py-1.5 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-xs font-medium text-[#F5F5F5] transition"
                      >
                        {isPt ? "Ver detalhes" : "View details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =========================================================================
          MODAL 1: CONTACT REQUEST DETAILS
          ========================================================================= */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#111111] border border-[#292929] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#F5F5F5]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#292929] flex items-center justify-between bg-[#141414]">
              <div>
                <span className="text-xs text-[#999999] uppercase tracking-wider font-semibold">
                  {isPt ? "Pedido de Contacto" : "Contact Request"}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-mono text-lg font-bold text-[#C6A667]">
                    {selectedContact.protocol}
                  </h3>
                  <ContactStatusBadge status={selectedContact.status} isPt={isPt} />
                </div>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 grid place-items-center text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 flex-1">
              {saveSuccessMsg && (
                <div className="p-3.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {saveErrorMsg && (
                <div className="p-3.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveErrorMsg}</span>
                </div>
              )}

              {/* Client Info Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                <div>
                  <span className="text-slate-500">{isPt ? "Nome do Cliente" : "Client Name"}</span>
                  <p className="font-medium text-white mt-0.5">{selectedContact.name}</p>
                </div>
                <div>
                  <span className="text-slate-500">E-mail</span>
                  <p className="font-medium text-white mt-0.5">{selectedContact.email}</p>
                </div>
                <div>
                  <span className="text-slate-500">{isPt ? "Data de Abertura" : "Date Opened"}</span>
                  <p className="font-medium text-slate-300 mt-0.5">
                    {new Date(selectedContact.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{isPt ? "Última Atualização" : "Last Updated"}</span>
                  <p className="font-medium text-slate-300 mt-0.5">
                    {new Date(selectedContact.updated_at).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>

              {/* Subject & Message */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {isPt ? "Assunto do Cliente" : "Client Subject"}
                </label>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-white font-medium">
                  {selectedContact.subject}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {isPt ? "Mensagem Completa" : "Full Message"}
                </label>
                <div className="p-4 rounded-lg bg-white/5 border border-white/5 text-slate-200 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedContact.message}
                </div>
              </div>

              {/* Editable Fields: Status & Admin Notes */}
              <div className="pt-4 border-t border-[#292929] space-y-4">
                <h4 className="font-bold text-[#F5F5F5] text-xs uppercase tracking-wider">
                  {isPt ? "Gestão Administrativa (PostgreSQL)" : "Administrative Management (PostgreSQL)"}
                </h4>

                <div>
                  <label className="block text-xs font-medium text-[#999999] mb-1.5">
                    {isPt ? "Alterar Status do Pedido" : "Update Request Status"}
                  </label>
                  <select
                    value={editContactStatus}
                    onChange={(e) => setEditContactStatus(e.target.value as ContactRequestStatus)}
                    style={{ colorScheme: "dark" }}
                    className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#C6A667]/50 [&>option]:bg-[#1C1C1C] [&>option]:text-[#F5F5F5]"
                  >
                    <option value="received">{isPt ? "Received (Recebido)" : "Received"}</option>
                    <option value="in_review">{isPt ? "In Review (Em Análise)" : "In Review"}</option>
                    <option value="resolved">{isPt ? "Resolved (Resolvido)" : "Resolved"}</option>
                    <option value="closed">{isPt ? "Closed (Fechado)" : "Closed"}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#999999] mb-1.5">
                    {isPt ? "Notas Internas Administrativas (admin_notes)" : "Internal Administrative Notes"}
                  </label>
                  <textarea
                    rows={4}
                    value={editContactNotes}
                    onChange={(e) => setEditContactNotes(e.target.value)}
                    placeholder={
                      isPt
                        ? "Insira anotações internas ou resumo do atendimento prestado ao cliente..."
                        : "Enter internal follow-up notes or resolution summary..."
                    }
                    className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg p-3 text-xs text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#292929] bg-[#141414] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedContact(null)}
                className="px-4 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-xs font-semibold text-[#999999] hover:text-[#F5F5F5] transition"
              >
                {isPt ? "Fechar" : "Close"}
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#C6A667]/50 text-xs font-bold text-[#F5F5F5] transition shadow-md disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isPt ? "Gravando no Banco..." : "Saving to Database..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#C6A667]" />
                    <span>{isPt ? "Salvar Alterações" : "Save Changes"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CUSTOMER COMPLAINT DETAILS & RESOLUTION
          ========================================================================= */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#111111] border border-[#292929] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#F5F5F5]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#292929] flex items-center justify-between bg-[#141414]">
              <div>
                <span className="text-xs text-[#999999] uppercase tracking-wider font-semibold">
                  {isPt ? "Reclamação de Cliente (Ouvidoria)" : "Customer Complaint (Dispute Desk)"}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-mono text-lg font-bold text-[#C6A667]">
                    {selectedComplaint.protocol}
                  </h3>
                  <ComplaintStatusBadge status={selectedComplaint.status} isPt={isPt} />
                </div>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="w-8 h-8 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] grid place-items-center text-[#999999] hover:text-[#F5F5F5] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#F5F5F5] flex-1">
              {saveSuccessMsg && (
                <div className="p-3.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {saveErrorMsg && (
                <div className="p-3.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveErrorMsg}</span>
                </div>
              )}

              {/* Client Info Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#141414] border border-[#292929] text-xs">
                <div>
                  <span className="text-[#999999]">{isPt ? "Nome do Cliente" : "Client Name"}</span>
                  <p className="font-medium text-[#F5F5F5] mt-0.5">{selectedComplaint.name}</p>
                </div>
                <div>
                  <span className="text-[#999999]">E-mail</span>
                  <p className="font-medium text-[#F5F5F5] mt-0.5">{selectedComplaint.email}</p>
                </div>
                <div>
                  <span className="text-[#999999]">{isPt ? "Categoria" : "Category"}</span>
                  <p className="font-medium text-[#F5F5F5] mt-0.5">
                    {CATEGORY_LABELS[selectedComplaint.category] || selectedComplaint.category}
                  </p>
                </div>
                <div>
                  <span className="text-[#999999]">{isPt ? "Data de Abertura" : "Date Opened"}</span>
                  <p className="font-medium text-[#999999] mt-0.5">
                    {new Date(selectedComplaint.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
                {selectedComplaint.resolved_at && (
                  <div className="col-span-2">
                    <span className="text-[#999999]">{isPt ? "Data de Resolução" : "Resolved Date"}</span>
                    <p className="font-medium text-emerald-400 mt-0.5">
                      {new Date(selectedComplaint.resolved_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                )}
              </div>

              {/* Detailed Description */}
              <div>
                <label className="text-xs font-semibold text-[#999999] uppercase tracking-wider block mb-1">
                  {isPt ? "Descrição Formal da Disputa" : "Formal Dispute Description"}
                </label>
                <div className="p-4 rounded-lg bg-[#141414] border border-[#292929] text-[#F5F5F5] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedComplaint.description}
                </div>
              </div>

              {/* Editable Fields: Status & Resolution Notes */}
              <div className="pt-4 border-t border-[#292929] space-y-4">
                <h4 className="font-bold text-[#F5F5F5] text-xs uppercase tracking-wider">
                  {isPt ? "Despacho do Administrador (PostgreSQL)" : "Administrator Determination (PostgreSQL)"}
                </h4>

                <div>
                  <label className="block text-xs font-medium text-[#999999] mb-1.5">
                    {isPt ? "Status da Reclamação" : "Complaint Status"}
                  </label>
                  <select
                    value={editComplaintStatus}
                    onChange={(e) => setEditComplaintStatus(e.target.value as CustomerComplaintStatus)}
                    style={{ colorScheme: "dark" }}
                    className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#C6A667]/50 [&>option]:bg-[#1C1C1C] [&>option]:text-[#F5F5F5]"
                  >
                    <option value="pending">{isPt ? "Pending (Pendente de Análise)" : "Pending"}</option>
                    <option value="investigating">{isPt ? "Investigating (Em Investigação)" : "Investigating"}</option>
                    <option value="resolved">{isPt ? "Resolved (Resolvida com Parecer)" : "Resolved"}</option>
                    <option value="rejected">{isPt ? "Rejected (Improcedente / Rejeitada)" : "Rejected"}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#999999] mb-1.5">
                    {isPt
                      ? "Parecer Oficial / Resolução ao Cliente (resolution_notes)"
                      : "Official Resolution Notes / Client Response"}
                  </label>
                  <textarea
                    rows={4}
                    value={editComplaintNotes}
                    onChange={(e) => setEditComplaintNotes(e.target.value)}
                    placeholder={
                      isPt
                        ? "Registre o parecer conclusivo da ouvidoria, medidas adotadas ou motivo da improcedência..."
                        : "Enter official determination, corrective actions taken, or settlement remarks..."
                    }
                    className="w-full bg-[#1C1C1C] border border-[#292929] rounded-lg p-3 text-xs text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50 resize-none"
                  />
                  <p className="text-[11px] text-[#999999] mt-1">
                    {isPt
                      ? "Este parecer é visualizado pelo cliente ao consultar o protocolo no portal de acompanhamento."
                      : "This note is directly visible to the customer when tracking their protocol."}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#292929] bg-[#141414] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="px-4 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-xs font-semibold text-[#999999] hover:text-[#F5F5F5] transition"
              >
                {isPt ? "Fechar" : "Close"}
              </button>
              <button
                type="button"
                onClick={handleSaveComplaint}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#C6A667]/50 text-xs font-bold text-[#F5F5F5] transition shadow-md disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isPt ? "Gravando no Banco..." : "Saving to Database..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#C6A667]" />
                    <span>{isPt ? "Salvar Resolução" : "Save Resolution"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponents: Status Badges
function ContactStatusBadge({ status, isPt }: { status: ContactRequestStatus; isPt: boolean }) {
  switch (status) {
    case "received":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-[#999999] border border-[#292929]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#999999]" />
          {isPt ? "Recebido" : "Received"}
        </span>
      );
    case "in_review":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-amber-300 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {isPt ? "Em Análise" : "In Review"}
        </span>
      );
    case "resolved":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-emerald-300 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {isPt ? "Resolvido" : "Resolved"}
        </span>
      );
    case "closed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-[#777777] border border-[#292929]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#777777]" />
          {isPt ? "Fechado" : "Closed"}
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-[#999999] border border-[#292929]">
          {status}
        </span>
      );
  }
}

function ComplaintStatusBadge({ status, isPt }: { status: CustomerComplaintStatus; isPt: boolean }) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-amber-300 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {isPt ? "Pendente" : "Pending"}
        </span>
      );
    case "investigating":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-[#C6A667] border border-[#C6A667]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C6A667]" />
          {isPt ? "Em Investigação" : "Investigating"}
        </span>
      );
    case "resolved":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-emerald-300 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {isPt ? "Resolvida" : "Resolved"}
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-rose-300 border border-rose-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          {isPt ? "Improcedente" : "Rejected"}
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1C1C1C] text-[#999999] border border-[#292929]">
          {status}
        </span>
      );
  }
}
