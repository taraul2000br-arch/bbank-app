import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  MessageSquare,
  Send,
  Paperclip,
  X,
  FileText,
  ExternalLink,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Check,
  CheckCheck,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  Lock,
  User,
  Archive,
} from "lucide-react";
import {
  listAdminConversations,
  getAdminConversationMessages,
  sendAdminReply,
  listSupportAuditEvents,
  getSupportAttachmentSignedUrl,
  type SupportConversationDTO,
  type SupportMessageDTO,
  type SupportAttachmentDTO,
  type SupportAuditEventDTO,
} from "@/lib/chat.functions";
import type { AdminLevel } from "@/lib/admin.functions";

interface AdminChatInboxTabProps {
  effectiveViewerLevel: AdminLevel | null;
  adminId?: string;
}

export function AdminChatInboxTab({
  effectiveViewerLevel,
  adminId,
}: AdminChatInboxTabProps) {
  const [conversations, setConversations] = useState<SupportConversationDTO[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageDTO[]>([]);
  const [isSupervisedOnly, setIsSupervisedOnly] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Master only: Confidential Audit State
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEvents, setAuditEvents] = useState<SupportAuditEventDTO[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMaster = effectiveViewerLevel === "master";

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      const res = await listAdminConversations();
      setConversations(res.conversations);
      // Auto-select first conversation if none selected
      if (!selectedConvId && res.conversations.length > 0) {
        setSelectedConvId(res.conversations[0].id);
      }
    } catch (err: any) {
      console.error("[AdminChatInbox] Error loading conversations:", err);
      setErrorMessage(err.message || "Failed to load support conversations.");
    } finally {
      setLoadingList(false);
    }
  }, [selectedConvId]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (convId: string, isInitial = false) => {
    if (!convId) return;
    if (isInitial) setLoadingMessages(true);
    try {
      const res = await getAdminConversationMessages({
        data: { conversationId: convId, limit: 50 },
      });
      setMessages(res.messages);
      setIsSupervisedOnly(res.isSupervisedOnly);
      if (isInitial) {
        setTimeout(() => scrollToBottom(false), 50);
      }
    } catch (err: any) {
      console.error("[AdminChatInbox] Error loading messages:", err);
      setErrorMessage(err.message || "Failed to load messages.");
    } finally {
      if (isInitial) setLoadingMessages(false);
    }
  }, [scrollToBottom]);

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Poll conversation list every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations();
    }, 8000);
    return () => clearInterval(timer);
  }, [loadConversations]);

  // When selected conversation changes
  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId, true);
    }
  }, [selectedConvId, loadMessages]);

  // Poll active conversation messages every 4 seconds
  useEffect(() => {
    if (!selectedConvId) return;
    const timer = setInterval(() => {
      loadMessages(selectedConvId, false);
    }, 4000);
    return () => clearInterval(timer);
  }, [selectedConvId, loadMessages]);

  // Load confidential audit trail (Master only)
  const handleOpenAudit = async () => {
    if (!isMaster) return;
    setAuditOpen(true);
    setLoadingAudit(true);
    try {
      const res = await listSupportAuditEvents({
        data: {
          conversationId: selectedConvId || undefined,
          limit: 100,
        },
      });
      setAuditEvents(res.events);
    } catch (err: any) {
      console.error("[AdminChatInbox] Error loading audit trail:", err);
      alert("Failed to load audit trail: " + err.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  // File selection (5 MB limit, strict MIME)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setFileError("Only JPG, PNG, WebP and PDF attachments are permitted.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError("File exceeds the strict 5 MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      setFileBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileBase64(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Send admin reply (under Camila Ricci public identity)
  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConvId) return;
    const body = replyBody.trim();
    if (!body && !selectedFile) return;
    if (sending || isSupervisedOnly) return;

    setSending(true);
    setErrorMessage(null);

    try {
      let attachmentPayload: any = undefined;
      if (selectedFile && fileBase64) {
        attachmentPayload = {
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
          base64Data: fileBase64,
        };
      }

      const res = await sendAdminReply({
        data: {
          conversationId: selectedConvId,
          body: body || (selectedFile ? `[Attachment: ${selectedFile.name}]` : "Support reply"),
          attachment: attachmentPayload,
        },
      });

      setReplyBody("");
      clearSelectedFile();

      // Append optimistic and scroll
      setMessages((prev) => [...prev, res]);
      setTimeout(() => scrollToBottom(true), 50);

      // Refresh list to update preview
      loadConversations();
    } catch (err: any) {
      console.error("[AdminChatInbox] Error sending reply:", err);
      setErrorMessage(err.message || "Failed to send response.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleOpenAttachment = async (attachmentId: string) => {
    try {
      const res = await getSupportAttachmentSignedUrl({ data: { attachmentId } });
      window.open(res.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      alert("Failed to access attachment: " + (err.message || "Unauthorized"));
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.customer_name.toLowerCase().includes(q) ||
      (c.customer_email && c.customer_email.toLowerCase().includes(q)) ||
      (c.assigned_admin_name && c.assigned_admin_name.toLowerCase().includes(q))
    );
  });

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[600px] bg-[#0c0d0e] border border-[#232629] rounded-xl overflow-hidden shadow-2xl text-slate-200">
      {/* TOP BAR / BREADCRUMB */}
      <div className="px-6 py-4 bg-[#121417] border-b border-[#232629] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white tracking-tight">Support Inbox</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                Camila Ricci
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Live customer support channels • Role: <span className="text-amber-400 capitalize">{effectiveViewerLevel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Master Confidential Audit Button */}
          {isMaster && (
            <button
              onClick={handleOpenAudit}
              className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/50 text-amber-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
              title="Access restricted audit logs (Master Only)"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Confidential Audit</span>
            </button>
          )}

          <button
            onClick={() => {
              loadConversations();
              if (selectedConvId) loadMessages(selectedConvId, false);
            }}
            title="Refresh inbox"
            className="p-2 bg-[#1a1c20] hover:bg-[#25282e] border border-[#2d3137] text-zinc-300 hover:text-white rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="bg-rose-950/80 border-b border-rose-800/60 text-rose-200 text-xs px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MAIN SPLIT VIEW */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: Conversation List */}
        <div className="w-80 md:w-96 border-r border-[#232629] bg-[#0f1113] flex flex-col">
          {/* Search Bar */}
          <div className="p-3 border-b border-[#232629]">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search client, email or agent..."
                className="w-full bg-[#16181b] border border-[#2b2f35] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1e2124]">
            {loadingList ? (
              <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                <span>Loading conversations...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                <Archive className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
                <span>No conversations found.</span>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.id === selectedConvId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConvId(c.id)}
                    className={`w-full text-left p-3.5 transition flex flex-col gap-1.5 select-none ${
                      isSelected
                        ? "bg-[#1c2025] border-l-2 border-amber-400"
                        : "hover:bg-[#141619]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-white truncate max-w-[170px]">
                        {c.customer_name}
                      </span>
                      <span className="text-[10px] text-zinc-500 flex-shrink-0">
                        {new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 truncate line-clamp-1">
                      {c.last_message_preview || "No message content"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-0.5">
                      <span className="truncate max-w-[140px] text-zinc-400">
                        Agent: <strong className="text-zinc-300 font-normal">{c.assigned_admin_name || "Unassigned"}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {c.is_supervised_only && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40 text-[9px] uppercase font-bold">
                            Supervised
                          </span>
                        )}
                        {c.unread_count > 0 && (
                          <span className="bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded-full text-[10px] min-w-[18px] text-center shadow">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Message Thread & Reply */}
        <div className="flex-1 flex flex-col bg-[#121417]">
          {selectedConversation ? (
            <>
              {/* Thread Header */}
              <div className="px-5 py-3.5 bg-[#16181b] border-b border-[#232629] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white font-bold text-xs">
                    {selectedConversation.customer_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-white">{selectedConversation.customer_name}</h3>
                      {selectedConversation.customer_email && (
                        <span className="text-xs text-zinc-400 font-mono">({selectedConversation.customer_email})</span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Assigned Agent: <span className="text-amber-400 font-medium">{selectedConversation.assigned_admin_name || "Unassigned"}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSupervisedOnly && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-700/50 text-amber-300 text-xs font-medium">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Supervision Mode (Read-Only)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Supervision Notice if ADM Geral viewing subordinate client */}
              {isSupervisedOnly && (
                <div className="bg-amber-950/40 border-b border-amber-800/40 px-5 py-2 text-xs text-amber-300/90 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    <strong>Supervision Active:</strong> You are observing this conversation. Replies may only be sent by the assigned administrator (
                    {selectedConversation.assigned_admin_name}) or ADM Master.
                  </span>
                </div>
              )}

              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#0d0e10]">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-xs gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    <span>Loading conversation history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs text-center">
                    <MessageSquare className="w-8 h-8 mb-2 text-zinc-600" />
                    <span>No messages exchanged yet in this conversation.</span>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isClient = m.sender_type === "customer";
                    const isAuto = m.is_auto_response || m.sender_type === "system";

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isClient ? "items-start" : "items-end"} max-w-full`}
                      >
                        {/* Header snippet */}
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-medium text-zinc-400">
                          {isClient ? (
                            <span className="text-zinc-200 font-semibold">{m.sender_name}</span>
                          ) : (
                            <>
                              <span className="text-amber-400 font-semibold">Camila Ricci</span>
                              <span className="text-[10px] text-zinc-500">
                                {isAuto ? "(Automated)" : "(Support Staff)"}
                              </span>
                            </>
                          )}
                          <span className="text-[10px] text-zinc-600">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Bubble */}
                        <div
                          className={`relative px-4 py-2.5 rounded-xl text-sm leading-relaxed max-w-[80%] break-words shadow ${
                            isClient
                              ? "bg-[#1f2227] text-white border border-[#2d3238] rounded-bl-none"
                              : isAuto
                              ? "bg-amber-950/20 text-amber-200 border border-amber-800/40 rounded-br-none italic"
                              : "bg-[#182333] text-sky-100 border border-[#253b59] rounded-br-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>

                          {/* Attachments */}
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
                              {m.attachments.map((att) => (
                                <div
                                  key={att.id}
                                  className="flex items-center justify-between gap-3 p-2 rounded bg-black/30 text-xs"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    <span className="truncate max-w-[180px] text-zinc-200">{att.file_name}</span>
                                    <span className="text-[10px] text-zinc-500">
                                      ({(att.file_size / 1024).toFixed(0)} KB)
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleOpenAttachment(att.id)}
                                    className="p-1 rounded hover:bg-white/10 text-amber-400 hover:text-amber-300 transition flex items-center gap-1 text-[11px]"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Open</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Status Checkmarks for Staff Replies */}
                        {!isClient && (
                          <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-zinc-500">
                            {m.status === "read" ? (
                              <>
                                <CheckCheck className="w-3 h-3 text-sky-400" />
                                <span className="text-sky-400">Read by customer</span>
                              </>
                            ) : m.status === "delivered" ? (
                              <>
                                <CheckCheck className="w-3 h-3 text-zinc-500" />
                                <span>Delivered</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3 text-zinc-500" />
                                <span>Sent</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ATTACHMENT TRAY */}
              {selectedFile && (
                <div className="px-5 py-2.5 bg-[#171a1e] border-t border-[#232629] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="w-4 h-4 text-amber-400" />
                    <span className="text-zinc-200 font-medium truncate max-w-[260px]">{selectedFile.name}</span>
                    <span className="text-[10px] text-zinc-500">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button onClick={clearSelectedFile} className="text-zinc-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {fileError && (
                <div className="px-5 py-2 bg-rose-950/60 border-t border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* REPLY FORM */}
              <form onSubmit={handleSendReply} className="p-4 bg-[#141619] border-t border-[#232629]">
                <div className="flex items-end gap-2.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    disabled={isSupervisedOnly}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || isSupervisedOnly}
                    title="Attach document or receipt (Max 5 MB)"
                    className="p-2.5 text-zinc-400 hover:text-white hover:bg-[#202328] rounded-lg transition disabled:opacity-30"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <div className="flex-1 relative">
                    <textarea
                      rows={1}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        isSupervisedOnly
                          ? "Supervision Mode: Replies disabled for non-assigned agents."
                          : "Reply as Camila Ricci (Customer Support)..."
                      }
                      disabled={sending || isSupervisedOnly}
                      maxLength={5000}
                      className="w-full resize-none bg-[#1a1d21] border border-[#2c3036] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-amber-500/60 max-h-32 min-h-[42px] disabled:opacity-40"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={(!replyBody.trim() && !selectedFile) || sending || isSupervisedOnly}
                    className="p-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition disabled:opacity-30 flex items-center justify-center shadow"
                    title="Send response (Enter)"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-zinc-500 select-none">
                  <span>Public identity: Camila Ricci (Customer Support)</span>
                  <span>{replyBody.length}/5000</span>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-sm">
              <MessageSquare className="w-10 h-10 mb-3 text-zinc-700" />
              <span>Select a customer conversation from the list to start assisting.</span>
            </div>
          )}
        </div>
      </div>

      {/* CONFIDENTIAL AUDIT MODAL (STRICTLY ADM MASTER) */}
      {/* Strict modal constraint: Zero backdrop dismiss, Zero ESC dismiss. Explicit close button only. */}
      {auditOpen && isMaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[85vh] bg-[#121417] border border-amber-600/40 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#171a1e] border-b border-[#292d33] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white tracking-wide">
                    Confidential Support Audit Trail
                  </h3>
                  <p className="text-[11px] text-amber-300/70">
                    Restricted Access • ADM Master Security Log • Immutable Records
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAuditOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
                title="Close Audit Trail"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Audit Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingAudit ? (
                <div className="p-12 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  <span>Loading confidential audit events...</span>
                </div>
              ) : auditEvents.length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-500">
                  <span>No audit events recorded for this scope.</span>
                </div>
              ) : (
                <div className="border border-[#26292f] rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#181b20] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-[#26292f]">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Real Actor</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Metadata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#202329] text-zinc-300">
                      {auditEvents.map((ev) => (
                        <tr key={ev.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                            {new Date(ev.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-semibold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                ev.action === "SEND_REPLY"
                                  ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                                  : ev.action === "SEND_MESSAGE"
                                  ? "bg-sky-950/60 text-sky-300 border border-sky-800/40"
                                  : ev.action === "AUTO_RESPONSE"
                                  ? "bg-purple-950/60 text-purple-300 border border-purple-800/40"
                                  : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {ev.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-white truncate max-w-[180px]">
                              {ev.actor_name || "System"}
                            </div>
                            {ev.actor_user_id && (
                              <div className="text-[10px] text-zinc-500 font-mono truncate max-w-[180px]">
                                {ev.actor_user_id}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 uppercase text-[10px] font-bold text-zinc-400">
                            {ev.actor_role}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-400 text-[11px] font-mono truncate max-w-[200px]">
                            {JSON.stringify(ev.metadata)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-[#171a1e] border-t border-[#292d33] flex justify-end">
              <button
                onClick={() => setAuditOpen(false)}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
