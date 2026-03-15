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
      chatbot_flow_history: {
        Row: {
          created_at: string
          edges: Json
          flow_id: string
          id: string
          name: string
          nodes: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          edges?: Json
          flow_id: string
          id?: string
          name: string
          nodes?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          edges?: Json
          flow_id?: string
          id?: string
          name?: string
          nodes?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flow_history_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flows: {
        Row: {
          active: boolean
          created_at: string
          edges: Json
          id: string
          instance_names: string[]
          name: string
          nodes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          edges?: Json
          id?: string
          instance_names?: string[]
          name: string
          nodes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          edges?: Json
          id?: string
          instance_names?: string[]
          name?: string
          nodes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_photos: {
        Row: {
          id: string
          photo_url: string
          remote_jid: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          photo_url: string
          remote_jid: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          photo_url?: string
          remote_jid?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contact_tags: {
        Row: {
          created_at: string
          id: string
          remote_jid: string
          tag_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          remote_jid: string
          tag_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          remote_jid?: string
          tag_name?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_labels: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          label_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          label_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          label_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_labels_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          contact_name: string | null
          created_at: string
          id: string
          instance_name: string | null
          last_message: string | null
          last_message_at: string | null
          lid: string | null
          phone_number: string | null
          remote_jid: string
          unread_count: number
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          last_message?: string | null
          last_message_at?: string | null
          lid?: string | null
          phone_number?: string | null
          remote_jid: string
          unread_count?: number
          user_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          last_message?: string | null
          last_message_at?: string | null
          lid?: string | null
          phone_number?: string | null
          remote_jid?: string
          unread_count?: number
          user_id?: string
        }
        Relationships: []
      }
      flow_executions: {
        Row: {
          conversation_id: string | null
          created_at: string
          current_node_index: number
          flow_id: string | null
          id: string
          instance_name: string | null
          remote_jid: string
          status: string
          updated_at: string
          user_id: string
          waiting_node_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          current_node_index?: number
          flow_id?: string | null
          id?: string
          instance_name?: string | null
          remote_jid: string
          status?: string
          updated_at?: string
          user_id: string
          waiting_node_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          current_node_index?: number
          flow_id?: string | null
          id?: string
          instance_name?: string | null
          remote_jid?: string
          status?: string
          updated_at?: string
          user_id?: string
          waiting_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_timeouts: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          execution_id: string
          flow_id: string
          id: string
          processed: boolean | null
          remote_jid: string
          timeout_at: string
          timeout_node_id: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          execution_id: string
          flow_id: string
          id?: string
          processed?: boolean | null
          remote_jid: string
          timeout_at: string
          timeout_node_id?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          execution_id?: string
          flow_id?: string
          id?: string
          processed?: boolean | null
          remote_jid?: string
          timeout_at?: string
          timeout_node_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_timeouts_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "flow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_timeouts_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          external_id: string | null
          id: string
          media_url: string | null
          message_type: string
          remote_jid: string
          status: string
          user_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          remote_jid: string
          status?: string
          user_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          remote_jid?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pixels: {
        Row: {
          access_token: string
          created_at: string
          id: string
          name: string
          pixel_id: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          name?: string
          pixel_id: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          name?: string
          pixel_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          app_public_url: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          meta_access_token: string | null
          meta_pixel_id: string | null
          openai_api_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_public_url?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          meta_access_token?: string | null
          meta_pixel_id?: string | null
          openai_api_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_public_url?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          meta_access_token?: string | null
          meta_pixel_id?: string | null
          openai_api_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      tracked_links: {
        Row: {
          clicked: boolean | null
          clicked_at: string | null
          conversation_id: string | null
          created_at: string | null
          execution_id: string | null
          flow_id: string
          id: string
          instance_name: string | null
          next_node_id: string | null
          original_url: string
          preview_description: string | null
          preview_image: string | null
          preview_title: string | null
          remote_jid: string
          short_code: string
          user_id: string
        }
        Insert: {
          clicked?: boolean | null
          clicked_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          execution_id?: string | null
          flow_id: string
          id?: string
          instance_name?: string | null
          next_node_id?: string | null
          original_url: string
          preview_description?: string | null
          preview_image?: string | null
          preview_title?: string | null
          remote_jid: string
          short_code: string
          user_id: string
        }
        Update: {
          clicked?: boolean | null
          clicked_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          execution_id?: string | null
          flow_id?: string
          id?: string
          instance_name?: string | null
          next_node_id?: string | null
          original_url?: string
          preview_description?: string | null
          preview_image?: string | null
          preview_title?: string | null
          remote_jid?: string
          short_code?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          id: string
          instance_name: string
          is_active: boolean | null
          message_delay_ms: number
          proxy_url: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_name: string
          is_active?: boolean | null
          message_delay_ms?: number
          proxy_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_name?: string
          is_active?: boolean | null
          message_delay_ms?: number
          proxy_url?: string | null
          status?: string | null
          updated_at?: string | null
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
      increment_unread: { Args: { conv_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
