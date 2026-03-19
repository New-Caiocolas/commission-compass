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
  public: {
    Tables: {
      comissoes: {
        Row: {
          id: number
          num_nf: string | null
          dt_pag: string | null
          repres_vend: number | null
          nome_rep: string | null
          nome_cliente: string | null
          prc_nf: number | null
          vlr_desc: number | null
          vlr_acresc: number | null
          vlr_negativa: number | null
          vlr_ajustada: number | null
          vlr_base_comis: number | null
          vlr_exced: number | null
          vlr_frete: number | null
          frete_na_nf: number | null
          desconto_1: number | null
          criado_em: string | null
        }
        Insert: {
          id?: number
          num_nf?: string | null
          dt_pag?: string | null
          repres_vend?: number | null
          nome_rep?: string | null
          nome_cliente?: string | null
          prc_nf?: number | null
          vlr_desc?: number | null
          vlr_acresc?: number | null
          vlr_negativa?: number | null
          vlr_ajustada?: number | null
          vlr_base_comis?: number | null
          vlr_exced?: number | null
          vlr_frete?: number | null
          frete_na_nf?: number | null
          desconto_1?: number | null
          criado_em?: string | null
        }
        Update: {
          id?: number
          num_nf?: string | null
          dt_pag?: string | null
          repres_vend?: number | null
          nome_rep?: string | null
          nome_cliente?: string | null
          prc_nf?: number | null
          vlr_desc?: number | null
          vlr_acresc?: number | null
          vlr_negativa?: number | null
          vlr_ajustada?: number | null
          vlr_base_comis?: number | null
          vlr_exced?: number | null
          vlr_frete?: number | null
          frete_na_nf?: number | null
          desconto_1?: number | null
          criado_em?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_anos_disponiveis: {
        Args: Record<never, never>
        Returns: { ano: number }[]
      }
      get_apuracao: {
        Args: { anos_filtro: number[]; meses_filtro?: number[] }
        Returns: {
          repres_vend: number
          nome_rep: string
          vlr_nf: number
          vlr_comissao_ajustada: number
          vlr_negativo: number
          vlr_excedente_nf: number
          vlr_frete_cte: number
          vlr_frete_desp: number
          desconto_1: number
        }[]
      }
      get_kpis_vendedor: {
        Args: { anos_filtro: number[]; meses_filtro?: number[] }
        Returns: {
          nome_rep: string
          repres_vend: number
          qtd_nfs: number
          qtd_clientes: number
          vlr_nf: number
          vlr_comissao_ajustada: number
          vlr_negativo: number
          vlr_excedente_nf: number
          vlr_frete_cte: number
          vlr_frete_desp: number
          desconto_1: number
        }[]
      }
      get_evolucao_mensal: {
        Args: { anos_filtro: number[]; meses_filtro?: number[] }
        Returns: {
          ano: number
          mes: number
          vlr_nf: number
          vlr_comissao: number
          vlr_frete: number
          vlr_negativo: number
          qtd_nfs: number
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
  public: {
    Enums: {},
  },
} as const

