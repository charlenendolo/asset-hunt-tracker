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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accessories: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          name: string
          quantity: number
          required: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          name: string
          quantity?: number
          required?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          name?: string
          quantity?: number
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "accessories_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      defects: {
        Row: {
          created_at: string
          description: string
          id: string
          machine_id: string
          reported_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          site_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          machine_id: string
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          site_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          machine_id?: string
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          site_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "defects_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_logins: {
        Row: {
          created_at: string
          enabled: boolean
          failed_attempts: number
          last_success_at: string | null
          lock_count: number
          locked_until: string | null
          pin_hash: string
          pin_must_change: boolean
          pin_salt: string
          pin_set_at: string
          select_ref: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          failed_attempts?: number
          last_success_at?: string | null
          lock_count?: number
          locked_until?: string | null
          pin_hash: string
          pin_must_change?: boolean
          pin_salt: string
          pin_set_at?: string
          select_ref?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          failed_attempts?: number
          last_success_at?: string | null
          lock_count?: number
          locked_until?: string | null
          pin_hash?: string
          pin_must_change?: boolean
          pin_salt?: string
          pin_set_at?: string
          select_ref?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_logins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      machine_photos: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          machine_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          machine_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          machine_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_photos_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          active: boolean
          asset_code: string
          category_id: string | null
          company_inventory_number: string | null
          created_at: string
          current_site_id: string | null
          description: string | null
          expected_return_at: string | null
          id: string
          inspection_required: boolean
          last_inspection_date: string | null
          manufacturer: string | null
          model: string | null
          name: string
          next_inspection_date: string | null
          purchase_date: string | null
          purchase_price: number | null
          responsible_user_id: string | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_code: string
          category_id?: string | null
          company_inventory_number?: string | null
          created_at?: string
          current_site_id?: string | null
          description?: string | null
          expected_return_at?: string | null
          id?: string
          inspection_required?: boolean
          last_inspection_date?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          next_inspection_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          responsible_user_id?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_code?: string
          category_id?: string | null
          company_inventory_number?: string | null
          created_at?: string
          current_site_id?: string | null
          description?: string | null
          expected_return_at?: string | null
          id?: string
          inspection_required?: boolean
          last_inspection_date?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          next_inspection_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          responsible_user_id?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "machine_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_current_site_id_fkey"
            columns: ["current_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string
          id: string
          machine_id: string
          maintenance_type: string
          notes: string | null
          scheduled_date: string | null
          service_provider: string | null
          status: string
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          machine_id: string
          maintenance_type: string
          notes?: string | null
          scheduled_date?: string | null
          service_provider?: string | null
          status?: string
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          machine_id?: string
          maintenance_type?: string
          notes?: string | null
          scheduled_date?: string | null
          service_provider?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          comment: string | null
          condition: string | null
          created_at: string
          equipment_complete: boolean | null
          expected_return_at: string | null
          from_site_id: string | null
          id: string
          machine_id: string
          movement_type: string
          performed_by: string | null
          responsible_user_id: string | null
          to_site_id: string | null
        }
        Insert: {
          comment?: string | null
          condition?: string | null
          created_at?: string
          equipment_complete?: boolean | null
          expected_return_at?: string | null
          from_site_id?: string | null
          id?: string
          machine_id: string
          movement_type: string
          performed_by?: string | null
          responsible_user_id?: string | null
          to_site_id?: string | null
        }
        Update: {
          comment?: string | null
          condition?: string | null
          created_at?: string
          equipment_complete?: boolean | null
          expected_return_at?: string | null
          from_site_id?: string | null
          id?: string
          machine_id?: string
          movement_type?: string
          performed_by?: string | null
          responsible_user_id?: string | null
          to_site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_from_site_id_fkey"
            columns: ["from_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_to_site_id_fkey"
            columns: ["to_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          end_at: string
          id: string
          machine_id: string
          notes: string | null
          reserved_by: string | null
          site_id: string | null
          start_at: string
          status: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          machine_id: string
          notes?: string | null
          reserved_by?: string | null
          site_id?: string | null
          start_at: string
          status?: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          machine_id?: string
          notes?: string | null
          reserved_by?: string | null
          site_id?: string | null
          start_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_reserved_by_fkey"
            columns: ["reserved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          name: string
          site_number: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name: string
          site_number?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          site_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          role: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
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
