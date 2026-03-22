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
      chapters: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          project_id: string
          sort_order: number | null
          status: string
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          project_id: string
          sort_order?: number | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          project_id?: string
          sort_order?: number | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
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
      projects: {
        Row: {
          adaptation_type: string | null
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
          world_setting: string | null
          writing_style: string | null
        }
        Insert: {
          adaptation_type?: string | null
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
          world_setting?: string | null
          writing_style?: string | null
        }
        Update: {
          adaptation_type?: string | null
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
