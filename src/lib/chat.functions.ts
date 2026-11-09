import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth, requireUserAuth } from "./backend-auth";
import { supabaseAdmin } from "./supabase-admin.server";
import {
  assertAdmin,
  assertMaster,
  assertCanSee,
  allowedUserIds,
  type AdminLevel,
} from "./admin.functions";
import type { Json } from "@/integrations/supabase/types";

// Types
export interface SupportAttachmentDTO {
  id: string;
  conversation_id: string;
  message_id: string | null;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  created_at: string;
  url?: string;
}

export interface SupportMessageDTO {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "admin" | "system";
  sender_name: string;
  sender_role: string;
  body: string;
  status: "sent" | "delivered" | "read";
  is_auto_response: boolean;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
  attachments?: SupportAttachmentDTO[];
}

export interface SupportConversationDTO {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  assigned_admin_id: string | null;
  assigned_admin_name?: string;
  last_message_at: string;
  last_message_preview?: string;
  unread_count: number;
  is_supervised_only?: boolean;
}

export interface SupportAuditEventDTO {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  actor_user_id: string | null;
  actor_role: string;
  actor_name?: string;
  action: string;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
}

// In-memory rate limiting: max 15 messages per 60 seconds per user
const chatRateLimitMap = new Map<string, { count: number; windowStart: number }>();
const CHAT_RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_CHAT_MESSAGES_PER_WINDOW = 15;

function checkChatRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = chatRateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > CHAT_RATE_LIMIT_WINDOW) {
    chatRateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_CHAT_MESSAGES_PER_WINDOW) {
    return false;
  }
  entry.count += 1;
  return true;
}

function sanitizeMessageBody(raw: string): string {
  return String(raw || "")
    .replace(/[<>]/g, "")
    .trim();
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Helper to record audit event safely
async function recordAuditEvent(params: {
  conversationId?: string | null;
  messageId?: string | null;
  actorUserId?: string | null;
  actorRole: string;
  action: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  try {
    await (supabaseAdmin as any).from("support_audit_events").insert({
      conversation_id: params.conversationId || null,
      message_id: params.messageId || null,
      actor_user_id: params.actorUserId || null,
      actor_role: params.actorRole,
      action: params.action,
      metadata: (params.metadata || {}) as Json,
    });
  } catch (err) {
    console.error("[SupportChat] Failed to insert audit event:", err);
  }
}

// -----------------------------------------------------------------------------
// CUSTOMER SERVER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Retrieves or lazily creates the customer's unique support conversation.
 */
export const getOrCreateMyConversation = createServerFn({ method: "POST" })
  .middleware([requireUserAuth])
  .handler(async ({ context }): Promise<SupportConversationDTO> => {
    const customerId = context.userId;

    // Check existing conversation
    const { data: existing, error: findErr } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("id, customer_id, assigned_admin_id, last_message_at")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (findErr) {
      console.error("[chat.functions:getOrCreateMyConversation] Supabase PostgREST error:", findErr);
      throw new Error(`Failed to query support conversation: ${findErr.message}`);
    }

    if (existing) {
      // Count unread admin messages for customer
      const { count } = await (supabaseAdmin as any)
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", existing.id)
        .in("sender_type", ["admin", "system"])
        .neq("status", "read");

      return {
        id: existing.id,
        customer_id: existing.customer_id,
        customer_name: "You",
        assigned_admin_id: existing.assigned_admin_id,
        last_message_at: existing.last_message_at,
        unread_count: count ?? 0,
      };
    }

    // Resolve assigned admin from profile.referred_by
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("user_id", customerId)
      .maybeSingle();

    const assignedAdminId = profile?.referred_by || null;

    // Insert new conversation
    const { data: created, error: createErr } = await (supabaseAdmin as any)
      .from("support_conversations")
      .insert({
        customer_id: customerId,
        assigned_admin_id: assignedAdminId,
      })
      .select("id, customer_id, assigned_admin_id, last_message_at")
      .single();

    if (createErr || !created) {
      console.error("[chat.functions:getOrCreateMyConversation] Failed to insert conversation:", createErr);
      throw new Error(`Failed to create support conversation: ${createErr?.message}`);
    }

    await recordAuditEvent({
      conversationId: created.id,
      actorUserId: customerId,
      actorRole: "customer",
      action: "CONVERSATION_CREATED",
    });

    return {
      id: created.id,
      customer_id: created.customer_id,
      customer_name: "You",
      assigned_admin_id: created.assigned_admin_id,
      last_message_at: created.last_message_at,
      unread_count: 0,
    };
  });

/**
 * Returns message thread for customer with attachments.
 * Automatically marks unread admin/system messages as read by the customer.
 */
export const getMyMessages = createServerFn({ method: "POST" })
  .middleware([requireUserAuth])
  .validator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).default(50),
        before: z.string().optional(),
      })
      .parse(input || {}),
  )
  .handler(async ({ data, context }): Promise<{ messages: SupportMessageDTO[] }> => {
    const customerId = context.userId;

    const { data: conv } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("id")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!conv) {
      return { messages: [] };
    }

    let query = (supabaseAdmin as any)
      .from("support_messages")
      .select(`
        id,
        conversation_id,
        sender_type,
        body,
        status,
        is_auto_response,
        created_at,
        delivered_at,
        read_at,
        support_attachments (
          id,
          conversation_id,
          message_id,
          file_name,
          file_size,
          mime_type,
          storage_path,
          created_at
        )
      `)
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(data.limit);

    if (data.before) {
      query = query.lt("created_at", data.before);
    }

    const { data: msgs, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    // Mark unread admin/system messages as read
    const unreadIds = (msgs || [])
      .filter((m: any) => m.sender_type !== "customer" && m.status !== "read")
      .map((m: any) => m.id);

    if (unreadIds.length > 0) {
      const nowIso = new Date().toISOString();
      await (supabaseAdmin as any)
        .from("support_messages")
        .update({
          status: "read",
          read_at: nowIso,
          read_by_user_id: customerId,
        })
        .in("id", unreadIds);

      await (supabaseAdmin as any)
        .from("support_conversations")
        .update({ customer_last_read_at: nowIso })
        .eq("id", conv.id);
    }

    // Map messages with Camila Ricci customer support identity
    const messages: SupportMessageDTO[] = (msgs || []).map((m: any) => {
      let sender_name = "Camila Ricci";
      let sender_role = "Customer Support";

      if (m.sender_type === "customer") {
        sender_name = "You";
        sender_role = "Customer";
      } else if (m.is_auto_response) {
        sender_name = "Camila Ricci (Automated)";
        sender_role = "Customer Support";
      }

      const attachments: SupportAttachmentDTO[] = (m.support_attachments || []).map((att: any) => ({
        id: att.id,
        conversation_id: att.conversation_id,
        message_id: att.message_id,
        file_name: att.file_name,
        file_size: att.file_size,
        mime_type: att.mime_type,
        storage_path: att.storage_path,
        created_at: att.created_at,
      }));

      return {
        id: m.id,
        conversation_id: m.conversation_id,
        sender_type: m.sender_type,
        sender_name,
        sender_role,
        body: m.body,
        status: unreadIds.includes(m.id) ? "read" : m.status,
        is_auto_response: m.is_auto_response,
        created_at: m.created_at,
        delivered_at: m.delivered_at,
        read_at: unreadIds.includes(m.id) ? new Date().toISOString() : m.read_at,
        attachments,
      };
    });

    return { messages };
  });

/**
 * Customer sends a message. Also handles auto-response when appropriate.
 */
export const sendCustomerMessage = createServerFn({ method: "POST" })
  .middleware([requireUserAuth])
  .validator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().min(1).max(5000),
        attachment: z
          .object({
            fileName: z.string().min(1).max(255),
            mimeType: z.string(),
            fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
            base64Data: z.string().min(1),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SupportMessageDTO> => {
    const customerId = context.userId;

    if (!checkChatRateLimit(customerId)) {
      throw new Error("Rate limit exceeded. Please wait a moment before sending another message.");
    }

    // Verify conversation belongs to customer
    const { data: conv, error: convErr } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("id, customer_id, assigned_admin_id")
      .eq("id", data.conversationId)
      .eq("customer_id", customerId)
      .single();

    if (convErr || !conv) {
      throw new Error("Unauthorized conversation access.");
    }

    const cleanBody = sanitizeMessageBody(data.body);
    if (!cleanBody) {
      throw new Error("Message body cannot be empty.");
    }

    // Insert customer message
    const { data: msg, error: msgErr } = await (supabaseAdmin as any)
      .from("support_messages")
      .insert({
        conversation_id: conv.id,
        sender_type: "customer",
        sender_user_id: customerId,
        body: cleanBody,
        status: "sent",
        is_auto_response: false,
      })
      .select("id, conversation_id, sender_type, body, status, is_auto_response, created_at")
      .single();

    if (msgErr || !msg) {
      throw new Error(`Failed to send message: ${msgErr?.message}`);
    }

    await recordAuditEvent({
      conversationId: conv.id,
      messageId: msg.id,
      actorUserId: customerId,
      actorRole: "customer",
      action: "SEND_MESSAGE",
      metadata: { bodyLength: cleanBody.length, hasAttachment: data.attachment ? 1 : 0 },
    });

    let attachmentDTO: SupportAttachmentDTO | undefined;

    // Handle attachment if present
    if (data.attachment) {
      const { fileName, mimeType, fileSize, base64Data } = data.attachment;

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error("Unsupported file type. Accepted: JPG, PNG, WebP, PDF.");
      }
      if (fileSize > MAX_FILE_SIZE) {
        throw new Error("File exceeds 5 MB limit.");
      }

      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > MAX_FILE_SIZE) {
        throw new Error("File payload exceeds 5 MB limit.");
      }

      const sanitizedFilename = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${conv.id}/${Date.now()}_${sanitizedFilename}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from("support-attachments")
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadErr) {
        console.error("[SupportChat] Storage upload error:", uploadErr);
        throw new Error(`Attachment upload failed: ${uploadErr.message}`);
      }

      const { data: attRecord, error: attErr } = await (supabaseAdmin as any)
        .from("support_attachments")
        .insert({
          conversation_id: conv.id,
          message_id: msg.id,
          uploaded_by_user_id: customerId,
          file_name: sanitizedFilename,
          file_size: buffer.length,
          mime_type: mimeType,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (!attErr && attRecord) {
        attachmentDTO = {
          id: attRecord.id,
          conversation_id: attRecord.conversation_id,
          message_id: attRecord.message_id,
          file_name: attRecord.file_name,
          file_size: attRecord.file_size,
          mime_type: attRecord.mime_type,
          storage_path: attRecord.storage_path,
          created_at: attRecord.created_at,
        };

        await recordAuditEvent({
          conversationId: conv.id,
          messageId: msg.id,
          actorUserId: customerId,
          actorRole: "customer",
          action: "UPLOAD_ATTACHMENT",
          metadata: { fileName: sanitizedFilename, fileSize: buffer.length },
        });
      }
    }

    // -------------------------------------------------------------------------
    // 24/7 AUTO-RESPONSE LOGIC
    // Controlled neutral confirmation when agent is unavailable
    // Check if auto-reply should be triggered (no admin/system reply in past 4h)
    // -------------------------------------------------------------------------
    try {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: recentReplies } = await (supabaseAdmin as any)
        .from("support_messages")
        .select("id, is_auto_response, created_at")
        .eq("conversation_id", conv.id)
        .in("sender_type", ["admin", "system"])
        .gte("created_at", fourHoursAgo)
        .limit(1);

      if (!recentReplies || recentReplies.length === 0) {
        const autoText =
          "Thank you for your message. Our support team will respond as soon as an agent is available.";

        const { data: autoMsg } = await (supabaseAdmin as any)
          .from("support_messages")
          .insert({
            conversation_id: conv.id,
            sender_type: "system",
            body: autoText,
            status: "delivered",
            is_auto_response: true,
          })
          .select("id")
          .single();

        if (autoMsg) {
          await recordAuditEvent({
            conversationId: conv.id,
            messageId: autoMsg.id,
            actorRole: "system",
            action: "AUTO_RESPONSE",
            metadata: { text: autoText },
          });
        }
      }
    } catch (err) {
      console.error("[SupportChat] Error processing auto-response:", err);
    }

    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_type: "customer",
      sender_name: "You",
      sender_role: "Customer",
      body: msg.body,
      status: "sent",
      is_auto_response: false,
      created_at: msg.created_at,
      attachments: attachmentDTO ? [attachmentDTO] : [],
    };
  });

/**
 * Quick unread message count for customer navigation badge.
 */
export const getMyUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireUserAuth])
  .handler(async ({ context }): Promise<{ unreadCount: number }> => {
    const customerId = context.userId;

    const { data: conv } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("id")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!conv) return { unreadCount: 0 };

    const { count } = await (supabaseAdmin as any)
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .in("sender_type", ["admin", "system"])
      .neq("status", "read");

    return { unreadCount: count ?? 0 };
  });

/**
 * Returns a short-lived signed URL for an attachment, verifying user access.
 */
export const getSupportAttachmentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireUserAuth])
  .validator((input: unknown) =>
    z
      .object({
        attachmentId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ signedUrl: string }> => {
    const userId = context.userId;

    const { data: att, error } = await (supabaseAdmin as any)
      .from("support_attachments")
      .select("id, storage_path, conversation_id")
      .eq("id", data.attachmentId)
      .single();

    if (error || !att) {
      throw new Error("Attachment not found.");
    }

    // Verify access: customer or admin
    const { data: conv } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("customer_id")
      .eq("id", att.conversation_id)
      .single();

    if (!conv) throw new Error("Conversation not found.");

    if (conv.customer_id !== userId) {
      // Must be an admin with access
      await assertCanSee(userId, conv.customer_id);
    }

    const { data: signedData, error: signErr } = await supabaseAdmin.storage
      .from("support-attachments")
      .createSignedUrl(att.storage_path, 60 * 15); // 15 minutes

    if (signErr || !signedData?.signedUrl) {
      throw new Error("Failed to generate signed URL.");
    }

    await recordAuditEvent({
      conversationId: att.conversation_id,
      actorUserId: userId,
      actorRole: conv.customer_id === userId ? "customer" : "admin",
      action: "DOWNLOAD_ATTACHMENT",
      metadata: { attachmentId: att.id },
    });

    return { signedUrl: signedData.signedUrl };
  });

// -----------------------------------------------------------------------------
// ADMIN CRM SERVER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Lists conversations accessible by the current admin.
 * - ADM Comum: only own clients
 * - ADM Geral: own clients + subordinate clients (marked is_supervised_only: true)
 * - ADM Master: all clients
 */
export const listAdminConversations = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }): Promise<{ conversations: SupportConversationDTO[]; adminLevel: AdminLevel }> => {
    const adminId = context.userId;
    const adminLevel = await assertAdmin(adminId);
    const allowed = await allowedUserIds(adminId, adminLevel);

    let query = (supabaseAdmin as any)
      .from("support_conversations")
      .select(`
        id,
        customer_id,
        assigned_admin_id,
        last_message_at,
        created_at
      `)
      .order("last_message_at", { ascending: false });

    if (allowed !== null) {
      const allowedArr = Array.from(allowed);
      if (allowedArr.length === 0) {
        return { conversations: [], adminLevel };
      }
      query = query.in("customer_id", allowedArr);
    }

    const { data: convs, error } = await query;
    if (error) {
      throw new Error(`Failed to list conversations: ${error.message}`);
    }

    // Fetch customer profiles and last messages
    const customerIds = (convs || []).map((c: any) => c.customer_id);
    const [profilesRes, usersRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, referred_by")
        .in("user_id", customerIds.length > 0 ? customerIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const profileMap = new Map<string, any>();
    (profilesRes.data || []).forEach((p) => profileMap.set(p.user_id, p));

    const emailMap = new Map<string, string>();
    (usersRes.data?.users || []).forEach((u) => emailMap.set(u.id, u.email || ""));

    const result: SupportConversationDTO[] = [];

    for (const c of convs || []) {
      const prof = profileMap.get(c.customer_id);
      const email = emailMap.get(c.customer_id) || "customer@bancoteste.com";
      const name = prof?.full_name || email.split("@")[0];

      // Unread messages from customer
      const { count } = await (supabaseAdmin as any)
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .eq("sender_type", "customer")
        .neq("status", "read");

      // Last message preview
      const { data: lastMsg } = await (supabaseAdmin as any)
        .from("support_messages")
        .select("body, sender_type")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const isSupervisedOnly =
        adminLevel === "geral" &&
        prof?.referred_by &&
        prof.referred_by !== adminId;

      result.push({
        id: c.id,
        customer_id: c.customer_id,
        customer_name: name,
        customer_email: email,
        assigned_admin_id: prof?.referred_by || c.assigned_admin_id,
        assigned_admin_name: prof?.referred_by ? emailMap.get(prof.referred_by) || "Assigned Agent" : "Unassigned",
        last_message_at: c.last_message_at,
        last_message_preview: lastMsg?.body ? (lastMsg.body.length > 60 ? `${lastMsg.body.slice(0, 60)}...` : lastMsg.body) : "No messages yet",
        unread_count: count ?? 0,
        is_supervised_only: !!isSupervisedOnly,
      });
    }

    return { conversations: result, adminLevel };
  });

/**
 * Admin loads messages for a specific conversation.
 * Marks customer messages as read.
 */
export const getAdminConversationMessages = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ messages: SupportMessageDTO[]; isSupervisedOnly: boolean }> => {
    const adminId = context.userId;
    const adminLevel = await assertAdmin(adminId);

    const { data: conv, error: convErr } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("id, customer_id, assigned_admin_id")
      .eq("id", data.conversationId)
      .single();

    if (convErr || !conv) {
      throw new Error("Conversation not found.");
    }

    // Permission check
    await assertCanSee(adminId, conv.customer_id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, referred_by")
      .eq("user_id", conv.customer_id)
      .single();

    const isSupervisedOnly =
      adminLevel === "geral" &&
      profile?.referred_by &&
      profile.referred_by !== adminId;

    const { data: msgs, error } = await (supabaseAdmin as any)
      .from("support_messages")
      .select(`
        id,
        conversation_id,
        sender_type,
        body,
        status,
        is_auto_response,
        created_at,
        delivered_at,
        read_at,
        support_attachments (
          id,
          conversation_id,
          message_id,
          file_name,
          file_size,
          mime_type,
          storage_path,
          created_at
        )
      `)
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(data.limit);

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    // Mark customer messages as read if not read yet
    const unreadIds = (msgs || [])
      .filter((m: any) => m.sender_type === "customer" && m.status !== "read")
      .map((m: any) => m.id);

    if (unreadIds.length > 0) {
      const nowIso = new Date().toISOString();

      await (supabaseAdmin as any)
        .from("support_messages")
        .update({
          status: "read",
          read_at: nowIso,
          read_by_user_id: adminId,
        })
        .in("id", unreadIds);

      await (supabaseAdmin as any)
        .from("support_conversations")
        .update({ admin_last_read_at: nowIso })
        .eq("id", conv.id);

      await recordAuditEvent({
        conversationId: conv.id,
        actorUserId: adminId,
        actorRole: adminLevel,
        action: "READ_MESSAGES",
        metadata: { messageCount: unreadIds.length },
      });
    }

    const customerName = profile?.full_name || "Customer";

    const messages: SupportMessageDTO[] = (msgs || []).map((m: any) => {
      let sender_name = customerName;
      let sender_role = "Customer";

      if (m.sender_type === "admin") {
        sender_name = "Camila Ricci";
        sender_role = "Customer Support";
      } else if (m.sender_type === "system" || m.is_auto_response) {
        sender_name = "Camila Ricci (Automated)";
        sender_role = "Customer Support";
      }

      const attachments: SupportAttachmentDTO[] = (m.support_attachments || []).map((att: any) => ({
        id: att.id,
        conversation_id: att.conversation_id,
        message_id: att.message_id,
        file_name: att.file_name,
        file_size: att.file_size,
        mime_type: att.mime_type,
        storage_path: att.storage_path,
        created_at: att.created_at,
      }));

      return {
        id: m.id,
        conversation_id: m.conversation_id,
        sender_type: m.sender_type,
        sender_name,
        sender_role,
        body: m.body,
        status: unreadIds.includes(m.id) ? "read" : m.status,
        is_auto_response: m.is_auto_response,
        created_at: m.created_at,
        delivered_at: m.delivered_at,
        read_at: unreadIds.includes(m.id) ? new Date().toISOString() : m.read_at,
        attachments,
      };
    });

    return { messages, isSupervisedOnly: !!isSupervisedOnly };
  });

/**
 * Admin sends a reply to customer under the Camila Ricci identity.
 * Rules:
 * - ADM Comum: only own clients
 * - ADM Geral: only own clients (subordinates are supervision only)
 * - ADM Master: can reply to any client
 * Preserves true author in support_messages.sender_user_id and support_audit_events.
 */
export const sendAdminReply = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().min(1).max(5000),
        attachment: z
          .object({
            fileName: z.string().min(1).max(255),
            mimeType: z.string(),
            fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
            base64Data: z.string().min(1),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SupportMessageDTO> => {
    const adminId = context.userId;
    const adminLevel = await assertAdmin(adminId);

    const { data: conv, error: convErr } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("id, customer_id, assigned_admin_id")
      .eq("id", data.conversationId)
      .single();

    if (convErr || !conv) {
      throw new Error("Conversation not found.");
    }

    // Permission assertion
    await assertCanSee(adminId, conv.customer_id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("user_id", conv.customer_id)
      .single();

    // Check if admin is authorized to reply:
    // Master can reply to any conversation.
    // Geral and Comum can only reply if client is referred_by themselves.
    if (adminLevel !== "master") {
      if (profile?.referred_by !== adminId) {
        throw new Error(
          "Supervision mode: You can only view this conversation. Replies can only be sent by the assigned administrator or Master.",
        );
      }
    }

    const cleanBody = sanitizeMessageBody(data.body);
    if (!cleanBody) {
      throw new Error("Message body cannot be empty.");
    }

    // Insert message recording the true admin author internally.
    // The public persona presented to clients and in API responses is always "Camila Ricci" (Customer Support).
    const { data: msg, error: msgErr } = await (supabaseAdmin as any)
      .from("support_messages")
      .insert({
        conversation_id: conv.id,
        sender_type: "admin",
        sender_user_id: adminId,
        body: cleanBody,
        status: "delivered",
        is_auto_response: false,
      })
      .select("id, conversation_id, sender_type, body, status, is_auto_response, created_at")
      .single();

    if (msgErr || !msg) {
      throw new Error(`Failed to send reply: ${msgErr?.message}`);
    }

    // Always log confidential audit with true actor
    await recordAuditEvent({
      conversationId: conv.id,
      messageId: msg.id,
      actorUserId: adminId,
      actorRole: adminLevel,
      action: "SEND_REPLY",
      metadata: {
        bodyLength: cleanBody.length,
        hasAttachment: data.attachment ? 1 : 0,
      },
    });

    let attachmentDTO: SupportAttachmentDTO | undefined;

    if (data.attachment) {
      const { fileName, mimeType, fileSize, base64Data } = data.attachment;

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error("Unsupported file type. Accepted: JPG, PNG, WebP, PDF.");
      }
      if (fileSize > MAX_FILE_SIZE) {
        throw new Error("File exceeds 5 MB limit.");
      }

      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > MAX_FILE_SIZE) {
        throw new Error("File payload exceeds 5 MB limit.");
      }

      const sanitizedFilename = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${conv.id}/${Date.now()}_${sanitizedFilename}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from("support-attachments")
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadErr) {
        throw new Error(`Attachment upload failed: ${uploadErr.message}`);
      }

      const { data: attRecord, error: attErr } = await (supabaseAdmin as any)
        .from("support_attachments")
        .insert({
          conversation_id: conv.id,
          message_id: msg.id,
          uploaded_by_user_id: adminId,
          file_name: sanitizedFilename,
          file_size: buffer.length,
          mime_type: mimeType,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (!attErr && attRecord) {
        attachmentDTO = {
          id: attRecord.id,
          conversation_id: attRecord.conversation_id,
          message_id: attRecord.message_id,
          file_name: attRecord.file_name,
          file_size: attRecord.file_size,
          mime_type: attRecord.mime_type,
          storage_path: attRecord.storage_path,
          created_at: attRecord.created_at,
        };

        await recordAuditEvent({
          conversationId: conv.id,
          messageId: msg.id,
          actorUserId: adminId,
          actorRole: adminLevel,
          action: "UPLOAD_ATTACHMENT",
          metadata: { fileName: sanitizedFilename, fileSize: buffer.length },
        });
      }
    }

    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_type: "admin",
      sender_name: "Camila Ricci",
      sender_role: "Customer Support",
      body: msg.body,
      status: "delivered",
      is_auto_response: false,
      created_at: msg.created_at,
      attachments: attachmentDTO ? [attachmentDTO] : [],
    };
  });

// -----------------------------------------------------------------------------
// MASTER ONLY: CONFIDENTIAL AUDIT LOGS
// -----------------------------------------------------------------------------

/**
 * Confidential audit trail, accessible strictly and exclusively by ADM Master.
 * Exposes true author IDs, roles, actions, timestamps.
 */
export const listSupportAuditEvents = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input || {}),
  )
  .handler(async ({ data, context }): Promise<{ events: SupportAuditEventDTO[] }> => {
    // Strictly verify master role
    await assertMaster(context.userId);

    let query = (supabaseAdmin as any)
      .from("support_audit_events")
      .select(`
        id,
        conversation_id,
        message_id,
        actor_user_id,
        actor_role,
        action,
        metadata,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.conversationId) {
      query = query.eq("conversation_id", data.conversationId);
    }

    const { data: logs, error } = await query;
    if (error) {
      throw new Error(`Failed to load audit events: ${error.message}`);
    }

    // Resolve actor names/emails for Master convenience
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const userEmailMap = new Map<string, string>();
    (authUsers?.users || []).forEach((u) => userEmailMap.set(u.id, u.email || ""));

    const events: SupportAuditEventDTO[] = (logs || []).map((l: any) => ({
      id: l.id,
      conversation_id: l.conversation_id,
      message_id: l.message_id,
      actor_user_id: l.actor_user_id,
      actor_role: l.actor_role,
      actor_name: l.actor_user_id ? userEmailMap.get(l.actor_user_id) || l.actor_user_id : "System / Automated",
      action: l.action,
      metadata: (l.metadata && typeof l.metadata === "object" ? l.metadata : {}) as Record<string, string | number | boolean | null>,
      created_at: l.created_at,
    }));

    return { events };
  });
