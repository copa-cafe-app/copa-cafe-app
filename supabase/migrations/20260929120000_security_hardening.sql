-- ============================================
-- Endurecimento de segurança (auditoria 2026-09-29)
-- ============================================

-- 1. users: a policy users_own_data é FOR ALL, então o próprio usuário podia
--    gravar skip_2fa / status / documento_verificado em si mesmo (pular o 2FA).
--    Privilégio por coluna: só o que o app realmente escreve.
REVOKE INSERT, UPDATE ON public.users FROM anon, authenticated;

GRANT INSERT (id, nome, cpf_cnpj, email, telefone, avatar_url, estado, municipio,
              lat, lng, status, aceite_termos, aceite_privacidade, ultimo_login,
              expo_push_token)
  ON public.users TO authenticated;

GRANT UPDATE (nome, cpf_cnpj, email, telefone, avatar_url, estado, municipio,
              lat, lng, aceite_termos, aceite_privacidade, ultimo_login,
              expo_push_token)
  ON public.users TO authenticated;

-- status no INSERT só pode nascer ACTIVE (o app sempre manda ACTIVE)
DROP POLICY IF EXISTS users_insert_status_active ON public.users;
CREATE POLICY users_insert_status_active ON public.users
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (status IS NULL OR status::text = 'ACTIVE');

-- 2. Storage comprovantes: upload só na pasta do próprio usuário.
DROP POLICY IF EXISTS "authenticated_upload_comprovantes" ON storage.objects;
CREATE POLICY "authenticated_upload_comprovantes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- A policy de SELECT pública permitia LISTAR o bucket inteiro pela API.
-- Bucket público não precisa dela para servir as URLs públicas (getPublicUrl).
DROP POLICY IF EXISTS "public_read_comprovantes" ON storage.objects;

-- Limite de tamanho e tipo de arquivo
UPDATE storage.buckets
  SET file_size_limit = 10485760,  -- 10 MB
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
  WHERE id = 'comprovantes';

-- 3. Função com search_path mutável (advisor)
ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;

-- 4. rls_auto_enable é função de event trigger; não precisa ser chamável via API
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;

-- 5. Rate limit de envio de OTP (usado pela Edge Function send-otp, service role)
CREATE TABLE IF NOT EXISTS public.otp_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone text NOT NULL,
  ip text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.otp_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.otp_requests FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_otp_requests_phone ON public.otp_requests (phone, criado_em);
CREATE INDEX IF NOT EXISTS idx_otp_requests_ip ON public.otp_requests (ip, criado_em);

-- 6. Busca de usuário por telefone para a verify-otp (substitui listUsers,
--    que só enxergava os primeiros 1000 usuários). Só service_role executa.
CREATE OR REPLACE FUNCTION public.auth_user_id_by_phone(p_digits text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM auth.users
  WHERE regexp_replace(coalesce(phone, ''), '\D', '', 'g') = p_digits
  ORDER BY created_at
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.auth_user_id_by_phone(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_phone(text) TO service_role;
