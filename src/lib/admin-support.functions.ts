import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth } from "./backend-auth";
import { supabaseAdmin } from "./supabase-admin.server";
import { assertAdmin, assertCanSee, allowedUserIds, type AdminLevel } from "./admin.functions";

export type ContactRequestStatus = "received" | "in_review" | "resolved" | "closed";
export type CustomerComplaintStatus = "pending" | "investigating" | "resolved" | "rejected";

export type AdminContactRequestRow = {
  id: string;
  protocol: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactRequestStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminCustomerComplaintRow = {
  id: string;
  protocol: string;
  user_id: string | null;
  name: string;
  email: string;
  category: string;
  description: string;
  status: CustomerComplaintStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminSupportData = {
  contacts: AdminContactRequestRow[];
  complaints: AdminCustomerComplaintRow[];
  viewerLevel: AdminLevel;
};

export const listAdminSupportData = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }): Promise<AdminSupportData> => {
    const viewerLevel = await assertAdmin(context.userId);
    const allowed = await allowedUserIds(context.userId, viewerLevel);

    const [{ data: contacts, error: ctErr }, { data: complaints, error: cmpErr }] = await Promise.all([
      supabaseAdmin
        .from("contact_requests" as any)
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("customer_complaints" as any)
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (ctErr) {
      console.error("[admin-support] Error fetching contact_requests:", ctErr.message);
      throw new Error(`Failed to load contact requests`);
    }
    if (cmpErr) {
      console.error("[admin-support] Error fetching customer_complaints:", cmpErr.message);
      throw new Error(`Failed to load customer complaints`);
    }

    const filterByScope = (item: any) => {
      if (viewerLevel === "master") return true;
      if (!item.user_id) {
        // Public unauthenticated leads/complaints: only master and adm_geral can review
        return viewerLevel === "geral";
      }
      return allowed ? allowed.has(item.user_id) : true;
    };

    return {
      contacts: ((contacts as any) || []).filter(filterByScope),
      complaints: ((complaints as any) || []).filter(filterByScope),
      viewerLevel,
    };
  });

export const updateAdminContactRequest = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((input: { id: string; status: ContactRequestStatus; admin_notes?: string | null }) => {
    return z
      .object({
        id: z.string().uuid(),
        status: z.enum(["received", "in_review", "resolved", "closed"]),
        admin_notes: z.string().max(3000).nullable().optional(),
      })
      .parse(input);
  })
  .handler(async ({ data, context }) => {
    const lvl = await assertAdmin(context.userId);

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("contact_requests" as any)
      .select("id, user_id")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr || !existing) {
      throw new Error("Contact request not found");
    }

    if ((existing as any)?.user_id) {
      await assertCanSee(context.userId, (existing as any).user_id);
    } else if (lvl === "comum") {
      throw new Error("Administradores comuns só podem alterar solicitações vinculadas a clientes da sua carteira");
    }

    const { data: updated, error } = await supabaseAdmin
      .from("contact_requests" as any)
      .update({
        status: data.status,
        admin_notes: data.admin_notes ? data.admin_notes.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error || !updated) {
      throw new Error(error?.message || "Failed to update contact request in database.");
    }

    return { ok: true, contact: updated as unknown as AdminContactRequestRow };
  });

export const updateAdminCustomerComplaint = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((input: { id: string; status: CustomerComplaintStatus; resolution_notes?: string | null }) => {
    return z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "investigating", "resolved", "rejected"]),
        resolution_notes: z.string().max(3000).nullable().optional(),
      })
      .parse(input);
  })
  .handler(async ({ data, context }) => {
    const lvl = await assertAdmin(context.userId);

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("customer_complaints" as any)
      .select("id, user_id")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr || !existing) {
      throw new Error("Customer complaint not found");
    }

    if ((existing as any)?.user_id) {
      await assertCanSee(context.userId, (existing as any).user_id);
    } else if (lvl === "comum") {
      throw new Error("Administradores comuns só podem alterar reclamações vinculadas a clientes da sua carteira");
    }

    const now = new Date().toISOString();
    const updatePayload: any = {
      status: data.status,
      resolution_notes: data.resolution_notes ? data.resolution_notes.trim() : null,
      updated_at: now,
    };

    if (data.status === "resolved" || data.status === "rejected") {
      updatePayload.resolved_at = now;
    } else {
      updatePayload.resolved_at = null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("customer_complaints" as any)
      .update(updatePayload)
      .eq("id", data.id)
      .select()
      .single();

    if (error || !updated) {
      throw new Error(error?.message || "Failed to update customer complaint in database.");
    }

    return { ok: true, complaint: updated as unknown as AdminCustomerComplaintRow };
  });
