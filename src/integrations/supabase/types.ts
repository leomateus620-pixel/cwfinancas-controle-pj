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
      accounts_payable_receivable: {
        Row: {
          amount: number
          connection_id: string | null
          content_hash: string
          counterpart: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          last_seen_at: string
          nf_number: string | null
          notes: string | null
          payment_method: string | null
          period_key: string
          raw_data: Json | null
          record_type: string
          source_layout: string | null
          source_row: number | null
          source_tab: string
          status_normalized: string
          status_raw: string | null
          sync_run_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          connection_id?: string | null
          content_hash: string
          counterpart?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          last_seen_at?: string
          nf_number?: string | null
          notes?: string | null
          payment_method?: string | null
          period_key: string
          raw_data?: Json | null
          record_type: string
          source_layout?: string | null
          source_row?: number | null
          source_tab: string
          status_normalized?: string
          status_raw?: string | null
          sync_run_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          connection_id?: string | null
          content_hash?: string
          counterpart?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          last_seen_at?: string
          nf_number?: string | null
          notes?: string | null
          payment_method?: string | null
          period_key?: string
          raw_data?: Json | null
          record_type?: string
          source_layout?: string | null
          source_row?: number | null
          source_tab?: string
          status_normalized?: string
          status_raw?: string | null
          sync_run_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_receivable_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          connected_sheet_id: string | null
          created_at: string
          data_quality: Json
          date_from: string
          date_to: string
          filters: Json | null
          id: string
          insights: Json
          kpis: Json
          model_version: string
          prompt_hash: string | null
          user_id: string
        }
        Insert: {
          connected_sheet_id?: string | null
          created_at?: string
          data_quality: Json
          date_from: string
          date_to: string
          filters?: Json | null
          id?: string
          insights: Json
          kpis: Json
          model_version: string
          prompt_hash?: string | null
          user_id: string
        }
        Update: {
          connected_sheet_id?: string | null
          created_at?: string
          data_quality?: Json
          date_from?: string
          date_to?: string
          filters?: Json | null
          id?: string
          insights?: Json
          kpis?: Json
          model_version?: string
          prompt_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_connected_sheet_id_fkey"
            columns: ["connected_sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sheet_profiles: {
        Row: {
          ai_suggestions: Json | null
          column_mapping: Json
          confidence: number
          connected_sheet_id: string | null
          created_at: string
          header_signature: string
          id: string
          parsing_rules: Json
          skip_patterns: Json | null
          source_tab: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_suggestions?: Json | null
          column_mapping?: Json
          confidence?: number
          connected_sheet_id?: string | null
          created_at?: string
          header_signature: string
          id?: string
          parsing_rules?: Json
          skip_patterns?: Json | null
          source_tab: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_suggestions?: Json | null
          column_mapping?: Json
          confidence?: number
          connected_sheet_id?: string | null
          created_at?: string
          header_signature?: string
          id?: string
          parsing_rules?: Json
          skip_patterns?: Json | null
          source_tab?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sheet_profiles_connected_sheet_id_fkey"
            columns: ["connected_sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      asana_integration_settings: {
        Row: {
          created_at: string
          default_assignee_gid: string | null
          default_section_gid: string | null
          id: string
          is_enabled: boolean
          priority_mapping: Json
          project_gid: string | null
          status_mapping: Json
          updated_at: string
          workspace_gid: string | null
        }
        Insert: {
          created_at?: string
          default_assignee_gid?: string | null
          default_section_gid?: string | null
          id?: string
          is_enabled?: boolean
          priority_mapping?: Json
          project_gid?: string | null
          status_mapping?: Json
          updated_at?: string
          workspace_gid?: string | null
        }
        Update: {
          created_at?: string
          default_assignee_gid?: string | null
          default_section_gid?: string | null
          id?: string
          is_enabled?: boolean
          priority_mapping?: Json
          project_gid?: string | null
          status_mapping?: Json
          updated_at?: string
          workspace_gid?: string | null
        }
        Relationships: []
      }
      asana_sync_logs: {
        Row: {
          action: string
          created_at: string
          demand_id: string | null
          error_message: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          demand_id?: string | null
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          demand_id?: string | null
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Relationships: []
      }
      balance_sheet_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          id?: string
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_balances: {
        Row: {
          bank_name: string
          closing_balance: number | null
          connection_id: string | null
          created_at: string | null
          id: string
          opening_balance: number | null
          period_key: string
          tab_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bank_name: string
          closing_balance?: number | null
          connection_id?: string | null
          created_at?: string | null
          id?: string
          opening_balance?: number | null
          period_key: string
          tab_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bank_name?: string
          closing_balance?: number | null
          connection_id?: string | null
          created_at?: string | null
          id?: string
          opening_balance?: number | null
          period_key?: string
          tab_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_balances_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      company_annual_goals: {
        Row: {
          connection_id: string | null
          created_at: string | null
          id: string
          meta_despesa_anual: number | null
          meta_lucro_anual: number | null
          meta_receita_anual: number | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          connection_id?: string | null
          created_at?: string | null
          id?: string
          meta_despesa_anual?: number | null
          meta_lucro_anual?: number | null
          meta_receita_anual?: number | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          connection_id?: string | null
          created_at?: string | null
          id?: string
          meta_despesa_anual?: number | null
          meta_lucro_anual?: number | null
          meta_receita_anual?: number | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_annual_goals_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          ano_fundacao: number | null
          cidade: string | null
          cnpj: string | null
          cnpj_lookup_at: string | null
          cnpj_lookup_source: string | null
          connection_id: string | null
          created_at: string | null
          estado: string | null
          faturamento_anual: number | null
          id: string
          locally_edited_fields: string[] | null
          meta_despesa_mensal: number | null
          meta_lucro_mensal: number | null
          meta_receita_mensal: number | null
          nome_fantasia: string | null
          num_funcionarios: number | null
          porte: string | null
          razao_social: string | null
          regime_tributario: string | null
          setor: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ano_fundacao?: number | null
          cidade?: string | null
          cnpj?: string | null
          cnpj_lookup_at?: string | null
          cnpj_lookup_source?: string | null
          connection_id?: string | null
          created_at?: string | null
          estado?: string | null
          faturamento_anual?: number | null
          id?: string
          locally_edited_fields?: string[] | null
          meta_despesa_mensal?: number | null
          meta_lucro_mensal?: number | null
          meta_receita_mensal?: number | null
          nome_fantasia?: string | null
          num_funcionarios?: number | null
          porte?: string | null
          razao_social?: string | null
          regime_tributario?: string | null
          setor?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ano_fundacao?: number | null
          cidade?: string | null
          cnpj?: string | null
          cnpj_lookup_at?: string | null
          cnpj_lookup_source?: string | null
          connection_id?: string | null
          created_at?: string | null
          estado?: string | null
          faturamento_anual?: number | null
          id?: string
          locally_edited_fields?: string[] | null
          meta_despesa_mensal?: number | null
          meta_lucro_mensal?: number | null
          meta_receita_mensal?: number | null
          nome_fantasia?: string | null
          num_funcionarios?: number | null
          porte?: string | null
          razao_social?: string | null
          regime_tributario?: string | null
          setor?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_cycles: {
        Row: {
          card_label: string | null
          connection_id: string | null
          created_at: string
          cycle_end_row: number | null
          cycle_start_row: number | null
          detection_confidence: number | null
          due_date: string
          gross_amount: number | null
          id: string
          import_batch_id: string | null
          net_amount: number | null
          period_key: string
          raw_block_hash: string | null
          reimbursement_amount: number | null
          source_sheet_id: string | null
          source_tab: string | null
          status: string
          transaction_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_label?: string | null
          connection_id?: string | null
          created_at?: string
          cycle_end_row?: number | null
          cycle_start_row?: number | null
          detection_confidence?: number | null
          due_date: string
          gross_amount?: number | null
          id?: string
          import_batch_id?: string | null
          net_amount?: number | null
          period_key: string
          raw_block_hash?: string | null
          reimbursement_amount?: number | null
          source_sheet_id?: string | null
          source_tab?: string | null
          status?: string
          transaction_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_label?: string | null
          connection_id?: string | null
          created_at?: string
          cycle_end_row?: number | null
          cycle_start_row?: number | null
          detection_confidence?: number | null
          due_date?: string
          gross_amount?: number | null
          id?: string
          import_batch_id?: string | null
          net_amount?: number | null
          period_key?: string
          raw_block_hash?: string | null
          reimbursement_amount?: number | null
          source_sheet_id?: string | null
          source_tab?: string | null
          status?: string
          transaction_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_cycles_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_cycles_source_sheet_id_fkey"
            columns: ["source_sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_review_queue: {
        Row: {
          confidence: number | null
          created_at: string
          final_decision: string | null
          id: string
          raw_snapshot: Json | null
          reason_flag: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          row_hash: string | null
          source_row_number: number | null
          source_tab: string | null
          suggested_action: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          final_decision?: string | null
          id?: string
          raw_snapshot?: Json | null
          reason_flag?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_hash?: string | null
          source_row_number?: number | null
          source_tab?: string | null
          suggested_action?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          final_decision?: string | null
          id?: string
          raw_snapshot?: Json | null
          reason_flag?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_hash?: string | null
          source_row_number?: number | null
          source_tab?: string | null
          suggested_action?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_review_queue_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_transactions: {
        Row: {
          amount: number
          category_normalized: string | null
          category_original: string | null
          created_at: string
          cycle_id: string | null
          detection_confidence: number | null
          detection_flags: Json | null
          due_date: string | null
          id: string
          is_manually_overridden: boolean | null
          original_description: string | null
          override_reason: string | null
          row_hash: string | null
          source_account: string | null
          source_row_number: number | null
          transaction_id: string | null
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_normalized?: string | null
          category_original?: string | null
          created_at?: string
          cycle_id?: string | null
          detection_confidence?: number | null
          detection_flags?: Json | null
          due_date?: string | null
          id?: string
          is_manually_overridden?: boolean | null
          original_description?: string | null
          override_reason?: string | null
          row_hash?: string | null
          source_account?: string | null
          source_row_number?: number | null
          transaction_id?: string | null
          transaction_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_normalized?: string | null
          category_original?: string | null
          created_at?: string
          cycle_id?: string | null
          detection_confidence?: number | null
          detection_flags?: Json | null
          due_date?: string | null
          id?: string
          is_manually_overridden?: boolean | null
          original_description?: string | null
          override_reason?: string | null
          row_hash?: string | null
          source_account?: string | null
          source_row_number?: number | null
          transaction_id?: string | null
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_transactions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "credit_card_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_lines: {
        Row: {
          created_at: string | null
          group_label: string | null
          id: string
          is_group: boolean | null
          is_subtotal: boolean | null
          line_label: string
          nucleo: string | null
          order_index: number
          period_id: string
          section: string | null
          source_cell: string | null
          source_tab: string | null
          updated_at: string | null
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string | null
          group_label?: string | null
          id?: string
          is_group?: boolean | null
          is_subtotal?: boolean | null
          line_label: string
          nucleo?: string | null
          order_index: number
          period_id: string
          section?: string | null
          source_cell?: string | null
          source_tab?: string | null
          updated_at?: string | null
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string | null
          group_label?: string | null
          id?: string
          is_group?: boolean | null
          is_subtotal?: boolean | null
          line_label?: string
          nucleo?: string | null
          order_index?: number
          period_id?: string
          section?: string | null
          source_cell?: string | null
          source_tab?: string | null
          updated_at?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "dre_lines_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "dre_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_mappings: {
        Row: {
          confidence: number
          created_at: string
          format_detected: string | null
          header_signature: string | null
          id: string
          mapping: Json
          sheet_id: string | null
          tab_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          format_detected?: string | null
          header_signature?: string | null
          id?: string
          mapping?: Json
          sheet_id?: string | null
          tab_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          format_detected?: string | null
          header_signature?: string | null
          id?: string
          mapping?: Json
          sheet_id?: string | null
          tab_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_mappings_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_periods: {
        Row: {
          col_index: number | null
          created_at: string | null
          id: string
          last_import_at: string | null
          period_key: string
          period_label: string | null
          scenario: string | null
          sheet_id: string | null
          template_type: string | null
          updated_at: string | null
          user_id: string
          validation_notes: Json | null
          validation_status: string | null
        }
        Insert: {
          col_index?: number | null
          created_at?: string | null
          id?: string
          last_import_at?: string | null
          period_key: string
          period_label?: string | null
          scenario?: string | null
          sheet_id?: string | null
          template_type?: string | null
          updated_at?: string | null
          user_id: string
          validation_notes?: Json | null
          validation_status?: string | null
        }
        Update: {
          col_index?: number | null
          created_at?: string | null
          id?: string
          last_import_at?: string | null
          period_key?: string
          period_label?: string | null
          scenario?: string | null
          sheet_id?: string | null
          template_type?: string | null
          updated_at?: string | null
          user_id?: string
          validation_notes?: Json | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dre_periods_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_validation_issues: {
        Row: {
          actual_cents: number | null
          created_at: string | null
          details_json: Json | null
          diff_cents: number | null
          expected_cents: number | null
          id: string
          period_id: string
          rule_code: string
          user_id: string
        }
        Insert: {
          actual_cents?: number | null
          created_at?: string | null
          details_json?: Json | null
          diff_cents?: number | null
          expected_cents?: number | null
          id?: string
          period_id: string
          rule_code: string
          user_id: string
        }
        Update: {
          actual_cents?: number | null
          created_at?: string | null
          details_json?: Json | null
          diff_cents?: number | null
          expected_cents?: number | null
          id?: string
          period_id?: string
          rule_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_validation_issues_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "dre_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_values: {
        Row: {
          created_at: string
          id: string
          is_calculated: boolean
          line_key: string
          original_value: number | null
          period_key: string
          sheet_id: string | null
          source_cell: string | null
          source_label: string | null
          source_tab: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_calculated?: boolean
          line_key: string
          original_value?: number | null
          period_key: string
          sheet_id?: string | null
          source_cell?: string | null
          source_label?: string | null
          source_tab?: string | null
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          is_calculated?: boolean
          line_key?: string
          original_value?: number | null
          period_key?: string
          sheet_id?: string | null
          source_cell?: string | null
          source_label?: string | null
          source_tab?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "dre_values_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_category_rules: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          priority: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          priority?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      financial_daily_aggregates: {
        Row: {
          created_at: string | null
          day: string
          id: string
          net: number | null
          source_sheet_id: string | null
          total_despesas: number | null
          total_receitas: number | null
          transaction_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day: string
          id?: string
          net?: number | null
          source_sheet_id?: string | null
          total_despesas?: number | null
          total_receitas?: number | null
          transaction_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day?: string
          id?: string
          net?: number | null
          source_sheet_id?: string | null
          total_despesas?: number | null
          total_receitas?: number | null
          transaction_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_daily_aggregates_source_sheet_id_fkey"
            columns: ["source_sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_demand_checklist: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          demand_id: string
          id: string
          is_completed: boolean
          label: string
          sort_order: number
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          demand_id: string
          id?: string
          is_completed?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          demand_id?: string
          id?: string
          is_completed?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_demand_checklist_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "financial_demands"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_demand_comments: {
        Row: {
          comment: string
          created_at: string
          demand_id: string
          id: string
          user_id: string
          visibility: string
        }
        Insert: {
          comment: string
          created_at?: string
          demand_id: string
          id?: string
          user_id: string
          visibility?: string
        }
        Update: {
          comment?: string
          created_at?: string
          demand_id?: string
          id?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_demand_comments_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "financial_demands"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_demand_documents: {
        Row: {
          created_at: string
          demand_id: string
          document_type: string | null
          extracted_data: Json | null
          extraction_confidence: number | null
          extraction_status: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          demand_id: string
          document_type?: string | null
          extracted_data?: Json | null
          extraction_confidence?: number | null
          extraction_status?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          demand_id?: string
          document_type?: string | null
          extracted_data?: Json | null
          extraction_confidence?: number | null
          extraction_status?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_demand_documents_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "financial_demands"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_demand_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          demand_id: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          demand_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          demand_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_demand_tasks_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "financial_demands"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_demand_timeline: {
        Row: {
          created_at: string
          demand_id: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          demand_id: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          demand_id?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_demand_timeline_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "financial_demands"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_demands: {
        Row: {
          ai_confidence: number | null
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          asana_last_synced_at: string | null
          asana_sync_error: string | null
          asana_sync_status: string
          asana_task_id: string | null
          asana_task_url: string | null
          assigned_to: string | null
          category_final: string | null
          category_suggested: string | null
          company_id: string | null
          cost_center: string | null
          created_at: string
          created_by: string
          demand_code: string | null
          demand_type: string
          description: string | null
          due_date: string | null
          finalized_at: string | null
          id: string
          priority: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requester_metadata: Json
          requires_review: boolean
          sla_due_at: string | null
          status: string
          supplier_document: string | null
          supplier_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          asana_last_synced_at?: string | null
          asana_sync_error?: string | null
          asana_sync_status?: string
          asana_task_id?: string | null
          asana_task_url?: string | null
          assigned_to?: string | null
          category_final?: string | null
          category_suggested?: string | null
          company_id?: string | null
          cost_center?: string | null
          created_at?: string
          created_by: string
          demand_code?: string | null
          demand_type: string
          description?: string | null
          due_date?: string | null
          finalized_at?: string | null
          id?: string
          priority?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requester_metadata?: Json
          requires_review?: boolean
          sla_due_at?: string | null
          status?: string
          supplier_document?: string | null
          supplier_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          asana_last_synced_at?: string | null
          asana_sync_error?: string | null
          asana_sync_status?: string
          asana_task_id?: string | null
          asana_task_url?: string | null
          assigned_to?: string | null
          category_final?: string | null
          category_suggested?: string | null
          company_id?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string
          demand_code?: string | null
          demand_type?: string
          description?: string | null
          due_date?: string | null
          finalized_at?: string | null
          id?: string
          priority?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requester_metadata?: Json
          requires_review?: boolean
          sla_due_at?: string | null
          status?: string
          supplier_document?: string | null
          supplier_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      forecast_insights: {
        Row: {
          generated_at: string
          horizon: string
          id: string
          insights: Json | null
          metadata: Json | null
          opportunities: Json | null
          recommendations: Json | null
          risks: Json | null
          sheet_id: string | null
          summary: string | null
          user_id: string
        }
        Insert: {
          generated_at?: string
          horizon: string
          id?: string
          insights?: Json | null
          metadata?: Json | null
          opportunities?: Json | null
          recommendations?: Json | null
          risks?: Json | null
          sheet_id?: string | null
          summary?: string | null
          user_id: string
        }
        Update: {
          generated_at?: string
          horizon?: string
          id?: string
          insights?: Json | null
          metadata?: Json | null
          opportunities?: Json | null
          recommendations?: Json | null
          risks?: Json | null
          sheet_id?: string | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_insights_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_monthly: {
        Row: {
          calibration_notes: Json | null
          confidence_score: number | null
          created_at: string
          despesa_prev_base: number | null
          despesa_prev_opt: number | null
          despesa_prev_pess: number | null
          despesa_real: number | null
          id: string
          is_forecast: boolean | null
          month_key: string
          receita_prev_base: number | null
          receita_prev_opt: number | null
          receita_prev_pess: number | null
          receita_real: number | null
          saldo_prev_base: number | null
          saldo_prev_opt: number | null
          saldo_prev_pess: number | null
          saldo_real: number | null
          sheet_id: string | null
          updated_at: string
          user_id: string
          validation_status: string | null
        }
        Insert: {
          calibration_notes?: Json | null
          confidence_score?: number | null
          created_at?: string
          despesa_prev_base?: number | null
          despesa_prev_opt?: number | null
          despesa_prev_pess?: number | null
          despesa_real?: number | null
          id?: string
          is_forecast?: boolean | null
          month_key: string
          receita_prev_base?: number | null
          receita_prev_opt?: number | null
          receita_prev_pess?: number | null
          receita_real?: number | null
          saldo_prev_base?: number | null
          saldo_prev_opt?: number | null
          saldo_prev_pess?: number | null
          saldo_real?: number | null
          sheet_id?: string | null
          updated_at?: string
          user_id: string
          validation_status?: string | null
        }
        Update: {
          calibration_notes?: Json | null
          confidence_score?: number | null
          created_at?: string
          despesa_prev_base?: number | null
          despesa_prev_opt?: number | null
          despesa_prev_pess?: number | null
          despesa_real?: number | null
          id?: string
          is_forecast?: boolean | null
          month_key?: string
          receita_prev_base?: number | null
          receita_prev_opt?: number | null
          receita_prev_pess?: number | null
          receita_real?: number | null
          saldo_prev_base?: number | null
          saldo_prev_opt?: number | null
          saldo_prev_pess?: number | null
          saldo_real?: number | null
          sheet_id?: string | null
          updated_at?: string
          user_id?: string
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_monthly_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      google_integration_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          level: string
          message: string
          request_id: string
          route: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          level: string
          message: string
          request_id: string
          route: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          message?: string
          request_id?: string
          route?: string
          user_id?: string | null
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          provider: string | null
          refresh_token: string
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          provider?: string | null
          refresh_token: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string | null
          refresh_token?: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_sheet_connections: {
        Row: {
          access_token: string | null
          auto_sync_enabled: boolean | null
          auto_sync_interval: number | null
          column_mapping: Json | null
          created_at: string
          data_type: string
          id: string
          last_source_fingerprint: string | null
          last_sync_at: string | null
          lock_until: string | null
          refresh_token: string
          sheet_name: string | null
          spreadsheet_id: string
          spreadsheet_name: string
          sync_frequency: string
          sync_status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          auto_sync_enabled?: boolean | null
          auto_sync_interval?: number | null
          column_mapping?: Json | null
          created_at?: string
          data_type?: string
          id?: string
          last_source_fingerprint?: string | null
          last_sync_at?: string | null
          lock_until?: string | null
          refresh_token: string
          sheet_name?: string | null
          spreadsheet_id: string
          spreadsheet_name: string
          sync_frequency?: string
          sync_status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          auto_sync_enabled?: boolean | null
          auto_sync_interval?: number | null
          column_mapping?: Json | null
          created_at?: string
          data_type?: string
          id?: string
          last_source_fingerprint?: string | null
          last_sync_at?: string | null
          lock_until?: string | null
          refresh_token?: string
          sheet_name?: string | null
          spreadsheet_id?: string
          spreadsheet_name?: string
          sync_frequency?: string
          sync_status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_sheet_sync_logs: {
        Row: {
          completed_at: string | null
          connection_id: string
          error_details: Json | null
          errors: Json | null
          google_revision: string | null
          id: string
          mode: string | null
          retry_count: number | null
          rows_imported: number | null
          rows_processed: number | null
          rows_skipped: number | null
          rows_updated: number | null
          rows_upserted: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          error_details?: Json | null
          errors?: Json | null
          google_revision?: string | null
          id?: string
          mode?: string | null
          retry_count?: number | null
          rows_imported?: number | null
          rows_processed?: number | null
          rows_skipped?: number | null
          rows_updated?: number | null
          rows_upserted?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          error_details?: Json | null
          errors?: Json | null
          google_revision?: string | null
          id?: string
          mode?: string | null
          retry_count?: number | null
          rows_imported?: number | null
          rows_processed?: number | null
          rows_skipped?: number | null
          rows_updated?: number | null
          rows_upserted?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_sheet_sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_name: string
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          status: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          client_name: string
          created_at?: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          status?: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          client_name?: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      meeting_audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      meeting_comparisons: {
        Row: {
          alignment_score: number | null
          company_id: string | null
          created_at: string
          divergences: Json
          error_message: string | null
          final_pdf_storage_path: string | null
          final_summary: string | null
          financial_impacts: Json
          id: string
          matched_points: Json
          meeting_session_id: string | null
          new_decisions: Json
          pre_report_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alignment_score?: number | null
          company_id?: string | null
          created_at?: string
          divergences?: Json
          error_message?: string | null
          final_pdf_storage_path?: string | null
          final_summary?: string | null
          financial_impacts?: Json
          id?: string
          matched_points?: Json
          meeting_session_id?: string | null
          new_decisions?: Json
          pre_report_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alignment_score?: number | null
          company_id?: string | null
          created_at?: string
          divergences?: Json
          error_message?: string | null
          final_pdf_storage_path?: string | null
          final_summary?: string | null
          financial_impacts?: Json
          id?: string
          matched_points?: Json
          meeting_session_id?: string | null
          new_decisions?: Json
          pre_report_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_comparisons_meeting_session_id_fkey"
            columns: ["meeting_session_id"]
            isOneToOne: false
            referencedRelation: "meeting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_comparisons_pre_report_id_fkey"
            columns: ["pre_report_id"]
            isOneToOne: false
            referencedRelation: "pre_meeting_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_sessions: {
        Row: {
          action_items: Json
          adjustments: Json
          audio_chunks: string[]
          audio_purged_at: string | null
          audio_storage_path: string | null
          cloud_status: string
          company_id: string | null
          created_at: string
          decisions: Json
          description: string | null
          duration_seconds: number
          ended_at: string | null
          id: string
          language: string
          last_autosave_at: string | null
          live_transcript_segments: string[]
          mentioned_numbers: Json
          metadata: Json
          participants: Json
          pre_report_id: string | null
          started_at: string | null
          status: string
          summary_error: string | null
          summary_generated_at: string | null
          summary_markdown: string | null
          summary_status: string
          title: string
          transcript_segments: Json
          transcript_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_items?: Json
          adjustments?: Json
          audio_chunks?: string[]
          audio_purged_at?: string | null
          audio_storage_path?: string | null
          cloud_status?: string
          company_id?: string | null
          created_at?: string
          decisions?: Json
          description?: string | null
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          language?: string
          last_autosave_at?: string | null
          live_transcript_segments?: string[]
          mentioned_numbers?: Json
          metadata?: Json
          participants?: Json
          pre_report_id?: string | null
          started_at?: string | null
          status?: string
          summary_error?: string | null
          summary_generated_at?: string | null
          summary_markdown?: string | null
          summary_status?: string
          title: string
          transcript_segments?: Json
          transcript_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_items?: Json
          adjustments?: Json
          audio_chunks?: string[]
          audio_purged_at?: string | null
          audio_storage_path?: string | null
          cloud_status?: string
          company_id?: string | null
          created_at?: string
          decisions?: Json
          description?: string | null
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          language?: string
          last_autosave_at?: string | null
          live_transcript_segments?: string[]
          mentioned_numbers?: Json
          metadata?: Json
          participants?: Json
          pre_report_id?: string | null
          started_at?: string | null
          status?: string
          summary_error?: string | null
          summary_generated_at?: string | null
          summary_markdown?: string | null
          summary_status?: string
          title?: string
          transcript_segments?: Json
          transcript_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_sessions_pre_report_id_fkey"
            columns: ["pre_report_id"]
            isOneToOne: false
            referencedRelation: "pre_meeting_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_sources: {
        Row: {
          company_id: string | null
          created_at: string
          external_id: string | null
          external_name: string
          id: string
          metadata: Json
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          external_id?: string | null
          external_name: string
          id?: string
          metadata?: Json
          source_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          external_id?: string | null
          external_name?: string
          id?: string
          metadata?: Json
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_parsed_transactions: {
        Row: {
          amount: number
          created_at: string
          date: string | null
          description: string
          id: string
          is_valid: boolean
          original_amount: number | null
          row_index: number
          upload_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string | null
          description?: string
          id?: string
          is_valid?: boolean
          original_amount?: number | null
          row_index?: number
          upload_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string | null
          description?: string
          id?: string
          is_valid?: boolean
          original_amount?: number | null
          row_index?: number
          upload_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_parsed_transactions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "pdf_statement_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_statement_uploads: {
        Row: {
          created_at: string
          detected_type: string
          error_message: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          id: string
          manual_type: string | null
          status: string
          transaction_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_type?: string
          error_message?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          manual_type?: string | null
          status?: string
          transaction_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detected_type?: string
          error_message?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          manual_type?: string | null
          status?: string
          transaction_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pre_meeting_reports: {
        Row: {
          company_id: string | null
          created_at: string
          error_message: string | null
          executive_summary: string | null
          id: string
          insights: Json
          pdf_storage_path: string | null
          period_end: string | null
          period_start: string | null
          report_json: Json
          risks: Json
          source_ids: string[] | null
          status: string
          suggested_agenda: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          executive_summary?: string | null
          id?: string
          insights?: Json
          pdf_storage_path?: string | null
          period_end?: string | null
          period_start?: string | null
          report_json?: Json
          risks?: Json
          source_ids?: string[] | null
          status?: string
          suggested_agenda?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          executive_summary?: string | null
          id?: string
          insights?: Json
          pdf_storage_path?: string | null
          period_end?: string | null
          period_start?: string | null
          report_json?: Json
          risks?: Json
          source_ids?: string[] | null
          status?: string
          suggested_agenda?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          preferences: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          preferences?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      sheet_sync_jobs: {
        Row: {
          connection_id: string
          created_at: string
          error_message: string | null
          error_step: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          mode: string
          progress: Json | null
          request_id: string | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          error_message?: string | null
          error_step?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          mode?: string
          progress?: Json | null
          request_id?: string | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          error_message?: string | null
          error_step?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          mode?: string
          progress?: Json | null
          request_id?: string | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_tab_audit: {
        Row: {
          connection_id: string | null
          created_at: string
          errors: Json | null
          id: string
          job_id: string | null
          period_key: string | null
          rows_imported: number
          rows_scanned: number
          rows_skipped: number
          rows_with_value: number
          skip_reasons: Json | null
          tab_name: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          job_id?: string | null
          period_key?: string | null
          rows_imported?: number
          rows_scanned?: number
          rows_skipped?: number
          rows_with_value?: number
          skip_reasons?: Json | null
          tab_name: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          job_id?: string | null
          period_key?: string | null
          rows_imported?: number
          rows_scanned?: number
          rows_skipped?: number
          rows_with_value?: number
          skip_reasons?: Json | null
          tab_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_tab_audit_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_tab_audit_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "sheet_sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_flags: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          needs_review: boolean
          notes: string | null
          reasons: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          transaction_id: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          needs_review?: boolean
          notes?: string | null
          reasons?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          transaction_id: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          needs_review?: boolean
          notes?: string | null
          reasons?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_flags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          client_vendor: string | null
          content_hash: string | null
          created_at: string
          date: string
          description: string
          external_row_key: string | null
          id: string
          movement_type: string
          notes: string | null
          raw_data: Json | null
          source: string | null
          source_row_number: number | null
          source_sheet_id: string | null
          source_tab: string | null
          stable_key: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          client_vendor?: string | null
          content_hash?: string | null
          created_at?: string
          date?: string
          description: string
          external_row_key?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          raw_data?: Json | null
          source?: string | null
          source_row_number?: number | null
          source_sheet_id?: string | null
          source_tab?: string | null
          stable_key?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          client_vendor?: string | null
          content_hash?: string | null
          created_at?: string
          date?: string
          description?: string
          external_row_key?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          raw_data?: Json | null
          source?: string | null
          source_row_number?: number | null
          source_sheet_id?: string | null
          source_tab?: string | null
          stable_key?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_source_sheet_id_fkey"
            columns: ["source_sheet_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_files: {
        Row: {
          created_at: string
          error_message: string | null
          file_name: string
          file_path: string | null
          id: string
          progress: Json | null
          rows_imported: number | null
          status: string
          tab_summary: Json | null
          user_id: string
          warnings: Json | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_name: string
          file_path?: string | null
          id?: string
          progress?: Json | null
          rows_imported?: number | null
          status?: string
          tab_summary?: Json | null
          user_id: string
          warnings?: Json | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          progress?: Json | null
          rows_imported?: number | null
          status?: string
          tab_summary?: Json | null
          user_id?: string
          warnings?: Json | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      demands_pending_approvals_count: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_internal: { Args: never; Returns: boolean }
      seed_demand_checklist: {
        Args: { _demand_id: string; _demand_type: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user" | "cliente"
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
      app_role: ["admin", "manager", "user", "cliente"],
    },
  },
} as const
