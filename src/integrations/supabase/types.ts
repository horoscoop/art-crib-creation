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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    },
  },
} as const
