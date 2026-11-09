export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string
          balance: number
          created_at: string
          currency: string
          holder_name: string | null
          iban: string | null
          id: string
          swift: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          balance?: number
          created_at?: string
          currency?: string
          holder_name?: string | null
          iban?: string | null
          id?: string
          swift?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          balance?: number
          created_at?: string
          currency?: string
          holder_name?: string | null
          iban?: string | null
          id?: string
          swift?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_plans: {
        Row: {
          admin_user_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          notes: string | null
          plan_name: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          notes?: string | null
          plan_name?: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          notes?: string | null
          plan_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_user_notes: {
        Row: {
          actor_admin_id: string | null
          author_id: string
          content: string
          created_at: string
          from_admin_id: string | null
          id: string
          to_admin_id: string | null
          user_id: string
        }
        Insert: {
          actor_admin_id?: string | null
          author_id: string
          content: string
          created_at?: string
          from_admin_id?: string | null
          id?: string
          to_admin_id?: string | null
          user_id: string
        }
        Update: {
          actor_admin_id?: string | null
          author_id?: string
          content?: string
          created_at?: string
          from_admin_id?: string | null
          id?: string
          to_admin_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      card_requests: {
        Row: {
          created_at: string
          credit_limit: number
          expiry: string | null
          holder_name: string | null
          id: string
          last4: string | null
          status: Database["public"]["Enums"]["card_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_limit?: number
          expiry?: string | null
          holder_name?: string | null
          id?: string
          last4?: string | null
          status?: Database["public"]["Enums"]["card_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_limit?: number
          expiry?: string | null
          holder_name?: string | null
          id?: string
          last4?: string | null
          status?: Database["public"]["Enums"]["card_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          created_at: string
          credit_limit: number | null
          id: string
          label: string
          last4: string | null
          status: Database["public"]["Enums"]["card_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_limit?: number | null
          id?: string
          label: string
          last4?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_limit?: number | null
          id?: string
          label?: string
          last4?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["credit_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["credit_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["credit_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          created_at: string
          id: string
          liveness_paths: string[]
          rejected_parts: string[]
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          statement1_path: string
          statement2_path: string
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liveness_paths?: string[]
          rejected_parts?: string[]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement1_path: string
          statement2_path: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liveness_paths?: string[]
          rejected_parts?: string[]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement1_path?: string
          statement2_path?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_blocked: boolean
          account_blocked_at: string | null
          avatar_url: string | null
          birth_date: string | null
          country: string
          created_at: string
          document_number: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          full_name: string | null
          id: string
          kyc_reviewed_at: string | null
          kyc_reviewed_by: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          tag_color: string
          transfer_locked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_blocked?: boolean
          account_blocked_at?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          country?: string
          created_at?: string
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          full_name?: string | null
          id?: string
          kyc_reviewed_at?: string | null
          kyc_reviewed_by?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          tag_color?: string
          transfer_locked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_blocked?: boolean
          account_blocked_at?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          country?: string
          created_at?: string
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          full_name?: string | null
          id?: string
          kyc_reviewed_at?: string | null
          kyc_reviewed_by?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          tag_color?: string
          transfer_locked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          description: string | null
          id: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          account_number: string
          amount: number
          bank_name: string
          beneficiary_doc: string
          beneficiary_email: string
          beneficiary_name: string
          converted_amount: number
          created_at: string
          currency_from: string
          currency_to: string
          fx_rate: number
          hmrc_doc_path: string | null
          id: string
          protocol: string | null
          purpose: string
          reference: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          swift: string
          to_country: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          amount: number
          bank_name: string
          beneficiary_doc: string
          beneficiary_email: string
          beneficiary_name: string
          converted_amount: number
          created_at?: string
          currency_from: string
          currency_to: string
          fx_rate: number
          hmrc_doc_path?: string | null
          id?: string
          protocol?: string | null
          purpose: string
          reference: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          swift: string
          to_country: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          amount?: number
          bank_name?: string
          beneficiary_doc?: string
          beneficiary_email?: string
          beneficiary_name?: string
          converted_amount?: number
          created_at?: string
          currency_from?: string
          currency_to?: string
          fx_rate?: number
          hmrc_doc_path?: string | null
          id?: string
          protocol?: string | null
          purpose?: string
          reference?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          swift?: string
          to_country?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_login_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          pix_key: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          pix_key?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          pix_key?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auth_verification_challenges: {
        Row: {
          attempts: number
          client_ip: string | null
          completed_at: string | null
          created_at: string
          encrypted_session: string
          expires_at: string
          id: string
          last_attempt_at: string | null
          lockout_until: string | null
          status: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          client_ip?: string | null
          completed_at?: string | null
          created_at?: string
          encrypted_session: string
          expires_at?: string
          id?: string
          last_attempt_at?: string | null
          lockout_until?: string | null
          status?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          client_ip?: string | null
          completed_at?: string | null
          created_at?: string
          encrypted_session?: string
          expires_at?: string
          id?: string
          last_attempt_at?: string | null
          lockout_until?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          protocol: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          protocol: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          protocol?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_complaints: {
        Row: {
          category: string
          created_at: string
          description: string
          email: string
          id: string
          name: string
          protocol: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          email: string
          id?: string
          name: string
          protocol: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          email?: string
          id?: string
          name?: string
          protocol?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scheduled_payments: {
        Row: {
          account_number: string
          amount: number
          beneficiary_name: string
          created_at: string
          currency: string
          frequency: string
          id: string
          reference: string | null
          scheduled_date: string
          sort_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          amount: number
          beneficiary_name: string
          created_at?: string
          currency?: string
          frequency?: string
          id?: string
          reference?: string | null
          scheduled_date: string
          sort_code?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          amount?: number
          beneficiary_name?: string
          created_at?: string
          currency?: string
          frequency?: string
          id?: string
          reference?: string | null
          scheduled_date?: string
          sort_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          id: string
          customer_id: string
          assigned_admin_id: string | null
          last_message_at: string
          customer_last_read_at: string | null
          admin_last_read_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          assigned_admin_id?: string | null
          last_message_at?: string
          customer_last_read_at?: string | null
          admin_last_read_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          assigned_admin_id?: string | null
          last_message_at?: string
          customer_last_read_at?: string | null
          admin_last_read_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_type: string
          sender_user_id: string | null
          body: string
          status: string
          is_auto_response: boolean
          delivered_at: string | null
          read_at: string | null
          read_by_user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_type: string
          sender_user_id?: string | null
          body: string
          status?: string
          is_auto_response?: boolean
          delivered_at?: string | null
          read_at?: string | null
          read_by_user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_type?: string
          sender_user_id?: string | null
          body?: string
          status?: string
          is_auto_response?: boolean
          delivered_at?: string | null
          read_at?: string | null
          read_by_user_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          }
        ]
      }
      support_attachments: {
        Row: {
          id: string
          conversation_id: string
          message_id: string | null
          uploaded_by_user_id: string
          file_name: string
          file_size: number
          mime_type: string
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          message_id?: string | null
          uploaded_by_user_id: string
          file_name: string
          file_size: number
          mime_type: string
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          message_id?: string | null
          uploaded_by_user_id?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          storage_path?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          }
        ]
      }
      support_audit_events: {
        Row: {
          id: string
          conversation_id: string | null
          message_id: string | null
          actor_user_id: string | null
          actor_role: string
          action: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id?: string | null
          message_id?: string | null
          actor_user_id?: string | null
          actor_role: string
          action: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string | null
          message_id?: string | null
          actor_user_id?: string | null
          actor_role?: string
          action?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_user_auth_activity: {
        Args: { _user_id: string }
        Returns: {
          action: string
          created_at: string
          ip_address: string
          payload: Json
        }[]
      }
      can_admin_see: {
        Args: { _admin_uid: string; _target_uid: string }
        Returns: boolean
      }
      get_admin_level: { Args: { _uid: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      submit_transfer_atomic: {
        Args: {
          _account_number: string
          _amount: number
          _bank_name: string
          _beneficiary_doc: string
          _beneficiary_email: string
          _beneficiary_name: string
          _converted_amount: number
          _currency_from: string
          _currency_to: string
          _fx_rate: number
          _hmrc_doc_path?: string | null
          _idempotency_key?: string | null
          _protocol: string
          _purpose: string
          _reference: string
          _swift: string
          _to_country: string
          _user_id: string
        }
        Returns: {
          id: string
          protocol: string
          status: string
          idempotent_replay?: boolean
        }
      }
      review_transfer_atomic: {
        Args: {
          _rejection_reason?: string | null
          _reviewer_id: string
          _target_status: string
          _transfer_id: string
        }
        Returns: {
          id: string
          ok: boolean
          status: string
        }
      }
      admin_update_balance_atomic: {
        Args: {
          _admin_id: string
          _expected_current_balance: number
          _new_balance: number
          _reason?: string | null
          _user_id: string
        }
        Returns: {
          delta: number
          new_balance: number
          ok: boolean
          previous_balance: number
        }
      }
      create_verification_challenge: {
        Args: {
          _user_id: string
          _encrypted_session: string
          _ip_address?: string | null
          _user_agent?: string | null
        }
        Returns: string
      }
      verify_sort_code_attempt: {
        Args: {
          _challenge_id: string
          _provided_sort_code: string
        }
        Returns: {
          success: boolean
          error?: string
          lockout?: boolean
          expired?: boolean
          reused?: boolean
          remaining_attempts?: number
          user_id?: string
          encrypted_session?: string
        }
      }
      normalize_sort_code: {
        Args: {
          raw_code: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user" | "adm_geral" | "adm_comum"
      card_request_status: "solicitado" | "aprovado" | "recusado"
      card_status: "solicitado" | "ativo" | "bloqueado" | "cancelado"
      credit_status: "solicitado" | "em_analise" | "aprovado" | "recusado"
      document_type: "cpf" | "ssn" | "nif" | "dni" | "passport" | "other"
      kyc_status: "not_started" | "pending" | "approved" | "rejected"
      transaction_type: "entrada" | "saida"
      withdrawal_status: "solicitado" | "aprovado" | "recusado" | "bloqueado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "adm_geral", "adm_comum"],
      card_request_status: ["solicitado", "aprovado", "recusado"],
      card_status: ["solicitado", "ativo", "bloqueado", "cancelado"],
      credit_status: ["solicitado", "em_analise", "aprovado", "recusado"],
      document_type: ["cpf", "ssn", "nif", "dni", "passport", "other"],
      kyc_status: ["not_started", "pending", "approved", "rejected"],
      transaction_type: ["entrada", "saida"],
      withdrawal_status: ["solicitado", "aprovado", "recusado", "bloqueado"],
    },
  },
} as const
