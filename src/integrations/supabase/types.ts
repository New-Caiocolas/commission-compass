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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
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
      comissoes: {
        Row: {
          criado_em: string
          desconto_1: number
          dt_pag: string
          frete_na_nf: number
          id: number
          nome_cliente: string
          nome_rep: string
          num_nf: string
          prc_nf: number
          repres_vend: number
          vlr_acresc: number
          vlr_ajustada: number
          vlr_base_comis: number
          vlr_desc: number
          vlr_exced: number
          vlr_frete: number
          vlr_negativa: number
        }
        Insert: {
          criado_em?: string
          desconto_1?: number
          dt_pag: string
          frete_na_nf?: number
          id?: number
          nome_cliente: string
          nome_rep: string
          num_nf: string
          prc_nf?: number
          repres_vend: number
          vlr_acresc?: number
          vlr_ajustada?: number
          vlr_base_comis?: number
          vlr_desc?: number
          vlr_exced?: number
          vlr_frete?: number
          vlr_negativa?: number
        }
        Update: {
          criado_em?: string
          desconto_1?: number
          dt_pag?: string
          frete_na_nf?: number
          id?: number
          nome_cliente?: string
          nome_rep?: string
          num_nf?: string
          prc_nf?: number
          repres_vend?: number
          vlr_acresc?: number
          vlr_ajustada?: number
          vlr_base_comis?: number
          vlr_desc?: number
          vlr_exced?: number
          vlr_frete?: number
          vlr_negativa?: number
        }
        Relationships: []
      }
      financeiro_contas_pagar: {
        Row: {
          centro_custo: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          empresa_id: string
          fornecedor: string | null
          id: string
          raw_payload: Json | null
          senior_titulo: string
          status: string | null
          synced_at: string | null
          valor: number | null
        }
        Insert: {
          centro_custo?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_id: string
          fornecedor?: string | null
          id?: string
          raw_payload?: Json | null
          senior_titulo: string
          status?: string | null
          synced_at?: string | null
          valor?: number | null
        }
        Update: {
          centro_custo?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          fornecedor?: string | null
          id?: string
          raw_payload?: Json | null
          senior_titulo?: string
          status?: string | null
          synced_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_contas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_contas_receber: {
        Row: {
          centro_custo: string | null
          cliente: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          empresa_id: string
          id: string
          raw_payload: Json | null
          senior_titulo: string
          status: string | null
          synced_at: string | null
          valor: number | null
        }
        Insert: {
          centro_custo?: string | null
          cliente?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_id: string
          id?: string
          raw_payload?: Json | null
          senior_titulo: string
          status?: string | null
          synced_at?: string | null
          valor?: number | null
        }
        Update: {
          centro_custo?: string | null
          cliente?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          id?: string
          raw_payload?: Json | null
          senior_titulo?: string
          status?: string | null
          synced_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_contas_receber_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_empresas: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          id: string
          nome: string
          senior_codigo_empresa: number | null
          senior_codigo_filial: number | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          id?: string
          nome: string
          senior_codigo_empresa?: number | null
          senior_codigo_filial?: number | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          id?: string
          nome?: string
          senior_codigo_empresa?: number | null
          senior_codigo_filial?: number | null
        }
        Relationships: []
      }
      financeiro_faturamento: {
        Row: {
          ano: number
          empresa_id: string
          id: string
          mes: number
          qtd_notas: number | null
          synced_at: string | null
          valor_total: number | null
        }
        Insert: {
          ano: number
          empresa_id: string
          id?: string
          mes: number
          qtd_notas?: number | null
          synced_at?: string | null
          valor_total?: number | null
        }
        Update: {
          ano?: number
          empresa_id?: string
          id?: string
          mes?: number
          qtd_notas?: number | null
          synced_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_faturamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_sync_log: {
        Row: {
          empresa_id: string | null
          executado_em: string | null
          id: string
          mensagem: string | null
          numero_lote: string | null
          registros: number | null
          servico: string
          status: string
        }
        Insert: {
          empresa_id?: string | null
          executado_em?: string | null
          id?: string
          mensagem?: string | null
          numero_lote?: string | null
          registros?: number | null
          servico: string
          status: string
        }
        Update: {
          empresa_id?: string | null
          executado_em?: string | null
          id?: string
          mensagem?: string | null
          numero_lote?: string | null
          registros?: number | null
          servico?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_sync_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cargo: string
          created_at: string
          foto_url: string | null
          id: string
          nome: string
          repres_vend: number | null
          vendedores_ids: number[] | null
        }
        Insert: {
          cargo?: string
          created_at?: string
          foto_url?: string | null
          id: string
          nome?: string
          repres_vend?: number | null
          vendedores_ids?: number[] | null
        }
        Update: {
          cargo?: string
          created_at?: string
          foto_url?: string | null
          id?: string
          nome?: string
          repres_vend?: number | null
          vendedores_ids?: number[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_anos_disponiveis: {
        Args: never
        Returns: {
          ano: number
        }[]
      }
      get_apuracao: {
        Args: { anos_filtro: number[]; meses_filtro?: number[] }
        Returns: {
          desconto_1: number
          nome_rep: string
          qtd_nfs: number
          repres_vend: number
          vlr_comissao_ajustada: number
          vlr_excedente_nf: number
          vlr_frete_cte: number
          vlr_frete_desp: number
          vlr_negativo: number
          vlr_nf: number
        }[]
      }
      get_clientes_ativos: {
        Args: never
        Returns: {
          nome_cliente: string
          nome_rep: string
          qtd_nfs: number
          repres_vend: number
          total_comprado: number
          ultima_compra: string
        }[]
      }
      get_evolucao_mensal: {
        Args: { anos_filtro: number[]; meses_filtro?: number[] }
        Returns: {
          ano: number
          mes: number
          qtd_nfs: number
          vlr_comissao: number
          vlr_frete: number
          vlr_negativo: number
          vlr_nf: number
        }[]
      }
      get_evolucao_mensal_vendedor: {
        Args: {
          anos_filtro: number[]
          meses_filtro?: number[]
          repres_vend_filtro: number
        }
        Returns: {
          ano: number
          mes: number
          qtd_nfs: number
          vlr_comissao: number
          vlr_negativo: number
          vlr_nf: number
        }[]
      }
      get_kpi_financeiro_aging: {
        Args: { empresa_codigo?: string }
        Returns: {
          faixa: string
          quantidade: number
          valor: number
        }[]
      }
      get_kpi_financeiro_comparativo: {
        Args: never
        Returns: {
          a_pagar_aberto: number
          a_receber_aberto: number
          despesa_mes: number
          empresa_codigo: string
          empresa_nome: string
          inadimplencia_pct: number
          mes_ref: string
          pmp_dias: number
          pmr_dias: number
          receita_mes: number
          resultado_mes: number
          saldo_projetado: number
        }[]
      }
      get_kpi_financeiro_fluxo_semanal: {
        Args: { empresa_codigo?: string; semanas?: number }
        Returns: {
          entradas: number
          saidas: number
          saldo: number
          semana: string
        }[]
      }
      get_kpi_financeiro_inadimplencia: {
        Args: { empresa_codigo?: string }
        Returns: {
          percentual: number
          valor_total_aberto: number
          valor_vencido: number
        }[]
      }
      get_kpi_financeiro_liquidez: {
        Args: { empresa_codigo?: string }
        Returns: {
          saldo_projetado: number
          total_a_pagar_aberto: number
          total_a_receber_aberto: number
        }[]
      }
      get_kpi_financeiro_prazos: {
        Args: { empresa_codigo?: string }
        Returns: {
          pmp_dias: number
          pmr_dias: number
        }[]
      }
      get_kpi_financeiro_resultado: {
        Args: { empresa_codigo?: string; meses?: number }
        Returns: {
          ano: number
          despesa: number
          mes: number
          receita: number
          resultado: number
        }[]
      }
      get_kpi_top_devedores: {
        Args: { empresa_codigo?: string; limite?: number }
        Returns: {
          cliente: string
          quantidade: number
          valor: number
        }[]
      }
      get_kpi_top_fornecedores: {
        Args: { empresa_codigo?: string; limite?: number }
        Returns: {
          fornecedor: string
          quantidade: number
          valor: number
        }[]
      }
      get_kpis_vendedor: {
        Args: { anos_filtro: number[]; meses_filtro?: number[] }
        Returns: {
          desconto_1: number
          nome_rep: string
          qtd_clientes: number
          qtd_nfs: number
          repres_vend: number
          vlr_comissao_ajustada: number
          vlr_excedente_nf: number
          vlr_frete_cte: number
          vlr_frete_desp: number
          vlr_negativo: number
          vlr_nf: number
        }[]
      }
      get_my_cargo: { Args: never; Returns: string }
      get_representantes: {
        Args: never
        Returns: {
          nome_rep: string
          repres_vend: number
        }[]
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
