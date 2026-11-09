import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Paperclip,
  X,
  FileText,
  AlertCircle,
  Loader2,
  Check,
  CheckCheck,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import {
  getOrCreateMyConversation,
  getMyMessages,
  sendCustomerMessage,
  getSupportAttachmentSignedUrl,
  type SupportMessageDTO,
  type SupportConversationDTO,
} from "@/lib/chat.functions";

interface CustomerSupportChatProps {
  mode?: "widget" | "full";
  onClose?: () => void;
}

export function CustomerSupportChat({ mode = "widget", onClose }: CustomerSupportChatProps) {
  const [conversation, setConversation] = useState<SupportConversationDTO | null>(null);
  const [messages, setMessages] = useState<SupportMessageDTO[]>([]);
  const [inputBody, setInputBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isWidget = mode === "widget";

  // Auto-scroll to bottom of chat
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  // Initialize or fetch conversation
  const loadConversation = useCallback(async (): Promise<SupportConversationDTO | null> => {
    try {
      const conv = await getOrCreateMyConversation();
      setConversation(conv);
      setErrorBanner(null);
      return conv;
    } catch (err: any) {
      console.error("[CustomerSupportChat] Error loading conversation:", err);
      setErrorBanner("Unable to connect to customer support service. Please retry shortly.");
      return null;
    }
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async (convId?: string, isInitial = false) => {
    try {
      const res = await getMyMessages({ data: { limit: 50 } });
      setMessages(res.messages);
      if (isInitial) {
        setTimeout(() => scrollToBottom(false), 80);
      }
    } catch (err: any) {
      console.error("[CustomerSupportChat] Error fetching messages:", err);
    }
  }, [scrollToBottom]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const conv = await loadConversation();
      if (mounted && conv) {
        await fetchMessages(conv.id, true);
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [loadConversation, fetchMessages]);

  // Manual retry handler
  const handleRetry = async () => {
    setIsRetrying(true);
    setErrorBanner(null);
    try {
      const conv = await loadConversation();
      if (conv) {
        await fetchMessages(conv.id, true);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // Header manual refresh handler
  const handleManualRefresh = async () => {
    if (!conversation) {
      await handleRetry();
      return;
    }
    setIsRefreshing(true);
    try {
      await fetchMessages(conversation.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Polling fallback every 4 seconds to guarantee message delivery
  useEffect(() => {
    if (!conversation) return;
    const interval = setInterval(() => {
      fetchMessages(conversation.id);
    }, 4000);
    return () => clearInterval(interval);
  }, [conversation, fetchMessages]);

  // File selection validation (5 MB limit, strict types)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setFileError("Only JPG, PNG, WebP images and PDF documents are supported.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError("File exceeds the maximum 5 MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setFileBase64(base64);
    };
    reader.onerror = () => {
      setFileError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileBase64(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputBody.trim();
    if (!trimmed && !selectedFile) return;
    if (sending) return;

    // If conversation is not loaded, attempt to connect first
    let activeConv = conversation;
    if (!activeConv) {
      setSending(true);
      activeConv = await loadConversation();
      setSending(false);
      if (!activeConv) {
        setErrorBanner("Unable to connect to customer support service. Please retry shortly.");
        return;
      }
    }

    setSending(true);
    setErrorBanner(null);

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

      const sentMsg = await sendCustomerMessage({
        data: {
          conversationId: activeConv.id,
          body: trimmed || (selectedFile ? `[Sent attachment: ${selectedFile.name}]` : "Hello"),
          attachment: attachmentPayload,
        },
      });

      setInputBody("");
      clearSelectedFile();

      // Append optimistic / sent message and refresh thread without duplicates
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      setTimeout(() => scrollToBottom(true), 50);

      // Trigger message refresh after 1.2s to capture auto-response
      setTimeout(() => {
        if (activeConv) {
          fetchMessages(activeConv.id);
        }
      }, 1200);
    } catch (err: any) {
      console.error("[CustomerSupportChat] Error sending message:", err);
      setErrorBanner(err.message || "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Open attachment signed URL
  const handleOpenAttachment = async (attachmentId: string) => {
    try {
      const res = await getSupportAttachmentSignedUrl({ data: { attachmentId } });
      window.open(res.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      alert("Unable to open attachment: " + (err.message || "Access denied"));
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white text-slate-800 overflow-hidden select-text">
      {/* 1. CABEÇALHO DA CONVERSA (Fixo no topo) */}
      <header className="bg-[#002D62] text-white px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm select-none shrink-0 z-10 border-b border-[#001D42]">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar com monograma CR */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-inner">
              CR
            </div>
            {/* Status Online quando conectado */}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#002D62] ${
                conversation ? "bg-emerald-500" : "bg-amber-400"
              }`}
              title={conversation ? "Customer Support Service Online" : "Connecting..."}
            />
          </div>

          {/* Nome e Setor */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-sm sm:text-base tracking-tight text-white leading-tight truncate">
                Camila Ricci
              </h2>
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            </div>
            <p className="text-[11px] sm:text-xs text-sky-200/90 font-normal leading-tight truncate mt-0.5">
              Customer Support • B Bank
            </p>
          </div>
        </div>

        {/* Ações do cabeçalho */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refresh messages"
            className="p-2 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          {isWidget && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close chat window"
              className="p-2 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. AVISO DISCRETO DE CONEXÃO (Não ocupa faixa grande, contém botão Retry) */}
      {errorBanner && (
        <div className="bg-amber-50/95 border-b border-amber-200/80 text-amber-900 text-xs px-4 py-2 flex items-center justify-between shrink-0 shadow-xs animate-in fade-in z-10">
          <div className="flex items-center gap-2 truncate mr-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">{errorBanner}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-2.5 py-1 rounded bg-amber-200/80 hover:bg-amber-300 text-amber-900 font-medium text-[11px] transition flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`} />
              <span>{isRetrying ? "Retrying..." : "Retry"}</span>
            </button>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="p-1 text-amber-700 hover:text-amber-950 rounded"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. HISTÓRICO DE MENSAGENS (Área central com scroll exclusivo, padrão WhatsApp Web) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-3.5 bg-[#F2F5F8]">
        {loading ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#002D62]" />
            <p className="text-xs font-medium text-slate-500">Loading conversation...</p>
          </div>
        ) : messages.length === 0 ? (
          /* Estado inicial / Conversa vazia limpa e discreta */
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-full bg-white shadow-sm border border-slate-200/80 text-[#002D62] flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7 text-sky-600" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">
              Camila Ricci • Customer Support
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm mb-3">
              Welcome to customer support. Our team is here to assist you with your account, transfers and general enquiries.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-slate-200 text-[11px] text-slate-500 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Messages can be sent at any time</span>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_type === "customer";
            const isAuto = m.is_auto_response || m.sender_type === "system";

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-full`}
              >
                {/* Nome do autor apenas para mensagens do suporte */}
                {!isMe && (
                  <span className="text-[#002D62] text-[11px] font-semibold mb-1 px-1 flex items-center gap-1.5">
                    Camila Ricci
                    {isAuto && (
                      <span className="text-[9px] bg-slate-200/80 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                        Automated
                      </span>
                    )}
                  </span>
                )}

                {/* Balão de Mensagem (WhatsApp Web Style com cores B Bank) */}
                <div
                  className={`relative px-4 py-2.5 shadow-xs break-words text-sm leading-relaxed max-w-[85%] sm:max-w-[72%] ${
                    isMe
                      ? "bg-[#D9EBFB] text-slate-900 border border-sky-200/70 rounded-2xl rounded-tr-xs"
                      : isAuto
                      ? "bg-white text-slate-800 border border-sky-100 rounded-2xl rounded-tl-xs italic"
                      : "bg-white text-slate-900 border border-slate-200/90 rounded-2xl rounded-tl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>

                  {/* Anexos dentro do balão */}
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 space-y-1.5">
                      {m.attachments.map((att) => (
                        <div
                          key={att.id}
                          className={`flex items-center justify-between gap-3 p-2 rounded-xl text-xs ${
                            isMe ? "bg-white/80 border border-sky-200/80 text-slate-800" : "bg-slate-50 border border-slate-200 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                            <span className="truncate max-w-[170px] font-medium">{att.file_name}</span>
                            <span className="text-[10px] text-slate-500">
                              ({(att.file_size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenAttachment(att.id)}
                            className="p-1 rounded text-sky-700 hover:text-sky-950 font-semibold transition flex items-center gap-1 text-[11px]"
                            title="View attachment"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rodapé do balão: Horário e status de leitura */}
                  <div
                    className={`flex items-center justify-end gap-1.5 mt-1 select-none text-[10px] ${
                      isMe ? "text-sky-900/60" : "text-slate-400"
                    }`}
                  >
                    <span>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMe && (
                      <span
                        className="inline-flex items-center"
                        title={m.status === "read" ? "Read" : m.status === "delivered" ? "Delivered" : "Sent"}
                      >
                        {m.status === "read" ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-700" />
                        ) : m.status === "delivered" ? (
                          <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. GAVETA DE PREVIEW DE ANEXO (Aparece somente quando um arquivo foi anexado) */}
      {selectedFile && (
        <div className="shrink-0 px-4 py-2 bg-sky-50/90 border-t border-sky-100 flex items-center justify-between text-xs z-10">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="font-medium text-slate-800 truncate max-w-[260px]">
              {selectedFile.name}
            </span>
            <span className="text-[11px] text-slate-500">
              ({(selectedFile.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={clearSelectedFile}
            className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {fileError && (
        <div className="shrink-0 px-4 py-1.5 bg-rose-50 text-rose-600 text-xs flex items-center gap-1.5 border-t border-rose-100 z-10">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      {/* 5. CAMPO DE MENSAGEM (Fixo na parte inferior, sempre visível) */}
      <form
        onSubmit={handleSendMessage}
        className="shrink-0 bg-white border-t border-slate-200 px-3 sm:px-4 py-2.5 z-10"
      >
        <div className="flex items-end gap-2">
          {/* Botão de anexo */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            title="Attach document or receipt (JPG, PNG, WebP, PDF - Max 5 MB)"
            className="p-2.5 text-slate-500 hover:text-[#002D62] hover:bg-slate-100 rounded-xl transition disabled:opacity-40 shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Campo de digitação com auto-ajuste */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputBody}
              onChange={(e) => setInputBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message to Camila Ricci..."
              disabled={sending}
              maxLength={5000}
              className="w-full resize-none px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-sm text-slate-900 placeholder:text-slate-400 max-h-28 min-h-[42px] leading-relaxed transition"
            />
          </div>

          {/* Botão de envio */}
          <button
            type="submit"
            disabled={(!inputBody.trim() && !selectedFile) || sending}
            className="p-2.5 bg-[#002D62] hover:bg-[#00395D] text-white rounded-xl transition disabled:opacity-40 flex items-center justify-center shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
            title="Send message (Enter)"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>

        {/* Rodapé discreto com identidade segura e contador */}
        <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400 select-none">
          <span>B Bank Secure Support Chat</span>
          <span>{inputBody.length}/5000</span>
        </div>
      </form>
    </div>
  );
}
