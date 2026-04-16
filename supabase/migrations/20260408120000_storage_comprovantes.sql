-- ============================================
-- 009_storage_comprovantes.sql — Bucket para comprovantes/cupons fiscais
-- ============================================

-- 1. Criar bucket para comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir upload por usuários autenticados
CREATE POLICY "authenticated_upload_comprovantes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'comprovantes');

-- 3. Permitir leitura pública (URLs públicas)
CREATE POLICY "public_read_comprovantes"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'comprovantes');

-- 4. Permitir que o dono delete seus arquivos
CREATE POLICY "owner_delete_comprovantes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);
