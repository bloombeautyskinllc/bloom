
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_profile_id": string | null,"actor_role": string | null,"actor_type": Database["public"]['Enums']["actor_type"],"actor_user_id": string | null,"after": Json | null,"before": Json | null,"correlation_id": string | null,"diff": Json | null,"entity_id": string | null,"entity_type": string,"id": number,"ip": unknown,"metadata": NonNullable<Json>,"occurred_at": string,"user_agent": string | null
                  }
                  Insert: {
                    "action": string,"actor_profile_id"?: string | null,"actor_role"?: string | null,"actor_type": Database["public"]['Enums']["actor_type"],"actor_user_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"correlation_id"?: string | null,"diff"?: Json | null,"entity_id"?: string | null,"entity_type": string,"id"?: never,"ip"?: unknown,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_profile_id"?: string | null,"actor_role"?: string | null,"actor_type"?: Database["public"]['Enums']["actor_type"],"actor_user_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"correlation_id"?: string | null,"diff"?: Json | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"ip"?: unknown,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"availability_blocks": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"google_event_id": string | null,"id": string,"range": unknown,"reason": string | null,"source": Database["public"]['Enums']["block_source"],"specialist_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"google_event_id"?: string | null,"id"?: string,"range": unknown,"reason"?: string | null,"source"?: Database["public"]['Enums']["block_source"],"specialist_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"google_event_id"?: string | null,"id"?: string,"range"?: unknown,"reason"?: string | null,"source"?: Database["public"]['Enums']["block_source"],"specialist_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_blocks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "availability_blocks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "availability_blocks_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialists"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_items": {
                  Row: {
                    "booking_id": string,"created_at": string,"description": string | null,"duration_minutes": number,"group_label": string | null,"id": string,"includes": (string)[],"kind": string,"name": string,"option_id": string | null,"price_type": Database["public"]['Enums']["price_type"],"sort_order": number,"treatment_id": string | null,"unit_price_cents": number
                  }
                  Insert: {
                    "booking_id": string,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"group_label"?: string | null,"id"?: string,"includes"?: (string)[],"kind": string,"name": string,"option_id"?: string | null,"price_type"?: Database["public"]['Enums']["price_type"],"sort_order"?: number,"treatment_id"?: string | null,"unit_price_cents": number
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"group_label"?: string | null,"id"?: string,"includes"?: (string)[],"kind"?: string,"name"?: string,"option_id"?: string | null,"price_type"?: Database["public"]['Enums']["price_type"],"sort_order"?: number,"treatment_id"?: string | null,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_items_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_items_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_items_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "treatment_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_items_treatment_id_fkey"
      columns: ["treatment_id"]
isOneToOne: false
      referencedRelation: "treatments"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_notes": {
                  Row: {
                    "author_id": string | null,"body": string,"booking_id": string,"created_at": string,"deleted_at": string | null,"id": string,"updated_at": string
                  }
                  Insert: {
                    "author_id"?: string | null,"body": string,"booking_id": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"booking_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_notes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_notes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "adjustment_cents": number,"amount_due_cents": number,"blocked_range": unknown,"buffer_after_min": number,"buffer_before_min": number,"cancellation_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"client_id": string,"client_notes": string | null,"closure_flagged_at": string | null,"code": string,"confirmed_at": string | null,"created_at": string,"created_by": string | null,"currency": string,"discount_cents": number,"end_at": string,"hold_expires_at": string | null,"id": string,"idempotency_key": string | null,"override_reason": string | null,"payment_status": Database["public"]['Enums']["payment_status"],"policy": NonNullable<Json>,"refund_due_cents": number | null,"reschedule_count": number,"rules_overridden": boolean,"source": Database["public"]['Enums']["booking_source"],"specialist_id": string,"start_at": string,"status": Database["public"]['Enums']["booking_status"],"subtotal_cents": number,"total_cents": number,"updated_at": string
                  }
                  Insert: {
                    "adjustment_cents"?: number,"amount_due_cents"?: number,"blocked_range": unknown,"buffer_after_min"?: number,"buffer_before_min"?: number,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id": string,"client_notes"?: string | null,"closure_flagged_at"?: string | null,"code"?: string,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"discount_cents"?: number,"end_at": string,"hold_expires_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"override_reason"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"policy"?: NonNullable<Json>,"refund_due_cents"?: number | null,"reschedule_count"?: number,"rules_overridden"?: boolean,"source"?: Database["public"]['Enums']["booking_source"],"specialist_id": string,"start_at": string,"status"?: Database["public"]['Enums']["booking_status"],"subtotal_cents": number,"total_cents": number,"updated_at"?: string
                  }
                  Update: {
                    "adjustment_cents"?: number,"amount_due_cents"?: number,"blocked_range"?: unknown,"buffer_after_min"?: number,"buffer_before_min"?: number,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id"?: string,"client_notes"?: string | null,"closure_flagged_at"?: string | null,"code"?: string,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"discount_cents"?: number,"end_at"?: string,"hold_expires_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"override_reason"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"policy"?: NonNullable<Json>,"refund_due_cents"?: number | null,"reschedule_count"?: number,"rules_overridden"?: boolean,"source"?: Database["public"]['Enums']["booking_source"],"specialist_id"?: string,"start_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"subtotal_cents"?: number,"total_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialists"
      referencedColumns: ["id"]
    }
                  ]
                },"business_settings": {
                  Row: {
                    "address_line1": string | null,"address_line2": string | null,"admin_alert_emails": (string)[],"business_name": string,"cancel_cutoff_hours": number,"cancellation_refund_percent": number,"created_at": string,"hold_minutes": number,"id": number,"late_cancellation_refund_percent": number,"legal_name": string,"max_reschedules": number,"max_window_days": number,"min_notice_min": number,"minors_allowed_with_guardian": boolean,"payments_enabled": boolean,"phone_e164": string | null,"privacy_email": string,"public_email": string | null,"reminder_offsets_min": (number)[],"reschedule_cutoff_hours": number,"review_request_delay_hours": number,"review_url": string | null,"slot_interval_min": number,"terms_version": string,"timezone": string,"updated_at": string,"whatsapp_e164": string | null
                  }
                  Insert: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"admin_alert_emails"?: (string)[],"business_name": string,"cancel_cutoff_hours"?: number,"cancellation_refund_percent"?: number,"created_at"?: string,"hold_minutes"?: number,"id"?: number,"late_cancellation_refund_percent"?: number,"legal_name"?: string,"max_reschedules"?: number,"max_window_days"?: number,"min_notice_min"?: number,"minors_allowed_with_guardian"?: boolean,"payments_enabled"?: boolean,"phone_e164"?: string | null,"privacy_email"?: string,"public_email"?: string | null,"reminder_offsets_min"?: (number)[],"reschedule_cutoff_hours"?: number,"review_request_delay_hours"?: number,"review_url"?: string | null,"slot_interval_min"?: number,"terms_version"?: string,"timezone"?: string,"updated_at"?: string,"whatsapp_e164"?: string | null
                  }
                  Update: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"admin_alert_emails"?: (string)[],"business_name"?: string,"cancel_cutoff_hours"?: number,"cancellation_refund_percent"?: number,"created_at"?: string,"hold_minutes"?: number,"id"?: number,"late_cancellation_refund_percent"?: number,"legal_name"?: string,"max_reschedules"?: number,"max_window_days"?: number,"min_notice_min"?: number,"minors_allowed_with_guardian"?: boolean,"payments_enabled"?: boolean,"phone_e164"?: string | null,"privacy_email"?: string,"public_email"?: string | null,"reminder_offsets_min"?: (number)[],"reschedule_cutoff_hours"?: number,"review_request_delay_hours"?: number,"review_url"?: string | null,"slot_interval_min"?: number,"terms_version"?: string,"timezone"?: string,"updated_at"?: string,"whatsapp_e164"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"calendar_events": {
                  Row: {
                    "booking_id": string,"calendar_id": string,"created_at": string,"credential_id": string | null,"google_event_id": string | null,"id": string,"kind": string,"last_error": string | null,"last_synced_at": string | null,"sync_status": string,"updated_at": string
                  }
                  Insert: {
                    "booking_id": string,"calendar_id": string,"created_at"?: string,"credential_id"?: string | null,"google_event_id"?: string | null,"id"?: string,"kind": string,"last_error"?: string | null,"last_synced_at"?: string | null,"sync_status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string,"calendar_id"?: string,"created_at"?: string,"credential_id"?: string | null,"google_event_id"?: string | null,"id"?: string,"kind"?: string,"last_error"?: string | null,"last_synced_at"?: string | null,"sync_status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"client_documents": {
                  Row: {
                    "booking_id": string | null,"client_id": string,"created_at": string,"deleted_at": string | null,"id": string,"kind": string,"mime_type": string | null,"signed_at": string | null,"size_bytes": number | null,"storage_path": string,"title": string,"uploaded_by": string | null
                  }
                  Insert: {
                    "booking_id"?: string | null,"client_id": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"kind"?: string,"mime_type"?: string | null,"signed_at"?: string | null,"size_bytes"?: number | null,"storage_path": string,"title": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "booking_id"?: string | null,"client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"kind"?: string,"mime_type"?: string | null,"signed_at"?: string | null,"size_bytes"?: number | null,"storage_path"?: string,"title"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_documents_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_documents_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_documents_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_documents_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_notes": {
                  Row: {
                    "author_id": string | null,"body": string,"client_id": string,"created_at": string,"deleted_at": string | null,"id": string,"pinned": boolean,"updated_at": string
                  }
                  Insert: {
                    "author_id"?: string | null,"body": string,"client_id": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"pinned"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"pinned"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_tag_links": {
                  Row: {
                    "client_id": string,"created_at": string,"tag_id": string
                  }
                  Insert: {
                    "client_id": string,"created_at"?: string,"tag_id": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_tag_links_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_tag_links_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_tag_links_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "client_tags"
      referencedColumns: ["id"]
    }
                  ]
                },"client_tags": {
                  Row: {
                    "color": string | null,"created_at": string,"id": string,"name": string
                  }
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"google_sync_state": {
                  Row: {
                    "credential_id": string,"last_pull_at": string | null,"sync_token": string | null,"updated_at": string
                  }
                  Insert: {
                    "credential_id": string,"last_pull_at"?: string | null,"sync_token"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "credential_id"?: string,"last_pull_at"?: string | null,"sync_token"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"google_watch_channels": {
                  Row: {
                    "calendar_id": string,"channel_id": string,"created_at": string,"credential_id": string,"expires_at": string | null,"id": string,"resource_id": string | null,"stopped_at": string | null,"sync_token": string | null,"token": string,"updated_at": string
                  }
                  Insert: {
                    "calendar_id": string,"channel_id": string,"created_at"?: string,"credential_id": string,"expires_at"?: string | null,"id"?: string,"resource_id"?: string | null,"stopped_at"?: string | null,"sync_token"?: string | null,"token": string,"updated_at"?: string
                  }
                  Update: {
                    "calendar_id"?: string,"channel_id"?: string,"created_at"?: string,"credential_id"?: string,"expires_at"?: string | null,"id"?: string,"resource_id"?: string | null,"stopped_at"?: string | null,"sync_token"?: string | null,"token"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"intake_forms": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"is_active": boolean,"name": string,"questions": NonNullable<Json>,"requires_signature": boolean,"slug": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"questions"?: NonNullable<Json>,"requires_signature"?: boolean,"slug": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"questions"?: NonNullable<Json>,"requires_signature"?: boolean,"slug"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"intake_responses": {
                  Row: {
                    "answers": NonNullable<Json>,"booking_id": string,"created_at": string,"form_id": string,"form_version": number,"id": string,"submitted_at": string
                  }
                  Insert: {
                    "answers": NonNullable<Json>,"booking_id": string,"created_at"?: string,"form_id": string,"form_version": number,"id"?: string,"submitted_at"?: string
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"booking_id"?: string,"created_at"?: string,"form_id"?: string,"form_version"?: number,"id"?: string,"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "intake_responses_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "booking_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "intake_responses_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "intake_responses_form_id_fkey"
      columns: ["form_id"]
isOneToOne: false
      referencedRelation: "intake_forms"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"completed_at": string | null,"correlation_id": string | null,"created_at": string,"dedupe_key": string | null,"id": string,"last_error": string | null,"locked_at": string | null,"locked_by": string | null,"max_attempts": number,"next_run_at": string,"payload": NonNullable<Json>,"status": Database["public"]['Enums']["job_status"],"type": string,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"completed_at"?: string | null,"correlation_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"id"?: string,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"next_run_at"?: string,"payload"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["job_status"],"type": string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"completed_at"?: string | null,"correlation_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"id"?: string,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"next_run_at"?: string,"payload"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["job_status"],"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "booking_id": string | null,"bounced_at": string | null,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"delivered_at": string | null,"error": string | null,"id": string,"job_id": string | null,"profile_id": string | null,"provider": string | null,"provider_message_id": string | null,"recipient": string,"sent_at": string | null,"status": Database["public"]['Enums']["notification_status"],"template": string,"updated_at": string
                  }
                  Insert: {
                    "booking_id"?: string | null,"bounced_at"?: string | null,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"delivered_at"?: string | null,"error"?: string | null,"id"?: string,"job_id"?: string | null,"profile_id"?: string | null,"provider"?: string | null,"provider_message_id"?: string | null,"recipient": string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"template": string,"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string | null,"bounced_at"?: string | null,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"delivered_at"?: string | null,"error"?: string | null,"id"?: string,"job_id"?: string | null,"profile_id"?: string | null,"provider"?: string | null,"provider_message_id"?: string | null,"recipient"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"template"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_booking_fk"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_booking_fk"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "anonymized_at": string | null,"avatar_url": string | null,"created_at": string,"deleted_at": string | null,"email": string | null,"full_name": string | null,"id": string,"locale": string,"onboarded_at": string | null,"phone_e164": string | null,"reminders_opt_in": boolean,"role": Database["public"]['Enums']["user_role"],"terms_accepted_at": string | null,"terms_version": string | null,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "anonymized_at"?: string | null,"avatar_url"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"id"?: string,"locale"?: string,"onboarded_at"?: string | null,"phone_e164"?: string | null,"reminders_opt_in"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "anonymized_at"?: string | null,"avatar_url"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"id"?: string,"locale"?: string,"onboarded_at"?: string | null,"phone_e164"?: string | null,"reminders_opt_in"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"service_categories": {
                  Row: {
                    "color": string | null,"created_at": string,"deleted_at": string | null,"description": string | null,"id": string,"is_active": boolean,"name": string,"short_name": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"short_name"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"short_name"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"specialist_treatments": {
                  Row: {
                    "created_at": string,"specialist_id": string,"treatment_id": string
                  }
                  Insert: {
                    "created_at"?: string,"specialist_id": string,"treatment_id": string
                  }
                  Update: {
                    "created_at"?: string,"specialist_id"?: string,"treatment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "specialist_treatments_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "specialist_treatments_treatment_id_fkey"
      columns: ["treatment_id"]
isOneToOne: false
      referencedRelation: "treatments"
      referencedColumns: ["id"]
    }
                  ]
                },"specialists": {
                  Row: {
                    "bio": string | null,"color": string | null,"created_at": string,"deleted_at": string | null,"display_name": string,"google_calendar_id": string | null,"id": string,"is_active": boolean,"needs_review": boolean,"profile_id": string | null,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "bio"?: string | null,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name": string,"google_calendar_id"?: string | null,"id"?: string,"is_active"?: boolean,"needs_review"?: boolean,"profile_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "bio"?: string | null,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string,"google_calendar_id"?: string | null,"id"?: string,"is_active"?: boolean,"needs_review"?: boolean,"profile_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "specialists_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "specialists_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"treatment_options": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string | null,"extra_duration_minutes": number | null,"group_label": string | null,"id": string,"is_active": boolean,"name": string,"needs_review": boolean,"price_cents": number,"price_type": Database["public"]['Enums']["price_type"],"slug": string,"sort_order": number,"treatment_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"extra_duration_minutes"?: number | null,"group_label"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"needs_review"?: boolean,"price_cents": number,"price_type"?: Database["public"]['Enums']["price_type"],"slug": string,"sort_order"?: number,"treatment_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"extra_duration_minutes"?: number | null,"group_label"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"needs_review"?: boolean,"price_cents"?: number,"price_type"?: Database["public"]['Enums']["price_type"],"slug"?: string,"sort_order"?: number,"treatment_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatment_options_treatment_id_fkey"
      columns: ["treatment_id"]
isOneToOne: false
      referencedRelation: "treatments"
      referencedColumns: ["id"]
    }
                  ]
                },"treatments": {
                  Row: {
                    "buffer_after_min": number,"buffer_before_min": number,"category_id": string,"created_at": string,"currency": string,"deleted_at": string | null,"deposit_cents": number | null,"description": string | null,"duration_minutes": number | null,"id": string,"includes": (string)[],"intake_form_id": string | null,"is_active": boolean,"is_best_seller": boolean,"is_bookable": boolean | null,"max_options": number | null,"menu_group": string | null,"min_options": number,"name": string,"needs_review": boolean,"price_cents": number,"price_type": Database["public"]['Enums']["price_type"],"slug": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "buffer_after_min"?: number,"buffer_before_min"?: number,"category_id": string,"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"deposit_cents"?: number | null,"description"?: string | null,"duration_minutes"?: number | null,"id"?: string,"includes"?: (string)[],"intake_form_id"?: string | null,"is_active"?: boolean,"is_best_seller"?: boolean,"is_bookable"?: never,"max_options"?: number | null,"menu_group"?: string | null,"min_options"?: number,"name": string,"needs_review"?: boolean,"price_cents": number,"price_type"?: Database["public"]['Enums']["price_type"],"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "buffer_after_min"?: number,"buffer_before_min"?: number,"category_id"?: string,"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"deposit_cents"?: number | null,"description"?: string | null,"duration_minutes"?: number | null,"id"?: string,"includes"?: (string)[],"intake_form_id"?: string | null,"is_active"?: boolean,"is_best_seller"?: boolean,"is_bookable"?: never,"max_options"?: number | null,"menu_group"?: string | null,"min_options"?: number,"name"?: string,"needs_review"?: boolean,"price_cents"?: number,"price_type"?: Database["public"]['Enums']["price_type"],"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatments_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "service_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "treatments_intake_form_id_fkey"
      columns: ["intake_form_id"]
isOneToOne: false
      referencedRelation: "intake_forms"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "event_id": string,"event_type": string | null,"processed_at": string | null,"provider": string,"received_at": string
                  }
                  Insert: {
                    "event_id": string,"event_type"?: string | null,"processed_at"?: string | null,"provider": string,"received_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"event_type"?: string | null,"processed_at"?: string | null,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"working_hours": {
                  Row: {
                    "created_at": string,"end_time": string,"id": string,"iso_weekday": number,"specialist_id": string | null,"start_time": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"end_time": string,"id"?: string,"iso_weekday": number,"specialist_id"?: string | null,"start_time": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string,"id"?: string,"iso_weekday"?: number,"specialist_id"?: string | null,"start_time"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "working_hours_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialists"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "booking_search": {
                  Row: {
                    "adjustment_cents": number | null,"cancellation_reason": string | null,"category_color": string | null,"category_slug": string | null,"client_email": string | null,"client_id": string | null,"client_name": string | null,"client_notes": string | null,"client_phone": string | null,"closure_flagged_at": string | null,"code": string | null,"created_at": string | null,"discount_cents": number | null,"end_at": string | null,"id": string | null,"options": string | null,"override_reason": string | null,"payment_status": Database["public"]['Enums']["payment_status"] | null,"reschedule_count": number | null,"rules_overridden": boolean | null,"service": string | null,"source": Database["public"]['Enums']["booking_source"] | null,"specialist_color": string | null,"specialist_id": string | null,"specialist_name": string | null,"start_at": string | null,"status": Database["public"]['Enums']["booking_status"] | null,"subtotal_cents": number | null,"total_cents": number | null,"treatment_ids": (string)[] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialists"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_pending_fields": {
                  Row: {
                    "id": string | null,"kind": string | null,"missing": (string)[] | null,"name": string | null,"slug": string | null
                  }
                  Relationships: [
                    
                  ]
                },"client_overview": {
                  Row: {
                    "anonymized_at": string | null,"created_at": string | null,"email": string | null,"full_name": string | null,"has_login": boolean | null,"id": string | null,"last_visit_at": string | null,"lifetime_cents": number | null,"next_visit_at": string | null,"no_shows": number | null,"phone_e164": string | null,"reminders_opt_in": boolean | null,"role": Database["public"]['Enums']["user_role"] | null,"tags": (string)[] | null,"visits": number | null
                  }
                  Insert: {
                           "anonymized_at"?: string | null,"created_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"has_login"?: never,"id"?: string | null,"last_visit_at"?: never,"lifetime_cents"?: never,"next_visit_at"?: never,"no_shows"?: never,"phone_e164"?: string | null,"reminders_opt_in"?: boolean | null,"role"?: Database["public"]['Enums']["user_role"] | null,"tags"?: never,"visits"?: never
                         }
                        Update: {
                           "anonymized_at"?: string | null,"created_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"has_login"?: never,"id"?: string | null,"last_visit_at"?: never,"lifetime_cents"?: never,"next_visit_at"?: never,"no_shows"?: never,"phone_e164"?: string | null,"reminders_opt_in"?: boolean | null,"role"?: Database["public"]['Enums']["user_role"] | null,"tags"?: never,"visits"?: never
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "admin_create_booking":
{ Args: { "p_client_id"?: string,"p_custom"?: Json,"p_discount_cents"?: number,"p_idempotency_key"?: string,"p_new_client"?: Json,"p_notes"?: string,"p_notify"?: boolean,"p_option_ids"?: (string)[],"p_override_reason"?: string,"p_override_rules"?: boolean,"p_price_cents"?: number,"p_specialist_id"?: string,"p_start_at": string,"p_treatment_id"?: string }; Returns: string
                           },
"admin_dashboard":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"admin_set_role":
{ Args: { "p_profile_id": string,"p_role": Database["public"]['Enums']["user_role"] }; Returns: undefined
                           },
"admin_set_working_hours":
{ Args: { "p_hours": Json,"p_specialist_id": string }; Returns: undefined
                           },
"cancel_booking":
{ Args: { "p_booking_id": string,"p_reason"?: string }; Returns: number
                           },
"claim_jobs":
{ Args: { "p_limit"?: number,"p_worker": string }; Returns: {
              "attempts": number,
"completed_at": string | null,
"correlation_id": string | null,
"created_at": string,
"dedupe_key": string | null,
"id": string,
"last_error": string | null,
"locked_at": string | null,
"locked_by": string | null,
"max_attempts": number,
"next_run_at": string,
"payload": NonNullable<Json>,
"status": Database["public"]['Enums']["job_status"],
"type": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"complete_job":
{ Args: { "p_job_id": string }; Returns: undefined
                           },
"complete_onboarding":
{ Args: { "p_accept_terms": boolean,"p_full_name": string,"p_phone_e164": string,"p_reminders"?: boolean }; Returns: boolean
                           },
"configure_job_worker":
{ Args: { "p_app_url": string,"p_secret": string }; Returns: undefined
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"expire_stale_holds":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"fail_job":
{ Args: { "p_error": string,"p_job_id": string }; Returns: undefined
                           },
"flag_bookings_pending_closure":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"get_busy_ranges":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "end_at": string,"specialist_id": string,"start_at": string
            }[]
                           },
"get_google_credential":
{ Args: { "p_owner_kind": string,"p_profile_id"?: string }; Returns: {
              "calendar_id": string,"credential_id": string,"google_email": string,"refresh_token": string
            }[]
                           },
"get_public_settings":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"google_calendar_status":
{ Args: Record<PropertyKey, never>; Returns: {
              "connected_at": string,"google_email": string,"last_error": string,"owner_kind": string
            }[]
                           },
"hold_slot":
{ Args: { "p_idempotency_key"?: string,"p_option_ids": (string)[],"p_specialist_id"?: string,"p_start_at": string,"p_treatment_id": string }; Returns: {
              "booking_id": string,"code": string,"end_at": string,"hold_expires_at": string,"start_at": string,"total_cents": number
            }[]
                           },
"log_app_event":
{ Args: { "p_action": string,"p_actor_user_id"?: string,"p_correlation_id"?: string,"p_entity_id"?: string,"p_entity_type": string,"p_ip"?: string,"p_metadata"?: Json,"p_user_agent"?: string }; Returns: number
                           },
"mark_google_credential":
{ Args: { "p_credential_id": string,"p_error"?: string }; Returns: undefined
                           },
"reschedule_booking":
{ Args: { "p_booking_id": string,"p_new_start": string }; Returns: {
              "end_at": string,"reschedule_count": number,"start_at": string
            }[]
                           },
"revoke_google_credential":
{ Args: { "p_error"?: string,"p_owner_kind": string,"p_profile_id"?: string }; Returns: undefined
                           },
"staff_cancel_booking":
{ Args: { "p_booking_id": string,"p_notify"?: boolean,"p_reason"?: string }; Returns: number
                           },
"staff_reschedule_booking":
{ Args: { "p_booking_id": string,"p_new_start": string,"p_notify"?: boolean,"p_override"?: boolean,"p_reason"?: string,"p_specialist_id"?: string }; Returns: undefined
                           },
"staff_set_booking_status":
{ Args: { "p_booking_id": string,"p_status": Database["public"]['Enums']["booking_status"] }; Returns: undefined
                           },
"store_google_credential":
{ Args: { "p_google_email": string,"p_owner_kind": string,"p_profile_id": string,"p_refresh_token": string,"p_scopes": (string)[] }; Returns: string
                           },
"submit_booking":
{ Args: { "p_booking_id": string,"p_intake"?: Json,"p_notes"?: string }; Returns: Database["public"]['Enums']["booking_status"]
                           }
          }
          Enums: {
            "actor_type": "user"|"staff"|"admin"|"system","block_source": "manual"|"google"|"holiday","booking_source": "online"|"admin","booking_status": "held"|"pending_payment"|"confirmed"|"completed"|"cancelled"|"no_show"|"expired","job_status": "queued"|"running"|"succeeded"|"failed"|"dead","notification_channel": "email"|"sms"|"whatsapp","notification_status": "queued"|"sent"|"delivered"|"bounced"|"complained"|"failed","payment_status": "unpaid"|"pending"|"paid"|"partially_paid"|"refunded"|"failed","price_type": "fixed"|"from","user_role": "client"|"staff"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "actor_type": ["user", "staff", "admin", "system"],"block_source": ["manual", "google", "holiday"],"booking_source": ["online", "admin"],"booking_status": ["held", "pending_payment", "confirmed", "completed", "cancelled", "no_show", "expired"],"job_status": ["queued", "running", "succeeded", "failed", "dead"],"notification_channel": ["email", "sms", "whatsapp"],"notification_status": ["queued", "sent", "delivered", "bounced", "complained", "failed"],"payment_status": ["unpaid", "pending", "paid", "partially_paid", "refunded", "failed"],"price_type": ["fixed", "from"],"user_role": ["client", "staff", "admin"]
          }
        }
} as const

