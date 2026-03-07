export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          language: string | null
          role: 'user' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          language?: string | null
          role?: 'user' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          language?: string | null
          role?: 'user' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          user_id: string
          plan_code: 'base' | 'business' | 'enterprise'
          status: 'active' | 'past_due' | 'canceled' | 'expired' | 'incomplete'
          currency: 'RUB' | 'USD'
          billing_provider: 'yookassa'
          price_amount: number
          started_at: string
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          past_due_at: string | null
          provider_customer_id: string | null
          provider_payment_method_id: string | null
          provider_last_payment_id: string | null
          provider_metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          plan_code?: 'base' | 'business' | 'enterprise'
          status?: 'active' | 'past_due' | 'canceled' | 'expired' | 'incomplete'
          currency?: 'RUB' | 'USD'
          billing_provider?: 'yookassa'
          price_amount?: number
          started_at?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          past_due_at?: string | null
          provider_customer_id?: string | null
          provider_payment_method_id?: string | null
          provider_last_payment_id?: string | null
          provider_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          plan_code?: 'base' | 'business' | 'enterprise'
          status?: 'active' | 'past_due' | 'canceled' | 'expired' | 'incomplete'
          currency?: 'RUB' | 'USD'
          billing_provider?: 'yookassa'
          price_amount?: number
          started_at?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          past_due_at?: string | null
          provider_customer_id?: string | null
          provider_payment_method_id?: string | null
          provider_last_payment_id?: string | null
          provider_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      subscription_transactions: {
        Row: {
          id: string
          user_id: string
          plan_code: 'base' | 'business' | 'enterprise'
          kind: 'initial' | 'renewal' | 'change'
          status: 'pending' | 'succeeded' | 'failed' | 'canceled'
          amount: number
          currency: 'RUB' | 'USD'
          billing_provider: 'yookassa'
          provider_payment_id: string | null
          provider_payment_method_id: string | null
          provider_idempotence_key: string | null
          confirmation_url: string | null
          return_url: string | null
          failure_reason: string | null
          payload: Json
          succeeded_at: string | null
          failed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_code: 'base' | 'business' | 'enterprise'
          kind: 'initial' | 'renewal' | 'change'
          status?: 'pending' | 'succeeded' | 'failed' | 'canceled'
          amount: number
          currency: 'RUB' | 'USD'
          billing_provider?: 'yookassa'
          provider_payment_id?: string | null
          provider_payment_method_id?: string | null
          provider_idempotence_key?: string | null
          confirmation_url?: string | null
          return_url?: string | null
          failure_reason?: string | null
          payload?: Json
          succeeded_at?: string | null
          failed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_code?: 'base' | 'business' | 'enterprise'
          kind?: 'initial' | 'renewal' | 'change'
          status?: 'pending' | 'succeeded' | 'failed' | 'canceled'
          amount?: number
          currency?: 'RUB' | 'USD'
          billing_provider?: 'yookassa'
          provider_payment_id?: string | null
          provider_payment_method_id?: string | null
          provider_idempotence_key?: string | null
          confirmation_url?: string | null
          return_url?: string | null
          failure_reason?: string | null
          payload?: Json
          succeeded_at?: string | null
          failed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscription_transactions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      bots: {
        Row: {
          id: string
          name: string
          description: string | null
          user_id: string
          status: 'draft' | 'active' | 'archived' | 'error'
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          user_id: string
          status?: 'draft' | 'active' | 'archived' | 'error'
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          user_id?: string
          status?: 'draft' | 'active' | 'archived' | 'error'
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bots_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      bot_configs: {
        Row: {
          id: string
          bot_id: string
          nodes: Json | null
          edges: Json | null
          variables: Json | null
          version: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          bot_id: string
          nodes?: Json | null
          edges?: Json | null
          variables?: Json | null
          version?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          bot_id?: string
          nodes?: Json | null
          edges?: Json | null
          variables?: Json | null
          version?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bot_configs_bot_id_fkey'
            columns: ['bot_id']
            isOneToOne: true
            referencedRelation: 'bots'
            referencedColumns: ['id']
          },
        ]
      }
      bot_test_logs: {
        Row: {
          id: string
          bot_id: string
          run_id: string | null
          ts_ms: number
          ts: string
          level: 'info' | 'warn' | 'error' | 'debug'
          source: string
          message: string
          created_at: string
        }
        Insert: {
          id: string
          bot_id: string
          run_id?: string | null
          ts_ms: number
          ts?: string
          level?: 'info' | 'warn' | 'error' | 'debug'
          source?: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          bot_id?: string
          run_id?: string | null
          ts_ms?: number
          ts?: string
          level?: 'info' | 'warn' | 'error' | 'debug'
          source?: string
          message?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bot_test_logs_bot_id_fkey'
            columns: ['bot_id']
            isOneToOne: false
            referencedRelation: 'bots'
            referencedColumns: ['id']
          },
        ]
      }
      bot_audit_events: {
        Row: {
          id: string
          bot_id: string
          actor_user_id: string | null
          source: string
          event_type: string
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          bot_id: string
          actor_user_id?: string | null
          source?: string
          event_type: string
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          bot_id?: string
          actor_user_id?: string | null
          source?: string
          event_type?: string
          payload?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bot_audit_events_bot_id_fkey'
            columns: ['bot_id']
            isOneToOne: false
            referencedRelation: 'bots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bot_audit_events_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      bot_subscribers: {
        Row: {
          id: string
          bot_id: string
          telegram_user_id: number
          telegram_chat_id: number | null
          username: string | null
          first_name: string | null
          last_name: string | null
          language_code: string | null
          source: string
          first_seen_at: string
          last_seen_at: string
          created_at: string
          lead_stage: 'new' | 'contacted' | 'qualified' | 'won' | 'lost'
          lead_notes: string | null
          lead_tags: string[]
          lead_stage_updated_at: string
          last_incoming_at: string | null
          last_outgoing_at: string | null
          inbound_count: number
          outbound_count: number
        }
        Insert: {
          id?: string
          bot_id: string
          telegram_user_id: number
          telegram_chat_id?: number | null
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          language_code?: string | null
          source?: string
          first_seen_at?: string
          last_seen_at?: string
          created_at?: string
          lead_stage?: 'new' | 'contacted' | 'qualified' | 'won' | 'lost'
          lead_notes?: string | null
          lead_tags?: string[]
          lead_stage_updated_at?: string
          last_incoming_at?: string | null
          last_outgoing_at?: string | null
          inbound_count?: number
          outbound_count?: number
        }
        Update: {
          id?: string
          bot_id?: string
          telegram_user_id?: number
          telegram_chat_id?: number | null
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          language_code?: string | null
          source?: string
          first_seen_at?: string
          last_seen_at?: string
          created_at?: string
          lead_stage?: 'new' | 'contacted' | 'qualified' | 'won' | 'lost'
          lead_notes?: string | null
          lead_tags?: string[]
          lead_stage_updated_at?: string
          last_incoming_at?: string | null
          last_outgoing_at?: string | null
          inbound_count?: number
          outbound_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'bot_subscribers_bot_id_fkey'
            columns: ['bot_id']
            isOneToOne: false
            referencedRelation: 'bots'
            referencedColumns: ['id']
          },
        ]
      }
      bot_contact_events: {
        Row: {
          id: string
          bot_id: string
          telegram_user_id: number
          telegram_chat_id: number | null
          direction: 'inbound' | 'outbound'
          event_kind: 'message_text' | 'callback' | 'media' | 'service'
          message_text: string | null
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          bot_id: string
          telegram_user_id: number
          telegram_chat_id?: number | null
          direction: 'inbound' | 'outbound'
          event_kind: 'message_text' | 'callback' | 'media' | 'service'
          message_text?: string | null
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          bot_id?: string
          telegram_user_id?: number
          telegram_chat_id?: number | null
          direction?: 'inbound' | 'outbound'
          event_kind?: 'message_text' | 'callback' | 'media' | 'service'
          message_text?: string | null
          payload?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bot_contact_events_bot_id_fkey'
            columns: ['bot_id']
            isOneToOne: false
            referencedRelation: 'bots'
            referencedColumns: ['id']
          },
        ]
      }
      user_presence: {
        Row: {
          user_id: string
          last_seen_at: string
          locale: string | null
          page_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          last_seen_at?: string
          locale?: string | null
          page_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          last_seen_at?: string
          locale?: string | null
          page_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      landing_page_views: {
        Row: {
          id: number
          session_id: string
          user_id: string | null
          locale: string | null
          path: string | null
          referrer: string | null
          created_at: string
        }
        Insert: {
          id?: number
          session_id: string
          user_id?: string | null
          locale?: string | null
          path?: string | null
          referrer?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          session_id?: string
          user_id?: string | null
          locale?: string | null
          path?: string | null
          referrer?: string | null
          created_at?: string
        }
        Relationships: []
      }
      docs_pages: {
        Row: {
          id: string
          locale: 'ru' | 'en'
          parent_id: string | null
          title: string
          slug: string
          path: string
          sort_order: number
          is_home: boolean
          latest_revision_id: string | null
          published_revision_id: string | null
          created_by: string
          updated_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          locale: 'ru' | 'en'
          parent_id?: string | null
          title: string
          slug: string
          path?: string
          sort_order?: number
          is_home?: boolean
          latest_revision_id?: string | null
          published_revision_id?: string | null
          created_by: string
          updated_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          locale?: 'ru' | 'en'
          parent_id?: string | null
          title?: string
          slug?: string
          path?: string
          sort_order?: number
          is_home?: boolean
          latest_revision_id?: string | null
          published_revision_id?: string | null
          created_by?: string
          updated_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'docs_pages_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'docs_pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'docs_pages_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'docs_pages_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      docs_page_revisions: {
        Row: {
          id: string
          page_id: string
          revision_no: number
          status: 'draft' | 'published' | 'archived'
          title_snapshot: string
          blocks: Json
          seo: Json
          change_note: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          page_id: string
          revision_no: number
          status?: 'draft' | 'published' | 'archived'
          title_snapshot: string
          blocks: Json
          seo?: Json
          change_note?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          revision_no?: number
          status?: 'draft' | 'published' | 'archived'
          title_snapshot?: string
          blocks?: Json
          seo?: Json
          change_note?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'docs_page_revisions_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'docs_pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'docs_page_revisions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      docs_redirects: {
        Row: {
          id: string
          locale: 'ru' | 'en'
          from_path: string
          to_page_id: string
          is_active: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          locale: 'ru' | 'en'
          from_path: string
          to_page_id: string
          is_active?: boolean
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          locale?: 'ru' | 'en'
          from_path?: string
          to_page_id?: string
          is_active?: boolean
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'docs_redirects_to_page_id_fkey'
            columns: ['to_page_id']
            isOneToOne: false
            referencedRelation: 'docs_pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'docs_redirects_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      docs_media_assets: {
        Row: {
          id: string
          locale: 'ru' | 'en'
          page_id: string | null
          bucket: string
          object_path: string
          public_url: string
          mime_type: string
          size_bytes: number
          meta: Json
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          locale: 'ru' | 'en'
          page_id?: string | null
          bucket?: string
          object_path: string
          public_url: string
          mime_type: string
          size_bytes: number
          meta?: Json
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          locale?: 'ru' | 'en'
          page_id?: string | null
          bucket?: string
          object_path?: string
          public_url?: string
          mime_type?: string
          size_bytes?: number
          meta?: Json
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'docs_media_assets_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'docs_pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'docs_media_assets_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
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
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type UserSubscriptionRow = Database['public']['Tables']['user_subscriptions']['Row']
export type SubscriptionTransactionRow = Database['public']['Tables']['subscription_transactions']['Row']
export type BotRow = Database['public']['Tables']['bots']['Row']
export type BotConfigRow = Database['public']['Tables']['bot_configs']['Row']
export type BotTestLogRow = Database['public']['Tables']['bot_test_logs']['Row']
export type BotAuditEventRow = Database['public']['Tables']['bot_audit_events']['Row']
export type BotSubscriberRow = Database['public']['Tables']['bot_subscribers']['Row']
export type BotContactEventRow = Database['public']['Tables']['bot_contact_events']['Row']
export type UserPresence = Database['public']['Tables']['user_presence']['Row']
export type LandingPageView = Database['public']['Tables']['landing_page_views']['Row']
export type DocsPageRow = Database['public']['Tables']['docs_pages']['Row']
export type DocsPageRevisionRow = Database['public']['Tables']['docs_page_revisions']['Row']
export type DocsRedirectRow = Database['public']['Tables']['docs_redirects']['Row']
export type DocsMediaAssetRow = Database['public']['Tables']['docs_media_assets']['Row']
