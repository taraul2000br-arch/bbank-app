-- ==============================================================================
-- 16_support_chat_system_rollback.sql
-- B Bank Online Banking - Customer Support Chat System (Camila Ricci)
-- Safe, Non-Destructive Subsystem Quarantine & Deactivation Procedure
-- ==============================================================================
-- ENTERPRISE BANKING COMPLIANCE NOTICE:
-- This procedure is TRULY NON-DESTRUCTIVE:
-- 1. NO DROP TABLE CASCADE is executed.
-- 2. NO data, message history, attachments metadata, or audit logs are deleted.
-- 3. Storage bucket and all uploaded binary files are 100% PRESERVED.
-- 4. Foreign key integrity, indexes, table structures, and constraints remain INTACT.
-- 5. End-user access is safely quarantined; Master Admin and service_role retain
--    audit and compliance read access.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- FASE 1: DESCONEXÃO DO REALTIME
-- Desconecta as tabelas de suporte do canal de transmissão Realtime.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.support_messages;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.support_conversations;
    END IF;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- FASE 2: DESVINCULAÇÃO DO CRM BANCÁRIO (PROFILES)
-- Remove o trigger de sincronização na tabela profiles, desassociando o chat
-- das rotinas de alteração de clientes do CRM sem afetar os dados de profiles.
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_profile_admin_to_support_conversation ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_profile_referred_by_sync();

-- ------------------------------------------------------------------------------
-- FASE 3: PRESERVAÇÃO DO STORAGE E DESATIVAÇÃO DE ACESSO
-- O bucket 'support-attachments' e todos os arquivos binários permanecem INTACTOS.
-- Remove as políticas de upload e download de usuários finais.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "support_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "support_storage_insert" ON storage.objects;

-- Concede acesso de inspeção de emergência apenas ao ADM Master no storage
CREATE POLICY "support_storage_quarantine_master"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'support-attachments' AND
        public.get_admin_level(auth.uid()) = 'master'
    );

-- ------------------------------------------------------------------------------
-- FASE 4: REMOÇÃO DE POLÍTICAS DE USUÁRIO E BLOQUEIO DE QUARENTENA
-- Remove as políticas ativas de inserção, atualização e seleção de clientes e ADMs.
-- Aplica políticas de Quarentena restritas ao ADM Master para consulta de conformidade.
-- ------------------------------------------------------------------------------
-- A. support_conversations
DROP POLICY IF EXISTS "support_conv_customer_select" ON public.support_conversations;
DROP POLICY IF EXISTS "support_conv_customer_insert" ON public.support_conversations;
DROP POLICY IF EXISTS "support_conv_admin_select" ON public.support_conversations;
DROP POLICY IF EXISTS "support_conv_admin_update" ON public.support_conversations;

-- Bloqueio: Apenas Master pode consultar histórico existente
CREATE POLICY "support_conv_quarantine_master"
    ON public.support_conversations
    FOR SELECT
    TO authenticated
    USING (public.get_admin_level(auth.uid()) = 'master');

-- B. support_messages
DROP POLICY IF EXISTS "support_msg_customer_select" ON public.support_messages;
DROP POLICY IF EXISTS "support_msg_customer_insert" ON public.support_messages;
DROP POLICY IF EXISTS "support_msg_customer_update" ON public.support_messages;
DROP POLICY IF EXISTS "support_msg_admin_select" ON public.support_messages;
DROP POLICY IF EXISTS "support_msg_admin_insert" ON public.support_messages;
DROP POLICY IF EXISTS "support_msg_admin_update" ON public.support_messages;

CREATE POLICY "support_msg_quarantine_master"
    ON public.support_messages
    FOR SELECT
    TO authenticated
    USING (public.get_admin_level(auth.uid()) = 'master');

-- C. support_attachments
DROP POLICY IF EXISTS "support_att_customer_select" ON public.support_attachments;
DROP POLICY IF EXISTS "support_att_customer_insert" ON public.support_attachments;
DROP POLICY IF EXISTS "support_att_admin_select" ON public.support_attachments;
DROP POLICY IF EXISTS "support_att_admin_insert" ON public.support_attachments;

CREATE POLICY "support_att_quarantine_master"
    ON public.support_attachments
    FOR SELECT
    TO authenticated
    USING (public.get_admin_level(auth.uid()) = 'master');

-- D. support_audit_events
-- A política de auditoria do Master é mantida para consulta permanente de histórico.

-- ------------------------------------------------------------------------------
-- FASE 5: DESATIVAÇÃO DE TRIGGERS ATIVOS DE TRANSAÇÃO DO CHAT
-- Triggers de inserção e atualização de mensagens são desativados de forma limpa.
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_support_messages_update_conv_time ON public.support_messages;
DROP FUNCTION IF EXISTS public.handle_new_support_message();

DROP TRIGGER IF EXISTS trg_support_conversations_auto_assign ON public.support_conversations;
DROP FUNCTION IF EXISTS public.handle_new_support_conversation();

DROP TRIGGER IF EXISTS trg_support_conversations_updated_at ON public.support_conversations;

-- Os triggers de proteção de integridade (prevent_tampering) permanecem ativos
-- para garantir que os dados arquivados nunca sejam alterados indevidamente.

-- ------------------------------------------------------------------------------
-- FASE 6: PROCEDIMENTO DE REATIVAÇÃO
-- Para reativar o chat Camila Ricci a qualquer momento mantendo todo o histórico:
-- Basta executar novamente o script 16_support_chat_system.sql.
-- ------------------------------------------------------------------------------
