-- ============================================
-- 009_precos_diarios.sql — Histórico de preços diários de café
-- Armazena preços de dias úteis para gráficos e análise
-- ============================================

CREATE TABLE IF NOT EXISTS public.precos_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('RIO', 'BEBIDA')),
  cata TEXT NOT NULL DEFAULT '20',
  preco DECIMAL(12, 2) NOT NULL,
  fonte TEXT NOT NULL DEFAULT 'COPA_CAFE',

  -- Dados extras opcionais
  dolar_dia DECIMAL(10, 4),
  bolsa_cents_lb DECIMAL(10, 2),
  bolsa_saca_brl DECIMAL(12, 2),

  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Evita duplicatas: um preço por tipo por dia
  UNIQUE(data, tipo, cata)
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_precos_diarios_data ON public.precos_diarios(data DESC);
CREATE INDEX IF NOT EXISTS idx_precos_diarios_tipo ON public.precos_diarios(tipo);
CREATE INDEX IF NOT EXISTS idx_precos_diarios_data_tipo ON public.precos_diarios(data DESC, tipo);

-- Comentários
COMMENT ON TABLE public.precos_diarios IS 'Histórico de preços diários de café Copa Café (dias úteis)';
COMMENT ON COLUMN public.precos_diarios.tipo IS 'Tipo de café: RIO ou BEBIDA';
COMMENT ON COLUMN public.precos_diarios.cata IS 'Classificação da cata (ex: 20)';
COMMENT ON COLUMN public.precos_diarios.preco IS 'Preço em reais por saca de 60kg';
COMMENT ON COLUMN public.precos_diarios.fonte IS 'Fonte do preço (COPA_CAFE, MERCADO, etc)';
COMMENT ON COLUMN public.precos_diarios.dolar_dia IS 'Cotação do dólar no dia';
COMMENT ON COLUMN public.precos_diarios.bolsa_cents_lb IS 'Preço da bolsa ICE em centavos/libra no dia';
COMMENT ON COLUMN public.precos_diarios.bolsa_saca_brl IS 'Preço da bolsa convertido para BRL/saca no dia';

-- RLS: leitura pública, escrita apenas por service_role (backend)
ALTER TABLE public.precos_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precos_diarios_leitura_publica" ON public.precos_diarios
  FOR SELECT USING (true);

-- Apenas service_role pode inserir/atualizar (via edge functions ou cron)
-- Usuários autenticados não podem modificar
CREATE POLICY "precos_diarios_escrita_service" ON public.precos_diarios
  FOR INSERT WITH CHECK (false);

CREATE POLICY "precos_diarios_update_service" ON public.precos_diarios
  FOR UPDATE USING (false);

CREATE POLICY "precos_diarios_delete_service" ON public.precos_diarios
  FOR DELETE USING (false);
