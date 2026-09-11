export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  private: {
    Tables: {
      integration_credentials: {
        Row: {
          connection_id: string
          created_at: string
          credential_kind: string
          encrypted_payload: string
          encryption_key_version: string
          expires_at: string | null
          id: string
          refresh_locked_at: string | null
          refresh_token_expires_at: string | null
          rotated_at: string | null
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          credential_kind: string
          encrypted_payload: string
          encryption_key_version?: string
          expires_at?: string | null
          id?: string
          refresh_locked_at?: string | null
          refresh_token_expires_at?: string | null
          rotated_at?: string | null
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          credential_kind?: string
          encrypted_payload?: string
          encryption_key_version?: string
          expires_at?: string | null
          id?: string
          refresh_locked_at?: string | null
          refresh_token_expires_at?: string | null
          rotated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_asset_tokens: {
        Row: {
          access_token_encrypted: string
          asset_type: string
          connection_id: string
          created_at: string
          encryption_key_version: string | null
          external_asset_id: string
          id: string
          scopes: Json | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted: string
          asset_type: string
          connection_id: string
          created_at?: string
          encryption_key_version?: string | null
          external_asset_id: string
          id?: string
          scopes?: Json | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string
          asset_type?: string
          connection_id?: string
          created_at?: string
          encryption_key_version?: string | null
          external_asset_id?: string
          id?: string
          scopes?: Json | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempt_count: number
          claimed_at: string | null
          connection_id: string | null
          created_at: string
          error_message: string | null
          external_event_id: string | null
          fingerprint: string
          headers: Json
          id: string
          next_retry_at: string | null
          organization_id: string | null
          payload: Json
          processed_at: string | null
          processing_result: Json
          provider: string
          received_at: string
          signature_valid: boolean
          status: string
          topic: string
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string | null
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          external_event_id?: string | null
          fingerprint: string
          headers?: Json
          id?: string
          next_retry_at?: string | null
          organization_id?: string | null
          payload: Json
          processed_at?: string | null
          processing_result?: Json
          provider: string
          received_at?: string
          signature_valid?: boolean
          status?: string
          topic: string
        }
        Update: {
          attempt_count?: number
          claimed_at?: string | null
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          external_event_id?: string | null
          fingerprint?: string
          headers?: Json
          id?: string
          next_retry_at?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_result?: Json
          provider?: string
          received_at?: string
          signature_valid?: boolean
          status?: string
          topic?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accessible_org_ids: { Args: never; Returns: string[] }
      assigned_consultant_org_ids: { Args: never; Returns: string[] }
      can_access_org: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      can_manage_org: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      current_member_role: {
        Args: { target_organization_id: string }
        Returns: Database["public"]["Enums"]["member_role"]
      }
      enum_labels: { Args: { enum_type_name: string }; Returns: string[] }
      export_organization_data: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      gateway_org_id: { Args: never; Returns: string }
      has_valid_subscription: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      is_active_org_member: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      is_assigned_consultant: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      purge_expired_ai_context: {
        Args: { p_before: string; p_limit?: number }
        Returns: Json
      }
      purge_expired_ai_security_events: {
        Args: { p_before: string; p_limit?: number }
        Returns: Json
      }
      purge_processed_webhook_events: {
        Args: { p_before: string; p_limit?: number }
        Returns: number
      }
      reap_stalled_agent_runs: {
        Args: { p_before: string; p_limit?: number }
        Returns: Json
      }
      record_agent_version_evaluation: {
        Args: { p_payload: Json }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_approvals: {
        Row: {
          decided_at: string
          decided_by: string | null
          decision: string
          id: string
          organization_id: string
          output_id: string
          reason: string | null
        }
        Insert: {
          decided_at?: string
          decided_by?: string | null
          decision: string
          id?: string
          organization_id: string
          output_id: string
          reason?: string | null
        }
        Update: {
          decided_at?: string
          decided_by?: string | null
          decision?: string
          id?: string
          organization_id?: string
          output_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_approvals_output_id_fkey"
            columns: ["output_id"]
            isOneToOne: false
            referencedRelation: "agent_outputs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_context_snapshots: {
        Row: {
          context_level: string
          created_at: string
          id: string
          organization_id: string
          run_id: string
          snapshot: Json
        }
        Insert: {
          context_level: string
          created_at?: string
          id?: string
          organization_id: string
          run_id: string
          snapshot: Json
        }
        Update: {
          context_level?: string
          created_at?: string
          id?: string
          organization_id?: string
          run_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agent_context_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_context_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_definitions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_outputs: {
        Row: {
          approval_required: boolean
          created_at: string
          id: string
          organization_id: string
          output: Json
          published_at: string | null
          run_id: string
          schema_version: string
          status: string
          updated_at: string
        }
        Insert: {
          approval_required?: boolean
          created_at?: string
          id?: string
          organization_id: string
          output: Json
          published_at?: string | null
          run_id: string
          schema_version?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approval_required?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          output?: Json
          published_at?: string | null
          run_id?: string
          schema_version?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_outputs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outputs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_query_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          organization_id: string
          rejection_reason: string | null
          rows_returned: number | null
          run_id: string
          sql_text: string
          tables_used: Json | null
          was_rejected: boolean
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          organization_id: string
          rejection_reason?: string | null
          rows_returned?: number | null
          run_id: string
          sql_text: string
          tables_used?: Json | null
          was_rejected?: boolean
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          organization_id?: string
          rejection_reason?: string | null
          rows_returned?: number | null
          run_id?: string
          sql_text?: string
          tables_used?: Json | null
          was_rejected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_query_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_query_runs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_run_steps: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          organization_id: string
          payload: Json | null
          position: number
          run_id: string
          step_type: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          organization_id: string
          payload?: Json | null
          position: number
          run_id: string
          step_type: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          organization_id?: string
          payload?: Json | null
          position?: number
          run_id?: string
          step_type?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          activity_digest: string | null
          actor_user_id: string | null
          agent_version_id: string
          budget_max_cost_usd: number | null
          budget_max_tool_calls: number | null
          cache_creation_tokens: number | null
          cache_read_tokens: number | null
          cost_basis: string | null
          created_at: string
          deployment_version: string | null
          entity_ids: Json | null
          error_message: string | null
          estimated_cost_usd: number | null
          execution_mode: string
          finished_at: string | null
          id: string
          input_tokens: number
          latency_ms: number | null
          lookback_days: number
          model: string | null
          model_calls: number | null
          objective: string
          organization_id: string
          output_tokens: number
          parallel_group_id: string | null
          parent_run_id: string | null
          pricing_version: string | null
          provider: string | null
          reasoning_tokens: number | null
          root_run_id: string | null
          started_at: string
          status: string
          stop_reason: string | null
          store_id: string | null
          time_range: Json | null
          tool_call_count: number | null
          trace_id: string | null
          trigger_type: string
        }
        Insert: {
          activity_digest?: string | null
          actor_user_id?: string | null
          agent_version_id: string
          budget_max_cost_usd?: number | null
          budget_max_tool_calls?: number | null
          cache_creation_tokens?: number | null
          cache_read_tokens?: number | null
          cost_basis?: string | null
          created_at?: string
          deployment_version?: string | null
          entity_ids?: Json | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          execution_mode?: string
          finished_at?: string | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          lookback_days?: number
          model?: string | null
          model_calls?: number | null
          objective: string
          organization_id: string
          output_tokens?: number
          parallel_group_id?: string | null
          parent_run_id?: string | null
          pricing_version?: string | null
          provider?: string | null
          reasoning_tokens?: number | null
          root_run_id?: string | null
          started_at?: string
          status?: string
          stop_reason?: string | null
          store_id?: string | null
          time_range?: Json | null
          tool_call_count?: number | null
          trace_id?: string | null
          trigger_type: string
        }
        Update: {
          activity_digest?: string | null
          actor_user_id?: string | null
          agent_version_id?: string
          budget_max_cost_usd?: number | null
          budget_max_tool_calls?: number | null
          cache_creation_tokens?: number | null
          cache_read_tokens?: number | null
          cost_basis?: string | null
          created_at?: string
          deployment_version?: string | null
          entity_ids?: Json | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          execution_mode?: string
          finished_at?: string | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          lookback_days?: number
          model?: string | null
          model_calls?: number | null
          objective?: string
          organization_id?: string
          output_tokens?: number
          parallel_group_id?: string | null
          parent_run_id?: string | null
          pricing_version?: string | null
          provider?: string | null
          reasoning_tokens?: number | null
          root_run_id?: string | null
          started_at?: string
          status?: string
          stop_reason?: string | null
          store_id?: string | null
          time_range?: Json | null
          tool_call_count?: number | null
          trace_id?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_agent_version_id_fkey"
            columns: ["agent_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_root_run_id_fkey"
            columns: ["root_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tool_calls: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          input: Json | null
          is_error: boolean
          organization_id: string
          output: Json | null
          run_id: string
          tool_name: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          input?: Json | null
          is_error?: boolean
          organization_id: string
          output?: Json | null
          run_id: string
          tool_name: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          input?: Json | null
          is_error?: boolean
          organization_id?: string
          output?: Json | null
          run_id?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tool_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tool_calls_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_version_eval_results: {
        Row: {
          agent_code: string
          checks: number
          created_at: string
          evaluation_id: string
          failed: Json
          id: string
          metrics: Json
          passed: boolean
        }
        Insert: {
          agent_code: string
          checks?: number
          created_at?: string
          evaluation_id: string
          failed?: Json
          id?: string
          metrics?: Json
          passed: boolean
        }
        Update: {
          agent_code?: string
          checks?: number
          created_at?: string
          evaluation_id?: string
          failed?: Json
          id?: string
          metrics?: Json
          passed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_version_eval_results_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "agent_version_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_version_evaluations: {
        Row: {
          agent_eval_failures: Json
          agent_version_id: string
          created_at: string
          dataset_version: string
          evaluated_agent_codes: Json
          evaluated_at: string
          evaluation_mode: string
          evidence: Json
          id: string
          overall_score: number | null
          rates: Json
          scores: Json
          status: string
        }
        Insert: {
          agent_eval_failures?: Json
          agent_version_id: string
          created_at?: string
          dataset_version: string
          evaluated_agent_codes?: Json
          evaluated_at?: string
          evaluation_mode: string
          evidence?: Json
          id?: string
          overall_score?: number | null
          rates?: Json
          scores?: Json
          status: string
        }
        Update: {
          agent_eval_failures?: Json
          agent_version_id?: string
          created_at?: string
          dataset_version?: string
          evaluated_agent_codes?: Json
          evaluated_at?: string
          evaluation_mode?: string
          evidence?: Json
          id?: string
          overall_score?: number | null
          rates?: Json
          scores?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_version_evaluations_agent_version_id_fkey"
            columns: ["agent_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_versions: {
        Row: {
          allowed_tools: Json
          approval_mode: string
          config: Json | null
          created_at: string
          definition_id: string
          id: string
          is_active: boolean
          model: string
          output_schema_version: string
          prompt_code: string
          prompt_version: string
          version: string
        }
        Insert: {
          allowed_tools?: Json
          approval_mode?: string
          config?: Json | null
          created_at?: string
          definition_id: string
          id?: string
          is_active?: boolean
          model: string
          output_schema_version?: string
          prompt_code: string
          prompt_version: string
          version: string
        }
        Update: {
          allowed_tools?: Json
          approval_mode?: string
          config?: Json | null
          created_at?: string
          definition_id?: string
          id?: string
          is_active?: boolean
          model?: string
          output_schema_version?: string
          prompt_code?: string
          prompt_version?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_versions_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          agent_code: string
          created_at: string
          id: string
          organization_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_code: string
          created_at?: string
          id?: string
          organization_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_code?: string
          created_at?: string
          id?: string
          organization_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_diagnostic_gate_log: {
        Row: {
          activity_digest: string | null
          agent_code: string
          created_at: string
          decision: string
          id: string
          organization_id: string
          reason: string
          store_id: string | null
          tick_id: string
        }
        Insert: {
          activity_digest?: string | null
          agent_code: string
          created_at?: string
          decision: string
          id?: string
          organization_id: string
          reason: string
          store_id?: string | null
          tick_id: string
        }
        Update: {
          activity_digest?: string | null
          agent_code?: string
          created_at?: string
          decision?: string
          id?: string
          organization_id?: string
          reason?: string
          store_id?: string | null
          tick_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_diagnostic_gate_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_diagnostic_gate_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          role: string
          run_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
          role: string
          run_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_security_events: {
        Row: {
          created_at: string
          detail: Json
          event_type: string
          id: string
          organization_id: string
          run_id: string | null
          severity: string
          source: string
          trace_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          event_type: string
          id?: string
          organization_id: string
          run_id?: string | null
          severity: string
          source: string
          trace_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          event_type?: string
          id?: string
          organization_id?: string
          run_id?: string | null
          severity?: string
          source?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_security_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_security_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rule_templates: {
        Row: {
          alert_message_template: string
          alert_title_template: string
          category: string
          code: string
          created_at: string
          default_condition: Json
          default_lookback_days: number | null
          default_severity: Database["public"]["Enums"]["alert_severity"]
          description: string | null
          id: string
          is_active: boolean
          metric_code: string | null
          name: string
          phase: number
          task_description_template: string | null
          task_title_template: string | null
          updated_at: string
        }
        Insert: {
          alert_message_template: string
          alert_title_template: string
          category?: string
          code: string
          created_at?: string
          default_condition: Json
          default_lookback_days?: number | null
          default_severity: Database["public"]["Enums"]["alert_severity"]
          description?: string | null
          id?: string
          is_active?: boolean
          metric_code?: string | null
          name: string
          phase?: number
          task_description_template?: string | null
          task_title_template?: string | null
          updated_at?: string
        }
        Update: {
          alert_message_template?: string
          alert_title_template?: string
          category?: string
          code?: string
          created_at?: string
          default_condition?: Json
          default_lookback_days?: number | null
          default_severity?: Database["public"]["Enums"]["alert_severity"]
          description?: string | null
          id?: string
          is_active?: boolean
          metric_code?: string | null
          name?: string
          phase?: number
          task_description_template?: string | null
          task_title_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          context_data: Json | null
          created_at: string
          fingerprint: string | null
          first_detected_at: string
          id: string
          last_detected_at: string
          message: string
          metric_code: string | null
          metric_value: number | null
          organization_id: string
          organization_rule_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_template_id: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          source_entity_id: string | null
          source_entity_type: string | null
          status: Database["public"]["Enums"]["alert_status"]
          threshold_value: number | null
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          context_data?: Json | null
          created_at?: string
          fingerprint?: string | null
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          message: string
          metric_code?: string | null
          metric_value?: number | null
          organization_id: string
          organization_rule_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_template_id?: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          source_entity_id?: string | null
          source_entity_type?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          threshold_value?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          context_data?: Json | null
          created_at?: string
          fingerprint?: string | null
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          message?: string
          metric_code?: string | null
          metric_value?: number | null
          organization_id?: string
          organization_rule_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_template_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          source_entity_id?: string | null
          source_entity_type?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          threshold_value?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_organization_rule_id_fkey"
            columns: ["organization_rule_id"]
            isOneToOne: false
            referencedRelation: "organization_alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_rule_template_id_fkey"
            columns: ["rule_template_id"]
            isOneToOne: false
            referencedRelation: "alert_rule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          request_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          request_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          request_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_ai_summaries: {
        Row: {
          agreed_actions: Json | null
          approved_at: string | null
          approved_by: string | null
          authored_by: string | null
          call_id: string
          created_at: string
          id: string
          key_points: Json | null
          organization_id: string
          published_at: string | null
          rejection_reason: string | null
          run_id: string | null
          status: Database["public"]["Enums"]["call_summary_status"]
          summary: string
          transcript_id: string | null
          updated_at: string
        }
        Insert: {
          agreed_actions?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          authored_by?: string | null
          call_id: string
          created_at?: string
          id?: string
          key_points?: Json | null
          organization_id: string
          published_at?: string | null
          rejection_reason?: string | null
          run_id?: string | null
          status?: Database["public"]["Enums"]["call_summary_status"]
          summary: string
          transcript_id?: string | null
          updated_at?: string
        }
        Update: {
          agreed_actions?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          authored_by?: string | null
          call_id?: string
          created_at?: string
          id?: string
          key_points?: Json | null
          organization_id?: string
          published_at?: string | null
          rejection_reason?: string | null
          run_id?: string | null
          status?: Database["public"]["Enums"]["call_summary_status"]
          summary?: string
          transcript_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_ai_summaries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_ai_summaries_authored_by_fkey"
            columns: ["authored_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_ai_summaries_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "consulting_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_ai_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_ai_summaries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_ai_summaries_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_internal_notes: {
        Row: {
          author_user_id: string
          body: string
          call_id: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          call_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          call_id?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_internal_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_internal_notes_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "consulting_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_internal_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_task_links: {
        Row: {
          call_id: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          task_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          task_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_task_links_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "consulting_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_task_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_task_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          organization_id: string
          source: string
          version: number
        }
        Insert: {
          call_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          organization_id: string
          source?: string
          version?: number
        }
        Update: {
          call_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          organization_id?: string
          source?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "consulting_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_calendar_items: {
        Row: {
          blocked_reason: string | null
          calendar_id: string
          channel: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          ends_at: string | null
          executed_at: string | null
          executed_by: string | null
          execution_notes: string | null
          id: string
          is_visible_to_client: boolean
          item_type: string
          klaviyo_campaign_id: string | null
          marketing_draft_id: string | null
          meta_campaign_id: string | null
          metadata: Json
          milestone_id: string | null
          organization_id: string
          owner_user_id: string | null
          result_data: Json
          starts_at: string
          status: string
          store_id: string | null
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          calendar_id: string
          channel: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          ends_at?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_notes?: string | null
          id?: string
          is_visible_to_client?: boolean
          item_type?: string
          klaviyo_campaign_id?: string | null
          marketing_draft_id?: string | null
          meta_campaign_id?: string | null
          metadata?: Json
          milestone_id?: string | null
          organization_id: string
          owner_user_id?: string | null
          result_data?: Json
          starts_at: string
          status?: string
          store_id?: string | null
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          calendar_id?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          ends_at?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_notes?: string | null
          id?: string
          is_visible_to_client?: boolean
          item_type?: string
          klaviyo_campaign_id?: string | null
          marketing_draft_id?: string | null
          meta_campaign_id?: string | null
          metadata?: Json
          milestone_id?: string | null
          organization_id?: string
          owner_user_id?: string | null
          result_data?: Json
          starts_at?: string
          status?: string
          store_id?: string | null
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_calendar_items_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "campaign_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_klaviyo_campaign_id_fkey"
            columns: ["klaviyo_campaign_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_marketing_draft_id_fkey"
            columns: ["marketing_draft_id"]
            isOneToOne: false
            referencedRelation: "marketing_content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_meta_campaign_id_fkey"
            columns: ["meta_campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "strategic_plan_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendar_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_calendars: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_visible_to_client: boolean
          name: string
          organization_id: string
          status: string
          store_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_visible_to_client?: boolean
          name: string
          organization_id: string
          status?: string
          store_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_visible_to_client?: boolean
          name?: string
          organization_id?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_calendars_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_calendars_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      client_constraints: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          priority: string
          statement: string
          status: string
          store_id: string | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          priority?: string
          statement: string
          status?: string
          store_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          priority?: string
          statement?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_constraints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_constraints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_constraints_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invites: {
        Row: {
          code: string
          consultant_user_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_user_id: string | null
          organization_id: string
          redeemed_at: string | null
          status: string
        }
        Insert: {
          code: string
          consultant_user_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_user_id?: string | null
          organization_id: string
          redeemed_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          consultant_user_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_user_id?: string | null
          organization_id?: string
          redeemed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invites_consultant_user_id_fkey"
            columns: ["consultant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          consultant_user_id: string
          ended_at: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          organization_id: string
          work_share: number
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          consultant_user_id: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          organization_id: string
          work_share?: number
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          consultant_user_id?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          organization_id?: string
          work_share?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultant_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_assignments_consultant_user_id_fkey"
            columns: ["consultant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_client_message_reads: {
        Row: {
          last_read_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          organization_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_client_message_reads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_client_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_client_messages: {
        Row: {
          attachments: Json
          author_kind: string
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          attachments?: Json
          author_kind: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          attachments?: Json
          author_kind?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_client_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_client_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_partners: {
        Row: {
          consultant_user_id: string
          created_at: string
          created_by: string | null
          partner_user_id: string
        }
        Insert: {
          consultant_user_id: string
          created_at?: string
          created_by?: string | null
          partner_user_id: string
        }
        Update: {
          consultant_user_id?: string
          created_at?: string
          created_by?: string | null
          partner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_partners_consultant_user_id_fkey"
            columns: ["consultant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_partners_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consulting_calls: {
        Row: {
          call_type: string
          consultant_user_id: string | null
          created_at: string
          created_by: string
          duration_minutes: number | null
          external_recording_id: string | null
          held_at: string | null
          id: string
          is_visible_to_client: boolean
          organization_id: string
          recording_provider: string | null
          recording_url: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["call_status"]
          title: string
          updated_at: string
        }
        Insert: {
          call_type?: string
          consultant_user_id?: string | null
          created_at?: string
          created_by: string
          duration_minutes?: number | null
          external_recording_id?: string | null
          held_at?: string | null
          id?: string
          is_visible_to_client?: boolean
          organization_id: string
          recording_provider?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          title: string
          updated_at?: string
        }
        Update: {
          call_type?: string
          consultant_user_id?: string | null
          created_at?: string
          created_by?: string
          duration_minutes?: number | null
          external_recording_id?: string | null
          held_at?: string | null
          id?: string
          is_visible_to_client?: boolean
          organization_id?: string
          recording_provider?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consulting_calls_consultant_user_id_fkey"
            columns: ["consultant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulting_calls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulting_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expenses: {
        Row: {
          amount: number
          billing_period: string
          category: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          amount: number
          billing_period?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          billing_period?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_account_insight_values: {
        Row: {
          account_id: string
          captured_at: string
          id: string
          metric_name: string
          organization_id: string
          period_end: string
          period_start: string
          source: string
          value: number | null
        }
        Insert: {
          account_id: string
          captured_at?: string
          id?: string
          metric_name: string
          organization_id: string
          period_end: string
          period_start: string
          source?: string
          value?: number | null
        }
        Update: {
          account_id?: string
          captured_at?: string
          id?: string
          metric_name?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          source?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_account_insight_values_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_account_insight_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_account_snapshots: {
        Row: {
          account_id: string
          captured_at: string
          followers_count: number | null
          id: string
          media_count: number | null
          organization_id: string
          snapshot_date: string
          source: string
          timezone: string
        }
        Insert: {
          account_id: string
          captured_at?: string
          followers_count?: number | null
          id?: string
          media_count?: number | null
          organization_id: string
          snapshot_date: string
          source?: string
          timezone: string
        }
        Update: {
          account_id?: string
          captured_at?: string
          followers_count?: number | null
          id?: string
          media_count?: number | null
          organization_id?: string
          snapshot_date?: string
          source?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_account_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_account_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          account_type: string | null
          auth_strategy: string
          connection_id: string
          created_at: string
          display_name: string | null
          external_instagram_id: string
          followers_count: number | null
          id: string
          is_active: boolean
          is_selected: boolean
          last_synced_at: string | null
          linked_page_external_id: string | null
          media_count: number | null
          metadata: Json
          organization_id: string
          scopes: string[]
          updated_at: string
          username: string | null
        }
        Insert: {
          account_type?: string | null
          auth_strategy: string
          connection_id: string
          created_at?: string
          display_name?: string | null
          external_instagram_id: string
          followers_count?: number | null
          id?: string
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          linked_page_external_id?: string | null
          media_count?: number | null
          metadata?: Json
          organization_id: string
          scopes?: string[]
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_type?: string | null
          auth_strategy?: string
          connection_id?: string
          created_at?: string
          display_name?: string | null
          external_instagram_id?: string
          followers_count?: number | null
          id?: string
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          linked_page_external_id?: string | null
          media_count?: number | null
          metadata?: Json
          organization_id?: string
          scopes?: string[]
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_follower_winners: {
        Row: {
          account_id: string
          confidence: string | null
          created_at: string
          followers_attributed: number | null
          id: string
          media_id: string | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          ranking: number
          recorded_by: string | null
          source: string
          updated_at: string
        }
        Insert: {
          account_id: string
          confidence?: string | null
          created_at?: string
          followers_attributed?: number | null
          id?: string
          media_id?: string | null
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          ranking: number
          recorded_by?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          confidence?: string | null
          created_at?: string
          followers_attributed?: number | null
          id?: string
          media_id?: string | null
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          ranking?: number
          recorded_by?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_follower_winners_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_follower_winners_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "instagram_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_follower_winners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_follower_winners_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_image_bank: {
        Row: {
          agent_run_id: string | null
          analysis: Json | null
          analyzed_at: string | null
          attempts: number
          byte_size: number
          checksum: string
          content_type: string
          created_at: string
          created_by: string
          error_reason: string | null
          id: string
          knowledge_document_id: string | null
          markdown: string | null
          organization_id: string
          original_filename: string
          public_url: string
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          agent_run_id?: string | null
          analysis?: Json | null
          analyzed_at?: string | null
          attempts?: number
          byte_size: number
          checksum: string
          content_type: string
          created_at?: string
          created_by: string
          error_reason?: string | null
          id?: string
          knowledge_document_id?: string | null
          markdown?: string | null
          organization_id: string
          original_filename: string
          public_url: string
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          agent_run_id?: string | null
          analysis?: Json | null
          analyzed_at?: string | null
          attempts?: number
          byte_size?: number
          checksum?: string
          content_type?: string
          created_at?: string
          created_by?: string
          error_reason?: string | null
          id?: string
          knowledge_document_id?: string | null
          markdown?: string | null
          organization_id?: string
          original_filename?: string
          public_url?: string
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_image_bank_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_image_bank_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_image_bank_knowledge_document_id_fkey"
            columns: ["knowledge_document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_image_bank_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_image_overlays: {
        Row: {
          created_at: string
          created_by: string
          format: string
          id: string
          image_id: string | null
          layout: Json
          name: string
          organization_id: string
          ratio: string
          slides: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          format?: string
          id?: string
          image_id?: string | null
          layout?: Json
          name?: string
          organization_id: string
          ratio?: string
          slides?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          format?: string
          id?: string
          image_id?: string | null
          layout?: Json
          name?: string
          organization_id?: string
          ratio?: string
          slides?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_image_overlays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_image_overlays_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "instagram_image_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_image_overlays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_media: {
        Row: {
          account_id: string
          caption: string | null
          children: Json
          created_at: string
          external_media_id: string
          id: string
          is_active: boolean
          media_type: string
          media_url: string | null
          media_url_expires_at: string | null
          metadata: Json
          organization_id: string
          permalink: string | null
          published_at: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          caption?: string | null
          children?: Json
          created_at?: string
          external_media_id: string
          id?: string
          is_active?: boolean
          media_type: string
          media_url?: string | null
          media_url_expires_at?: string | null
          metadata?: Json
          organization_id: string
          permalink?: string | null
          published_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          caption?: string | null
          children?: Json
          created_at?: string
          external_media_id?: string
          id?: string
          is_active?: boolean
          media_type?: string
          media_url?: string | null
          media_url_expires_at?: string | null
          metadata?: Json
          organization_id?: string
          permalink?: string | null
          published_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_media_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_media_insight_values: {
        Row: {
          account_id: string
          captured_at: string
          id: string
          media_id: string
          metric_name: string
          organization_id: string
          period: string
          period_end: string | null
          period_start: string | null
          source: string
          value: number | null
        }
        Insert: {
          account_id: string
          captured_at?: string
          id?: string
          media_id: string
          metric_name: string
          organization_id: string
          period: string
          period_end?: string | null
          period_start?: string | null
          source?: string
          value?: number | null
        }
        Update: {
          account_id?: string
          captured_at?: string
          id?: string
          media_id?: string
          metric_name?: string
          organization_id?: string
          period?: string
          period_end?: string | null
          period_start?: string | null
          source?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_media_insight_values_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_media_insight_values_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "instagram_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_media_insight_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          api_version: string | null
          connected_at: string | null
          connected_by: string | null
          created_at: string
          deletion_requested_at: string | null
          deletion_requested_by: string | null
          disconnected_at: string | null
          id: string
          last_error_at: string | null
          last_error_message: string | null
          last_sync_at: string | null
          metadata: Json
          organization_id: string
          provider: string
          provider_account_id: string | null
          provider_account_name: string | null
          scheduled_purge_at: string | null
          scopes: string[]
          status: string
          sync_cursor: Json
          updated_at: string
        }
        Insert: {
          api_version?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          disconnected_at?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          metadata?: Json
          organization_id: string
          provider: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          scheduled_purge_at?: string | null
          scopes?: string[]
          status?: string
          sync_cursor?: Json
          updated_at?: string
        }
        Update: {
          api_version?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          disconnected_at?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          metadata?: Json
          organization_id?: string
          provider?: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          scheduled_purge_at?: string | null
          scopes?: string[]
          status?: string
          sync_cursor?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_deletion_requested_by_fkey"
            columns: ["deletion_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_runs: {
        Row: {
          attempt_count: number
          connection_id: string
          created_at: string
          cursor_after: Json | null
          cursor_before: Json | null
          error_code: string | null
          error_message: string | null
          external_operation_id: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          metadata: Json
          next_retry_at: string | null
          organization_id: string
          provider: string
          records_failed: number
          records_read: number
          records_written: number
          started_at: string | null
          status: string
          sync_scope: string | null
          sync_type: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          connection_id: string
          created_at?: string
          cursor_after?: Json | null
          cursor_before?: Json | null
          error_code?: string | null
          error_message?: string | null
          external_operation_id?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          next_retry_at?: string | null
          organization_id: string
          provider: string
          records_failed?: number
          records_read?: number
          records_written?: number
          started_at?: string | null
          status?: string
          sync_scope?: string | null
          sync_type: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          connection_id?: string
          created_at?: string
          cursor_after?: Json | null
          cursor_before?: Json | null
          error_code?: string | null
          error_message?: string | null
          external_operation_id?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          next_retry_at?: string | null
          organization_id?: string
          provider?: string
          records_failed?: number
          records_read?: number
          records_written?: number
          started_at?: string | null
          status?: string
          sync_scope?: string | null
          sync_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_accounts: {
        Row: {
          connection_id: string
          conversion_metric_id: string | null
          conversion_metric_name: string | null
          conversion_metric_selected_at: string | null
          conversion_metric_selected_by: string | null
          conversion_metric_source: string | null
          created_at: string
          currency_code: string | null
          external_account_id: string
          id: string
          last_synced_at: string | null
          name: string | null
          organization_id: string
          raw_data: Json
          store_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          connection_id: string
          conversion_metric_id?: string | null
          conversion_metric_name?: string | null
          conversion_metric_selected_at?: string | null
          conversion_metric_selected_by?: string | null
          conversion_metric_source?: string | null
          created_at?: string
          currency_code?: string | null
          external_account_id: string
          id?: string
          last_synced_at?: string | null
          name?: string | null
          organization_id: string
          raw_data?: Json
          store_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          connection_id?: string
          conversion_metric_id?: string | null
          conversion_metric_name?: string | null
          conversion_metric_selected_at?: string | null
          conversion_metric_selected_by?: string | null
          conversion_metric_source?: string | null
          created_at?: string
          currency_code?: string | null
          external_account_id?: string
          id?: string
          last_synced_at?: string | null
          name?: string | null
          organization_id?: string
          raw_data?: Json
          store_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_campaign_audiences: {
        Row: {
          audience_type: string
          campaign_id: string
          external_audience_id: string
          id: string
          name: string | null
          organization_id: string
          raw_data: Json
        }
        Insert: {
          audience_type: string
          campaign_id: string
          external_audience_id: string
          id?: string
          name?: string | null
          organization_id: string
          raw_data?: Json
        }
        Update: {
          audience_type?: string
          campaign_id?: string
          external_audience_id?: string
          id?: string
          name?: string | null
          organization_id?: string
          raw_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_campaign_audiences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_campaign_audiences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_campaign_messages: {
        Row: {
          campaign_id: string
          channel: string | null
          created_at: string
          external_message_id: string
          external_template_id: string | null
          from_email: string | null
          from_label: string | null
          id: string
          label: string | null
          last_synced_at: string | null
          name: string | null
          organization_id: string
          preview_text: string | null
          raw_data: Json
          reply_to_email: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          channel?: string | null
          created_at?: string
          external_message_id: string
          external_template_id?: string | null
          from_email?: string | null
          from_label?: string | null
          id?: string
          label?: string | null
          last_synced_at?: string | null
          name?: string | null
          organization_id: string
          preview_text?: string | null
          raw_data?: Json
          reply_to_email?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          channel?: string | null
          created_at?: string
          external_message_id?: string
          external_template_id?: string | null
          from_email?: string | null
          from_label?: string | null
          id?: string
          label?: string | null
          last_synced_at?: string | null
          name?: string | null
          organization_id?: string
          preview_text?: string | null
          raw_data?: Json
          reply_to_email?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_campaign_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_campaigns: {
        Row: {
          account_id: string
          created_at: string
          created_at_external: string | null
          external_campaign_id: string
          id: string
          last_synced_at: string | null
          name: string
          organization_id: string
          raw_data: Json
          send_time: string | null
          status: string | null
          updated_at: string
          updated_at_external: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_at_external?: string | null
          external_campaign_id: string
          id?: string
          last_synced_at?: string | null
          name: string
          organization_id: string
          raw_data?: Json
          send_time?: string | null
          status?: string | null
          updated_at?: string
          updated_at_external?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_at_external?: string | null
          external_campaign_id?: string
          id?: string
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          raw_data?: Json
          send_time?: string | null
          status?: string | null
          updated_at?: string
          updated_at_external?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_daily_account_metrics: {
        Row: {
          account_id: string
          created_at: string
          currency_code: string | null
          id: string
          metric_date: string
          metric_id: string
          metric_name: string | null
          organization_id: string
          raw_data: Json
          source: string
          value: number
        }
        Insert: {
          account_id: string
          created_at?: string
          currency_code?: string | null
          id?: string
          metric_date: string
          metric_id: string
          metric_name?: string | null
          organization_id: string
          raw_data?: Json
          source?: string
          value: number
        }
        Update: {
          account_id?: string
          created_at?: string
          currency_code?: string | null
          id?: string
          metric_date?: string
          metric_id?: string
          metric_name?: string | null
          organization_id?: string
          raw_data?: Json
          source?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_daily_account_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_daily_account_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_email_click_events: {
        Row: {
          account_id: string
          created_at: string
          external_event_id: string
          external_message_id: string | null
          external_profile_id: string | null
          id: string
          occurred_at: string
          organization_id: string
          raw_data: Json | null
          url: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          external_event_id: string
          external_message_id?: string | null
          external_profile_id?: string | null
          id?: string
          occurred_at: string
          organization_id: string
          raw_data?: Json | null
          url?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          external_event_id?: string
          external_message_id?: string | null
          external_profile_id?: string | null
          id?: string
          occurred_at?: string
          organization_id?: string
          raw_data?: Json | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_email_click_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_email_click_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_flow_actions: {
        Row: {
          action_type: string | null
          created_at: string
          external_action_id: string
          external_created_at: string | null
          external_updated_at: string | null
          flow_id: string
          id: string
          last_synced_at: string | null
          organization_id: string
          position: number | null
          raw_data: Json
          settings_data: Json | null
          status: string | null
          updated_at: string
        }
        Insert: {
          action_type?: string | null
          created_at?: string
          external_action_id: string
          external_created_at?: string | null
          external_updated_at?: string | null
          flow_id: string
          id?: string
          last_synced_at?: string | null
          organization_id: string
          position?: number | null
          raw_data?: Json
          settings_data?: Json | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string | null
          created_at?: string
          external_action_id?: string
          external_created_at?: string | null
          external_updated_at?: string | null
          flow_id?: string
          id?: string
          last_synced_at?: string | null
          organization_id?: string
          position?: number | null
          raw_data?: Json
          settings_data?: Json | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_flow_actions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_flow_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_flow_messages: {
        Row: {
          action_id: string | null
          channel: string | null
          created_at: string
          external_created_at: string | null
          external_message_id: string
          external_template_id: string | null
          external_updated_at: string | null
          flow_id: string
          from_email: string | null
          from_label: string | null
          id: string
          last_synced_at: string | null
          name: string | null
          organization_id: string
          preview_text: string | null
          raw_data: Json
          reply_to_email: string | null
          status: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          channel?: string | null
          created_at?: string
          external_created_at?: string | null
          external_message_id: string
          external_template_id?: string | null
          external_updated_at?: string | null
          flow_id: string
          from_email?: string | null
          from_label?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string | null
          organization_id: string
          preview_text?: string | null
          raw_data?: Json
          reply_to_email?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          channel?: string | null
          created_at?: string
          external_created_at?: string | null
          external_message_id?: string
          external_template_id?: string | null
          external_updated_at?: string | null
          flow_id?: string
          from_email?: string | null
          from_label?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string | null
          organization_id?: string
          preview_text?: string | null
          raw_data?: Json
          reply_to_email?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_flow_messages_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_flow_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_flow_messages_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_flow_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_flows: {
        Row: {
          account_id: string
          created_at: string
          created_at_external: string | null
          external_flow_id: string
          id: string
          last_synced_at: string | null
          name: string
          organization_id: string
          raw_data: Json
          status: string | null
          trigger_type: string | null
          updated_at: string
          updated_at_external: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_at_external?: string | null
          external_flow_id: string
          id?: string
          last_synced_at?: string | null
          name: string
          organization_id: string
          raw_data?: Json
          status?: string | null
          trigger_type?: string | null
          updated_at?: string
          updated_at_external?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_at_external?: string | null
          external_flow_id?: string
          id?: string
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          raw_data?: Json
          status?: string | null
          trigger_type?: string | null
          updated_at?: string
          updated_at_external?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_flows_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_flows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_forms: {
        Row: {
          account_id: string
          created_at: string
          external_form_id: string
          id: string
          last_synced_at: string | null
          name: string
          organization_id: string
          raw_data: Json
          status: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          external_form_id: string
          id?: string
          last_synced_at?: string | null
          name: string
          organization_id: string
          raw_data?: Json
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          external_form_id?: string
          id?: string
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          raw_data?: Json
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_forms_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_list_daily_snapshots: {
        Row: {
          created_at: string
          id: string
          list_id: string
          organization_id: string
          profile_count: number
          snapshot_date: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          organization_id: string
          profile_count?: number
          snapshot_date: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          organization_id?: string
          profile_count?: number
          snapshot_date?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_list_daily_snapshots_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_list_daily_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_lists: {
        Row: {
          account_id: string
          created_at: string
          external_list_id: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string
          opt_in_process: string | null
          organization_id: string
          profile_count: number | null
          raw_data: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          external_list_id: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name: string
          opt_in_process?: string | null
          organization_id: string
          profile_count?: number | null
          raw_data?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          external_list_id?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string
          opt_in_process?: string | null
          organization_id?: string
          profile_count?: number | null
          raw_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_lists_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_metrics: {
        Row: {
          account_id: string
          external_metric_id: string
          id: string
          is_conversion_candidate: boolean
          last_synced_at: string | null
          metric_type: string | null
          name: string
          organization_id: string
          raw_data: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          external_metric_id: string
          id?: string
          is_conversion_candidate?: boolean
          last_synced_at?: string | null
          metric_type?: string | null
          name: string
          organization_id: string
          raw_data?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          external_metric_id?: string
          id?: string
          is_conversion_candidate?: boolean
          last_synced_at?: string | null
          metric_type?: string | null
          name?: string
          organization_id?: string
          raw_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_report_runs: {
        Row: {
          account_id: string
          created_at: string
          currency_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          organization_id: string
          period_end: string
          period_start: string
          report_type: string
          started_at: string
          status: string
          timezone: string
        }
        Insert: {
          account_id: string
          created_at?: string
          currency_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          organization_id: string
          period_end: string
          period_start: string
          report_type: string
          started_at?: string
          status?: string
          timezone: string
        }
        Update: {
          account_id?: string
          created_at?: string
          currency_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          report_type?: string
          started_at?: string
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_report_runs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_report_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_report_values: {
        Row: {
          conversions: number | null
          created_at: string
          currency_code: string | null
          entity_name: string | null
          entity_type: string
          external_entity_id: string | null
          id: string
          metric_id: string
          organization_id: string
          period_end: string
          period_start: string
          raw_data: Json
          report_run_id: string
          revenue: number | null
        }
        Insert: {
          conversions?: number | null
          created_at?: string
          currency_code?: string | null
          entity_name?: string | null
          entity_type: string
          external_entity_id?: string | null
          id?: string
          metric_id: string
          organization_id: string
          period_end: string
          period_start: string
          raw_data?: Json
          report_run_id: string
          revenue?: number | null
        }
        Update: {
          conversions?: number | null
          created_at?: string
          currency_code?: string | null
          entity_name?: string | null
          entity_type?: string
          external_entity_id?: string | null
          id?: string
          metric_id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          raw_data?: Json
          report_run_id?: string
          revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_report_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_report_values_report_run_id_fkey"
            columns: ["report_run_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_report_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_segment_daily_snapshots: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          profile_count: number
          segment_id: string
          snapshot_date: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          profile_count?: number
          segment_id: string
          snapshot_date: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          profile_count?: number
          segment_id?: string
          snapshot_date?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_segment_daily_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_segment_daily_snapshots_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_segments: {
        Row: {
          account_id: string
          created_at: string
          external_segment_id: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string
          organization_id: string
          profile_count: number | null
          raw_data: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          external_segment_id: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name: string
          organization_id: string
          profile_count?: number | null
          raw_data?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          external_segment_id?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          profile_count?: number | null
          raw_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_segments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_segments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_templates: {
        Row: {
          account_id: string
          created_at: string
          editor_type: string | null
          external_created_at: string | null
          external_template_id: string
          external_updated_at: string | null
          html_content: string | null
          id: string
          last_synced_at: string | null
          name: string | null
          organization_id: string
          raw_data: Json | null
          text_content: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          editor_type?: string | null
          external_created_at?: string | null
          external_template_id: string
          external_updated_at?: string | null
          html_content?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string | null
          organization_id: string
          raw_data?: Json | null
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          editor_type?: string | null
          external_created_at?: string | null
          external_template_id?: string
          external_updated_at?: string | null
          html_content?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string | null
          organization_id?: string
          raw_data?: Json | null
          text_content?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_tracking_consents: {
        Row: {
          account_id: string
          channel: string
          created_at: string
          id: string
          occurred_at: string
          organization_id: string
          profile_id: string
          raw_data: Json
          source: string
          status: string
        }
        Insert: {
          account_id: string
          channel: string
          created_at?: string
          id?: string
          occurred_at: string
          organization_id: string
          profile_id: string
          raw_data?: Json
          source: string
          status: string
        }
        Update: {
          account_id?: string
          channel?: string
          created_at?: string
          id?: string
          occurred_at?: string
          organization_id?: string
          profile_id?: string
          raw_data?: Json
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_tracking_consents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_tracking_consents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_tracking_consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_tracking_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_tracking_events: {
        Row: {
          account_id: string
          created_at: string
          currency_code: string | null
          dedupe_key: string
          event_name: string
          id: string
          occurred_at: string
          organization_id: string
          profile_id: string | null
          properties: Json
          raw_data: Json
          source: string
          source_event_id: string | null
          value: number | null
        }
        Insert: {
          account_id: string
          created_at?: string
          currency_code?: string | null
          dedupe_key: string
          event_name: string
          id?: string
          occurred_at: string
          organization_id: string
          profile_id?: string | null
          properties?: Json
          raw_data?: Json
          source: string
          source_event_id?: string | null
          value?: number | null
        }
        Update: {
          account_id?: string
          created_at?: string
          currency_code?: string | null
          dedupe_key?: string
          event_name?: string
          id?: string
          occurred_at?: string
          organization_id?: string
          profile_id?: string | null
          properties?: Json
          raw_data?: Json
          source?: string
          source_event_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_tracking_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_tracking_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_tracking_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_tracking_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      klaviyo_tracking_profiles: {
        Row: {
          account_id: string
          created_at: string
          email: string | null
          email_normalized: string | null
          external_profile_id: string | null
          first_name: string | null
          first_seen_at: string
          id: string
          last_name: string | null
          last_seen_at: string
          organization_id: string
          phone: string | null
          phone_normalized: string | null
          raw_data: Json
          shopify_customer_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email?: string | null
          email_normalized?: string | null
          external_profile_id?: string | null
          first_name?: string | null
          first_seen_at?: string
          id?: string
          last_name?: string | null
          last_seen_at?: string
          organization_id: string
          phone?: string | null
          phone_normalized?: string | null
          raw_data?: Json
          shopify_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string | null
          email_normalized?: string | null
          external_profile_id?: string | null
          first_name?: string | null
          first_seen_at?: string
          id?: string
          last_name?: string | null
          last_seen_at?: string
          organization_id?: string
          phone?: string | null
          phone_normalized?: string | null
          raw_data?: Json
          shopify_customer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "klaviyo_tracking_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "klaviyo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klaviyo_tracking_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          organization_id: string | null
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          organization_id?: string | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          organization_id?: string | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          audience: string
          authority: string
          checksum: string
          created_at: string
          created_by: string | null
          description: string | null
          embedding_model: string | null
          id: string
          ingested_by: string
          organization_id: string | null
          origin: string
          source_actor_id: string | null
          source_entity_id: string | null
          source_entity_type: string | null
          source_event_id: string | null
          source_type: string
          source_version: number | null
          status: string
          store_id: string | null
          title: string
          updated_at: string
          version: number
          visibility: string
        }
        Insert: {
          audience?: string
          authority?: string
          checksum: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          embedding_model?: string | null
          id?: string
          ingested_by?: string
          organization_id?: string | null
          origin?: string
          source_actor_id?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_event_id?: string | null
          source_type?: string
          source_version?: number | null
          status?: string
          store_id?: string | null
          title: string
          updated_at?: string
          version?: number
          visibility: string
        }
        Update: {
          audience?: string
          authority?: string
          checksum?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          embedding_model?: string | null
          id?: string
          ingested_by?: string
          organization_id?: string | null
          origin?: string
          source_actor_id?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_event_id?: string | null
          source_type?: string
          source_version?: number | null
          status?: string
          store_id?: string | null
          title?: string
          updated_at?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_source_actor_id_fkey"
            columns: ["source_actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_snapshots: {
        Row: {
          ad_spend: number | null
          aov: number | null
          cac: number | null
          captured_by: string | null
          created_at: string
          id: string
          net_profit: number | null
          net_sales: number | null
          notes: string | null
          orders_count: number | null
          organization_id: string
          period: string
          period_end: string
          period_start: string
          roas: number | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          ad_spend?: number | null
          aov?: number | null
          cac?: number | null
          captured_by?: string | null
          created_at?: string
          id?: string
          net_profit?: number | null
          net_sales?: number | null
          notes?: string | null
          orders_count?: number | null
          organization_id: string
          period?: string
          period_end: string
          period_start: string
          roas?: number | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          ad_spend?: number | null
          aov?: number | null
          cac?: number | null
          captured_by?: string | null
          created_at?: string
          id?: string
          net_profit?: number | null
          net_sales?: number | null
          notes?: string | null
          orders_count?: number | null
          organization_id?: string
          period?: string
          period_end?: string
          period_start?: string
          roas?: number | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_content_draft_notes: {
        Row: {
          author_kind: string
          author_user_id: string | null
          body: string
          created_at: string
          draft_id: string
          id: string
          organization_id: string
        }
        Insert: {
          author_kind?: string
          author_user_id?: string | null
          body: string
          created_at?: string
          draft_id: string
          id?: string
          organization_id: string
        }
        Update: {
          author_kind?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          draft_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_content_draft_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_draft_notes_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "marketing_content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_draft_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_content_draft_versions: {
        Row: {
          change_type: string
          created_at: string
          draft_id: string
          edited_by: string | null
          id: string
          organization_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_type: string
          created_at?: string
          draft_id: string
          edited_by?: string | null
          id?: string
          organization_id: string
          snapshot: Json
          version: number
        }
        Update: {
          change_type?: string
          created_at?: string
          draft_id?: string
          edited_by?: string | null
          id?: string
          organization_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_content_draft_versions_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "marketing_content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_draft_versions_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_draft_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_content_drafts: {
        Row: {
          agent_output_id: string | null
          agent_run_id: string | null
          audience: string
          blocks: Json
          brand_colors: Json
          compliance_notes: Json
          confidence: string
          content_type: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          from_name: string
          html: string
          id: string
          last_edited_at: string | null
          last_edited_by: string | null
          locale: string
          organization_id: string
          personalization_tokens: Json
          plain_text: string
          preheader: string
          purpose: string
          reply_to: string | null
          request: Json
          scheduled_for: string | null
          sources: Json
          status: string
          subject: string
          summary: string
          template_name: string
          tone: string
          updated_at: string
          verbatim_texts: Json
          version: number
          warnings: Json
        }
        Insert: {
          agent_output_id?: string | null
          agent_run_id?: string | null
          audience: string
          blocks?: Json
          brand_colors?: Json
          compliance_notes?: Json
          confidence: string
          content_type: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          from_name?: string
          html: string
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          locale: string
          organization_id: string
          personalization_tokens?: Json
          plain_text: string
          preheader?: string
          purpose: string
          reply_to?: string | null
          request: Json
          scheduled_for?: string | null
          sources?: Json
          status?: string
          subject: string
          summary: string
          template_name: string
          tone: string
          updated_at?: string
          verbatim_texts?: Json
          version?: number
          warnings?: Json
        }
        Update: {
          agent_output_id?: string | null
          agent_run_id?: string | null
          audience?: string
          blocks?: Json
          brand_colors?: Json
          compliance_notes?: Json
          confidence?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          from_name?: string
          html?: string
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          locale?: string
          organization_id?: string
          personalization_tokens?: Json
          plain_text?: string
          preheader?: string
          purpose?: string
          reply_to?: string | null
          request?: Json
          scheduled_for?: string | null
          sources?: Json
          status?: string
          subject?: string
          summary?: string
          template_name?: string
          tone?: string
          updated_at?: string
          verbatim_texts?: Json
          version?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "marketing_content_drafts_agent_output_id_fkey"
            columns: ["agent_output_id"]
            isOneToOne: false
            referencedRelation: "agent_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_drafts_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_drafts_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_drafts_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_content_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_ingestion_queue: {
        Row: {
          attempts: number
          audience: string
          authority: string
          content: string
          created_at: string
          document_id: string | null
          id: string
          last_error: string | null
          organization_id: string
          origin: string
          processed_at: string | null
          processing_started_at: string | null
          source_actor_id: string | null
          source_entity_id: string
          source_entity_type: string
          source_event_id: string
          source_type: string
          source_version: number
          status: string
          store_id: string | null
          title: string
        }
        Insert: {
          attempts?: number
          audience: string
          authority: string
          content: string
          created_at?: string
          document_id?: string | null
          id?: string
          last_error?: string | null
          organization_id: string
          origin: string
          processed_at?: string | null
          processing_started_at?: string | null
          source_actor_id?: string | null
          source_entity_id: string
          source_entity_type: string
          source_event_id?: string
          source_type: string
          source_version?: number
          status?: string
          store_id?: string | null
          title: string
        }
        Update: {
          attempts?: number
          audience?: string
          authority?: string
          content?: string
          created_at?: string
          document_id?: string | null
          id?: string
          last_error?: string | null
          organization_id?: string
          origin?: string
          processed_at?: string | null
          processing_started_at?: string | null
          source_actor_id?: string | null
          source_entity_id?: string
          source_entity_type?: string
          source_event_id?: string
          source_type?: string
          source_version?: number
          status?: string
          store_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_ingestion_queue_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_ingestion_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_ingestion_queue_source_actor_id_fkey"
            columns: ["source_actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_ingestion_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_account_activities: {
        Row: {
          actor_id: string
          actor_name: string | null
          ad_account_id: string
          created_at: string
          event_time: string
          event_type: string
          extra_data: Json | null
          id: string
          object_external_id: string
          object_name: string | null
          object_type: string | null
          organization_id: string
          translated_event_type: string | null
        }
        Insert: {
          actor_id?: string
          actor_name?: string | null
          ad_account_id: string
          created_at?: string
          event_time: string
          event_type: string
          extra_data?: Json | null
          id?: string
          object_external_id?: string
          object_name?: string | null
          object_type?: string | null
          organization_id: string
          translated_event_type?: string | null
        }
        Update: {
          actor_id?: string
          actor_name?: string | null
          ad_account_id?: string
          created_at?: string
          event_time?: string
          event_type?: string
          extra_data?: Json | null
          id?: string
          object_external_id?: string
          object_name?: string | null
          object_type?: string | null
          organization_id?: string
          translated_event_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_account_activities_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_account_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_accounts: {
        Row: {
          account_name: string
          account_status_code: number | null
          amount_spent: number | null
          balance: number | null
          business_account_id: string | null
          business_country_code: string | null
          canonical_purchase_action_selected_at: string | null
          canonical_purchase_action_selected_by: string | null
          canonical_purchase_action_type: string
          connection_id: string
          created_at: string
          currency_code: string | null
          disable_reason_code: number | null
          external_ad_account_id: string
          external_created_at: string | null
          funding_source_details: Json | null
          has_accepted_terms: boolean | null
          id: string
          is_active: boolean
          is_selected: boolean
          last_synced_at: string | null
          minimum_daily_budget: number | null
          organization_id: string
          raw_data: Json | null
          spend_cap: number | null
          store_id: string | null
          timezone_name: string | null
          timezone_offset_hours_utc: number | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_status_code?: number | null
          amount_spent?: number | null
          balance?: number | null
          business_account_id?: string | null
          business_country_code?: string | null
          canonical_purchase_action_selected_at?: string | null
          canonical_purchase_action_selected_by?: string | null
          canonical_purchase_action_type?: string
          connection_id: string
          created_at?: string
          currency_code?: string | null
          disable_reason_code?: number | null
          external_ad_account_id: string
          external_created_at?: string | null
          funding_source_details?: Json | null
          has_accepted_terms?: boolean | null
          id?: string
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          minimum_daily_budget?: number | null
          organization_id: string
          raw_data?: Json | null
          spend_cap?: number | null
          store_id?: string | null
          timezone_name?: string | null
          timezone_offset_hours_utc?: number | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_status_code?: number | null
          amount_spent?: number | null
          balance?: number | null
          business_account_id?: string | null
          business_country_code?: string | null
          canonical_purchase_action_selected_at?: string | null
          canonical_purchase_action_selected_by?: string | null
          canonical_purchase_action_type?: string
          connection_id?: string
          created_at?: string
          currency_code?: string | null
          disable_reason_code?: number | null
          external_ad_account_id?: string
          external_created_at?: string | null
          funding_source_details?: Json | null
          has_accepted_terms?: boolean | null
          id?: string
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          minimum_daily_budget?: number | null
          organization_id?: string
          raw_data?: Json | null
          spend_cap?: number | null
          store_id?: string | null
          timezone_name?: string | null
          timezone_offset_hours_utc?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_accounts_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "meta_business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_creative_assignments: {
        Row: {
          ad_id: string
          created_at: string
          creative_id: string
          detected_at: string
          id: string
          organization_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          creative_id: string
          detected_at?: string
          id?: string
          organization_id: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          creative_id?: string
          detected_at?: string
          id?: string
          organization_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_creative_assignments_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "meta_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_creative_assignments_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "meta_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_creative_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_issues: {
        Row: {
          ad_id: string
          created_at: string
          detected_at: string
          error_code: number
          error_message: string | null
          error_summary: string | null
          error_type: string | null
          id: string
          level: string | null
          organization_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          detected_at?: string
          error_code?: number
          error_message?: string | null
          error_summary?: string | null
          error_type?: string | null
          id?: string
          level?: string | null
          organization_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          detected_at?: string
          error_code?: number
          error_message?: string | null
          error_summary?: string | null
          error_type?: string | null
          id?: string
          level?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_issues_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "meta_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_sets: {
        Row: {
          attribution_spec: Json | null
          bid_amount: number | null
          bid_strategy: string | null
          billing_event: string | null
          budget_remaining: number | null
          campaign_id: string
          configured_status: string | null
          created_at: string
          daily_budget: number | null
          destination_type: string | null
          effective_status: string | null
          ends_at: string | null
          external_ad_set_id: string
          external_created_at: string | null
          external_updated_at: string | null
          id: string
          is_dynamic_creative: boolean
          last_synced_at: string | null
          learning_conversions: number | null
          learning_conversions_needed: number | null
          learning_stage_exit_reason: string | null
          learning_stage_status: string | null
          lifetime_budget: number | null
          name: string
          optimization_goal: string | null
          organization_id: string
          promoted_object: Json | null
          raw_data: Json | null
          starts_at: string | null
          targeting_data: Json | null
          updated_at: string
        }
        Insert: {
          attribution_spec?: Json | null
          bid_amount?: number | null
          bid_strategy?: string | null
          billing_event?: string | null
          budget_remaining?: number | null
          campaign_id: string
          configured_status?: string | null
          created_at?: string
          daily_budget?: number | null
          destination_type?: string | null
          effective_status?: string | null
          ends_at?: string | null
          external_ad_set_id: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_dynamic_creative?: boolean
          last_synced_at?: string | null
          learning_conversions?: number | null
          learning_conversions_needed?: number | null
          learning_stage_exit_reason?: string | null
          learning_stage_status?: string | null
          lifetime_budget?: number | null
          name: string
          optimization_goal?: string | null
          organization_id: string
          promoted_object?: Json | null
          raw_data?: Json | null
          starts_at?: string | null
          targeting_data?: Json | null
          updated_at?: string
        }
        Update: {
          attribution_spec?: Json | null
          bid_amount?: number | null
          bid_strategy?: string | null
          billing_event?: string | null
          budget_remaining?: number | null
          campaign_id?: string
          configured_status?: string | null
          created_at?: string
          daily_budget?: number | null
          destination_type?: string | null
          effective_status?: string | null
          ends_at?: string | null
          external_ad_set_id?: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_dynamic_creative?: boolean
          last_synced_at?: string | null
          learning_conversions?: number | null
          learning_conversions_needed?: number | null
          learning_stage_exit_reason?: string | null
          learning_stage_status?: string | null
          lifetime_budget?: number | null
          name?: string
          optimization_goal?: string | null
          organization_id?: string
          promoted_object?: Json | null
          raw_data?: Json | null
          starts_at?: string | null
          targeting_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_sets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads: {
        Row: {
          ad_set_id: string
          configured_status: string | null
          conversion_specs: Json | null
          created_at: string
          current_creative_id: string | null
          effective_status: string | null
          external_ad_id: string
          external_created_at: string | null
          external_updated_at: string | null
          id: string
          last_synced_at: string | null
          name: string
          naming_parser_version: string | null
          organization_id: string
          parsed_angle: string | null
          parsed_format: string | null
          parsed_hook: string | null
          parsed_naming_data: Json | null
          raw_data: Json | null
          review_feedback: Json | null
          tracking_specs: Json | null
          updated_at: string
        }
        Insert: {
          ad_set_id: string
          configured_status?: string | null
          conversion_specs?: Json | null
          created_at?: string
          current_creative_id?: string | null
          effective_status?: string | null
          external_ad_id: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          naming_parser_version?: string | null
          organization_id: string
          parsed_angle?: string | null
          parsed_format?: string | null
          parsed_hook?: string | null
          parsed_naming_data?: Json | null
          raw_data?: Json | null
          review_feedback?: Json | null
          tracking_specs?: Json | null
          updated_at?: string
        }
        Update: {
          ad_set_id?: string
          configured_status?: string | null
          conversion_specs?: Json | null
          created_at?: string
          current_creative_id?: string | null
          effective_status?: string | null
          external_ad_id?: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          naming_parser_version?: string | null
          organization_id?: string
          parsed_angle?: string | null
          parsed_format?: string | null
          parsed_hook?: string | null
          parsed_naming_data?: Json | null
          raw_data?: Json | null
          review_feedback?: Json | null
          tracking_specs?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_current_creative_id_fkey"
            columns: ["current_creative_id"]
            isOneToOne: false
            referencedRelation: "meta_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_business_accounts: {
        Row: {
          connection_id: string
          created_at: string
          external_business_id: string
          id: string
          is_active: boolean
          is_selected: boolean
          last_synced_at: string | null
          name: string
          organization_id: string
          raw_data: Json | null
          updated_at: string
          verification_status: string | null
          vertical: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          external_business_id: string
          id?: string
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          name: string
          organization_id: string
          raw_data?: Json | null
          updated_at?: string
          verification_status?: string | null
          vertical?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          external_business_id?: string
          id?: string
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          raw_data?: Json | null
          updated_at?: string
          verification_status?: string | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_business_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_business_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_calculated_metrics_daily: {
        Row: {
          calculated_at: string
          formula_code: string
          formula_version: string
          id: string
          input_data: Json | null
          insight_row_id: string
          metric_code: string
          organization_id: string
          value: number | null
        }
        Insert: {
          calculated_at?: string
          formula_code: string
          formula_version: string
          id?: string
          input_data?: Json | null
          insight_row_id: string
          metric_code: string
          organization_id: string
          value?: number | null
        }
        Update: {
          calculated_at?: string
          formula_code?: string
          formula_version?: string
          id?: string
          input_data?: Json | null
          insight_row_id?: string
          metric_code?: string
          organization_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_calculated_metrics_daily_insight_row_id_fkey"
            columns: ["insight_row_id"]
            isOneToOne: false
            referencedRelation: "meta_insight_rows_daily"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_calculated_metrics_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          ad_account_id: string
          bid_strategy: string | null
          budget_remaining: number | null
          buying_type: string | null
          configured_status: string | null
          created_at: string
          daily_budget: number | null
          effective_status: string | null
          ends_at: string | null
          external_campaign_id: string
          external_created_at: string | null
          external_updated_at: string | null
          id: string
          last_synced_at: string | null
          lifetime_budget: number | null
          name: string
          objective: string | null
          organization_id: string
          raw_data: Json | null
          special_ad_categories: Json | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          bid_strategy?: string | null
          budget_remaining?: number | null
          buying_type?: string | null
          configured_status?: string | null
          created_at?: string
          daily_budget?: number | null
          effective_status?: string | null
          ends_at?: string | null
          external_campaign_id: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          last_synced_at?: string | null
          lifetime_budget?: number | null
          name: string
          objective?: string | null
          organization_id: string
          raw_data?: Json | null
          special_ad_categories?: Json | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          bid_strategy?: string | null
          budget_remaining?: number | null
          buying_type?: string | null
          configured_status?: string | null
          created_at?: string
          daily_budget?: number | null
          effective_status?: string | null
          ends_at?: string | null
          external_campaign_id?: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          last_synced_at?: string | null
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          organization_id?: string
          raw_data?: Json | null
          special_ad_categories?: Json | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_creative_assets: {
        Row: {
          asset_hash: string | null
          asset_label: string | null
          asset_type: Database["public"]["Enums"]["meta_creative_asset_type"]
          created_at: string
          creative_id: string
          external_asset_id: string | null
          id: string
          is_primary: boolean
          link_url: string | null
          media_url: string | null
          metadata: Json | null
          organization_id: string
          position: number
          text_value: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          asset_hash?: string | null
          asset_label?: string | null
          asset_type: Database["public"]["Enums"]["meta_creative_asset_type"]
          created_at?: string
          creative_id: string
          external_asset_id?: string | null
          id?: string
          is_primary?: boolean
          link_url?: string | null
          media_url?: string | null
          metadata?: Json | null
          organization_id: string
          position?: number
          text_value?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          asset_hash?: string | null
          asset_label?: string | null
          asset_type?: Database["public"]["Enums"]["meta_creative_asset_type"]
          created_at?: string
          creative_id?: string
          external_asset_id?: string | null
          id?: string
          is_primary?: boolean
          link_url?: string | null
          media_url?: string | null
          metadata?: Json | null
          organization_id?: string
          position?: number
          text_value?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_creative_assets_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "meta_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_creative_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_creatives: {
        Row: {
          ad_account_id: string
          asset_feed_spec: Json | null
          call_to_action_type: string | null
          created_at: string
          degrees_of_freedom_spec: Json | null
          description: string | null
          effective_object_story_id: string | null
          external_created_at: string | null
          external_creative_id: string
          external_video_id: string | null
          headline: string | null
          id: string
          image_hash: string | null
          last_synced_at: string | null
          link_url: string | null
          name: string | null
          object_story_id: string | null
          object_story_spec: Json | null
          object_type: string | null
          organization_id: string
          primary_text: string | null
          raw_data: Json | null
          thumbnail_url: string | null
          updated_at: string
          url_tags: string | null
        }
        Insert: {
          ad_account_id: string
          asset_feed_spec?: Json | null
          call_to_action_type?: string | null
          created_at?: string
          degrees_of_freedom_spec?: Json | null
          description?: string | null
          effective_object_story_id?: string | null
          external_created_at?: string | null
          external_creative_id: string
          external_video_id?: string | null
          headline?: string | null
          id?: string
          image_hash?: string | null
          last_synced_at?: string | null
          link_url?: string | null
          name?: string | null
          object_story_id?: string | null
          object_story_spec?: Json | null
          object_type?: string | null
          organization_id: string
          primary_text?: string | null
          raw_data?: Json | null
          thumbnail_url?: string | null
          updated_at?: string
          url_tags?: string | null
        }
        Update: {
          ad_account_id?: string
          asset_feed_spec?: Json | null
          call_to_action_type?: string | null
          created_at?: string
          degrees_of_freedom_spec?: Json | null
          description?: string | null
          effective_object_story_id?: string | null
          external_created_at?: string | null
          external_creative_id?: string
          external_video_id?: string | null
          headline?: string | null
          id?: string
          image_hash?: string | null
          last_synced_at?: string | null
          link_url?: string | null
          name?: string | null
          object_story_id?: string | null
          object_story_spec?: Json | null
          object_type?: string | null
          organization_id?: string
          primary_text?: string | null
          raw_data?: Json | null
          thumbnail_url?: string | null
          updated_at?: string
          url_tags?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_creatives_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_creatives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_custom_audiences: {
        Row: {
          ad_account_id: string
          approximate_count_lower: number | null
          approximate_count_upper: number | null
          created_at: string
          data_source: Json | null
          delivery_status: Json | null
          description: string | null
          external_audience_id: string
          external_created_at: string | null
          external_updated_at: string | null
          id: string
          is_lookalike: boolean
          last_synced_at: string | null
          lookalike_country: string | null
          lookalike_origin_external_id: string | null
          lookalike_ratio: number | null
          name: string | null
          operation_status: Json | null
          organization_id: string
          retention_days: number | null
          subtype: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          approximate_count_lower?: number | null
          approximate_count_upper?: number | null
          created_at?: string
          data_source?: Json | null
          delivery_status?: Json | null
          description?: string | null
          external_audience_id: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_lookalike?: boolean
          last_synced_at?: string | null
          lookalike_country?: string | null
          lookalike_origin_external_id?: string | null
          lookalike_ratio?: number | null
          name?: string | null
          operation_status?: Json | null
          organization_id: string
          retention_days?: number | null
          subtype?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          approximate_count_lower?: number | null
          approximate_count_upper?: number | null
          created_at?: string
          data_source?: Json | null
          delivery_status?: Json | null
          description?: string | null
          external_audience_id?: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_lookalike?: boolean
          last_synced_at?: string | null
          lookalike_country?: string | null
          lookalike_origin_external_id?: string | null
          lookalike_ratio?: number | null
          name?: string | null
          operation_status?: Json | null
          organization_id?: string
          retention_days?: number | null
          subtype?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_custom_audiences_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_custom_audiences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_insight_action_metrics: {
        Row: {
          action_type: string
          attribution_window: string
          created_at: string
          id: string
          insight_row_id: string
          metric_name: string
          organization_id: string
          raw_value: Json | null
          updated_at: string
          value: number | null
        }
        Insert: {
          action_type?: string
          attribution_window?: string
          created_at?: string
          id?: string
          insight_row_id: string
          metric_name: string
          organization_id: string
          raw_value?: Json | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          action_type?: string
          attribution_window?: string
          created_at?: string
          id?: string
          insight_row_id?: string
          metric_name?: string
          organization_id?: string
          raw_value?: Json | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_insight_action_metrics_insight_row_id_fkey"
            columns: ["insight_row_id"]
            isOneToOne: false
            referencedRelation: "meta_insight_rows_daily"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_insight_action_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_insight_report_runs: {
        Row: {
          ad_account_id: string
          completed_at: string | null
          connection_id: string
          created_at: string
          downloaded_at: string | null
          error_code: string | null
          error_message: string | null
          external_report_run_id: string
          id: string
          level: Database["public"]["Enums"]["meta_insight_level"]
          organization_id: string
          percent_complete: number
          request_params: Json
          requested_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["meta_report_status"]
          sync_run_id: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          completed_at?: string | null
          connection_id: string
          created_at?: string
          downloaded_at?: string | null
          error_code?: string | null
          error_message?: string | null
          external_report_run_id: string
          id?: string
          level: Database["public"]["Enums"]["meta_insight_level"]
          organization_id: string
          percent_complete?: number
          request_params: Json
          requested_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["meta_report_status"]
          sync_run_id?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          downloaded_at?: string | null
          error_code?: string | null
          error_message?: string | null
          external_report_run_id?: string
          id?: string
          level?: Database["public"]["Enums"]["meta_insight_level"]
          organization_id?: string
          percent_complete?: number
          request_params?: Json
          requested_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["meta_report_status"]
          sync_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_insight_report_runs_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_insight_report_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_insight_report_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_insight_report_runs_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "integration_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_insight_rows_daily: {
        Row: {
          action_report_time: string
          ad_account_id: string
          ad_id: string | null
          ad_set_id: string | null
          attribution_hash: string
          attribution_setting: string | null
          attribution_windows: Json | null
          breakdown_hash: string
          breakdowns: Json | null
          campaign_id: string | null
          clicks: number
          conversion_rate_ranking: string | null
          cost_per_inline_link_click: number | null
          cost_per_thruplay: number | null
          cpc: number | null
          cpm: number | null
          cpp: number | null
          created_at: string
          ctr: number | null
          device_platform: string | null
          engagement_rate_ranking: string | null
          estimated_ad_recall_rate: number | null
          estimated_ad_recallers: number | null
          external_entity_id: string
          frequency: number | null
          full_view_impressions: number | null
          full_view_reach: number | null
          id: string
          impressions: number
          inline_link_click_ctr: number | null
          inline_link_clicks: number
          level: Database["public"]["Enums"]["meta_insight_level"]
          metric_date: string
          organization_id: string
          outbound_clicks: number
          outbound_clicks_ctr: number | null
          platform_position: string | null
          publisher_platform: string | null
          quality_ranking: string | null
          raw_data: Json | null
          reach: number
          spend: number
          synced_at: string
          unique_clicks: number
          unique_inline_link_clicks: number | null
          updated_at: string
          video_avg_time_watched_seconds: number | null
          video_p100_watched: number | null
          video_p25_watched: number | null
          video_p50_watched: number | null
          video_p75_watched: number | null
          video_p95_watched: number | null
          video_plays: number | null
          video_thruplays: number | null
        }
        Insert: {
          action_report_time?: string
          ad_account_id: string
          ad_id?: string | null
          ad_set_id?: string | null
          attribution_hash?: string
          attribution_setting?: string | null
          attribution_windows?: Json | null
          breakdown_hash?: string
          breakdowns?: Json | null
          campaign_id?: string | null
          clicks?: number
          conversion_rate_ranking?: string | null
          cost_per_inline_link_click?: number | null
          cost_per_thruplay?: number | null
          cpc?: number | null
          cpm?: number | null
          cpp?: number | null
          created_at?: string
          ctr?: number | null
          device_platform?: string | null
          engagement_rate_ranking?: string | null
          estimated_ad_recall_rate?: number | null
          estimated_ad_recallers?: number | null
          external_entity_id: string
          frequency?: number | null
          full_view_impressions?: number | null
          full_view_reach?: number | null
          id?: string
          impressions?: number
          inline_link_click_ctr?: number | null
          inline_link_clicks?: number
          level: Database["public"]["Enums"]["meta_insight_level"]
          metric_date: string
          organization_id: string
          outbound_clicks?: number
          outbound_clicks_ctr?: number | null
          platform_position?: string | null
          publisher_platform?: string | null
          quality_ranking?: string | null
          raw_data?: Json | null
          reach?: number
          spend?: number
          synced_at?: string
          unique_clicks?: number
          unique_inline_link_clicks?: number | null
          updated_at?: string
          video_avg_time_watched_seconds?: number | null
          video_p100_watched?: number | null
          video_p25_watched?: number | null
          video_p50_watched?: number | null
          video_p75_watched?: number | null
          video_p95_watched?: number | null
          video_plays?: number | null
          video_thruplays?: number | null
        }
        Update: {
          action_report_time?: string
          ad_account_id?: string
          ad_id?: string | null
          ad_set_id?: string | null
          attribution_hash?: string
          attribution_setting?: string | null
          attribution_windows?: Json | null
          breakdown_hash?: string
          breakdowns?: Json | null
          campaign_id?: string | null
          clicks?: number
          conversion_rate_ranking?: string | null
          cost_per_inline_link_click?: number | null
          cost_per_thruplay?: number | null
          cpc?: number | null
          cpm?: number | null
          cpp?: number | null
          created_at?: string
          ctr?: number | null
          device_platform?: string | null
          engagement_rate_ranking?: string | null
          estimated_ad_recall_rate?: number | null
          estimated_ad_recallers?: number | null
          external_entity_id?: string
          frequency?: number | null
          full_view_impressions?: number | null
          full_view_reach?: number | null
          id?: string
          impressions?: number
          inline_link_click_ctr?: number | null
          inline_link_clicks?: number
          level?: Database["public"]["Enums"]["meta_insight_level"]
          metric_date?: string
          organization_id?: string
          outbound_clicks?: number
          outbound_clicks_ctr?: number | null
          platform_position?: string | null
          publisher_platform?: string | null
          quality_ranking?: string | null
          raw_data?: Json | null
          reach?: number
          spend?: number
          synced_at?: string
          unique_clicks?: number
          unique_inline_link_clicks?: number | null
          updated_at?: string
          video_avg_time_watched_seconds?: number | null
          video_p100_watched?: number | null
          video_p25_watched?: number | null
          video_p50_watched?: number | null
          video_p75_watched?: number | null
          video_p95_watched?: number | null
          video_plays?: number | null
          video_thruplays?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_insight_rows_daily_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_insight_rows_daily_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "meta_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_insight_rows_daily_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_insight_rows_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_insight_rows_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pages: {
        Row: {
          business_account_id: string | null
          category: string | null
          connection_id: string
          created_at: string
          external_page_id: string
          id: string
          is_active: boolean
          is_selected: boolean
          last_synced_at: string | null
          name: string
          organization_id: string
          picture_url: string | null
          raw_data: Json | null
          tasks: Json | null
          updated_at: string
        }
        Insert: {
          business_account_id?: string | null
          category?: string | null
          connection_id: string
          created_at?: string
          external_page_id: string
          id?: string
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          name: string
          organization_id: string
          picture_url?: string | null
          raw_data?: Json | null
          tasks?: Json | null
          updated_at?: string
        }
        Update: {
          business_account_id?: string | null
          category?: string | null
          connection_id?: string
          created_at?: string
          external_page_id?: string
          id?: string
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          picture_url?: string | null
          raw_data?: Json | null
          tasks?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "meta_business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pixel_daily_stats: {
        Row: {
          created_at: string
          event_count: number
          event_name: string
          id: string
          metric_date: string
          organization_id: string
          pixel_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_count?: number
          event_name: string
          id?: string
          metric_date: string
          organization_id: string
          pixel_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_count?: number
          event_name?: string
          id?: string
          metric_date?: string
          organization_id?: string
          pixel_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pixel_daily_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pixel_daily_stats_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "meta_pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pixels: {
        Row: {
          ad_account_id: string
          created_at: string
          data_use_setting: string | null
          enable_automatic_matching: boolean | null
          external_created_at: string | null
          external_pixel_id: string
          first_party_cookie_status: string | null
          id: string
          is_unavailable: boolean | null
          last_fired_at: string | null
          last_synced_at: string | null
          name: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          data_use_setting?: string | null
          enable_automatic_matching?: boolean | null
          external_created_at?: string | null
          external_pixel_id: string
          first_party_cookie_status?: string | null
          id?: string
          is_unavailable?: boolean | null
          last_fired_at?: string | null
          last_synced_at?: string | null
          name?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          data_use_setting?: string | null
          enable_automatic_matching?: boolean | null
          external_created_at?: string | null
          external_pixel_id?: string
          first_party_cookie_status?: string | null
          id?: string
          is_unavailable?: boolean | null
          last_fired_at?: string | null
          last_synced_at?: string | null
          name?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pixels_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pixels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_recommendations: {
        Row: {
          ad_account_id: string
          code: number
          confidence: string | null
          created_at: string
          detected_at: string
          entity_external_id: string
          entity_level: string
          id: string
          importance: string | null
          message: string | null
          organization_id: string
          title: string | null
        }
        Insert: {
          ad_account_id: string
          code?: number
          confidence?: string | null
          created_at?: string
          detected_at?: string
          entity_external_id: string
          entity_level: string
          id?: string
          importance?: string | null
          message?: string | null
          organization_id: string
          title?: string | null
        }
        Update: {
          ad_account_id?: string
          code?: number
          confidence?: string | null
          created_at?: string
          detected_at?: string
          entity_external_id?: string
          entity_level?: string
          id?: string
          importance?: string | null
          message?: string | null
          organization_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_recommendations_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_internal_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          milestone_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          milestone_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          milestone_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_internal_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_internal_notes_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "strategic_plan_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_internal_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_task_links: {
        Row: {
          created_at: string
          id: string
          milestone_id: string
          organization_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_id: string
          organization_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          milestone_id?: string
          organization_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_task_links_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "strategic_plan_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_task_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          archived_at: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          organization_id: string | null
          read_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          archived_at?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id?: string | null
          read_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          archived_at?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id?: string | null
          read_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      objective_definitions: {
        Row: {
          archived_at: string | null
          created_at: string
          direction: string
          id: string
          label: string
          metric_key: string | null
          organization_id: string | null
          owner_user_id: string
          slug: string
          source: string
          unit: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          direction?: string
          id?: string
          label: string
          metric_key?: string | null
          organization_id?: string | null
          owner_user_id: string
          slug: string
          source: string
          unit: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          direction?: string
          id?: string
          label?: string
          metric_key?: string | null
          organization_id?: string | null
          owner_user_id?: string
          slug?: string
          source?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objective_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objective_definitions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_alert_rules: {
        Row: {
          condition_override: Json | null
          configured_by: string | null
          created_at: string
          id: string
          is_enabled: boolean
          organization_id: string
          severity_override:
            | Database["public"]["Enums"]["alert_severity"]
            | null
          template_id: string
          updated_at: string
        }
        Insert: {
          condition_override?: Json | null
          configured_by?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id: string
          severity_override?:
            | Database["public"]["Enums"]["alert_severity"]
            | null
          template_id: string
          updated_at?: string
        }
        Update: {
          condition_override?: Json | null
          configured_by?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id?: string
          severity_override?:
            | Database["public"]["Enums"]["alert_severity"]
            | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_alert_rules_configured_by_fkey"
            columns: ["configured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_alert_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_alert_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "alert_rule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_financial_settings: {
        Row: {
          created_at: string
          created_by: string | null
          currency_code: string
          default_shipping_cost: number
          id: string
          notes: string | null
          organization_id: string
          payment_fee_fixed: number
          payment_fee_pct: number
          updated_at: string
          updated_by: string | null
          vat_pct: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          default_shipping_cost?: number
          id?: string
          notes?: string | null
          organization_id: string
          payment_fee_fixed?: number
          payment_fee_pct?: number
          updated_at?: string
          updated_by?: string | null
          vat_pct?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          default_shipping_cost?: number
          id?: string
          notes?: string | null
          organization_id?: string
          payment_fee_fixed?: number
          payment_fee_pct?: number
          updated_at?: string
          updated_by?: string | null
          vat_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_financial_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_financial_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_financial_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_metric_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          manual_actual_at: string | null
          manual_actual_value: number | null
          metric_key: string
          organization_id: string
          period: string
          store_id: string | null
          target_value: number
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          manual_actual_at?: string | null
          manual_actual_value?: number | null
          metric_key: string
          organization_id: string
          period?: string
          store_id?: string | null
          target_value: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          manual_actual_at?: string | null
          manual_actual_value?: number | null
          metric_key?: string
          organization_id?: string
          period?: string
          store_id?: string | null
          target_value?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_metric_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_metric_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_metric_targets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          activated_at: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          deletion_requested_at: string | null
          deletion_requested_by: string | null
          display_name: string
          ecommerce_url: string | null
          id: string
          legal_name: string | null
          onboarding_completed_at: string | null
          scheduled_purge_at: string | null
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          suspended_at: string | null
          tax_id: string | null
          timezone: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          display_name: string
          ecommerce_url?: string | null
          id?: string
          legal_name?: string | null
          onboarding_completed_at?: string | null
          scheduled_purge_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          suspended_at?: string | null
          tax_id?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          display_name?: string
          ecommerce_url?: string | null
          id?: string
          legal_name?: string | null
          onboarding_completed_at?: string | null
          scheduled_purge_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          suspended_at?: string | null
          tax_id?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_deletion_requested_by_fkey"
            columns: ["deletion_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          created_at: string
          created_by: string | null
          currency_code: string
          id: string
          inventory_item_id: string
          is_override: boolean
          organization_id: string
          source: string
          unit_cost: number
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          inventory_item_id: string
          is_override?: boolean
          organization_id: string
          source: string
          unit_cost: number
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          inventory_item_id?: string
          is_override?: boolean
          organization_id?: string
          source?: string
          unit_cost?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "shopify_inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          onboarding_completed_at: string | null
          phone: string | null
          platform_role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          checksum: string
          code: string
          content: string
          created_at: string
          id: string
          version: string
        }
        Insert: {
          checksum: string
          code: string
          content: string
          created_at?: string
          id?: string
          version: string
        }
        Update: {
          checksum?: string
          code?: string
          content?: string
          created_at?: string
          id?: string
          version?: string
        }
        Relationships: []
      }
      service_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          ends_at: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          plan_code: string
          starts_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          store_limit: number | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          plan_code: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          store_limit?: number | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          plan_code?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          store_limit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_cost_rules: {
        Row: {
          cost_per_order: number
          country_code: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          id: string
          is_active: boolean
          max_order_total: number | null
          min_order_total: number
          name: string
          organization_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          cost_per_order: number
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          is_active?: boolean
          max_order_total?: number | null
          min_order_total?: number
          name: string
          organization_id: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          cost_per_order?: number
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          is_active?: boolean
          max_order_total?: number | null
          min_order_total?: number
          name?: string
          organization_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_cost_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_cost_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_abandoned_checkout_items: {
        Row: {
          checkout_id: string
          created_at: string
          external_line_item_id: string
          id: string
          organization_id: string
          product_id: string | null
          quantity: number
          title: string
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          checkout_id: string
          created_at?: string
          external_line_item_id: string
          id?: string
          organization_id: string
          product_id?: string | null
          quantity?: number
          title: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          checkout_id?: string
          created_at?: string
          external_line_item_id?: string
          id?: string
          organization_id?: string
          product_id?: string | null
          quantity?: number
          title?: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_abandoned_checkout_items_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "shopify_abandoned_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_abandoned_checkout_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_abandoned_checkout_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shopify_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_abandoned_checkout_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "shopify_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_abandoned_checkouts: {
        Row: {
          completed_at: string | null
          country_code: string | null
          created_at: string
          currency_code: string | null
          customer_reference_hash: string | null
          external_checkout_id: string
          external_created_at: string | null
          external_updated_at: string | null
          id: string
          organization_id: string
          recovery_url: string | null
          store_id: string
          subtotal_price: number
          total_items: number
          total_price: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          customer_reference_hash?: string | null
          external_checkout_id: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          organization_id: string
          recovery_url?: string | null
          store_id: string
          subtotal_price?: number
          total_items?: number
          total_price?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          customer_reference_hash?: string | null
          external_checkout_id?: string
          external_created_at?: string | null
          external_updated_at?: string | null
          id?: string
          organization_id?: string
          recovery_url?: string | null
          store_id?: string
          subtotal_price?: number
          total_items?: number
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_abandoned_checkouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_abandoned_checkouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_collections: {
        Row: {
          created_at: string
          external_collection_id: string
          external_updated_at: string | null
          handle: string | null
          id: string
          is_automated: boolean
          organization_id: string
          products_count: number
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_collection_id: string
          external_updated_at?: string | null
          handle?: string | null
          id?: string
          is_automated?: boolean
          organization_id: string
          products_count?: number
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_collection_id?: string
          external_updated_at?: string | null
          handle?: string | null
          id?: string
          is_automated?: boolean
          organization_id?: string
          products_count?: number
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_collections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_customers: {
        Row: {
          amount_spent: number
          created_at: string
          currency_code: string | null
          customer_reference_hash: string
          email_marketing_state: string | null
          external_created_at: string | null
          external_customer_id: string
          external_updated_at: string | null
          id: string
          is_active: boolean
          last_order_at: string | null
          locale: string | null
          number_of_orders: number
          organization_id: string
          sms_marketing_state: string | null
          state: string | null
          store_id: string
          tags: string[]
          updated_at: string
          verified_email: boolean | null
        }
        Insert: {
          amount_spent?: number
          created_at?: string
          currency_code?: string | null
          customer_reference_hash: string
          email_marketing_state?: string | null
          external_created_at?: string | null
          external_customer_id: string
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_order_at?: string | null
          locale?: string | null
          number_of_orders?: number
          organization_id: string
          sms_marketing_state?: string | null
          state?: string | null
          store_id: string
          tags?: string[]
          updated_at?: string
          verified_email?: boolean | null
        }
        Update: {
          amount_spent?: number
          created_at?: string
          currency_code?: string | null
          customer_reference_hash?: string
          email_marketing_state?: string | null
          external_created_at?: string | null
          external_customer_id?: string
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_order_at?: string | null
          locale?: string | null
          number_of_orders?: number
          organization_id?: string
          sms_marketing_state?: string | null
          state?: string | null
          store_id?: string
          tags?: string[]
          updated_at?: string
          verified_email?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_discounts: {
        Row: {
          applies_once_per_customer: boolean | null
          code: string | null
          created_at: string
          discount_class: string | null
          ends_at: string | null
          external_created_at: string | null
          external_discount_id: string
          external_updated_at: string | null
          id: string
          organization_id: string
          starts_at: string | null
          status: string | null
          store_id: string
          title: string | null
          updated_at: string
          usage_count: number
          usage_limit: number | null
          value: number | null
          value_type: string | null
        }
        Insert: {
          applies_once_per_customer?: boolean | null
          code?: string | null
          created_at?: string
          discount_class?: string | null
          ends_at?: string | null
          external_created_at?: string | null
          external_discount_id: string
          external_updated_at?: string | null
          id?: string
          organization_id: string
          starts_at?: string | null
          status?: string | null
          store_id: string
          title?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          value?: number | null
          value_type?: string | null
        }
        Update: {
          applies_once_per_customer?: boolean | null
          code?: string | null
          created_at?: string
          discount_class?: string | null
          ends_at?: string | null
          external_created_at?: string | null
          external_discount_id?: string
          external_updated_at?: string | null
          id?: string
          organization_id?: string
          starts_at?: string | null
          status?: string | null
          store_id?: string
          title?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          value?: number | null
          value_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_discounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_discounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_fulfillments: {
        Row: {
          created_at: string
          delivered_at: string | null
          display_status: string | null
          estimated_delivery_at: string | null
          external_created_at: string | null
          external_fulfillment_id: string
          external_updated_at: string | null
          id: string
          in_transit_at: string | null
          location_id: string | null
          order_id: string
          organization_id: string
          status: string | null
          store_id: string
          tracking_company: string | null
          tracking_numbers: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          display_status?: string | null
          estimated_delivery_at?: string | null
          external_created_at?: string | null
          external_fulfillment_id: string
          external_updated_at?: string | null
          id?: string
          in_transit_at?: string | null
          location_id?: string | null
          order_id: string
          organization_id: string
          status?: string | null
          store_id: string
          tracking_company?: string | null
          tracking_numbers?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          display_status?: string | null
          estimated_delivery_at?: string | null
          external_created_at?: string | null
          external_fulfillment_id?: string
          external_updated_at?: string | null
          id?: string
          in_transit_at?: string | null
          location_id?: string | null
          order_id?: string
          organization_id?: string
          status?: string | null
          store_id?: string
          tracking_company?: string | null
          tracking_numbers?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_fulfillments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shopify_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shopify_order_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_fulfillments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_fulfillments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_inventory_current_state: {
        Row: {
          available_quantity: number | null
          committed_quantity: number | null
          external_inventory_level_id: string | null
          id: string
          incoming_quantity: number | null
          inventory_item_id: string
          is_active: boolean
          location_id: string
          on_hand_quantity: number | null
          organization_id: string
          quantities_data: Json | null
          updated_at: string
        }
        Insert: {
          available_quantity?: number | null
          committed_quantity?: number | null
          external_inventory_level_id?: string | null
          id?: string
          incoming_quantity?: number | null
          inventory_item_id: string
          is_active?: boolean
          location_id: string
          on_hand_quantity?: number | null
          organization_id: string
          quantities_data?: Json | null
          updated_at?: string
        }
        Update: {
          available_quantity?: number | null
          committed_quantity?: number | null
          external_inventory_level_id?: string | null
          id?: string
          incoming_quantity?: number | null
          inventory_item_id?: string
          is_active?: boolean
          location_id?: string
          on_hand_quantity?: number | null
          organization_id?: string
          quantities_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_inventory_current_state_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "shopify_inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_inventory_current_state_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shopify_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_inventory_current_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_inventory_items: {
        Row: {
          cost_currency_code: string | null
          country_code_of_origin: string | null
          created_at: string
          current_unit_cost: number | null
          external_created_at: string | null
          external_inventory_item_id: string
          external_updated_at: string | null
          harmonized_system_code: string | null
          id: string
          measurement_data: Json | null
          organization_id: string
          province_code_of_origin: string | null
          requires_shipping: boolean
          sku: string | null
          tracked: boolean
          updated_at: string
          variant_id: string
        }
        Insert: {
          cost_currency_code?: string | null
          country_code_of_origin?: string | null
          created_at?: string
          current_unit_cost?: number | null
          external_created_at?: string | null
          external_inventory_item_id: string
          external_updated_at?: string | null
          harmonized_system_code?: string | null
          id?: string
          measurement_data?: Json | null
          organization_id: string
          province_code_of_origin?: string | null
          requires_shipping?: boolean
          sku?: string | null
          tracked?: boolean
          updated_at?: string
          variant_id: string
        }
        Update: {
          cost_currency_code?: string | null
          country_code_of_origin?: string | null
          created_at?: string
          current_unit_cost?: number | null
          external_created_at?: string | null
          external_inventory_item_id?: string
          external_updated_at?: string | null
          harmonized_system_code?: string | null
          id?: string
          measurement_data?: Json | null
          organization_id?: string
          province_code_of_origin?: string | null
          requires_shipping?: boolean
          sku?: string | null
          tracked?: boolean
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_inventory_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "shopify_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_inventory_level_snapshots: {
        Row: {
          available_quantity: number | null
          captured_at: string
          committed_quantity: number | null
          created_at: string
          external_inventory_level_id: string | null
          id: string
          incoming_quantity: number | null
          inventory_item_id: string
          is_active: boolean
          location_id: string
          on_hand_quantity: number | null
          organization_id: string
          quantities_data: Json | null
        }
        Insert: {
          available_quantity?: number | null
          captured_at: string
          committed_quantity?: number | null
          created_at?: string
          external_inventory_level_id?: string | null
          id?: string
          incoming_quantity?: number | null
          inventory_item_id: string
          is_active?: boolean
          location_id: string
          on_hand_quantity?: number | null
          organization_id: string
          quantities_data?: Json | null
        }
        Update: {
          available_quantity?: number | null
          captured_at?: string
          committed_quantity?: number | null
          created_at?: string
          external_inventory_level_id?: string | null
          id?: string
          incoming_quantity?: number | null
          inventory_item_id?: string
          is_active?: boolean
          location_id?: string
          on_hand_quantity?: number | null
          organization_id?: string
          quantities_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_inventory_level_snapshots_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "shopify_inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_inventory_level_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shopify_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_inventory_level_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_locations: {
        Row: {
          address_data: Json | null
          created_at: string
          external_created_at: string | null
          external_location_id: string
          external_updated_at: string | null
          fulfills_online_orders: boolean | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          address_data?: Json | null
          created_at?: string
          external_created_at?: string | null
          external_location_id: string
          external_updated_at?: string | null
          fulfills_online_orders?: boolean | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          address_data?: Json | null
          created_at?: string
          external_created_at?: string | null
          external_location_id?: string
          external_updated_at?: string | null
          fulfills_online_orders?: boolean | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_locations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_marketing_events: {
        Row: {
          app_handle: string | null
          channel_handle: string | null
          created_at: string
          description: string | null
          ended_at: string | null
          event_type: string | null
          external_created_at: string | null
          external_event_id: string
          id: string
          organization_id: string
          started_at: string | null
          store_id: string
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          app_handle?: string | null
          channel_handle?: string | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          event_type?: string | null
          external_created_at?: string | null
          external_event_id: string
          id?: string
          organization_id: string
          started_at?: string | null
          store_id: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          app_handle?: string | null
          channel_handle?: string | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          event_type?: string | null
          external_created_at?: string | null
          external_event_id?: string
          id?: string
          organization_id?: string
          started_at?: string | null
          store_id?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_marketing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_marketing_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_order_discount_applications: {
        Row: {
          allocation_method: string | null
          amount: number
          code: string | null
          created_at: string
          discount_id: string | null
          id: string
          order_id: string
          organization_id: string
          position: number
          target_type: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          allocation_method?: string | null
          amount?: number
          code?: string | null
          created_at?: string
          discount_id?: string | null
          id?: string
          order_id: string
          organization_id: string
          position?: number
          target_type?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          allocation_method?: string | null
          amount?: number
          code?: string | null
          created_at?: string
          discount_id?: string | null
          id?: string
          order_id?: string
          organization_id?: string
          position?: number
          target_type?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_order_discount_applications_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "shopify_discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_order_discount_applications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shopify_order_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_order_discount_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_order_facts: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          currency_code: string | null
          current_shipping_price: number
          current_subtotal_price: number
          current_total_price: number
          current_total_tax: number
          customer_order_index: number | null
          customer_reference_hash: string | null
          days_to_conversion: number | null
          discounts: number
          external_created_at: string | null
          external_order_id: string
          external_updated_at: string | null
          financial_status: string | null
          first_visit_at: string | null
          first_visit_landing_page: string | null
          first_visit_referrer_url: string | null
          first_visit_source: string | null
          first_visit_source_type: string | null
          first_visit_utm_campaign: string | null
          first_visit_utm_medium: string | null
          first_visit_utm_source: string | null
          fulfillment_status: string | null
          gross_sales: number
          id: string
          is_first_customer_order: boolean | null
          is_test_order: boolean
          last_visit_source: string | null
          last_visit_source_type: string | null
          net_sales: number
          order_name: string | null
          organization_id: string
          payment_gateway_names: string[]
          presentment_currency_code: string | null
          processed_at: string | null
          refunds: number
          return_status: string | null
          risk_level: string | null
          source_name: string | null
          store_id: string
          tags: string[]
          total_items: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency_code?: string | null
          current_shipping_price?: number
          current_subtotal_price?: number
          current_total_price?: number
          current_total_tax?: number
          customer_order_index?: number | null
          customer_reference_hash?: string | null
          days_to_conversion?: number | null
          discounts?: number
          external_created_at?: string | null
          external_order_id: string
          external_updated_at?: string | null
          financial_status?: string | null
          first_visit_at?: string | null
          first_visit_landing_page?: string | null
          first_visit_referrer_url?: string | null
          first_visit_source?: string | null
          first_visit_source_type?: string | null
          first_visit_utm_campaign?: string | null
          first_visit_utm_medium?: string | null
          first_visit_utm_source?: string | null
          fulfillment_status?: string | null
          gross_sales?: number
          id?: string
          is_first_customer_order?: boolean | null
          is_test_order?: boolean
          last_visit_source?: string | null
          last_visit_source_type?: string | null
          net_sales?: number
          order_name?: string | null
          organization_id: string
          payment_gateway_names?: string[]
          presentment_currency_code?: string | null
          processed_at?: string | null
          refunds?: number
          return_status?: string | null
          risk_level?: string | null
          source_name?: string | null
          store_id: string
          tags?: string[]
          total_items?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency_code?: string | null
          current_shipping_price?: number
          current_subtotal_price?: number
          current_total_price?: number
          current_total_tax?: number
          customer_order_index?: number | null
          customer_reference_hash?: string | null
          days_to_conversion?: number | null
          discounts?: number
          external_created_at?: string | null
          external_order_id?: string
          external_updated_at?: string | null
          financial_status?: string | null
          first_visit_at?: string | null
          first_visit_landing_page?: string | null
          first_visit_referrer_url?: string | null
          first_visit_source?: string | null
          first_visit_source_type?: string | null
          first_visit_utm_campaign?: string | null
          first_visit_utm_medium?: string | null
          first_visit_utm_source?: string | null
          fulfillment_status?: string | null
          gross_sales?: number
          id?: string
          is_first_customer_order?: boolean | null
          is_test_order?: boolean
          last_visit_source?: string | null
          last_visit_source_type?: string | null
          net_sales?: number
          order_name?: string | null
          organization_id?: string
          payment_gateway_names?: string[]
          presentment_currency_code?: string | null
          processed_at?: string | null
          refunds?: number
          return_status?: string | null
          risk_level?: string | null
          source_name?: string | null
          store_id?: string
          tags?: string[]
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_order_facts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_order_facts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_order_items: {
        Row: {
          created_at: string
          current_line_total: number
          discount_total: number
          external_line_item_id: string
          id: string
          order_id: string
          organization_id: string
          original_line_total: number
          product_id: string | null
          quantity_current: number
          quantity_original: number
          refunded_amount: number
          refunded_quantity: number
          sku_snapshot: string | null
          title: string
          unit_price: number
          updated_at: string
          variant_id: string | null
          vendor_snapshot: string | null
        }
        Insert: {
          created_at?: string
          current_line_total?: number
          discount_total?: number
          external_line_item_id: string
          id?: string
          order_id: string
          organization_id: string
          original_line_total?: number
          product_id?: string | null
          quantity_current?: number
          quantity_original?: number
          refunded_amount?: number
          refunded_quantity?: number
          sku_snapshot?: string | null
          title: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
          vendor_snapshot?: string | null
        }
        Update: {
          created_at?: string
          current_line_total?: number
          discount_total?: number
          external_line_item_id?: string
          id?: string
          order_id?: string
          organization_id?: string
          original_line_total?: number
          product_id?: string | null
          quantity_current?: number
          quantity_original?: number
          refunded_amount?: number
          refunded_quantity?: number
          sku_snapshot?: string | null
          title?: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
          vendor_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shopify_order_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shopify_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "shopify_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_order_transactions: {
        Row: {
          amount: number
          created_at: string
          currency_code: string | null
          external_created_at: string | null
          external_transaction_id: string
          fee_amount: number | null
          gateway: string | null
          id: string
          kind: string | null
          net_amount: number | null
          order_id: string
          organization_id: string
          payment_method: string | null
          processed_at: string | null
          status: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency_code?: string | null
          external_created_at?: string | null
          external_transaction_id: string
          fee_amount?: number | null
          gateway?: string | null
          id?: string
          kind?: string | null
          net_amount?: number | null
          order_id: string
          organization_id: string
          payment_method?: string | null
          processed_at?: string | null
          status?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: string | null
          external_created_at?: string | null
          external_transaction_id?: string
          fee_amount?: number | null
          gateway?: string | null
          id?: string
          kind?: string | null
          net_amount?: number | null
          order_id?: string
          organization_id?: string
          payment_method?: string | null
          processed_at?: string | null
          status?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_order_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shopify_order_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_order_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_order_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_product_collections: {
        Row: {
          collection_id: string
          created_at: string
          organization_id: string
          product_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          organization_id: string
          product_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          organization_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "shopify_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_product_collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shopify_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_products: {
        Row: {
          created_at: string
          external_created_at: string | null
          external_product_id: string
          external_updated_at: string | null
          handle: string | null
          id: string
          organization_id: string
          product_type: string | null
          published_at: string | null
          status: string | null
          store_id: string
          title: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          external_created_at?: string | null
          external_product_id: string
          external_updated_at?: string | null
          handle?: string | null
          id?: string
          organization_id: string
          product_type?: string | null
          published_at?: string | null
          status?: string | null
          store_id: string
          title: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          external_created_at?: string | null
          external_product_id?: string
          external_updated_at?: string | null
          handle?: string | null
          id?: string
          organization_id?: string
          product_type?: string | null
          published_at?: string | null
          status?: string | null
          store_id?: string
          title?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_refund_items: {
        Row: {
          created_at: string
          external_refund_line_item_id: string | null
          id: string
          location_id: string | null
          order_item_id: string
          organization_id: string
          quantity: number
          refund_id: string
          restock_type: string | null
          subtotal: number
          total_tax: number
        }
        Insert: {
          created_at?: string
          external_refund_line_item_id?: string | null
          id?: string
          location_id?: string | null
          order_item_id: string
          organization_id: string
          quantity: number
          refund_id: string
          restock_type?: string | null
          subtotal?: number
          total_tax?: number
        }
        Update: {
          created_at?: string
          external_refund_line_item_id?: string | null
          id?: string
          location_id?: string | null
          order_item_id?: string
          organization_id?: string
          quantity?: number
          refund_id?: string
          restock_type?: string | null
          subtotal?: number
          total_tax?: number
        }
        Relationships: [
          {
            foreignKeyName: "shopify_refund_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shopify_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_refund_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "shopify_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_refund_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_refund_items_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "shopify_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_refunds: {
        Row: {
          created_at: string
          currency_code: string | null
          external_created_at: string
          external_refund_id: string
          id: string
          order_id: string
          organization_id: string
          total_refunded: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string | null
          external_created_at: string
          external_refund_id: string
          id?: string
          order_id: string
          organization_id: string
          total_refunded?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string | null
          external_created_at?: string
          external_refund_id?: string
          id?: string
          order_id?: string
          organization_id?: string
          total_refunded?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shopify_order_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_refunds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_return_line_items: {
        Row: {
          created_at: string
          external_return_line_item_id: string
          id: string
          order_item_id: string | null
          organization_id: string
          quantity: number
          return_id: string
          return_reason: string | null
          return_reason_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_return_line_item_id: string
          id?: string
          order_item_id?: string | null
          organization_id: string
          quantity?: number
          return_id: string
          return_reason?: string | null
          return_reason_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_return_line_item_id?: string
          id?: string
          order_item_id?: string | null
          organization_id?: string
          quantity?: number
          return_id?: string
          return_reason?: string | null
          return_reason_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_return_line_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "shopify_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_return_line_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_return_line_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "shopify_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_returns: {
        Row: {
          closed_at: string | null
          created_at: string
          external_created_at: string | null
          external_return_id: string
          id: string
          order_id: string
          organization_id: string
          status: string | null
          store_id: string
          total_quantity: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          external_created_at?: string | null
          external_return_id: string
          id?: string
          order_id: string
          organization_id: string
          status?: string | null
          store_id: string
          total_quantity?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          external_created_at?: string | null
          external_return_id?: string
          id?: string
          order_id?: string
          organization_id?: string
          status?: string | null
          store_id?: string
          total_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shopify_order_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_returns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_sessions_daily: {
        Row: {
          bucket_date: string
          conversion_rate: number | null
          created_at: string
          id: string
          online_store_visitors: number
          organization_id: string
          raw: Json | null
          sessions: number
          store_id: string
          updated_at: string
        }
        Insert: {
          bucket_date: string
          conversion_rate?: number | null
          created_at?: string
          id?: string
          online_store_visitors?: number
          organization_id: string
          raw?: Json | null
          sessions?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          bucket_date?: string
          conversion_rate?: number | null
          created_at?: string
          id?: string
          online_store_visitors?: number
          organization_id?: string
          raw?: Json | null
          sessions?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_sessions_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sessions_daily_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopify_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_stores: {
        Row: {
          connection_id: string
          created_at: string
          currency_code: string | null
          external_created_at: string | null
          external_shop_id: string
          external_updated_at: string | null
          id: string
          is_active: boolean
          myshopify_domain: string
          organization_id: string
          plan_display_name: string | null
          primary_domain: string | null
          shop_name: string
          taxes_included: boolean | null
          timezone: string | null
          updated_at: string
          weight_unit: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          currency_code?: string | null
          external_created_at?: string | null
          external_shop_id: string
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          myshopify_domain: string
          organization_id: string
          plan_display_name?: string | null
          primary_domain?: string | null
          shop_name: string
          taxes_included?: boolean | null
          timezone?: string | null
          updated_at?: string
          weight_unit?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          currency_code?: string | null
          external_created_at?: string | null
          external_shop_id?: string
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          myshopify_domain?: string
          organization_id?: string
          plan_display_name?: string | null
          primary_domain?: string | null
          shop_name?: string
          taxes_included?: boolean | null
          timezone?: string | null
          updated_at?: string
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_stores_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_variants: {
        Row: {
          barcode: string | null
          compare_at_price: number | null
          created_at: string
          current_price: number | null
          external_created_at: string | null
          external_updated_at: string | null
          external_variant_id: string
          id: string
          inventory_policy: string | null
          is_active: boolean
          organization_id: string
          position: number | null
          product_id: string
          taxable: boolean | null
          title: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          compare_at_price?: number | null
          created_at?: string
          current_price?: number | null
          external_created_at?: string | null
          external_updated_at?: string | null
          external_variant_id: string
          id?: string
          inventory_policy?: string | null
          is_active?: boolean
          organization_id: string
          position?: number | null
          product_id: string
          taxable?: boolean | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          compare_at_price?: number | null
          created_at?: string
          current_price?: number | null
          external_created_at?: string | null
          external_updated_at?: string | null
          external_variant_id?: string
          id?: string
          inventory_policy?: string | null
          is_active?: boolean
          organization_id?: string
          position?: number | null
          product_id?: string
          taxable?: boolean | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shopify_products"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_plan_milestones: {
        Row: {
          activated_at: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          phase_id: string
          position: number
          status: Database["public"]["Enums"]["milestone_status"]
          target_date: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          phase_id: string
          position: number
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          phase_id?: string
          position?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_plan_milestones_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plan_milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plan_milestones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plan_milestones_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "strategic_plan_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_plan_phases: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          plan_id: string
          position: number
          status: Database["public"]["Enums"]["plan_phase_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          plan_id: string
          position: number
          status?: Database["public"]["Enums"]["plan_phase_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          plan_id?: string
          position?: number
          status?: Database["public"]["Enums"]["plan_phase_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_plan_phases_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plan_phases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plan_phases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plan_phases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_on: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          starts_on: string | null
          status: Database["public"]["Enums"]["plan_status"]
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_on?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_on?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategic_plans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          organization_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["task_status"]
          organization_id: string
          previous_status: Database["public"]["Enums"]["task_status"] | null
          reason: string | null
          task_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["task_status"]
          organization_id: string
          previous_status?: Database["public"]["Enums"]["task_status"] | null
          reason?: string | null
          task_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["task_status"]
          organization_id?: string
          previous_status?: Database["public"]["Enums"]["task_status"] | null
          reason?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          alert_id: string | null
          assigned_to: string | null
          categories: string[]
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          ignored_at: string | null
          ignored_reason: string | null
          is_visible_to_client: boolean
          metadata: Json | null
          organization_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          source: Database["public"]["Enums"]["task_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          alert_id?: string | null
          assigned_to?: string | null
          categories?: string[]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          ignored_at?: string | null
          ignored_reason?: string | null
          is_visible_to_client?: boolean
          metadata?: Json | null
          organization_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          source: Database["public"]["Enums"]["task_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          alert_id?: string | null
          assigned_to?: string | null
          categories?: string[]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          ignored_at?: string | null
          ignored_reason?: string | null
          is_visible_to_client?: boolean
          metadata?: Json | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          source?: Database["public"]["Enums"]["task_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      shopify_inventory_current_levels: {
        Row: {
          available_quantity: number | null
          captured_at: string | null
          committed_quantity: number | null
          external_inventory_level_id: string | null
          id: string | null
          incoming_quantity: number | null
          inventory_item_id: string | null
          is_active: boolean | null
          location_id: string | null
          on_hand_quantity: number | null
          organization_id: string | null
          quantities_data: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_inventory_level_snapshots_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "shopify_inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_inventory_level_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shopify_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_inventory_level_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_agent_runtime_stats: {
        Args: { since: string }
        Returns: {
          agent_code: string
          agent_name: string
          avg_latency_ms: number
          failed_count: number
          p95_latency_ms: number
          run_count: number
          running_count: number
          total_cost_usd: number
        }[]
      }
      admin_consultant_ai_stats: {
        Args: { since: string }
        Returns: {
          client_count: number
          consultant_user_id: string
          run_count: number
          top_agents: Json
          total_cost_usd: number
        }[]
      }
      admin_organization_ai_stats: {
        Args: { since: string }
        Returns: {
          organization_id: string
          run_count: number
          top_agents: Json
          total_cost_usd: number
        }[]
      }
      agent_sql_gateway: {
        Args: {
          max_rows?: number
          query_sql: string
          target_organization_id: string
        }
        Returns: Json
      }
      billable_store_count: {
        Args: { target_organization_id: string }
        Returns: number
      }
      consultant_business_rollup: {
        Args: { org_ids: string[]; period_end: string; period_start: string }
        Returns: {
          meta_purchase_value: number
          meta_spend: number
          net_sales: number
          orders_count: number
          roas: number
        }[]
      }
      consultant_klaviyo_by_org: {
        Args: { org_ids: string[]; period_end: string; period_start: string }
        Returns: {
          campaigns_sent: number
          clicks_unique: number
          last_send_at: string
          opens_unique: number
          organization_id: string
          recipients: number
          revenue: number
        }[]
      }
      consultant_klaviyo_signals: {
        Args: { lookback_days?: number; target_organization_ids: string[] }
        Returns: {
          campaigns_in_window: number
          connection_status: string
          emails_sin_cuerpo: number
          emails_sin_utm: number
          emails_total: number
          flows_active: number
          last_send_at: string
          last_sync_at: string
          lists: number
          organization_id: string
          segments: number
          sync_incomplete: boolean
        }[]
      }
      consultant_meta_by_org: {
        Args: { org_ids: string[]; period_end: string; period_start: string }
        Returns: {
          cac: number
          clicks: number
          days_with_data: number
          impressions: number
          organization_id: string
          purchase_value: number
          purchases: number
          roas: number
          spend: number
        }[]
      }
      consultant_meta_signals: {
        Args: { lookback_days?: number; target_organization_ids: string[] }
        Returns: {
          ad_accounts: number
          ad_sets_learning: number
          ads_with_issues: number
          connection_status: string
          days_with_spend: number
          last_sync_at: string
          organization_id: string
          pixels: number
          pixels_silent: number
          recent_changes: number
          spend: number
          spend_below_average: number
          spend_with_verdict: number
        }[]
      }
      consultant_orders_by_org: {
        Args: { org_ids: string[]; period_end: string; period_start: string }
        Returns: {
          net_sales: number
          orders_count: number
          organization_id: string
        }[]
      }
      consultant_orders_by_store: {
        Args: { org_ids: string[]; period_end: string; period_start: string }
        Returns: {
          currency_code: string
          myshopify_domain: string
          net_sales: number
          orders_count: number
          organization_id: string
          shop_name: string
          store_id: string
          units_sold: number
        }[]
      }
      consultant_orders_daily_by_org: {
        Args: { org_ids: string[]; period_end: string; period_start: string }
        Returns: {
          bucket_date: string
          orders_count: number
          organization_id: string
        }[]
      }
      consultant_store_signals: {
        Args: { agent_codes: string[]; target_organization_ids: string[] }
        Returns: {
          agent_code: string
          organization_id: string
          output: Json
          ran_at: string
        }[]
      }
      klaviyo_email_inventory: {
        Args: { target_organization_id: string; target_store_id?: string }
        Returns: {
          adds_utm: boolean
          body_chars: number
          custom_utm_params: number
          external_message_id: string
          external_template_id: string
          message_id: string
          parent_id: string
          parent_name: string
          parent_status: string
          position_in_parent: number
          preview_text: string
          send_time: string
          source: string
          subject: string
          template_name: string
          tracks_clicks: boolean
          tracks_opens: boolean
          trigger_type: string
        }[]
      }
      klaviyo_email_report: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          bounced: number
          bucket_month: string
          clicks_unique: number
          conversions: number
          delivered: number
          entity_id: string
          entity_name: string
          entity_type: string
          opens_unique: number
          recipients: number
          revenue: number
          send_time: string
          spam_complaints: number
          subject: string
          trigger_type: string
          unsubscribes: number
        }[]
      }
      klaviyo_link_clicks: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          clicks: number
          mensajes: number
          personas: number
          primer_click: string
          ultimo_click: string
          url: string
        }[]
      }
      klaviyo_measurement_health: {
        Args: { target_organization_id: string; target_store_id?: string }
        Returns: {
          campanas_enviadas: number
          emails_sin_asunto: number
          emails_sin_cuerpo: number
          emails_sin_seguimiento_clics: number
          emails_sin_utm: number
          emails_total: number
          flujos_activos: number
          listas: number
          metrica_conversion: string
          recursos_no_traidos: string
          segmentos: number
          ultimo_sync: string
          ultimo_sync_estado: string
        }[]
      }
      klaviyo_subject_performance: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          bucket_month: string
          click_rate: number
          click_to_open_rate: number
          clicks_unique: number
          delivered: number
          entity_name: string
          entity_type: string
          has_emoji: boolean
          has_number: boolean
          has_personalization: boolean
          is_question: boolean
          open_rate: number
          opens_unique: number
          revenue: number
          revenue_per_delivered: number
          subject: string
          subject_chars: number
          subject_words: number
          unsubscribe_rate: number
        }[]
      }
      klaviyo_tracking_summary: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
        }
        Returns: {
          event_count: number
          event_name: string
          first_event_at: string
          last_event_at: string
          profiles: number
          revenue: number
        }[]
      }
      knowledge_search: {
        Args: {
          audience_allowed: string[]
          match_count?: number
          query_embedding: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          audience: string
          authority: string
          chunk_id: string
          chunk_index: number
          content: string
          document_id: string
          document_title: string
          similarity: number
          visibility: string
        }[]
      }
      knowledge_search_hybrid: {
        Args: {
          audience_allowed: string[]
          match_count?: number
          query_embedding: string
          query_text: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          audience: string
          authority: string
          chunk_id: string
          chunk_index: number
          content: string
          document_id: string
          document_title: string
          lexical_score: number
          semantic_similarity: number
          similarity: number
          visibility: string
        }[]
      }
      meta_attribution_window_rank: {
        Args: { window_name: string }
        Returns: number
      }
      meta_audience_overview: {
        Args: { target_organization_id: string; target_store_id?: string }
        Returns: {
          ad_sets_using: number
          approximate_count_lower: number
          approximate_count_upper: number
          audience_id: string
          audience_name: string
          delivery_status_code: number
          delivery_status_description: string
          external_updated_at: string
          is_lookalike: boolean
          lookalike_country: string
          lookalike_ratio: number
          origin_name: string
          retention_days: number
          subtype: string
        }[]
      }
      meta_change_impact: {
        Args: {
          min_spend?: number
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
          window_days?: number
        }
        Returns: {
          actor_name: string
          cpa_after: number
          cpa_before: number
          days_after: number
          days_before: number
          entity_level: string
          event_time: string
          event_type: string
          object_name: string
          purchase_attribution_window: string
          purchase_value_after: number
          purchase_value_before: number
          purchases_after: number
          purchases_before: number
          roas_after: number
          roas_before: number
          roas_delta_pct: number
          spend_after: number
          spend_before: number
          translated_event_type: string
        }[]
      }
      meta_creative_performance: {
        Args: {
          min_impressions?: number
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          ad_id: string
          ad_name: string
          ad_set_name: string
          campaign_name: string
          conversion_rate_ranking: string
          cost_per_purchase: number
          days_with_data: number
          effective_status: string
          engagement_rate_ranking: string
          enough_volume: boolean
          has_video: boolean
          hold_rate: number
          hook_rate: number
          impressions: number
          outbound_clicks: number
          outbound_ctr: number
          purchase_attribution_window: string
          purchase_value: number
          purchases: number
          quality_ranking: string
          roas: number
          spend: number
          thruplay_rate: number
          video_plays: number
        }[]
      }
      meta_creative_ranking_distribution: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          ads: number
          dimension: string
          ranking_value: string
          spend: number
          spend_share: number
        }[]
      }
      meta_learning_phase_status: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          ad_set_id: string
          ad_set_name: string
          campaign_name: string
          conversions_missing: number
          daily_budget: number
          days_since_change: number
          effective_status: string
          last_significant_change: string
          learning_conversions: number
          learning_conversions_needed: number
          learning_stage_status: string
          optimization_goal: string
          spend_in_period: number
        }[]
      }
      meta_pixel_health: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          avg_daily_events: number
          days_in_period: number
          days_missing: number
          days_with_events: number
          event_name: string
          events_total: number
          external_pixel_id: string
          hours_since_last_fire: number
          is_unavailable: boolean
          last_event_date: string
          last_fired_at: string
          pixel_id: string
          pixel_name: string
        }[]
      }
      meta_spend_by_campaign: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          campaign_id: string
          campaign_name: string
          clicks: number
          days_with_data: number
          impressions: number
          purchase_action_type: string
          purchase_value: number
          purchases: number
          roas: number
          spend: number
        }[]
      }
      meta_spend_daily: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          bucket_date: string
          spend: number
        }[]
      }
      meta_spend_summary: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id?: string
        }
        Returns: {
          cac: number
          clicks: number
          days_with_data: number
          impressions: number
          purchase_action_types: string[]
          purchase_value: number
          purchases: number
          roas: number
          spend: number
        }[]
      }
      organization_activity_digest: {
        Args: { target_organization_id: string }
        Returns: string
      }
      reorder_strategic_milestones: {
        Args: { p_ordered_ids: string[]; p_phase_id: string }
        Returns: undefined
      }
      reorder_strategic_phases: {
        Args: { p_ordered_ids: string[]; p_plan_id: string }
        Returns: undefined
      }
      shopify_attribution_by_channel: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          avg_days_to_conversion: number
          new_customers: number
          orders: number
          revenue: number
          source: string
          source_type: string
          utm_campaign: string
        }[]
      }
      shopify_checkout_recovery: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          avg_checkout_value: number
          avg_hours_to_recover: number
          checkouts: number
          lost_value: number
          recovered: number
          recovered_value: number
          recovery_rate: number
        }[]
      }
      shopify_cohorts: {
        Args: {
          months_back?: number
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          cohort_customers: number
          cohort_month: string
          customers: number
          month_offset: number
          orders: number
          revenue: number
        }[]
      }
      shopify_customer_recurrence: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          new_orders: number
          new_revenue: number
          repeat_order_rate: number
          returning_orders: number
          returning_revenue: number
          unknown_orders: number
        }[]
      }
      shopify_customer_value: {
        Args: { target_organization_id: string; target_store_id: string }
        Returns: {
          avg_orders_per_customer: number
          avg_revenue_per_customer: number
          customers: number
          guest_orders: number
          median_revenue_per_customer: number
          orders_with_customer: number
          p90_revenue_per_customer: number
        }[]
      }
      shopify_delivery_times: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          avg_days_to_deliver: number
          avg_delay_days: number
          avg_hours_to_ship: number
          delivered: number
          fulfillments: number
          in_transit: number
          late_deliveries: number
          with_estimate: number
        }[]
      }
      shopify_discount_cost_by_code: {
        Args: {
          period_end: string
          period_start: string
          result_limit?: number
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          code: string
          discount_share: number
          new_customers: number
          order_discount_total: number
          order_revenue: number
          orders: number
          orders_with_multiple_codes: number
        }[]
      }
      shopify_financial_summary: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          break_even_monthly_revenue: number
          cogs: number
          fixed_costs: number
          fixed_expenses_count: number
          gross_margin: number
          has_settings: boolean
          items_without_cost: number
          monthly_fixed_costs: number
          net_margin_pct: number
          net_profit: number
          net_sales: number
          orders_count: number
          payment_fees: number
          shipping_costs: number
        }[]
      }
      shopify_funnel_daily: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          bucket_date: string
          sessions: number
        }[]
      }
      shopify_funnel_summary: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          conversion_rate_shopify: number
          days_with_sessions: number
          online_store_visitors: number
          sessions: number
        }[]
      }
      shopify_margin_summary:
        | {
            Args: {
              period_end: string
              period_start: string
              target_organization_id: string
            }
            Returns: {
              cogs: number
              gross_margin: number
              items_with_cost: number
              items_without_cost: number
              margin_pct: number
              revenue: number
            }[]
          }
        | {
            Args: {
              period_end: string
              period_start: string
              target_organization_id: string
              target_store_id: string
            }
            Returns: {
              cogs: number
              gross_margin: number
              items_with_cost: number
              items_without_cost: number
              margin_pct: number
              revenue: number
            }[]
          }
      shopify_return_rate_by_product: {
        Args: {
          period_end: string
          period_start: string
          result_limit?: number
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          product_id: string
          refunded_amount: number
          return_rate: number
          revenue: number
          title: string
          top_return_reason: string
          units_returned: number
          units_sold: number
        }[]
      }
      shopify_sales_daily: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          bucket_date: string
          net_sales: number
          orders_count: number
        }[]
      }
      shopify_sales_summary:
        | {
            Args: {
              period_end: string
              period_start: string
              target_organization_id: string
            }
            Returns: {
              aov: number
              discounts: number
              gross_sales: number
              net_sales: number
              orders_count: number
              refunds: number
              units_sold: number
            }[]
          }
        | {
            Args: {
              period_end: string
              period_start: string
              target_organization_id: string
              target_store_id: string
            }
            Returns: {
              aov: number
              discounts: number
              gross_sales: number
              net_sales: number
              orders_count: number
              refunds: number
              units_sold: number
            }[]
          }
      shopify_stock_risk_products: {
        Args: {
          period_end: string
          period_start: string
          target_organization_id: string
          target_store_id: string
        }
        Returns: {
          available_quantity: number
          product_id: string
          quantity_sold_30d: number
          title: string
        }[]
      }
      shopify_stock_summary:
        | {
            Args: {
              low_stock_threshold?: number
              target_organization_id: string
            }
            Returns: {
              low_stock_items: number
              out_of_stock_items: number
              total_available: number
              tracked_items: number
            }[]
          }
        | {
            Args: {
              low_stock_threshold: number
              target_organization_id: string
              target_store_id: string
            }
            Returns: {
              low_stock_items: number
              out_of_stock_items: number
              total_available: number
              tracked_items: number
            }[]
          }
      shopify_top_products:
        | {
            Args: {
              period_end: string
              period_start: string
              result_limit?: number
              target_organization_id: string
            }
            Returns: {
              product_id: string
              quantity_sold: number
              revenue: number
              title: string
            }[]
          }
        | {
            Args: {
              period_end: string
              period_start: string
              result_limit: number
              target_organization_id: string
              target_store_id: string
            }
            Returns: {
              product_id: string
              quantity_sold: number
              revenue: number
              title: string
            }[]
          }
    }
    Enums: {
      alert_severity: "info" | "low" | "medium" | "high" | "critical"
      alert_status: "open" | "acknowledged" | "resolved" | "dismissed"
      call_status: "scheduled" | "held" | "cancelled"
      call_summary_status:
        | "draft"
        | "pending_approval"
        | "published"
        | "rejected"
      klaviyo_audience_role: "included" | "excluded"
      klaviyo_audience_type: "list" | "segment"
      klaviyo_report_entity_type:
        | "campaign"
        | "campaign_message"
        | "flow"
        | "flow_message"
        | "form"
        | "segment"
      klaviyo_report_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "succeeded"
      klaviyo_report_type:
        | "values"
        | "series"
        | "metric_aggregate"
        | "campaign-values-report"
        | "flow-values-report"
        | "form-values-report"
        | "segment-values-report"
      member_role: "owner" | "manager" | "member" | "readonly"
      meta_creative_asset_type:
        | "image"
        | "video"
        | "primary_text"
        | "headline"
        | "description"
        | "call_to_action"
        | "link_url"
        | "thumbnail"
        | "other"
      meta_insight_level: "account" | "campaign" | "adset" | "ad"
      meta_report_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      milestone_status:
        | "locked"
        | "pending"
        | "in_progress"
        | "completed"
        | "skipped"
      notification_status: "unread" | "read" | "archived"
      organization_status:
        | "onboarding"
        | "active"
        | "suspended"
        | "cancelled"
        | "pending_deletion"
      plan_phase_status: "locked" | "pending" | "active" | "completed"
      plan_status: "draft" | "active" | "completed" | "archived"
      platform_role: "user" | "consultant" | "platform_admin"
      subscription_status:
        | "pending"
        | "trial"
        | "active"
        | "paused"
        | "cancelled"
        | "expired"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_source:
        | "manual"
        | "alert"
        | "consulting_call"
        | "strategic_plan"
        | "ai_consultant"
        | "system"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "ignored"
        | "cancelled"
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
  private: {
    Enums: {},
  },
  public: {
    Enums: {
      alert_severity: ["info", "low", "medium", "high", "critical"],
      alert_status: ["open", "acknowledged", "resolved", "dismissed"],
      call_status: ["scheduled", "held", "cancelled"],
      call_summary_status: [
        "draft",
        "pending_approval",
        "published",
        "rejected",
      ],
      klaviyo_audience_role: ["included", "excluded"],
      klaviyo_audience_type: ["list", "segment"],
      klaviyo_report_entity_type: [
        "campaign",
        "campaign_message",
        "flow",
        "flow_message",
        "form",
        "segment",
      ],
      klaviyo_report_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "succeeded",
      ],
      klaviyo_report_type: [
        "values",
        "series",
        "metric_aggregate",
        "campaign-values-report",
        "flow-values-report",
        "form-values-report",
        "segment-values-report",
      ],
      member_role: ["owner", "manager", "member", "readonly"],
      meta_creative_asset_type: [
        "image",
        "video",
        "primary_text",
        "headline",
        "description",
        "call_to_action",
        "link_url",
        "thumbnail",
        "other",
      ],
      meta_insight_level: ["account", "campaign", "adset", "ad"],
      meta_report_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      milestone_status: [
        "locked",
        "pending",
        "in_progress",
        "completed",
        "skipped",
      ],
      notification_status: ["unread", "read", "archived"],
      organization_status: [
        "onboarding",
        "active",
        "suspended",
        "cancelled",
        "pending_deletion",
      ],
      plan_phase_status: ["locked", "pending", "active", "completed"],
      plan_status: ["draft", "active", "completed", "archived"],
      platform_role: ["user", "consultant", "platform_admin"],
      subscription_status: [
        "pending",
        "trial",
        "active",
        "paused",
        "cancelled",
        "expired",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_source: [
        "manual",
        "alert",
        "consulting_call",
        "strategic_plan",
        "ai_consultant",
        "system",
      ],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "ignored",
        "cancelled",
      ],
    },
  },
} as const

