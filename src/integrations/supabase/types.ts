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
      admin_login_codes: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          used?: boolean
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
        }
        Relationships: []
      }
      client_mappings: {
        Row: {
          client_email: string
          created_at: string
          id: string
          label: string | null
          panel: string
          subscription_id: string | null
        }
        Insert: {
          client_email: string
          created_at?: string
          id?: string
          label?: string | null
          panel: string
          subscription_id?: string | null
        }
        Update: {
          client_email?: string
          created_at?: string
          id?: string
          label?: string | null
          panel?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_mappings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      panels: {
        Row: {
          created_at: string
          host: string
          id: string
          last_checked_at: string | null
          name: string
          panel_url: string
          password: string
          public_host: string
          readiness: string
          slug: string | null
          ssh_auth_type: string
          ssh_key_passphrase: string
          ssh_password: string
          ssh_port: number
          ssh_user: string
          status: string
          status_message: string
          template: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          host: string
          id?: string
          last_checked_at?: string | null
          name: string
          panel_url: string
          password: string
          public_host?: string
          readiness?: string
          slug?: string | null
          ssh_auth_type?: string
          ssh_key_passphrase?: string
          ssh_password?: string
          ssh_port?: number
          ssh_user?: string
          status?: string
          status_message?: string
          template?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          host?: string
          id?: string
          last_checked_at?: string | null
          name?: string
          panel_url?: string
          password?: string
          public_host?: string
          readiness?: string
          slug?: string | null
          ssh_auth_type?: string
          ssh_key_passphrase?: string
          ssh_password?: string
          ssh_port?: number
          ssh_user?: string
          status?: string
          status_message?: string
          template?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      subscription_inbounds: {
        Row: {
          client_email: string
          created_at: string
          host: string
          id: string
          inbound_id: number
          panel: string
          port: number
          protocol: string
          remark: string
          stream_settings: Json
          subscription_id: string
        }
        Insert: {
          client_email: string
          created_at?: string
          host: string
          id?: string
          inbound_id: number
          panel: string
          port: number
          protocol: string
          remark: string
          stream_settings?: Json
          subscription_id: string
        }
        Update: {
          client_email?: string
          created_at?: string
          host?: string
          id?: string
          inbound_id?: number
          panel?: string
          port?: number
          protocol?: string
          remark?: string
          stream_settings?: Json
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_inbounds_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          client_email: string
          client_uuid: string
          created_at: string
          expiry_ms: number
          hits: number
          id: string
          last_accessed_at: string | null
          name: string
          slug: string
          sni_whitelist: string[]
          total_bytes: number
        }
        Insert: {
          client_email: string
          client_uuid: string
          created_at?: string
          expiry_ms?: number
          hits?: number
          id?: string
          last_accessed_at?: string | null
          name: string
          slug: string
          sni_whitelist?: string[]
          total_bytes?: number
        }
        Update: {
          client_email?: string
          client_uuid?: string
          created_at?: string
          expiry_ms?: number
          hits?: number
          id?: string
          last_accessed_at?: string | null
          name?: string
          slug?: string
          sni_whitelist?: string[]
          total_bytes?: number
        }
        Relationships: []
      }
      traffic_snapshots: {
        Row: {
          created_at: string
          id: string
          subscription_id: string
          used_bytes: number
        }
        Insert: {
          created_at?: string
          id?: string
          subscription_id: string
          used_bytes?: number
        }
        Update: {
          created_at?: string
          id?: string
          subscription_id?: string
          used_bytes?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
