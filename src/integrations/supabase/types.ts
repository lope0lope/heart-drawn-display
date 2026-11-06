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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      capture_ingest_log: {
        Row: {
          client_id: string
          croc_id: number | null
          inspection_date: string | null
          received_at: string
          tag: string | null
        }
        Insert: {
          client_id: string
          croc_id?: number | null
          inspection_date?: string | null
          received_at?: string
          tag?: string | null
        }
        Update: {
          client_id?: string
          croc_id?: number | null
          inspection_date?: string | null
          received_at?: string
          tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capture_ingest_log_croc_id_fkey"
            columns: ["croc_id"]
            isOneToOne: false
            referencedRelation: "crocs"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_codes: {
        Row: {
          code: string
          color_var: string
          is_hide: boolean
          is_live: boolean
          name: string
        }
        Insert: {
          code: string
          color_var?: string
          is_hide?: boolean
          is_live?: boolean
          name: string
        }
        Update: {
          code?: string
          color_var?: string
          is_hide?: boolean
          is_live?: boolean
          name?: string
        }
        Relationships: []
      }
      croc_photos: {
        Row: {
          belly_cm: number | null
          created_at: string
          croc_id: number | null
          id: number
          inspection_date: string
          marks: Json | null
          photo_url: string
          storage_path: string | null
          tag: string | null
        }
        Insert: {
          belly_cm?: number | null
          created_at?: string
          croc_id?: number | null
          id?: number
          inspection_date: string
          marks?: Json | null
          photo_url: string
          storage_path?: string | null
          tag?: string | null
        }
        Update: {
          belly_cm?: number | null
          created_at?: string
          croc_id?: number | null
          id?: number
          inspection_date?: string
          marks?: Json | null
          photo_url?: string
          storage_path?: string | null
          tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "croc_photos_croc_id_fkey"
            columns: ["croc_id"]
            isOneToOne: false
            referencedRelation: "crocs"
            referencedColumns: ["id"]
          },
        ]
      }
      crocs: {
        Row: {
          belly_cm: number | null
          condition_codes: string[]
          cull_schedule: string | null
          id: number
          inspection_date: string
          line: string
          pen_id: string
          pen_since: string | null
          pen_slot: number
          placement_belly_cm: number | null
          placement_date: string | null
          tag: string | null
        }
        Insert: {
          belly_cm?: number | null
          condition_codes?: string[]
          cull_schedule?: string | null
          id?: number
          inspection_date: string
          line: string
          pen_id: string
          pen_since?: string | null
          pen_slot: number
          placement_belly_cm?: number | null
          placement_date?: string | null
          tag?: string | null
        }
        Update: {
          belly_cm?: number | null
          condition_codes?: string[]
          cull_schedule?: string | null
          id?: number
          inspection_date?: string
          line?: string
          pen_id?: string
          pen_since?: string | null
          pen_slot?: number
          placement_belly_cm?: number | null
          placement_date?: string | null
          tag?: string | null
        }
        Relationships: []
      }
      cull_records: {
        Row: {
          created_at: string
          croc_id: number | null
          cull_date: string
          id: number
          reason: string | null
          size_band_index: number | null
        }
        Insert: {
          created_at?: string
          croc_id?: number | null
          cull_date: string
          id?: number
          reason?: string | null
          size_band_index?: number | null
        }
        Update: {
          created_at?: string
          croc_id?: number | null
          cull_date?: string
          id?: number
          reason?: string | null
          size_band_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cull_records_croc_id_fkey"
            columns: ["croc_id"]
            isOneToOne: false
            referencedRelation: "crocs"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_records: {
        Row: {
          croc_count: number | null
          cycle: string
          feed_kg: number
          id: number
          line: string
          pen_id: string
          recorded_date: string
        }
        Insert: {
          croc_count?: number | null
          cycle: string
          feed_kg?: number
          id?: number
          line: string
          pen_id: string
          recorded_date: string
        }
        Update: {
          croc_count?: number | null
          cycle?: string
          feed_kg?: number
          id?: number
          line?: string
          pen_id?: string
          recorded_date?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          belly_cm: number | null
          condition_codes: string[]
          croc_id: number
          id: number
          inspection_date: string
          line: string | null
          pen_id: string | null
          pen_slot: number | null
        }
        Insert: {
          belly_cm?: number | null
          condition_codes?: string[]
          croc_id: number
          id?: number
          inspection_date: string
          line?: string | null
          pen_id?: string | null
          pen_slot?: number | null
        }
        Update: {
          belly_cm?: number | null
          condition_codes?: string[]
          croc_id?: number
          id?: number
          inspection_date?: string
          line?: string | null
          pen_id?: string | null
          pen_slot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_croc_id_fkey"
            columns: ["croc_id"]
            isOneToOne: false
            referencedRelation: "crocs"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_logs: {
        Row: {
          filename: string
          id: number
          record_count: number
          status: string
          uploaded_at: string
          warnings: number
        }
        Insert: {
          filename: string
          id?: number
          record_count?: number
          status?: string
          uploaded_at?: string
          warnings?: number
        }
        Update: {
          filename?: string
          id?: number
          record_count?: number
          status?: string
          uploaded_at?: string
          warnings?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_capture: { Args: { e: Json; p_photo_url?: string }; Returns: Json }
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
    Enums: {},
  },
} as const
