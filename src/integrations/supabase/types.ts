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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agreement_acceptances: {
        Row: {
          agreement_id: string
          agreement_version_id: string
          created_at: string
          group_id: string
          id: string
          message: string | null
          person_user_id: string
          status: string
        }
        Insert: {
          agreement_id: string
          agreement_version_id: string
          created_at?: string
          group_id: string
          id?: string
          message?: string | null
          person_user_id: string
          status: string
        }
        Update: {
          agreement_id?: string
          agreement_version_id?: string
          created_at?: string
          group_id?: string
          id?: string
          message?: string | null
          person_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_acceptances_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_acceptances_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_acceptances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_versions: {
        Row: {
          agreement_id: string
          created_at: string
          fields: Json
          group_id: string
          id: string
          proposed_by_user_id: string
          version_num: number
        }
        Insert: {
          agreement_id: string
          created_at?: string
          fields?: Json
          group_id: string
          id?: string
          proposed_by_user_id: string
          version_num: number
        }
        Update: {
          agreement_id?: string
          created_at?: string
          fields?: Json
          group_id?: string
          id?: string
          proposed_by_user_id?: string
          version_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "agreement_versions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_versions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          created_at: string
          created_by_user_id: string
          current_version_id: string | null
          group_id: string
          id: string
          status: string
          subject_person_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          current_version_id?: string | null
          group_id: string
          id?: string
          status?: string
          subject_person_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          current_version_id?: string | null
          group_id?: string
          id?: string
          status?: string
          subject_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_user_id: string | null
          body: string | null
          created_at: string
          created_by_user_id: string
          group_id: string
          id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          source_id: string | null
          source_table: string | null
          status: string
          subject_person_id: string
          title: string
          type: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          body?: string | null
          created_at?: string
          created_by_user_id: string
          group_id: string
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          source_id?: string | null
          source_table?: string | null
          status?: string
          subject_person_id: string
          title: string
          type: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          body?: string | null
          created_at?: string
          created_by_user_id?: string
          group_id?: string
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          source_id?: string | null
          source_table?: string | null
          status?: string
          subject_person_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          author_user_id: string
          body: string
          channel: string | null
          consent_level: string
          created_at: string
          group_id: string
          id: string
          indicators: Json
          occurred_at: string
          subject_person_id: string
          visibility_tier: string
        }
        Insert: {
          author_user_id: string
          body: string
          channel?: string | null
          consent_level?: string
          created_at?: string
          group_id: string
          id?: string
          indicators?: Json
          occurred_at?: string
          subject_person_id: string
          visibility_tier?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          channel?: string | null
          consent_level?: string
          created_at?: string
          group_id?: string
          id?: string
          indicators?: Json
          occurred_at?: string
          subject_person_id?: string
          visibility_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      contradictions: {
        Row: {
          created_at: string
          created_by_user_id: string
          details: string | null
          group_id: string
          id: string
          related_agreement_ids: string[]
          related_note_ids: string[]
          resolution: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          status: string
          subject_person_id: string
          summary: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          details?: string | null
          group_id: string
          id?: string
          related_agreement_ids?: string[]
          related_note_ids?: string[]
          resolution?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          status?: string
          subject_person_id: string
          summary: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          details?: string | null
          group_id?: string
          id?: string
          related_agreement_ids?: string[]
          related_note_ids?: string[]
          resolution?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          status?: string
          subject_person_id?: string
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contradictions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contradictions_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          capabilities: Json
          created_at: string
          display_name: string | null
          group_id: string
          id: string
          is_active: boolean
          role: string
          user_id: string
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          display_name?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          role: string
          user_id: string
        }
        Update: {
          capabilities?: Json
          created_at?: string
          display_name?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      intervention_private_details: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          group_id: string
          id: string
          intervention_id: string
          subject_person_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          group_id: string
          id?: string
          intervention_id: string
          subject_person_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          intervention_id?: string
          subject_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_private_details_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_private_details_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_private_details_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          created_at: string
          created_by_user_id: string
          end_at: string | null
          group_id: string
          id: string
          rationale: string | null
          start_at: string | null
          status: string
          subject_person_id: string
          title: string
          type: string
          visibility_tier: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          end_at?: string | null
          group_id: string
          id?: string
          rationale?: string | null
          start_at?: string | null
          status?: string
          subject_person_id: string
          title: string
          type?: string
          visibility_tier?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          end_at?: string | null
          group_id?: string
          id?: string
          rationale?: string | null
          start_at?: string | null
          status?: string
          subject_person_id?: string
          title?: string
          type?: string
          visibility_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      person_access_requests: {
        Row: {
          created_at: string
          group_id: string
          id: string
          person_label: string
          requester_user_id: string
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          person_label: string
          requester_user_id: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          person_label?: string
          requester_user_id?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_access_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      person_consents: {
        Row: {
          consent_notes: string | null
          consent_scope: string
          created_at: string
          created_by_user_id: string
          effective_at: string
          group_id: string
          id: string
          revoked_at: string | null
          subject_person_id: string
        }
        Insert: {
          consent_notes?: string | null
          consent_scope?: string
          created_at?: string
          created_by_user_id: string
          effective_at?: string
          group_id: string
          id?: string
          revoked_at?: string | null
          subject_person_id: string
        }
        Update: {
          consent_notes?: string | null
          consent_scope?: string
          created_at?: string
          created_by_user_id?: string
          effective_at?: string
          group_id?: string
          id?: string
          revoked_at?: string | null
          subject_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_consents_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_consents_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_primary: boolean
          label: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_primary?: boolean
          label: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_primary?: boolean
          label?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_supported_person: {
        Args: {
          p_group_id: string
          p_request_id: string
          p_subject_user_id: string
        }
        Returns: string
      }
      bootstrap_create_group: { Args: { p_name: string }; Returns: string }
      is_group_coordinator: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_subject_person: {
        Args: { _person_id: string; _user_id: string }
        Returns: boolean
      }
      whoami: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
