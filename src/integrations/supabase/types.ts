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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agent_events: {
        Row: {
          created_at: string | null
          id: number
          level: string
          message: string
          meta: Json | null
          phase: string
          run_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          level?: string
          message: string
          meta?: Json | null
          phase: string
          run_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          level?: string
          message?: string
          meta?: Json | null
          phase?: string
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          course_id: string | null
          created_at: string | null
          error: string | null
          id: string
          kind: string
          payload: Json | null
          progress: number
          status: string
          summary: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          kind: string
          payload?: Json | null
          progress?: number
          status?: string
          summary?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          kind?: string
          payload?: Json | null
          progress?: number
          status?: string
          summary?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          artifact_type: string
          content: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          job_id: string
        }
        Insert: {
          artifact_type: string
          content?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          job_id: string
        }
        Update: {
          artifact_type?: string
          content?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          content_type: string | null
          course_id: string | null
          created_at: string | null
          id: string
          is_public: boolean
          storage_path: string
        }
        Insert: {
          content_type?: string | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean
          storage_path: string
        }
        Update: {
          content_type?: string | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          published: boolean
          slug: string
          title: string
          visibility: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          published?: boolean
          slug: string
          title: string
          visibility?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          published?: boolean
          slug?: string
          title?: string
          visibility?: string
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          created_at: string | null
          id: string
          prompt: Json
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prompt: Json
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          prompt?: Json
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content_html: string | null
          content_md: string | null
          created_at: string | null
          id: string
          module_id: string
          position: number
          published: boolean
          slug: string
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content_html?: string | null
          content_md?: string | null
          created_at?: string | null
          id?: string
          module_id: string
          position?: number
          published?: boolean
          slug: string
          summary?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content_html?: string | null
          content_md?: string | null
          created_at?: string | null
          id?: string
          module_id?: string
          position?: number
          published?: boolean
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          position: number
          slug: string
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          position?: number
          slug: string
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          position?: number
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          global_role: string
          org: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          global_role?: string
          org?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          global_role?: string
          org?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer: Json | null
          difficulty: number | null
          est_time_minutes: number | null
          id: string
          lesson_id: string | null
          options: Json | null
          solution: string | null
          stem: string | null
          type: string | null
        }
        Insert: {
          answer?: Json | null
          difficulty?: number | null
          est_time_minutes?: number | null
          id?: string
          lesson_id?: string | null
          options?: Json | null
          solution?: string | null
          stem?: string | null
          type?: string | null
        }
        Update: {
          answer?: Json | null
          difficulty?: number | null
          est_time_minutes?: number | null
          id?: string
          lesson_id?: string | null
          options?: Json | null
          solution?: string | null
          stem?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      triage_requests: {
        Row: {
          course_slug: string
          created_at: string | null
          diff: Json | null
          error: string | null
          id: string
          lesson_slug: string | null
          module_slug: string | null
          prompt: string
          scope: string
          status: string
          updated_at: string | null
        }
        Insert: {
          course_slug: string
          created_at?: string | null
          diff?: Json | null
          error?: string | null
          id?: string
          lesson_slug?: string | null
          module_slug?: string | null
          prompt: string
          scope: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          course_slug?: string
          created_at?: string | null
          diff?: Json | null
          error?: string | null
          id?: string
          lesson_slug?: string | null
          module_slug?: string | null
          prompt?: string
          scope?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_instructor_global: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      promote_admin: {
        Args: { target_email: string }
        Returns: undefined
      }
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
