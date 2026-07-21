-- Segurança: trocar a leitura PÚBLICA das tabelas financeiras por leitura
-- restrita a administradores logados. Os dados (títulos, valores, nomes de
-- clientes/fornecedores) não devem ser legíveis por quem só tem a anon key.
--
-- A escrita continua só pela Edge Function (service role, que ignora RLS),
-- então não há policies de INSERT/UPDATE/DELETE aqui.

-- Função auxiliar: o usuário atual é administrador? SECURITY DEFINER para ler
-- profiles sem esbarrar no RLS da própria profiles (evita recursão).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND cargo = 'administrador'
  );
$$;

-- anon e authenticated precisam poder EXECUTAR (retorna false p/ não-admin);
-- sem isso, a avaliação da policy por um anônimo daria "permission denied".
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Troca das policies de leitura pública por leitura só-admin.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'financeiro_empresas',
    'financeiro_contas_pagar',
    'financeiro_contas_receber',
    'financeiro_sync_log',
    'financeiro_faturamento'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admin read" ON public.%I FOR SELECT USING (public.is_admin())', t);
  END LOOP;
END $$;
