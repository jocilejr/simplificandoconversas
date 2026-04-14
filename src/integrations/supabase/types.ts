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
      boleto_recovery_contacts: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          rule_id: string | null
          transaction_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          rule_id?: string | null
          transaction_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          rule_id?: string | null
          transaction_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boleto_recovery_contacts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "boleto_recovery_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boleto_recovery_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      boleto_recovery_rules: {
        Row: {
          created_at: string
          days: number
          id: string
          is_active: boolean
          media_blocks: Json
          message: string
          name: string
          priority: number
          rule_type: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          days?: number
          id?: string
          is_active?: boolean
          media_blocks?: Json
          message?: string
          name: string
          priority?: number
          rule_type?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          days?: number
          id?: string
          is_active?: boolean
          media_blocks?: Json
          message?: string
          name?: string
          priority?: number
          rule_type?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boleto_recovery_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      boleto_recovery_templates: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boleto_recovery_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      boleto_settings: {
        Row: {
          created_at: string
          default_expiration_days: number
          id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_expiration_days?: number
          id?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_expiration_days?: number
          id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boleto_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
          document: string | null
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
          document?: string | null
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
          document?: string | null
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
      daily_prayers: {
        Row: {
          created_at: string
          day_number: number
          id: string
          text: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          text: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          text?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_prayers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_accesses: {
        Row: {
          accessed_at: string
          created_at: string
          id: string
          phone: string | null
          pixel_fired: boolean
          product_id: string
          webhook_sent: boolean
          workspace_id: string
        }
        Insert: {
          accessed_at?: string
          created_at?: string
          id?: string
          phone?: string | null
          pixel_fired?: boolean
          product_id: string
          webhook_sent?: boolean
          workspace_id: string
        }
        Update: {
          accessed_at?: string
          created_at?: string
          id?: string
          phone?: string | null
          pixel_fired?: boolean
          product_id?: string
          webhook_sent?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_accesses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_accesses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_link_generations: {
        Row: {
          created_at: string
          id: string
          normalized_phone: string | null
          payment_method: string | null
          phone: string | null
          product_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_phone?: string | null
          payment_method?: string | null
          phone?: string | null
          product_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          normalized_phone?: string | null
          payment_method?: string | null
          phone?: string | null
          product_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_link_generations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_link_generations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_pixels: {
        Row: {
          access_token: string | null
          created_at: string
          event_name: string
          id: string
          is_active: boolean
          pixel_id: string
          platform: string
          product_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          event_name?: string
          id?: string
          is_active?: boolean
          pixel_id?: string
          platform?: string
          product_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          event_name?: string
          id?: string
          is_active?: boolean
          pixel_id?: string
          platform?: string
          product_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pixels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_products: {
        Row: {
          created_at: string
          delivery_webhook_url: string | null
          id: string
          is_active: boolean
          member_cover_image: string | null
          member_description: string | null
          name: string
          page_logo: string | null
          page_message: string
          page_title: string
          redirect_delay: number
          redirect_url: string | null
          slug: string
          updated_at: string
          value: number
          whatsapp_message: string | null
          whatsapp_number: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          delivery_webhook_url?: string | null
          id?: string
          is_active?: boolean
          member_cover_image?: string | null
          member_description?: string | null
          name: string
          page_logo?: string | null
          page_message?: string
          page_title?: string
          redirect_delay?: number
          redirect_url?: string | null
          slug: string
          updated_at?: string
          value?: number
          whatsapp_message?: string | null
          whatsapp_number?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          delivery_webhook_url?: string | null
          id?: string
          is_active?: boolean
          member_cover_image?: string | null
          member_description?: string | null
          name?: string
          page_logo?: string | null
          page_message?: string
          page_title?: string
          redirect_delay?: number
          redirect_url?: string | null
          slug?: string
          updated_at?: string
          value?: number
          whatsapp_message?: string | null
          whatsapp_number?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_settings: {
        Row: {
          created_at: string
          custom_domain: string | null
          delivery_message: string | null
          global_redirect_url: string | null
          id: string
          link_message_template: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          delivery_message?: string | null
          global_redirect_url?: string | null
          id?: string
          link_message_template?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          delivery_message?: string | null
          global_redirect_url?: string | null
          id?: string
          link_message_template?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
      financial_settings: {
        Row: {
          boleto_fee_type: string
          boleto_fee_value: number
          cartao_fee_type: string
          cartao_fee_value: number
          created_at: string
          id: string
          pix_fee_type: string
          pix_fee_value: number
          tax_name: string
          tax_type: string
          tax_value: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          boleto_fee_type?: string
          boleto_fee_value?: number
          cartao_fee_type?: string
          cartao_fee_value?: number
          created_at?: string
          id?: string
          pix_fee_type?: string
          pix_fee_value?: number
          tax_name?: string
          tax_type?: string
          tax_value?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          boleto_fee_type?: string
          boleto_fee_value?: number
          cartao_fee_type?: string
          cartao_fee_value?: number
          created_at?: string
          id?: string
          pix_fee_type?: string
          pix_fee_value?: number
          tax_name?: string
          tax_type?: string
          tax_value?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
      followup_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          instance_name: string | null
          max_messages_per_phone_per_day: number
          send_after_minutes: number
          send_at_hour: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          instance_name?: string | null
          max_messages_per_phone_per_day?: number
          send_after_minutes?: number
          send_at_hour?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          instance_name?: string | null
          max_messages_per_phone_per_day?: number
          send_after_minutes?: number
          send_at_hour?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      global_delivery_pixels: {
        Row: {
          access_token: string | null
          created_at: string
          event_name: string
          id: string
          is_active: boolean
          pixel_id: string
          platform: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          event_name?: string
          id?: string
          is_active?: boolean
          pixel_id?: string
          platform?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          event_name?: string
          id?: string
          is_active?: boolean
          pixel_id?: string
          platform?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_delivery_pixels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      group_campaigns: {
        Row: {
          created_at: string
          description: string | null
          group_jids: string[]
          id: string
          instance_name: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_jids?: string[]
          id?: string
          instance_name: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_jids?: string[]
          id?: string
          instance_name?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_queue: {
        Row: {
          campaign_id: string | null
          completed_at: string | null
          content: Json
          created_at: string
          error_message: string | null
          execution_batch: string | null
          group_jid: string
          group_name: string
          id: string
          instance_name: string
          message_type: string
          priority: number
          scheduled_message_id: string | null
          started_at: string | null
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          completed_at?: string | null
          content?: Json
          created_at?: string
          error_message?: string | null
          execution_batch?: string | null
          group_jid: string
          group_name?: string
          id?: string
          instance_name: string
          message_type?: string
          priority?: number
          scheduled_message_id?: string | null
          started_at?: string | null
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          completed_at?: string | null
          content?: Json
          created_at?: string
          error_message?: string | null
          execution_batch?: string | null
          group_jid?: string
          group_name?: string
          id?: string
          instance_name?: string
          message_type?: string
          priority?: number
          scheduled_message_id?: string | null
          started_at?: string | null
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "group_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_message_queue_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "group_scheduled_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_message_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      group_participant_events: {
        Row: {
          action: string
          created_at: string
          group_jid: string
          group_name: string
          id: string
          instance_name: string
          participant_jid: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          group_jid: string
          group_name?: string
          id?: string
          instance_name: string
          participant_jid: string
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          group_jid?: string
          group_name?: string
          id?: string
          instance_name?: string
          participant_jid?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_participant_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      group_queue_config: {
        Row: {
          created_at: string
          delay_between_sends_ms: number
          id: string
          max_messages_per_group: number
          per_minutes: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          delay_between_sends_ms?: number
          id?: string
          max_messages_per_group?: number
          per_minutes?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          delay_between_sends_ms?: number
          id?: string
          max_messages_per_group?: number
          per_minutes?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_queue_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      group_scheduled_messages: {
        Row: {
          campaign_id: string
          content: Json
          created_at: string
          cron_expression: string | null
          id: string
          interval_minutes: number | null
          is_active: boolean
          last_run_at: string | null
          message_type: string
          next_run_at: string | null
          schedule_type: string
          scheduled_at: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          content?: Json
          created_at?: string
          cron_expression?: string | null
          id?: string
          interval_minutes?: number | null
          is_active?: boolean
          last_run_at?: string | null
          message_type?: string
          next_run_at?: string | null
          schedule_type?: string
          scheduled_at?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          content?: Json
          created_at?: string
          cron_expression?: string | null
          id?: string
          interval_minutes?: number | null
          is_active?: boolean
          last_run_at?: string | null
          message_type?: string
          next_run_at?: string | null
          schedule_type?: string
          scheduled_at?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_scheduled_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "group_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_scheduled_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      group_selected: {
        Row: {
          created_at: string
          group_jid: string
          group_name: string
          id: string
          instance_name: string
          member_count: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          group_jid: string
          group_name?: string
          id?: string
          instance_name: string
          member_count?: number
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          group_jid?: string
          group_name?: string
          id?: string
          instance_name?: string
          member_count?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_selected_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      group_smart_link_clicks: {
        Row: {
          created_at: string
          group_jid: string
          id: string
          redirected_to: string | null
          smart_link_id: string
        }
        Insert: {
          created_at?: string
          group_jid: string
          id?: string
          redirected_to?: string | null
          smart_link_id: string
        }
        Update: {
          created_at?: string
          group_jid?: string
          id?: string
          redirected_to?: string | null
          smart_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_smart_link_clicks_smart_link_id_fkey"
            columns: ["smart_link_id"]
            isOneToOne: false
            referencedRelation: "group_smart_links"
            referencedColumns: ["id"]
          },
        ]
      }
      group_smart_links: {
        Row: {
          campaign_id: string | null
          created_at: string
          current_group_index: number
          group_links: Json
          id: string
          instance_name: string | null
          is_active: boolean
          max_members_per_group: number
          slug: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          current_group_index?: number
          group_links?: Json
          id?: string
          instance_name?: string | null
          is_active?: boolean
          max_members_per_group?: number
          slug: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          current_group_index?: number
          group_links?: Json
          id?: string
          instance_name?: string | null
          is_active?: boolean
          max_members_per_group?: number
          slug?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_smart_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "group_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_smart_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      manual_boleto_settings: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          webhook_url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          webhook_url?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          webhook_url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_boleto_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_area_offers: {
        Row: {
          card_payment_url: string | null
          category_tag: string | null
          created_at: string
          description: string | null
          display_type: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          pix_key: string | null
          pix_key_type: string | null
          price: number | null
          product_id: string | null
          purchase_url: string | null
          sort_order: number
          total_clicks: number
          total_impressions: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          card_payment_url?: string | null
          category_tag?: string | null
          created_at?: string
          description?: string | null
          display_type?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          pix_key?: string | null
          pix_key_type?: string | null
          price?: number | null
          product_id?: string | null
          purchase_url?: string | null
          sort_order?: number
          total_clicks?: number
          total_impressions?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          card_payment_url?: string | null
          category_tag?: string | null
          created_at?: string
          description?: string | null
          display_type?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          pix_key?: string | null
          pix_key_type?: string | null
          price?: number | null
          product_id?: string | null
          purchase_url?: string | null
          sort_order?: number
          total_clicks?: number
          total_impressions?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_area_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_area_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_area_settings: {
        Row: {
          ai_persona_prompt: string | null
          created_at: string
          greeting_prompt: string | null
          id: string
          layout_order: Json | null
          logo_url: string | null
          offer_prompt: string | null
          theme_color: string | null
          title: string
          updated_at: string
          welcome_message: string | null
          workspace_id: string
        }
        Insert: {
          ai_persona_prompt?: string | null
          created_at?: string
          greeting_prompt?: string | null
          id?: string
          layout_order?: Json | null
          logo_url?: string | null
          offer_prompt?: string | null
          theme_color?: string | null
          title?: string
          updated_at?: string
          welcome_message?: string | null
          workspace_id: string
        }
        Update: {
          ai_persona_prompt?: string | null
          created_at?: string
          greeting_prompt?: string | null
          id?: string
          layout_order?: Json | null
          logo_url?: string | null
          offer_prompt?: string | null
          theme_color?: string | null
          title?: string
          updated_at?: string
          welcome_message?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_area_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_content_progress: {
        Row: {
          created_at: string
          current_page: number
          id: string
          last_accessed_at: string
          material_id: string
          normalized_phone: string
          progress_type: string
          total_pages: number
          video_duration: number
          video_seconds: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          current_page?: number
          id?: string
          last_accessed_at?: string
          material_id: string
          normalized_phone: string
          progress_type?: string
          total_pages?: number
          video_duration?: number
          video_seconds?: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          current_page?: number
          id?: string
          last_accessed_at?: string
          material_id?: string
          normalized_phone?: string
          progress_type?: string
          total_pages?: number
          video_duration?: number
          video_seconds?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_content_progress_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_offer_impressions: {
        Row: {
          clicked: boolean
          created_at: string
          id: string
          impression_count: number
          last_shown_at: string
          normalized_phone: string
          offer_id: string
          payment_method: string | null
          payment_started: boolean
        }
        Insert: {
          clicked?: boolean
          created_at?: string
          id?: string
          impression_count?: number
          last_shown_at?: string
          normalized_phone: string
          offer_id: string
          payment_method?: string | null
          payment_started?: boolean
        }
        Update: {
          clicked?: boolean
          created_at?: string
          id?: string
          impression_count?: number
          last_shown_at?: string
          normalized_phone?: string
          offer_id?: string
          payment_method?: string | null
          payment_started?: boolean
        }
        Relationships: []
      }
      member_pixel_frames: {
        Row: {
          created_at: string
          fired: boolean
          fired_at: string | null
          id: string
          normalized_phone: string
          product_name: string | null
          product_value: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          fired?: boolean
          fired_at?: string | null
          id?: string
          normalized_phone: string
          product_name?: string | null
          product_value?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          fired?: boolean
          fired_at?: string | null
          id?: string
          normalized_phone?: string
          product_name?: string | null
          product_value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_pixel_frames_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_product_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          product_id: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          product_id: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_product_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_product_materials: {
        Row: {
          button_label: string | null
          category_id: string | null
          content_text: string | null
          content_type: string
          content_url: string | null
          created_at: string
          description: string | null
          id: string
          is_preview: boolean
          product_id: string
          sort_order: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          button_label?: string | null
          category_id?: string | null
          content_text?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_preview?: boolean
          product_id: string
          sort_order?: number
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          button_label?: string | null
          category_id?: string | null
          content_text?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_preview?: boolean
          product_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_product_materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "member_product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_product_materials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_products: {
        Row: {
          created_at: string
          granted_at: string
          id: string
          is_active: boolean
          normalized_phone: string
          product_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          id?: string
          is_active?: boolean
          normalized_phone: string
          product_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          id?: string
          is_active?: boolean
          normalized_phone?: string
          product_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_sessions: {
        Row: {
          created_at: string
          current_activity: string | null
          current_material_name: string | null
          current_product_name: string | null
          ended_at: string | null
          id: string
          last_heartbeat_at: string
          normalized_phone: string
          started_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_activity?: string | null
          current_material_name?: string | null
          current_product_name?: string | null
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string
          normalized_phone: string
          started_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_activity?: string | null
          current_material_name?: string | null
          current_product_name?: string | null
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string
          normalized_phone?: string
          started_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue_config: {
        Row: {
          created_at: string
          delay_seconds: number
          id: string
          instance_name: string
          pause_after_sends: number | null
          pause_minutes: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          delay_seconds?: number
          id?: string
          instance_name: string
          pause_after_sends?: number | null
          pause_minutes?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          delay_seconds?: number
          id?: string
          instance_name?: string
          pause_after_sends?: number | null
          pause_minutes?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_config_workspace_id_fkey"
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
      meta_ad_spend: {
        Row: {
          campaign_name: string | null
          created_at: string | null
          date: string
          id: string
          spend: number
          workspace_id: string
        }
        Insert: {
          campaign_name?: string | null
          created_at?: string | null
          date: string
          id?: string
          spend?: number
          workspace_id: string
        }
        Update: {
          campaign_name?: string | null
          created_at?: string | null
          date?: string
          id?: string
          spend?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_spend_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      openai_settings: {
        Row: {
          api_key: string
          created_at: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "openai_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
      product_knowledge_summaries: {
        Row: {
          created_at: string
          id: string
          key_topics: string[]
          product_id: string
          summary: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_topics?: string[]
          product_id: string
          summary?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_topics?: string[]
          product_id?: string
          summary?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_knowledge_summaries_workspace_id_fkey"
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
          recovery_message_abandoned: string | null
          recovery_message_boleto: string | null
          recovery_message_pix: string | null
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
          recovery_message_abandoned?: string | null
          recovery_message_boleto?: string | null
          recovery_message_pix?: string | null
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
          recovery_message_abandoned?: string | null
          recovery_message_boleto?: string | null
          recovery_message_pix?: string | null
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
      recovery_clicks: {
        Row: {
          created_at: string
          id: string
          recovery_type: string
          transaction_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recovery_type?: string
          transaction_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recovery_type?: string
          transaction_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      recovery_queue: {
        Row: {
          amount: number
          created_at: string
          customer_name: string | null
          customer_phone: string
          error_message: string | null
          id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          transaction_id: string
          transaction_type: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          error_message?: string | null
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          transaction_id: string
          transaction_type?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          error_message?: string | null
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          transaction_id?: string
          transaction_type?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_settings: {
        Row: {
          created_at: string
          delay_seconds: number
          enabled: boolean
          enabled_boleto: boolean
          enabled_pix: boolean
          enabled_yampi: boolean
          id: string
          instance_boleto: string | null
          instance_name: string | null
          instance_pix: string | null
          instance_yampi: string | null
          send_after_minutes: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          delay_seconds?: number
          enabled?: boolean
          enabled_boleto?: boolean
          enabled_pix?: boolean
          enabled_yampi?: boolean
          id?: string
          instance_boleto?: string | null
          instance_name?: string | null
          instance_pix?: string | null
          instance_yampi?: string | null
          send_after_minutes?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          delay_seconds?: number
          enabled?: boolean
          enabled_boleto?: boolean
          enabled_pix?: boolean
          enabled_yampi?: boolean
          id?: string
          instance_boleto?: string | null
          instance_name?: string | null
          instance_pix?: string | null
          instance_yampi?: string | null
          send_after_minutes?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
          viewed_at: string | null
          whatsapp_valid: boolean | null
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
          viewed_at?: string | null
          whatsapp_valid?: boolean | null
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
          viewed_at?: string | null
          whatsapp_valid?: boolean | null
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
      workspace_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_active: boolean
          workspace_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
          workspace_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_domains_workspace_id_fkey"
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
          api_public_url: string | null
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
          api_public_url?: string | null
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
          api_public_url?: string | null
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
      increment_offer_click: { Args: { offer_id: string }; Returns: undefined }
      increment_offer_impression: {
        Args: { offer_id: string }
        Returns: undefined
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
