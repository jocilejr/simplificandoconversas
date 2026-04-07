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
      ai_auto_reply_contacts: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          instance_name: string
          remote_jid: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          instance_name: string
          remote_jid: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          instance_name?: string
          remote_jid?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_auto_reply_contacts_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_config: {
        Row: {
          created_at: string | null
          id: string
          listen_rules: string | null
          max_context_messages: number | null
          reply_stop_contexts: string | null
          reply_system_prompt: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          listen_rules?: string | null
          max_context_messages?: number | null
          reply_stop_contexts?: string | null
          reply_system_prompt?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          listen_rules?: string | null
          max_context_messages?: number | null
          reply_stop_contexts?: string | null
          reply_system_prompt?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_config_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_listen_contacts: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          instance_name: string
          remote_jid: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          instance_name: string
          remote_jid: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          instance_name?: string
          remote_jid?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_listen_contacts_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          method: string
          path: string
          request_body: Json | null
          response_summary: string | null
          status_code: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          method: string
          path: string
          request_body?: Json | null
          response_summary?: string | null
          status_code: number
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          method?: string
          path?: string
          request_body?: Json | null
          response_summary?: string | null
          status_code?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_api_request_logs_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flow_history: {
        Row: {
          created_at: string
          edges: Json
          flow_id: string
          id: string
          name: string
          nodes: Json
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          edges?: Json
          flow_id: string
          id?: string
          name: string
          nodes?: Json
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          edges?: Json
          flow_id?: string
          id?: string
          name?: string
          nodes?: Json
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flow_history_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_chatbot_flow_history_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flows: {
        Row: {
          active: boolean
          created_at: string
          edges: Json
          folder: string | null
          id: string
          instance_names: string[]
          name: string
          nodes: Json
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          edges?: Json
          folder?: string | null
          id?: string
          instance_names?: string[]
          name: string
          nodes?: Json
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          edges?: Json
          folder?: string | null
          id?: string
          instance_names?: string[]
          name?: string
          nodes?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_chatbot_flows_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_photos: {
        Row: {
          id: string
          photo_url: string
          remote_jid: string
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          photo_url: string
          remote_jid: string
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          photo_url?: string
          remote_jid?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contact_photos_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          created_at: string
          id: string
          remote_jid: string
          tag_name: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          remote_jid: string
          tag_name: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          remote_jid?: string
          tag_name?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contact_tags_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_labels: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          label_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          label_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          label_id?: string
          user_id?: string
          workspace_id?: string
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
          {
            foreignKeyName: "fk_conversation_labels_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          instance_name: string | null
          last_message: string | null
          last_message_at: string | null
          lid: string | null
          phone_number: string | null
          remote_jid: string
          unread_count: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instance_name?: string | null
          last_message?: string | null
          last_message_at?: string | null
          lid?: string | null
          phone_number?: string | null
          remote_jid: string
          unread_count?: number
          user_id: string
          workspace_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instance_name?: string | null
          last_message?: string | null
          last_message_at?: string | null
          lid?: string | null
          phone_number?: string | null
          remote_jid?: string
          unread_count?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_conversations_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          auto_send: boolean
          created_at: string
          failed_count: number
          id: string
          name: string
          opened_count: number
          sent_at: string | null
          sent_count: number
          smtp_config_id: string | null
          status: string
          tag_filter: string | null
          template_id: string | null
          total_recipients: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          auto_send?: boolean
          created_at?: string
          failed_count?: number
          id?: string
          name: string
          opened_count?: number
          sent_at?: string | null
          sent_count?: number
          smtp_config_id?: string | null
          status?: string
          tag_filter?: string | null
          template_id?: string | null
          total_recipients?: number
          user_id: string
          workspace_id: string
        }
        Update: {
          auto_send?: boolean
          created_at?: string
          failed_count?: number
          id?: string
          name?: string
          opened_count?: number
          sent_at?: string | null
          sent_count?: number
          smtp_config_id?: string | null
          status?: string
          tag_filter?: string | null
          template_id?: string | null
          total_recipients?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_smtp_config_id_fkey"
            columns: ["smtp_config_id"]
            isOneToOne: false
            referencedRelation: "smtp_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_campaigns_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          source: string
          status: string
          tags: string[]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source?: string
          status?: string
          tags?: string[]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string
          status?: string
          tags?: string[]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_email_contacts_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          send_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          send_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          send_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "email_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_events_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_follow_up_sends: {
        Row: {
          created_at: string
          error_message: string | null
          follow_up_id: string
          id: string
          recipient_email: string
          scheduled_at: string
          sent_at: string | null
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          follow_up_id: string
          id?: string
          recipient_email: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          follow_up_id?: string
          id?: string
          recipient_email?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_follow_up_sends_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "email_follow_ups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_follow_up_sends_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_follow_ups: {
        Row: {
          campaign_id: string
          created_at: string
          delay_days: number
          id: string
          step_order: number
          template_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order?: number
          template_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order?: number
          template_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_follow_ups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_follow_ups_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_follow_ups_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_link_clicks: {
        Row: {
          clicked: boolean | null
          clicked_at: string | null
          created_at: string | null
          id: string
          original_url: string
          send_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          clicked?: boolean | null
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          original_url: string
          send_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          clicked?: boolean | null
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          original_url?: string
          send_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_link_clicks_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "email_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_link_clicks_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          personalization: Json | null
          processed_at: string | null
          recipient_email: string
          recipient_name: string | null
          smtp_config_id: string | null
          status: string
          template_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          personalization?: Json | null
          processed_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          smtp_config_id?: string | null
          status?: string
          template_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          personalization?: Json | null
          processed_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          smtp_config_id?: string | null
          status?: string
          template_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_queue_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          status: string
          template_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          status?: string
          template_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          status?: string
          template_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_sends_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_email_suppressions_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          created_at: string
          html_body: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          html_body?: string
          id?: string
          name: string
          subject?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          html_body?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_email_templates_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          results: Json | null
          status: string
          updated_at: string
          user_id: string
          waiting_node_id: string | null
          workspace_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          current_node_index?: number
          flow_id?: string | null
          id?: string
          instance_name?: string | null
          remote_jid: string
          results?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          waiting_node_id?: string | null
          workspace_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          current_node_index?: number
          flow_id?: string | null
          id?: string
          instance_name?: string | null
          remote_jid?: string
          results?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          waiting_node_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_flow_executions_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_flow_timeouts_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
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
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_labels_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_messages_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
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
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          name?: string
          pixel_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          name?: string
          pixel_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_meta_pixels_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_connections: {
        Row: {
          created_at: string | null
          credentials: Json
          enabled: boolean | null
          id: string
          platform: string
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          credentials?: Json
          enabled?: boolean | null
          id?: string
          platform: string
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          enabled?: boolean | null
          id?: string
          platform?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_platform_connections_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_public_url: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
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
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_quick_replies_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          completed: boolean | null
          contact_name: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          instance_name: string | null
          phone_number: string | null
          remote_jid: string
          title: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          completed?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          instance_name?: string | null
          phone_number?: string | null
          remote_jid: string
          title: string
          user_id: string
          workspace_id: string
        }
        Update: {
          completed?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          instance_name?: string | null
          phone_number?: string | null
          remote_jid?: string
          title?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_reminders_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_config: {
        Row: {
          created_at: string
          from_email: string
          from_name: string
          host: string
          id: string
          label: string
          password: string
          port: number
          updated_at: string
          user_id: string
          username: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          label?: string
          password?: string
          port?: number
          updated_at?: string
          user_id: string
          username?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          label?: string
          password?: string
          port?: number
          updated_at?: string
          user_id?: string
          username?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_smtp_config_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tracked_links_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_url: string | null
          source: string
          status: string
          type: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_url?: string | null
          source?: string
          status?: string
          type?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_url?: string | null
          source?: string
          status?: string
          type?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_transactions_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_whatsapp_instances_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          permissions: Json
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          app_public_url: string | null
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          name: string
          openai_api_key: string | null
          slug: string
        }
        Insert: {
          app_public_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          openai_api_key?: string | null
          slug: string
        }
        Update: {
          app_public_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          openai_api_key?: string | null
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_workspace: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      get_user_workspace_ids: { Args: { _user_id: string }; Returns: string[] }
      get_workspace_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["workspace_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      increment_unread: { Args: { conv_id: string }; Returns: undefined }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      workspace_role: "admin" | "operator" | "viewer"
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
      workspace_role: ["admin", "operator", "viewer"],
    },
  },
} as const
