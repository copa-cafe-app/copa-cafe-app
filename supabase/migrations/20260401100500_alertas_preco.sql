-- ============================================
-- 006_alertas_preco.sql — Alertas de cotação
-- ============================================

CREATE TABLE IF NOT EXISTS public.alertas_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produtor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  tipo_cafe TEXT NOT NULL CHECK (tipo_cafe IN ('ARABICA', 'CONILON')),
  condicao TEXT NOT NULL CHECK (condicao IN ('ACIMA', 'ABAIXO')),
  preco_alvo DECIMAL(12, 2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  disparado BOOLEAN NOT NULL DEFAULT FALSE,
  disparado_em TIMESTAMPTZ,

  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_produtor ON public.alertas_preco(produtor_id);
CREATE INDEX IF NOT EXISTS idx_alertas_ativos ON public.alertas_preco(ativo) WHERE ativo = TRUE;

ALTER TABLE public.alertas_preco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtor_own_alertas" ON public.alertas_preco
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);
