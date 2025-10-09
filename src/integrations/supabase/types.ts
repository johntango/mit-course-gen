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
      agent_runs: {
        Row: {
          agent_type: string
          completed_at: string | null
          course_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input_data: Json | null
          messages: Json | null
          output_data: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          agent_type: string
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_data?: Json | null
          messages?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          agent_type?: string
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_data?: Json | null
          messages?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status?: string
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
      course_specs: {
        Row: {
          course_id: string
          created_at: string
          id: string
          spec_data: Json
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          spec_data: Json
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          spec_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "course_specs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          length_hours: number
          s3_error_message: string | null
          s3_manifest_url: string | null
          s3_published_at: string | null
          s3_sync_status: string | null
          status: string
          target_knowledge_level: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          length_hours: number
          s3_error_message?: string | null
          s3_manifest_url?: string | null
          s3_published_at?: string | null
          s3_sync_status?: string | null
          status?: string
          target_knowledge_level: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          length_hours?: number
          s3_error_message?: string | null
          s3_manifest_url?: string | null
          s3_published_at?: string | null
          s3_sync_status?: string | null
          status?: string
          target_knowledge_level?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dummy_heygen_jobs: {
        Row: {
          created_at: string
          payload: Json
          status: string
          updated_at: string
          video_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          payload: Json
          status?: string
          updated_at?: string
          video_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          payload?: Json
          status?: string
          updated_at?: string
          video_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      lesson_attachments: {
        Row: {
          alt_text: string | null
          asset_type: string
          created_at: string | null
          created_by: string | null
          file_size: number | null
          filename: string | null
          id: string
          lesson_id: string
          metadata: Json | null
          mime_type: string | null
          public_url: string | null
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string | null
          uploaded_at: string | null
        }
        Insert: {
          alt_text?: string | null
          asset_type: string
          created_at?: string | null
          created_by?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          lesson_id: string
          metadata?: Json | null
          mime_type?: string | null
          public_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          uploaded_at?: string | null
        }
        Update: {
          alt_text?: string | null
          asset_type?: string
          created_at?: string | null
          created_by?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          lesson_id?: string
          metadata?: Json | null
          mime_type?: string | null
          public_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lesson_attachments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_videos: {
        Row: {
          avatar_id: string | null
          check_attempts: number
          created_at: string
          file_size: number | null
          generation_meta: Json | null
          id: string
          last_checked_at: string | null
          lesson_id: string
          mime_type: string | null
          next_check_at: string | null
          public_url: string | null
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string | null
          target_duration_s: number | null
          uploaded_at: string | null
          video_duration_s: number | null
          video_id: string | null
          video_provider: string
          video_script: string
          video_status: string | null
          video_url: string | null
          voice_id: string | null
        }
        Insert: {
          avatar_id?: string | null
          check_attempts?: number
          created_at?: string
          file_size?: number | null
          generation_meta?: Json | null
          id?: string
          last_checked_at?: string | null
          lesson_id: string
          mime_type?: string | null
          next_check_at?: string | null
          public_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          target_duration_s?: number | null
          uploaded_at?: string | null
          video_duration_s?: number | null
          video_id?: string | null
          video_provider?: string
          video_script: string
          video_status?: string | null
          video_url?: string | null
          voice_id?: string | null
        }
        Update: {
          avatar_id?: string | null
          check_attempts?: number
          created_at?: string
          file_size?: number | null
          generation_meta?: Json | null
          id?: string
          last_checked_at?: string | null
          lesson_id?: string
          mime_type?: string | null
          next_check_at?: string | null
          public_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          target_duration_s?: number | null
          uploaded_at?: string | null
          video_duration_s?: number | null
          video_id?: string | null
          video_provider?: string
          video_script?: string
          video_status?: string | null
          video_url?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_videos_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          avatar_id: string | null
          content: string | null
          created_at: string
          current_video_ref: string | null
          generation_meta: Json | null
          id: string
          last_generated_at: string | null
          module_id: string
          position: number
          title: string
          video_duration_sec: number | null
          video_id: string | null
          video_provider: string | null
          video_script: string | null
          video_status: string | null
          video_url: string | null
          voice_id: string | null
        }
        Insert: {
          avatar_id?: string | null
          content?: string | null
          created_at?: string
          current_video_ref?: string | null
          generation_meta?: Json | null
          id?: string
          last_generated_at?: string | null
          module_id: string
          position?: number
          title: string
          video_duration_sec?: number | null
          video_id?: string | null
          video_provider?: string | null
          video_script?: string | null
          video_status?: string | null
          video_url?: string | null
          voice_id?: string | null
        }
        Update: {
          avatar_id?: string | null
          content?: string | null
          created_at?: string
          current_video_ref?: string | null
          generation_meta?: Json | null
          id?: string
          last_generated_at?: string | null
          module_id?: string
          position?: number
          title?: string
          video_duration_sec?: number | null
          video_id?: string | null
          video_provider?: string | null
          video_script?: string | null
          video_status?: string | null
          video_url?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_current_video_ref_fkey"
            columns: ["current_video_ref"]
            isOneToOne: false
            referencedRelation: "lesson_videos"
            referencedColumns: ["id"]
          },
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
          created_at: string
          description: string | null
          id: string
          position: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
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
