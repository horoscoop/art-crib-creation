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
      alerts: {
        Row: {
          artwork_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["alert_kind"]
          measured_value: number | null
          message: string
          resolved: boolean
          resolved_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          threshold_value: number | null
        }
        Insert: {
          artwork_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["alert_kind"]
          measured_value?: number | null
          message: string
          resolved?: boolean
          resolved_at?: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          threshold_value?: number | null
        }
        Update: {
          artwork_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["alert_kind"]
          measured_value?: number | null
          message?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          threshold_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
        ]
      }
      artworks: {
        Row: {
          artist: string | null
          baseline: Json | null
          created_at: string
          hanging_system_id: string | null
          id: string
          install_date: string | null
          koa_system: string | null
          location: string | null
          max_drift_mm: number
          max_humidity: number
          max_tilt_deg: number
          notes: string | null
          owner_id: string
          photo_url: string | null
          title: string
          updated_at: string
          wall_type: string | null
          weight_kg: number
        }
        Insert: {
          artist?: string | null
          baseline?: Json | null
          created_at?: string
          hanging_system_id?: string | null
          id?: string
          install_date?: string | null
          koa_system?: string | null
          location?: string | null
          max_drift_mm?: number
          max_humidity?: number
          max_tilt_deg?: number
          notes?: string | null
          owner_id: string
          photo_url?: string | null
          title: string
          updated_at?: string
          wall_type?: string | null
          weight_kg: number
        }
        Update: {
          artist?: string | null
          baseline?: Json | null
          created_at?: string
          hanging_system_id?: string | null
          id?: string
          install_date?: string | null
          koa_system?: string | null
          location?: string | null
          max_drift_mm?: number
          max_humidity?: number
          max_tilt_deg?: number
          notes?: string | null
          owner_id?: string
          photo_url?: string | null
          title?: string
          updated_at?: string
          wall_type?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "artworks_hanging_system_id_fkey"
            columns: ["hanging_system_id"]
            isOneToOne: false
            referencedRelation: "hanging_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          artwork_id: string
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          artwork_id: string
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          artwork_id?: string
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
        ]
      }
      backups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          rows_count: number | null
          size_bytes: number | null
          storage_path: string
          tables_count: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          rows_count?: number | null
          size_bytes?: number | null
          storage_path: string
          tables_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          rows_count?: number | null
          size_bytes?: number | null
          storage_path?: string
          tables_count?: number | null
        }
        Relationships: []
      }
      connection_logs: {
        Row: {
          created_at: string
          email: string | null
          event: string
          id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event: string
          id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      expertises: {
        Row: {
          artwork_id: string
          certificat_url: string | null
          charge_mesuree_kg: number | null
          created_at: string
          expert_id: string
          id: string
          kit_recommande: string | null
          performed_at: string
          rapport: string
          recommandations: string | null
          type: string
        }
        Insert: {
          artwork_id: string
          certificat_url?: string | null
          charge_mesuree_kg?: number | null
          created_at?: string
          expert_id: string
          id?: string
          kit_recommande?: string | null
          performed_at?: string
          rapport: string
          recommandations?: string | null
          type?: string
        }
        Update: {
          artwork_id?: string
          certificat_url?: string | null
          charge_mesuree_kg?: number | null
          created_at?: string
          expert_id?: string
          id?: string
          kit_recommande?: string | null
          performed_at?: string
          rapport?: string
          recommandations?: string | null
          type?: string
        }
        Relationships: []
      }
      gateway_artwork_map: {
        Row: {
          artwork_id: string
          gateway_id: string
          id: string
          sensor_field_map: Json
        }
        Insert: {
          artwork_id: string
          gateway_id: string
          id?: string
          sensor_field_map?: Json
        }
        Update: {
          artwork_id?: string
          gateway_id?: string
          id?: string
          sensor_field_map?: Json
        }
        Relationships: [
          {
            foreignKeyName: "gateway_artwork_map_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_artwork_map_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "sensor_gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      hanging_systems: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          illustration_url: string | null
          maintenance_interval_years: number | null
          max_weight_kg: number | null
          name: string
          wall_types: string[] | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          illustration_url?: string | null
          maintenance_interval_years?: number | null
          max_weight_kg?: number | null
          name: string
          wall_types?: string[] | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          illustration_url?: string | null
          maintenance_interval_years?: number | null
          max_weight_kg?: number | null
          name?: string
          wall_types?: string[] | null
        }
        Relationships: []
      }
      inspections: {
        Row: {
          artwork_id: string
          created_at: string
          id: string
          inspector_id: string
          next_due_at: string | null
          notes: string | null
          performed_at: string
          period_type: string
          score_global: number | null
          signatures: Json
        }
        Insert: {
          artwork_id: string
          created_at?: string
          id?: string
          inspector_id: string
          next_due_at?: string | null
          notes?: string | null
          performed_at?: string
          period_type?: string
          score_global?: number | null
          signatures?: Json
        }
        Update: {
          artwork_id?: string
          created_at?: string
          id?: string
          inspector_id?: string
          next_due_at?: string | null
          notes?: string | null
          performed_at?: string
          period_type?: string
          score_global?: number | null
          signatures?: Json
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          artwork_id: string
          created_at: string
          description: string
          id: string
          kind: string
          performed_at: string
          performed_by: string | null
          photo_url: string | null
        }
        Insert: {
          artwork_id: string
          created_at?: string
          description: string
          id?: string
          kind: string
          performed_at?: string
          performed_by?: string | null
          photo_url?: string | null
        }
        Update: {
          artwork_id?: string
          created_at?: string
          description?: string
          id?: string
          kind?: string
          performed_at?: string
          performed_by?: string | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          organization: string | null
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          organization?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          organization?: string | null
          role?: string
        }
        Relationships: []
      }
      sensor_gateways: {
        Row: {
          auth_token: string
          created_at: string
          endpoint: string | null
          id: string
          last_sync_at: string | null
          name: string
          owner_id: string
          payload_mapping: Json
          protocol: string
          status: string | null
          sync_interval_s: number | null
        }
        Insert: {
          auth_token?: string
          created_at?: string
          endpoint?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          owner_id: string
          payload_mapping?: Json
          protocol?: string
          status?: string | null
          sync_interval_s?: number | null
        }
        Update: {
          auth_token?: string
          created_at?: string
          endpoint?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          owner_id?: string
          payload_mapping?: Json
          protocol?: string
          status?: string | null
          sync_interval_s?: number | null
        }
        Relationships: []
      }
      sensor_readings: {
        Row: {
          artwork_id: string
          created_at: string
          drift_mm: number | null
          humidity_pct: number | null
          id: string
          recorded_at: string
          source: string
          temperature_c: number | null
          tension_n: number | null
          tilt_deg: number | null
        }
        Insert: {
          artwork_id: string
          created_at?: string
          drift_mm?: number | null
          humidity_pct?: number | null
          id?: string
          recorded_at?: string
          source?: string
          temperature_c?: number | null
          tension_n?: number | null
          tilt_deg?: number | null
        }
        Update: {
          artwork_id?: string
          created_at?: string
          drift_mm?: number | null
          humidity_pct?: number | null
          id?: string
          recorded_at?: string
          source?: string
          temperature_c?: number | null
          tension_n?: number | null
          tilt_deg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_kind:
        | "humidity"
        | "tilt"
        | "drift"
        | "tension"
        | "temperature"
        | "maintenance_due"
      alert_severity: "info" | "vigilance" | "critical"
      app_role: "admin" | "conservateur" | "expert_koa"
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
    Enums: {
      alert_kind: [
        "humidity",
        "tilt",
        "drift",
        "tension",
        "temperature",
        "maintenance_due",
      ],
      alert_severity: ["info", "vigilance", "critical"],
      app_role: ["admin", "conservateur", "expert_koa"],
    },
  },
} as const
