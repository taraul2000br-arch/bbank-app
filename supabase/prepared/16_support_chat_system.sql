-- ==============================================================================
-- 16_support_chat_system.sql
-- B Bank Online Banking - Customer Support Chat System (Camila Ricci)
-- Safe, idempotent migration script prepared for manual execution on Supabase.
-- Compatible with PostgreSQL 15+ / Supabase RLS & Storage.
-- ==============================================================================

-- 0. Helper: Ensure updated_at trigger function exists with secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 1. Create support_conversations table
CREATE TABLE IF NOT EXISTS public.support_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    customer_last_read_at TIMESTAMPTZ,
    admin_last_read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create support_messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'admin', 'system')),
    sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    body TEXT NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 5000),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
    is_auto_response BOOLEAN NOT NULL DEFAULT false,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    read_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create support_attachments table (5 MB max, strict MIME types)
CREATE TABLE IF NOT EXISTS public.support_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.support_messages(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create support_audit_events table (Confidential audit trail, immutable)
CREATE TABLE IF NOT EXISTS public.support_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.support_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.support_messages(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_support_conv_customer ON public.support_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_assigned_admin ON public.support_conversations(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_last_msg ON public.support_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_msg_conv_created ON public.support_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_support_msg_status ON public.support_messages(conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_support_msg_sender ON public.support_messages(sender_user_id);

CREATE INDEX IF NOT EXISTS idx_support_att_conv ON public.support_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_att_msg ON public.support_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_support_audit_conv ON public.support_audit_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_audit_actor ON public.support_audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_support_audit_created ON public.support_audit_events(created_at DESC);

-- 6. Trigger to maintain updated_at on support_conversations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_support_conversations_updated_at'
    ) THEN
        CREATE TRIGGER trg_support_conversations_updated_at
            BEFORE UPDATE ON public.support_conversations
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- 7. Trigger to keep last_message_at updated on support_conversations when a message is inserted
CREATE OR REPLACE FUNCTION public.handle_new_support_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.support_conversations
    SET last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_messages_update_conv_time ON public.support_messages;
CREATE TRIGGER trg_support_messages_update_conv_time
    AFTER INSERT ON public.support_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_support_message();

-- 8. Trigger to auto-assign admin on conversation creation if not specified
CREATE OR REPLACE FUNCTION public.handle_new_support_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.assigned_admin_id IS NULL THEN
        SELECT referred_by INTO NEW.assigned_admin_id
        FROM public.profiles
        WHERE user_id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_conversations_auto_assign ON public.support_conversations;
CREATE TRIGGER trg_support_conversations_auto_assign
    BEFORE INSERT ON public.support_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_support_conversation();

-- 9. Trigger to sync assigned_admin_id when client is reassigned in CRM (profiles.referred_by)
CREATE OR REPLACE FUNCTION public.handle_profile_referred_by_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (OLD.referred_by IS DISTINCT FROM NEW.referred_by) THEN
        UPDATE public.support_conversations
        SET assigned_admin_id = NEW.referred_by,
            updated_at = now()
        WHERE customer_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_admin_to_support_conversation ON public.profiles;
CREATE TRIGGER trg_sync_profile_admin_to_support_conversation
    AFTER UPDATE OF referred_by ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_profile_referred_by_sync();

-- 10. Triggers to protect immutable fields and enforce CRM attribution
-- A. Protect support_conversations fields (customer_id, created_at immutable; assigned_admin_id follows CRM referral only)
CREATE OR REPLACE FUNCTION public.protect_conversation_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION 'Conversation id is immutable.';
    END IF;
    IF NEW.customer_id <> OLD.customer_id THEN
        RAISE EXCEPTION 'Conversation customer_id is immutable.';
    END IF;
    IF NEW.created_at <> OLD.created_at THEN
        RAISE EXCEPTION 'Conversation created_at is immutable.';
    END IF;
    -- assigned_admin_id can ONLY be updated if it strictly matches profiles.referred_by (via CRM sync trigger)
    IF NEW.assigned_admin_id IS DISTINCT FROM OLD.assigned_admin_id THEN
        IF NEW.assigned_admin_id IS DISTINCT FROM (SELECT referred_by FROM public.profiles WHERE user_id = NEW.customer_id) THEN
            RAISE EXCEPTION 'assigned_admin_id cannot be altered directly. It follows exclusively the official CRM referral (profiles.referred_by).';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_conversation_fields ON public.support_conversations;
CREATE TRIGGER trg_protect_conversation_fields
    BEFORE UPDATE ON public.support_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_conversation_fields();

-- B. Protect support_messages fields and validate status transitions
CREATE OR REPLACE FUNCTION public.prevent_message_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Structural and content fields are strictly immutable
    IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION 'Message id is immutable.';
    END IF;
    IF NEW.conversation_id <> OLD.conversation_id THEN
        RAISE EXCEPTION 'Message conversation_id is immutable.';
    END IF;
    IF NEW.sender_type <> OLD.sender_type THEN
        RAISE EXCEPTION 'Message sender_type is immutable.';
    END IF;
    IF NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id THEN
        RAISE EXCEPTION 'Message sender_user_id is immutable.';
    END IF;
    IF NEW.body <> OLD.body THEN
        RAISE EXCEPTION 'Message body is immutable.';
    END IF;
    IF NEW.is_auto_response <> OLD.is_auto_response THEN
        RAISE EXCEPTION 'Message is_auto_response is immutable.';
    END IF;
    IF NEW.created_at <> OLD.created_at THEN
        RAISE EXCEPTION 'Message created_at is immutable.';
    END IF;

    -- 2. Validate forward-only status progression (sent -> delivered -> read)
    IF OLD.status = 'read' AND NEW.status <> 'read' THEN
        RAISE EXCEPTION 'Status transition from read to % is invalid.', NEW.status;
    END IF;
    IF OLD.status = 'delivered' AND NEW.status = 'sent' THEN
        RAISE EXCEPTION 'Status transition from delivered to sent is invalid.';
    END IF;

    -- 3. Automatic timestamps for transitions
    IF NEW.status = 'delivered' AND OLD.status = 'sent' AND NEW.delivered_at IS NULL THEN
        NEW.delivered_at = now();
    END IF;
    IF NEW.status = 'read' AND OLD.status <> 'read' AND NEW.read_at IS NULL THEN
        NEW.read_at = now();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_message_tampering ON public.support_messages;
CREATE TRIGGER trg_prevent_message_tampering
    BEFORE UPDATE ON public.support_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_message_tampering();

-- C. Prevent message deletion (messages cannot be deleted by clients or admins)
CREATE OR REPLACE FUNCTION public.prevent_message_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF current_user <> 'postgres' AND (SELECT auth.role()) = 'authenticated' THEN
        RAISE EXCEPTION 'Direct message deletion is strictly prohibited in banking audit.';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_message_deletion ON public.support_messages;
CREATE TRIGGER trg_prevent_message_deletion
    BEFORE DELETE ON public.support_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_message_deletion();

-- D. Protect support_attachments fields (attachments metadata is strictly immutable)
CREATE OR REPLACE FUNCTION public.prevent_attachment_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Attachment metadata is immutable.';
    ELSIF TG_OP = 'DELETE' THEN
        IF current_user <> 'postgres' AND (SELECT auth.role()) = 'authenticated' THEN
            RAISE EXCEPTION 'Direct attachment deletion is strictly prohibited in banking audit.';
        END IF;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_attachment_tampering ON public.support_attachments;
CREATE TRIGGER trg_prevent_attachment_tampering
    BEFORE UPDATE OR DELETE ON public.support_attachments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_attachment_tampering();

-- E. Protect support_audit_events (audit trail is strictly immutable)
CREATE OR REPLACE FUNCTION public.prevent_support_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'support_audit_events is an immutable audit log. Updates and deletes are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_support_audit_mutation ON public.support_audit_events;
CREATE TRIGGER trg_prevent_support_audit_mutation
    BEFORE UPDATE OR DELETE ON public.support_audit_events
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_support_audit_mutation();

-- 11. Enable Row Level Security (RLS)
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_audit_events ENABLE ROW LEVEL SECURITY;

-- 12. Table Permissions & PostgREST Grants
GRANT ALL ON TABLE public.support_conversations TO postgres, service_role;
GRANT ALL ON TABLE public.support_messages TO postgres, service_role;
GRANT ALL ON TABLE public.support_attachments TO postgres, service_role;
GRANT ALL ON TABLE public.support_audit_events TO postgres, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.support_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_messages TO authenticated;
GRANT SELECT, INSERT ON TABLE public.support_attachments TO authenticated;
GRANT SELECT ON TABLE public.support_audit_events TO authenticated;

REVOKE ALL ON public.support_conversations FROM anon;
REVOKE ALL ON public.support_messages FROM anon;
REVOKE ALL ON public.support_attachments FROM anon;
REVOKE ALL ON public.support_audit_events FROM PUBLIC, anon;

REVOKE DELETE ON public.support_conversations FROM authenticated;
REVOKE DELETE ON public.support_messages FROM authenticated;
REVOKE DELETE ON public.support_attachments FROM authenticated;

-- 13. Column-level security: Prevent exposure of internal sender/reader user IDs to authenticated callers
REVOKE SELECT ON public.support_messages FROM authenticated;
GRANT SELECT (
    id,
    conversation_id,
    sender_type,
    body,
    status,
    is_auto_response,
    delivered_at,
    read_at,
    created_at
) ON public.support_messages TO authenticated;

-- 14. RLS Policies: support_conversations
DROP POLICY IF EXISTS "support_conv_customer_select" ON public.support_conversations;
CREATE POLICY "support_conv_customer_select"
    ON public.support_conversations
    FOR SELECT
    TO authenticated
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "support_conv_customer_insert" ON public.support_conversations;
CREATE POLICY "support_conv_customer_insert"
    ON public.support_conversations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = auth.uid() AND
        -- Ensure customer is an end-user, not an admin role
        NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'adm_geral', 'adm_comum')
        ) AND
        -- Ensure assigned_admin_id matches CRM referral if supplied
        (
            assigned_admin_id IS NULL OR
            assigned_admin_id = (SELECT referred_by FROM public.profiles WHERE user_id = auth.uid())
        )
    );

-- Admins can view conversations according to CRM 3-level hierarchy (Master, Geral, Comum)
DROP POLICY IF EXISTS "support_conv_admin_select" ON public.support_conversations;
CREATE POLICY "support_conv_admin_select"
    ON public.support_conversations
    FOR SELECT
    TO authenticated
    USING (public.can_admin_see(auth.uid(), customer_id));

-- Admins update read receipts or metadata
DROP POLICY IF EXISTS "support_conv_admin_update" ON public.support_conversations;
CREATE POLICY "support_conv_admin_update"
    ON public.support_conversations
    FOR UPDATE
    TO authenticated
    USING (public.can_admin_see(auth.uid(), customer_id))
    WITH CHECK (public.can_admin_see(auth.uid(), customer_id));

-- 15. RLS Policies: support_messages
DROP POLICY IF EXISTS "support_msg_customer_select" ON public.support_messages;
CREATE POLICY "support_msg_customer_select"
    ON public.support_messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND sc.customer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "support_msg_customer_insert" ON public.support_messages;
CREATE POLICY "support_msg_customer_insert"
    ON public.support_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_type = 'customer' AND
        sender_user_id = auth.uid() AND
        NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'adm_geral', 'adm_comum')
        ) AND
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND sc.customer_id = auth.uid()
        ) AND
        status = 'sent' AND
        is_auto_response = false
    );

-- Customer can only mark admin messages as read/delivered in their own conversation
DROP POLICY IF EXISTS "support_msg_customer_update" ON public.support_messages;
CREATE POLICY "support_msg_customer_update"
    ON public.support_messages
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND sc.customer_id = auth.uid()
        ) AND
        sender_type IN ('admin', 'system')
    )
    WITH CHECK (
        status IN ('delivered', 'read')
    );

-- Admins can SELECT (view / supervise) messages according to hierarchy
DROP POLICY IF EXISTS "support_msg_admin_select" ON public.support_messages;
CREATE POLICY "support_msg_admin_select"
    ON public.support_messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND public.can_admin_see(auth.uid(), sc.customer_id)
        )
    );

-- Admins INSERT:
-- Master can reply to ANY conversation without reassigning the admin.
-- ADM Comum / Geral can ONLY reply if directly assigned to the client.
-- ADM Geral supervising subordinate clients CANNOT insert replies on their behalf.
DROP POLICY IF EXISTS "support_msg_admin_insert" ON public.support_messages;
CREATE POLICY "support_msg_admin_insert"
    ON public.support_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_type = 'admin' AND
        sender_user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'adm_geral', 'adm_comum')
        ) AND
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND (
                public.get_admin_level(auth.uid()) = 'master' OR
                sc.assigned_admin_id = auth.uid() OR
                (SELECT referred_by FROM public.profiles WHERE user_id = sc.customer_id) = auth.uid()
            )
        )
    );

-- Admin can mark customer messages as read in their authorized conversations
DROP POLICY IF EXISTS "support_msg_admin_update" ON public.support_messages;
CREATE POLICY "support_msg_admin_update"
    ON public.support_messages
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND public.can_admin_see(auth.uid(), sc.customer_id)
        ) AND
        sender_type = 'customer'
    )
    WITH CHECK (
        status IN ('delivered', 'read')
    );

-- 16. RLS Policies: support_attachments
DROP POLICY IF EXISTS "support_att_customer_select" ON public.support_attachments;
CREATE POLICY "support_att_customer_select"
    ON public.support_attachments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND sc.customer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "support_att_customer_insert" ON public.support_attachments;
CREATE POLICY "support_att_customer_insert"
    ON public.support_attachments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by_user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND sc.customer_id = auth.uid()
        ) AND
        file_size > 0 AND file_size <= 5242880 AND
        mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    );

DROP POLICY IF EXISTS "support_att_admin_select" ON public.support_attachments;
CREATE POLICY "support_att_admin_select"
    ON public.support_attachments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND public.can_admin_see(auth.uid(), sc.customer_id)
        )
    );

DROP POLICY IF EXISTS "support_att_admin_insert" ON public.support_attachments;
CREATE POLICY "support_att_admin_insert"
    ON public.support_attachments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by_user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'adm_geral', 'adm_comum')
        ) AND
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id = conversation_id AND (
                public.get_admin_level(auth.uid()) = 'master' OR
                sc.assigned_admin_id = auth.uid() OR
                (SELECT referred_by FROM public.profiles WHERE user_id = sc.customer_id) = auth.uid()
            )
        ) AND
        file_size > 0 AND file_size <= 5242880 AND
        mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    );

-- 17. RLS Policies: support_audit_events (Master only, Immutable)
GRANT SELECT ON public.support_audit_events TO authenticated;

DROP POLICY IF EXISTS "support_audit_master_select" ON public.support_audit_events;
CREATE POLICY "support_audit_master_select"
    ON public.support_audit_events
    FOR SELECT
    TO authenticated
    USING (public.get_admin_level(auth.uid()) = 'master');

-- Direct user INSERT, UPDATE, and DELETE are strictly prohibited.
-- Only service_role can INSERT audit records via trusted Server Functions.

-- 18. Private Supabase Storage Bucket setup
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'support-attachments',
    'support-attachments',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Storage bucket RLS policies:
-- Download/SELECT policy:
DROP POLICY IF EXISTS "support_storage_select" ON storage.objects;
CREATE POLICY "support_storage_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'support-attachments' AND (
            -- The uploader can select their own file
            owner = auth.uid() OR
            -- Master can select all files
            public.get_admin_level(auth.uid()) = 'master' OR
            -- Admins or clients can select if they have access to the conversation
            EXISTS (
                SELECT 1 FROM public.support_attachments sa
                JOIN public.support_conversations sc ON sc.id = sa.conversation_id
                WHERE sa.storage_path = storage.objects.name AND (
                    sc.customer_id = auth.uid() OR
                    public.can_admin_see(auth.uid(), sc.customer_id)
                )
            )
        )
    );

-- Upload/INSERT policy:
-- Path must begin with conversation ID: (storage.foldername(name))[1] = sc.id::text
-- Customer owning conversation, directly assigned admin, or Master can upload.
-- Supervisors (non-assigned ADM Geral) are strictly prohibited from uploading.
DROP POLICY IF EXISTS "support_storage_insert" ON storage.objects;
CREATE POLICY "support_storage_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'support-attachments' AND
        EXISTS (
            SELECT 1 FROM public.support_conversations sc
            WHERE sc.id::text = (storage.foldername(name))[1] AND (
                -- 1. Customer owning conversation
                sc.customer_id = auth.uid()
                -- 2. Master Admin
                OR public.get_admin_level(auth.uid()) = 'master'
                -- 3. Directly assigned admin (Comum or Geral acting as direct manager)
                OR sc.assigned_admin_id = auth.uid()
                OR (SELECT referred_by FROM public.profiles WHERE user_id = sc.customer_id) = auth.uid()
            )
        ) AND
        -- Explicit negative check: non-assigned supervisors cannot upload
        NOT (
            public.get_admin_level(auth.uid()) = 'geral' AND
            EXISTS (
                SELECT 1 FROM public.support_conversations sc
                WHERE sc.id::text = (storage.foldername(name))[1] AND
                sc.assigned_admin_id IS DISTINCT FROM auth.uid() AND
                (SELECT referred_by FROM public.profiles WHERE user_id = sc.customer_id) IS DISTINCT FROM auth.uid()
            )
        )
    );

-- 19. Realtime publication & Replica Identity
-- Specify exact safe columns to prevent Realtime from exposing internal user IDs
ALTER TABLE public.support_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        -- Add tables to realtime publication
        ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
