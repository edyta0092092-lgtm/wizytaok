/**
 * Typ bazy dla Supabase — odwzorowuje `supabase/schema.sql`.
 * Po wygenerowaniu typów z CLI (`supabase gen types`) można zastąpić ten plik wyjściem narzędzia.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppointmentStatusDb =
  | "pending"
  | "confirmed"
  | "change_requested"
  | "cancelled"
  | "completed"
  | "no_show"

export type MessageTemplateTypeDb =
  | "reminder_24h"
  | "reminder_before_visit"
  | "booking_confirmation"
  | "booking_cancelled_by_client"
  | "no_show_follow_up"
  | "reminder"
  | "second_reminder"
  | "confirmation"
  | "reschedule"
  | "followup_noshow"
  | "booking_cancelled_by_company"

export type MessageTemplateChannelDb = "sms" | "email"

export type MessageTemplateStatusDb = "active" | "draft"

export type BusinessReminderChannelDb = "sms" | "email" | "both"

export type BusinessAccessStatusDb = "trial" | "active" | "suspended" | "cancelled"

export type PaymentTypeDb = "deposit" | "full" | "adjustment"

export type PaymentStatusDb =
  | "pending"
  | "requires_action"
  | "succeeded"
  | "failed"
  | "canceled"

export type SupportTicketStatusDb = "open" | "in_progress" | "resolved" | "closed"

export type SupportTicketPriorityDb = "low" | "normal" | "high"

export type SupportMessageSenderTypeDb = "user" | "support" | "system"

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          owner_user_id: string
          email: string
          business_name: string
          owner_name: string | null
          phone: string | null
          reminder_channel: BusinessReminderChannelDb
          default_reminder_hours: number
          access_status: BusinessAccessStatusDb
          trial_started_at: string | null
          trial_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          email: string
          business_name: string
          owner_name?: string | null
          phone?: string | null
          reminder_channel?: BusinessReminderChannelDb
          default_reminder_hours?: number
          access_status?: BusinessAccessStatusDb
          trial_started_at?: string | null
          trial_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          email?: string
          business_name?: string
          owner_name?: string | null
          phone?: string | null
          reminder_channel?: BusinessReminderChannelDb
          default_reminder_hours?: number
          access_status?: BusinessAccessStatusDb
          trial_started_at?: string | null
          trial_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_profiles: {
        Row: {
          id: string
          owner_id: string
          business_name: string
          slug: string
          owner_name: string | null
          email: string | null
          phone: string | null
          tax_id: string | null
          default_reminder_hours: number
          second_reminder_minutes: number
          reminder_channel: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          business_name: string
          slug: string
          owner_name?: string | null
          email?: string | null
          phone?: string | null
          tax_id?: string | null
          default_reminder_hours?: number
          second_reminder_minutes?: number
          reminder_channel?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          business_name?: string
          slug?: string
          owner_name?: string | null
          email?: string | null
          phone?: string | null
          tax_id?: string | null
          default_reminder_hours?: number
          second_reminder_minutes?: number
          reminder_channel?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          business_id: string
          name: string
          description: string
          duration_minutes: number
          price: number
          currency: string
          is_active: boolean
          sort_order: number
          uses_default_availability: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          description?: string
          duration_minutes?: number
          price?: number
          currency?: string
          is_active?: boolean
          sort_order?: number
          uses_default_availability?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          description?: string
          duration_minutes?: number
          price?: number
          currency?: string
          is_active?: boolean
          sort_order?: number
          uses_default_availability?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      availability_rules: {
        Row: {
          id: string
          business_id: string
          weekday: number
          is_open: boolean
          start_time: string
          end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          weekday: number
          is_open?: boolean
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          weekday?: number
          is_open?: boolean
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      availability_exceptions: {
        Row: {
          id: string
          business_id: string
          exception_date: string
          is_closed: boolean
          start_time: string | null
          end_time: string | null
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          exception_date: string
          is_closed?: boolean
          start_time?: string | null
          end_time?: string | null
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          exception_date?: string
          is_closed?: boolean
          start_time?: string | null
          end_time?: string | null
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_availability_rules: {
        Row: {
          id: string
          business_id: string
          service_id: string
          weekday: number
          is_available: boolean
          start_time: string
          end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          service_id: string
          weekday: number
          is_available?: boolean
          start_time: string
          end_time: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          service_id?: string
          weekday?: number
          is_available?: boolean
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          id: string
          business_id: string
          name: string
          role: string | null
          email: string | null
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          role?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          role?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_services: {
        Row: {
          id: string
          business_id: string
          staff_id: string
          service_id: string
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          staff_id: string
          service_id: string
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          staff_id?: string
          service_id?: string
          created_at?: string
        }
        Relationships: []
      }
      staff_availability_rules: {
        Row: {
          id: string
          business_id: string
          staff_id: string
          weekday: number
          is_available: boolean
          start_time: string
          end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          staff_id: string
          weekday: number
          is_available?: boolean
          start_time: string
          end_time: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          staff_id?: string
          weekday?: number
          is_available?: boolean
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_availability_exceptions: {
        Row: {
          id: string
          business_id: string
          staff_id: string
          exception_date: string
          is_unavailable: boolean
          start_time: string | null
          end_time: string | null
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          staff_id: string
          exception_date: string
          is_unavailable?: boolean
          start_time?: string | null
          end_time?: string | null
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          staff_id?: string
          exception_date?: string
          is_unavailable?: boolean
          start_time?: string | null
          end_time?: string | null
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          business_id: string
          service_id: string | null
          confirmation_token: string
          client_id: string | null
          client_name: string
          client_phone: string
          client_email: string | null
          service_name: string
          service_duration_minutes: number
          service_price: number
          service_currency: string
          staff_id: string | null
          staff_name: string | null
          appointment_date: string
          appointment_time: string
          status: string
          source: string
          customer_note: string | null
          business_note: string | null
          proposed_date: string | null
          proposed_time: string | null
          proposed_service_id: string | null
          proposed_service_name: string | null
          proposed_service_duration_minutes: number | null
          proposed_service_price: number | null
          proposed_staff_id: string | null
          proposed_staff_name: string | null
          previous_date: string | null
          previous_time: string | null
          previous_service_name: string | null
          last_updated_by: string | null
          last_change_type: string | null
          last_status_change_source: string | null
          status_before_request: string | null
          reschedule_message: string | null
          internal_note: string | null
          accepted_proposal_at: string | null
          business_proposal_kind: string | null
          previous_service_duration_minutes: number | null
          previous_service_price: number | null
          reminder_due_at: string | null
          reminder_sent_at: string | null
          reminder_status: string | null
          reminder_error: string | null
          first_reminder_due_at: string | null
          first_reminder_sent_at: string | null
          first_reminder_status: string | null
          second_reminder_due_at: string | null
          second_reminder_sent_at: string | null
          second_reminder_status: string | null
          second_reminder_error: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancellation_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          service_id?: string | null
          confirmation_token?: string
          client_id?: string | null
          client_name: string
          client_phone: string
          client_email?: string | null
          service_name: string
          service_duration_minutes?: number
          service_price?: number
          service_currency?: string
          staff_id?: string | null
          staff_name?: string | null
          appointment_date: string
          appointment_time: string
          status?: string
          source?: string
          customer_note?: string | null
          business_note?: string | null
          proposed_date?: string | null
          proposed_time?: string | null
          proposed_service_id?: string | null
          proposed_service_name?: string | null
          proposed_service_duration_minutes?: number | null
          proposed_service_price?: number | null
          proposed_staff_id?: string | null
          proposed_staff_name?: string | null
          previous_date?: string | null
          previous_time?: string | null
          previous_service_name?: string | null
          last_updated_by?: string | null
          last_change_type?: string | null
          last_status_change_source?: string | null
          status_before_request?: string | null
          reschedule_message?: string | null
          internal_note?: string | null
          accepted_proposal_at?: string | null
          business_proposal_kind?: string | null
          previous_service_duration_minutes?: number | null
          previous_service_price?: number | null
          reminder_due_at?: string | null
          reminder_sent_at?: string | null
          reminder_status?: string | null
          reminder_error?: string | null
          first_reminder_due_at?: string | null
          first_reminder_sent_at?: string | null
          first_reminder_status?: string | null
          second_reminder_due_at?: string | null
          second_reminder_sent_at?: string | null
          second_reminder_status?: string | null
          second_reminder_error?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancellation_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          service_id?: string | null
          confirmation_token?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string
          client_email?: string | null
          service_name?: string
          service_duration_minutes?: number
          service_price?: number
          service_currency?: string
          staff_id?: string | null
          staff_name?: string | null
          appointment_date?: string
          appointment_time?: string
          status?: string
          source?: string
          customer_note?: string | null
          business_note?: string | null
          proposed_date?: string | null
          proposed_time?: string | null
          proposed_service_id?: string | null
          proposed_service_name?: string | null
          proposed_service_duration_minutes?: number | null
          proposed_service_price?: number | null
          proposed_staff_id?: string | null
          proposed_staff_name?: string | null
          previous_date?: string | null
          previous_time?: string | null
          previous_service_name?: string | null
          last_updated_by?: string | null
          last_change_type?: string | null
          last_status_change_source?: string | null
          status_before_request?: string | null
          reschedule_message?: string | null
          internal_note?: string | null
          accepted_proposal_at?: string | null
          business_proposal_kind?: string | null
          previous_service_duration_minutes?: number | null
          previous_service_price?: number | null
          reminder_due_at?: string | null
          reminder_sent_at?: string | null
          reminder_status?: string | null
          reminder_error?: string | null
          first_reminder_due_at?: string | null
          first_reminder_sent_at?: string | null
          first_reminder_status?: string | null
          second_reminder_due_at?: string | null
          second_reminder_sent_at?: string | null
          second_reminder_status?: string | null
          second_reminder_error?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancellation_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          id: string
          business_id: string
          booking_id: string | null
          channel: string
          type: string
          recipient: string | null
          status: string
          subject: string | null
          body: string | null
          provider: string | null
          provider_message_id: string | null
          error: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          booking_id?: string | null
          channel: string
          type?: string
          recipient?: string | null
          status: string
          subject?: string | null
          body?: string | null
          provider?: string | null
          provider_message_id?: string | null
          error?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          booking_id?: string | null
          channel?: string
          type?: string
          recipient?: string | null
          status?: string
          subject?: string | null
          body?: string | null
          provider?: string | null
          provider_message_id?: string | null
          error?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          business_id: string
          full_name: string
          phone: string
          email: string
          normalized_email: string | null
          normalized_phone: string | null
          notes: string | null
          no_show_count: number
          confirmed_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          full_name: string
          phone: string
          email?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          no_show_count?: number
          confirmed_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          full_name?: string
          phone?: string
          email?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          no_show_count?: number
          confirmed_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          business_id: string
          client_id: string | null
          service_name: string
          starts_at: string
          ends_at: string | null
          status: AppointmentStatusDb
          notes: string | null
          reminder_sent_at: string | null
          confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          client_id?: string | null
          service_name: string
          starts_at: string
          ends_at?: string | null
          status?: AppointmentStatusDb
          notes?: string | null
          reminder_sent_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          client_id?: string | null
          service_name?: string
          starts_at?: string
          ends_at?: string | null
          status?: AppointmentStatusDb
          notes?: string | null
          reminder_sent_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          id: string
          business_id: string
          type: MessageTemplateTypeDb
          channel: MessageTemplateChannelDb
          title: string
          content: string
          timing_minutes_before: number | null
          status: MessageTemplateStatusDb
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          type: MessageTemplateTypeDb
          channel: MessageTemplateChannelDb
          title: string
          content: string
          timing_minutes_before?: number | null
          status?: MessageTemplateStatusDb
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          type?: MessageTemplateTypeDb
          channel?: MessageTemplateChannelDb
          title?: string
          content?: string
          timing_minutes_before?: number | null
          status?: MessageTemplateStatusDb
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          business_id: string
          appointment_id: string | null
          type: PaymentTypeDb
          amount: number
          status: PaymentStatusDb
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          appointment_id?: string | null
          type?: PaymentTypeDb
          amount: number
          status?: PaymentStatusDb
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          appointment_id?: string | null
          type?: PaymentTypeDb
          amount?: number
          status?: PaymentStatusDb
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_members: {
        Row: {
          id: string
          business_id: string
          user_id: string
          role: string
          display_name: string | null
          email: string | null
          is_active: boolean
          invited_by: string | null
          staff_member_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id: string
          role?: string
          display_name?: string | null
          email?: string | null
          is_active?: boolean
          invited_by?: string | null
          staff_member_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          user_id?: string
          role?: string
          display_name?: string | null
          email?: string | null
          is_active?: boolean
          invited_by?: string | null
          staff_member_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          id: string
          business_id: string
          user_id: string | null
          subject: string
          message: string
          priority: SupportTicketPriorityDb
          status: SupportTicketStatusDb
          current_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id?: string | null
          subject: string
          message: string
          priority?: SupportTicketPriorityDb
          status?: SupportTicketStatusDb
          current_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          user_id?: string | null
          subject?: string
          message?: string
          priority?: SupportTicketPriorityDb
          status?: SupportTicketStatusDb
          current_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_admins: {
        Row: {
          id: string
          user_id: string | null
          email: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          id: string
          business_id: string | null
          user_id: string | null
          status: string
          subject: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          user_id?: string | null
          status?: string
          subject?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          user_id?: string | null
          status?: string
          subject?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          id: string
          ticket_id: string | null
          conversation_id: string | null
          business_id: string | null
          sender_user_id: string | null
          sender_type: SupportMessageSenderTypeDb
          sender_role: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id?: string | null
          conversation_id?: string | null
          business_id?: string | null
          sender_user_id?: string | null
          sender_type?: SupportMessageSenderTypeDb
          sender_role?: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string | null
          conversation_id?: string | null
          business_id?: string | null
          sender_user_id?: string | null
          sender_type?: SupportMessageSenderTypeDb
          sender_role?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      business_invitations: {
        Row: {
          id: string
          business_id: string
          email: string
          role: string
          token: string
          status: string
          invited_by: string | null
          staff_member_id: string | null
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          email: string
          role?: string
          token?: string
          status?: string
          invited_by?: string | null
          staff_member_id?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          email?: string
          role?: string
          token?: string
          status?: string
          invited_by?: string | null
          staff_member_id?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_business_profile_by_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          business_name: string
          slug: string
          phone: string | null
        }[]
      }
      is_business_slug_available: {
        Args: { p_slug: string }
        Returns: boolean
      }
      get_active_services_by_business_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          business_id: string
          name: string
          description: string
          duration_minutes: number
          price: number
          currency: string
          is_active: boolean
          sort_order: number
          uses_default_availability: boolean
        }[]
      }
      get_active_services_by_business_id: {
        Args: { p_business_id: string }
        Returns: {
          id: string
          business_id: string
          name: string
          description: string
          duration_minutes: number
          price: number
          currency: string
          is_active: boolean
          sort_order: number
          uses_default_availability: boolean
        }[]
      }
      get_public_staff_for_service: {
        Args: { p_business_id: string; p_service_id: string }
        Returns: { id: string; name: string }[]
      }
      create_online_booking: {
        Args: {
          p_slug: string
          p_service_id: string
          p_client_name: string
          p_client_phone: string
          p_client_email: string | null
          p_appointment_date: string
          p_appointment_time: string
          p_customer_note: string | null
          p_staff_id?: string | null
        }
        Returns: {
          id: string
          confirmation_token: string
          client_id: string | null
        }[]
      }
      find_or_create_client: {
        Args: {
          p_business_id: string
          p_full_name: string
          p_email: string
          p_phone: string
        }
        Returns: {
          client_id: string
          outcome: string
        }[]
      }
      get_booked_slots_for_public_booking: {
        Args: { p_slug: string; p_date_from: string; p_date_to: string }
        Returns: Json
      }
      get_booking_by_confirmation_token: {
        Args: { p_token: string }
        Returns: Json
      }
      update_booking_by_confirmation_token: {
        Args: {
          p_token: string
          p_action: string
          p_payload?: Json
        }
        Returns: Json
      }
      ensure_owner_membership: {
        Args: Record<string, never>
        Returns: undefined
      }
      get_business_invitation_public: {
        Args: { p_token: string }
        Returns: Json
      }
      accept_business_invitation: {
        Args: { p_token: string }
        Returns: Json
      }
      set_business_member_display_name: {
        Args: { p_business_id: string; p_display_name: string }
        Returns: undefined
      }
      is_business_owner: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      is_business_member_active: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      is_business_settings_admin: {
        Args: { p_business_id: string }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status: AppointmentStatusDb
      message_template_type: MessageTemplateTypeDb
      message_template_channel: MessageTemplateChannelDb
      message_template_status: MessageTemplateStatusDb
      business_reminder_channel: BusinessReminderChannelDb
      business_access_status: BusinessAccessStatusDb
      payment_type: PaymentTypeDb
      payment_status: PaymentStatusDb
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
