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
      bookings: {
        Row: {
          application_fee_amount: number | null
          booking_fee: number
          booking_fee_percentage: number
          booking_fee_status: string
          commission_amount: number
          commission_rate: number
          connect_account_id: string | null
          created_at: string
          customer_id: string
          customer_total_charged: number | null
          estimated_hours: number | null
          id: string
          notes: string | null
          payment_provider: string | null
          platform_fee_amount: number | null
          provider_id: string
          provider_net_amount: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          service_id: string
          service_payment_status: string
          service_price: number
          status: Database["public"]["Enums"]["booking_status"]
          stripe_checkout_session_id: string | null
          stripe_fee_amount: number | null
          stripe_payment_intent_id: string | null
          total_price: number
          updated_at: string
        }
        Insert: {
          application_fee_amount?: number | null
          booking_fee?: number
          booking_fee_percentage?: number
          booking_fee_status?: string
          commission_amount?: number
          commission_rate?: number
          connect_account_id?: string | null
          created_at?: string
          customer_id: string
          customer_total_charged?: number | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          payment_provider?: string | null
          platform_fee_amount?: number | null
          provider_id: string
          provider_net_amount?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_id: string
          service_payment_status?: string
          service_price?: number
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_checkout_session_id?: string | null
          stripe_fee_amount?: number | null
          stripe_payment_intent_id?: string | null
          total_price?: number
          updated_at?: string
        }
        Update: {
          application_fee_amount?: number | null
          booking_fee?: number
          booking_fee_percentage?: number
          booking_fee_status?: string
          commission_amount?: number
          commission_rate?: number
          connect_account_id?: string | null
          created_at?: string
          customer_id?: string
          customer_total_charged?: number | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          payment_provider?: string | null
          platform_fee_amount?: number | null
          provider_id?: string
          provider_net_amount?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_id?: string
          service_payment_status?: string
          service_price?: number
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_checkout_session_id?: string | null
          stripe_fee_amount?: number | null
          stripe_payment_intent_id?: string | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      connect_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          environment: string
          id: string
          payouts_enabled: boolean
          provider_id: string
          requirements: Json
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          environment?: string
          id?: string
          payouts_enabled?: boolean
          provider_id: string
          requirements?: Json
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          environment?: string
          id?: string
          payouts_enabled?: boolean
          provider_id?: string
          requirements?: Json
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connect_accounts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connect_accounts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connect_accounts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          booking_id: string
          created_at: string
          customer_id: string
          id: string
          last_message_at: string
          provider_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_id: string
          id?: string
          last_message_at?: string
          provider_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          last_message_at?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_quotes: {
        Row: {
          attachment_urls: string[]
          created_at: string
          custom_price: number
          customer_id: string
          description: string | null
          id: string
          provider_id: string
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attachment_urls?: string[]
          created_at?: string
          custom_price: number
          customer_id: string
          description?: string | null
          id?: string
          provider_id: string
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attachment_urls?: string[]
          created_at?: string
          custom_price?: number
          customer_id?: string
          description?: string | null
          id?: string
          provider_id?: string
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_quotes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_quotes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_quotes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_quotes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_milestones: {
        Row: {
          current_booking_fee_percentage: number
          customer_id: string
          id: string
          positive_reviews: number
          updated_at: string
        }
        Insert: {
          current_booking_fee_percentage?: number
          customer_id: string
          id?: string
          positive_reviews?: number
          updated_at?: string
        }
        Update: {
          current_booking_fee_percentage?: number
          customer_id?: string
          id?: string
          positive_reviews?: number
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      price_adjustments: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          new_price: number
          old_price: number
          proposed_by: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          new_price: number
          old_price: number
          proposed_by: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          new_price?: number
          old_price?: number
          proposed_by?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_adjustments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustments_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustments_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustments_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          average_rating: number | null
          bio: string | null
          city: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          latitude: number | null
          latitude_public: number | null
          longitude: number | null
          longitude_public: number | null
          role: Database["public"]["Enums"]["user_role"]
          state: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_onboarding_completed: boolean
          stripe_payouts_enabled: boolean
          total_reviews: number | null
          total_services_completed: number | null
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          city?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          latitude_public?: number | null
          longitude?: number | null
          longitude_public?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_completed?: boolean
          stripe_payouts_enabled?: boolean
          total_reviews?: number | null
          total_services_completed?: number | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          city?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          latitude_public?: number | null
          longitude?: number | null
          longitude_public?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_completed?: boolean
          stripe_payouts_enabled?: boolean
          total_reviews?: number | null
          total_services_completed?: number | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      provider_availability: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          provider_id: string
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean
          provider_id: string
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          provider_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_milestones: {
        Row: {
          completed_bookings: number
          current_commission_rate: number
          id: string
          provider_id: string
          updated_at: string
        }
        Insert: {
          completed_bookings?: number
          current_commission_rate?: number
          id?: string
          provider_id: string
          updated_at?: string
        }
        Update: {
          completed_bookings?: number
          current_commission_rate?: number
          id?: string
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_milestones_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_milestones_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_milestones_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_service_areas: {
        Row: {
          area_type: string
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          latitude: number | null
          longitude: number | null
          provider_id: string
          radius_miles: number | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          area_type: string
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          provider_id: string
          radius_miles?: number | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          area_type?: string
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          provider_id?: string
          radius_miles?: number | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh_key: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh_key: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh_key?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quote_edit_audit_log: {
        Row: {
          admin_override: boolean
          created_at: string
          edited_by_profile_id: string | null
          edited_by_user_id: string | null
          editor_role: string | null
          id: string
          new_description: string | null
          new_price: number | null
          new_status: string | null
          old_description: string | null
          old_price: number | null
          old_status: string | null
          quote_id: string
        }
        Insert: {
          admin_override?: boolean
          created_at?: string
          edited_by_profile_id?: string | null
          edited_by_user_id?: string | null
          editor_role?: string | null
          id?: string
          new_description?: string | null
          new_price?: number | null
          new_status?: string | null
          old_description?: string | null
          old_price?: number | null
          old_status?: string | null
          quote_id: string
        }
        Update: {
          admin_override?: boolean
          created_at?: string
          edited_by_profile_id?: string | null
          edited_by_user_id?: string | null
          editor_role?: string | null
          id?: string
          new_description?: string | null
          new_price?: number | null
          new_status?: string | null
          old_description?: string | null
          old_price?: number | null
          old_status?: string | null
          quote_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          provider_id: string
          rating: number
          reviewer_id: string
          service_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          provider_id: string
          rating: number
          reviewer_id: string
          service_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          provider_id?: string
          rating?: number
          reviewer_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          estimated_hours: number | null
          id: string
          photo_alts: string[]
          photo_captions: string[] | null
          photo_url: string | null
          photo_urls: string[] | null
          price: number
          provider_id: string
          status: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          photo_alts?: string[]
          photo_captions?: string[] | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price?: number
          provider_id: string
          status?: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          photo_alts?: string[]
          photo_captions?: string[] | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price?: number
          provider_id?: string
          status?: Database["public"]["Enums"]["service_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          ai_response: string | null
          category: string | null
          created_at: string
          id: string
          message: string
          sentiment: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_response?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message: string
          sentiment?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_response?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          sentiment?: string | null
          status?: string
          subject?: string
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      conversation_partner_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      public_provider_profiles: {
        Row: {
          avatar_url: string | null
          average_rating: number | null
          bio: string | null
          city: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          role: Database["public"]["Enums"]["user_role"] | null
          state: string | null
          total_reviews: number | null
          total_services_completed: number | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          city?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          role?: Database["public"]["Enums"]["user_role"] | null
          state?: string | null
          total_reviews?: number | null
          total_services_completed?: number | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          city?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          role?: Database["public"]["Enums"]["user_role"] | null
          state?: string | null
          total_reviews?: number | null
          total_services_completed?: number | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      public_provider_service_areas: {
        Row: {
          area_type: string | null
          city: string | null
          id: string | null
          is_active: boolean | null
          label: string | null
          latitude: number | null
          longitude: number | null
          provider_id: string | null
          radius_miles: number | null
          state: string | null
          zip_code: string | null
        }
        Insert: {
          area_type?: string | null
          city?: string | null
          id?: string | null
          is_active?: boolean | null
          label?: string | null
          latitude?: never
          longitude?: never
          provider_id?: string | null
          radius_miles?: number | null
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          area_type?: string | null
          city?: string | null
          id?: string | null
          is_active?: boolean | null
          label?: string | null
          latitude?: never
          longitude?: never
          provider_id?: string | null
          radius_miles?: number | null
          state?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_profile_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_role_secure: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      send_push_notification: {
        Args: {
          _data?: Json
          _message: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      service_status: "available" | "unavailable"
      user_role: "customer" | "service_provider"
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
      app_role: ["admin", "moderator", "user"],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      service_status: ["available", "unavailable"],
      user_role: ["customer", "service_provider"],
    },
  },
} as const
