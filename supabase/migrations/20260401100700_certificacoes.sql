-- ============================================
-- 008_certificacoes.sql — Certificações da propriedade
-- ============================================

CREATE TABLE IF NOT EXISTS public.certificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id UUID NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  produtor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  tipo TEXT NOT NULL,                   -- "UTZ", "Rainforest Alliance", "Orgânico", "4C", "Certifica Minas", etc.
  certificadora TEXT,                   -- Nome da certificadora
  numero_certificado TEXT,
  validade DATE,
  documento_url TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVO'
    CHECK (status IN ('ATIVO', 'VENCIDO', 'EM_RENOVACAO', 'CANCELADO')),

  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificacoes_propriedade ON public.certificacoes(propriedade_id);
CREATE INDEX IF NOT EXISTS idx_certificacoes_produtor ON public.certificacoes(produtor_id);

ALTER TABLE public.certificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtor_own_certificacoes" ON public.certificacoes
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);

CREATE TRIGGER certificacoes_updated_at
  BEFORE UPDATE ON public.certificacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
