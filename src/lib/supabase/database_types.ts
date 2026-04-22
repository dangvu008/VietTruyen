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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      author_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_public: boolean | null
          profile_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_public?: boolean | null
          profile_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_public?: boolean | null
          profile_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          project_id: string
          sort_order: number | null
          status: string
          summary: string | null
          title: string
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          project_id: string
          sort_order?: number | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          project_id?: string
          sort_order?: number | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          arc: string | null
          created_at: string | null
          current_stage: string | null
          id: string
          name: string
          project_id: string
          role: string | null
          sort_order: number | null
          traits: string | null
          updated_at: string | null
        }
        Insert: {
          arc?: string | null
          created_at?: string | null
          current_stage?: string | null
          id?: string
          name?: string
          project_id: string
          role?: string | null
          sort_order?: number | null
          traits?: string | null
          updated_at?: string | null
        }
        Update: {
          arc?: string | null
          created_at?: string | null
          current_stage?: string | null
          id?: string
          name?: string
          project_id?: string
          role?: string | null
          sort_order?: number | null
          traits?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      foreshadowings: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_resolved: boolean | null
          project_id: string
          related_entity_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string
          id?: string
          is_resolved?: boolean | null
          project_id: string
          related_entity_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_resolved?: boolean | null
          project_id?: string
          related_entity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foreshadowings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      outline_beats: {
        Row: {
          created_at: string | null
          focus: string | null
          id: string
          project_id: string
          sort_order: number | null
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          focus?: string | null
          id?: string
          project_id: string
          sort_order?: number | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          focus?: string | null
          id?: string
          project_id?: string
          sort_order?: number | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outline_beats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          adaptation_type: string | null
          allow_comments: boolean | null
          character_setup: string | null
          created_at: string | null
          endgame: string | null
          genre: string | null
          id: string
          logline: string | null
          main_character_count: number | null
          main_plot: string | null
          notes: string | null
          source_project_id: string | null
          style_id: string | null
          sub_genre: string[] | null
          support_character_count: number | null
          target_chapters: number | null
          title: string
          tone: string | null
          updated_at: string | null
          user_id: string
          visibility: string | null
          world_setting: string | null
          writing_style: string | null
        }
        Insert: {
          adaptation_type?: string | null
          allow_comments?: boolean | null
          character_setup?: string | null
          created_at?: string | null
          endgame?: string | null
          genre?: string | null
          id?: string
          logline?: string | null
          main_character_count?: number | null
          main_plot?: string | null
          notes?: string | null
          source_project_id?: string | null
          style_id?: string | null
          sub_genre?: string[] | null
          support_character_count?: number | null
          target_chapters?: number | null
          title?: string
          tone?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string | null
          world_setting?: string | null
          writing_style?: string | null
        }
        Update: {
          adaptation_type?: string | null
          allow_comments?: boolean | null
          character_setup?: string | null
          created_at?: string | null
          endgame?: string | null
          genre?: string | null
          id?: string
          logline?: string | null
          main_character_count?: number | null
          main_plot?: string | null
          notes?: string | null
          source_project_id?: string | null
          style_id?: string | null
          sub_genre?: string[] | null
          support_character_count?: number | null
          target_chapters?: number | null
          title?: string
          tone?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
          world_setting?: string | null
          writing_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_stories: {
        Row: {
          chapter_count: number | null
          chapters: Json
          characters: Json | null
          cover_emoji: string | null
          created_at: string | null
          genre: string | null
          id: string
          like_count: number | null
          logline: string | null
          project_id: string
          status: string
          sub_genre: string[] | null
          title: string
          updated_at: string | null
          user_id: string
          view_count: number | null
          word_count: number | null
        }
        Insert: {
          chapter_count?: number | null
          chapters?: Json
          characters?: Json | null
          cover_emoji?: string | null
          created_at?: string | null
          genre?: string | null
          id?: string
          like_count?: number | null
          logline?: string | null
          project_id: string
          status?: string
          sub_genre?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
          view_count?: number | null
          word_count?: number | null
        }
        Update: {
          chapter_count?: number | null
          chapters?: Json
          characters?: Json | null
          cover_emoji?: string | null
          created_at?: string | null
          genre?: string | null
          id?: string
          like_count?: number | null
          logline?: string | null
          project_id?: string
          status?: string
          sub_genre?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
          view_count?: number | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "shared_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reports: {
        Row: {
          author_note: string | null
          category: string
          chapter_index: number | null
          created_at: string | null
          description: string
          excerpt: string | null
          id: string
          reporter_id: string
          status: string
          story_id: string
          updated_at: string | null
        }
        Insert: {
          author_note?: string | null
          category?: string
          chapter_index?: number | null
          created_at?: string | null
          description: string
          excerpt?: string | null
          id?: string
          reporter_id: string
          status?: string
          story_id: string
          updated_at?: string | null
        }
        Update: {
          author_note?: string | null
          category?: string
          chapter_index?: number | null
          created_at?: string | null
          description?: string
          excerpt?: string | null
          id?: string
          reporter_id?: string
          status?: string
          story_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_reports_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "shared_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_versions: {
        Row: {
          id: string
          chapter_id: string
          project_id: string
          version_number: number
          title: string | null
          content: string
          summary: string | null
          word_count: number | null
          author_id: string
          change_note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          chapter_id: string
          project_id: string
          version_number: number
          title?: string | null
          content: string
          summary?: string | null
          word_count?: number | null
          author_id: string
          change_note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          chapter_id?: string
          project_id?: string
          version_number?: number
          title?: string | null
          content?: string
          summary?: string | null
          word_count?: number | null
          author_id?: string
          change_note?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_versions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      story_branches: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          source_branch_id: string | null
          status: string
          author_id: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          name?: string
          description?: string | null
          source_branch_id?: string | null
          status?: string
          author_id: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string | null
          source_branch_id?: string | null
          status?: string
          author_id?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_branches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_chapters: {
        Row: {
          id: string
          branch_id: string
          chapter_id: string | null
          title: string
          content: string
          summary: string | null
          sort_order: number | null
          status: string | null
          word_count: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          branch_id: string
          chapter_id?: string | null
          title?: string
          content?: string
          summary?: string | null
          sort_order?: number | null
          status?: string | null
          word_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          branch_id?: string
          chapter_id?: string | null
          title?: string
          content?: string
          summary?: string | null
          sort_order?: number | null
          status?: string | null
          word_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_chapters_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "story_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_chapters_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_comments: {
        Row: {
          id: string
          chapter_id: string | null
          branch_id: string | null
          project_id: string
          parent_id: string | null
          author_id: string
          content: string
          status: string | null
          line_ref: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          chapter_id?: string | null
          branch_id?: string | null
          project_id: string
          parent_id?: string | null
          author_id: string
          content?: string
          status?: string | null
          line_ref?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          chapter_id?: string | null
          branch_id?: string | null
          project_id?: string
          parent_id?: string | null
          author_id?: string
          content?: string
          status?: string | null
          line_ref?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_comments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_comments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "story_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          calls_count: number | null
          created_at: string | null
          id: string
          month: string
          tokens_limit: number
          tokens_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calls_count?: number | null
          created_at?: string | null
          id?: string
          month: string
          tokens_limit: number
          tokens_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calls_count?: number | null
          created_at?: string | null
          id?: string
          month?: string
          tokens_limit?: number
          tokens_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      world_rules: {
        Row: {
          currency: string | null
          factions: string[] | null
          geography: string | null
          id: string
          magic_system: string | null
          project_id: string
          rules: string | null
          tech_level: string | null
        }
        Insert: {
          currency?: string | null
          factions?: string[] | null
          geography?: string | null
          id?: string
          magic_system?: string | null
          project_id: string
          rules?: string | null
          tech_level?: string | null
        }
        Update: {
          currency?: string | null
          factions?: string[] | null
          geography?: string | null
          id?: string
          magic_system?: string | null
          project_id?: string
          rules?: string | null
          tech_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "world_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_or_create_token_usage: {
        Args: { p_user_id: string }
        Returns: {
          calls_count: number | null
          created_at: string | null
          id: string
          month: string
          tokens_limit: number
          tokens_used: number | null
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "token_usage"
          isOneToOne: true
          isSetofReturn: false
        }
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

