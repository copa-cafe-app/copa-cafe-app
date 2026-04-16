-- ============================================
-- 005_talhoes_despesas.sql — Talhões e Despesas de produção
-- ============================================

-- 1. Talhões (parcelas da propriedade)
CREATE TABLE IF NOT EXISTS public.talhoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produtor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  propriedade_id UUID REFERENCES public.propriedades(id) ON DELETE SET NULL,

  nome TEXT NOT NULL,
  area_hectares DECIMAL NOT NULL,
  variedade TEXT,
  altitude_metros INTEGER,
  ano_plantio INTEGER,
  espacamento TEXT,               -- "3.5 x 0.7"
  num_plantas INTEGER,
  status TEXT NOT NULL DEFAULT 'ATIVO'
    CHECK (status IN ('ATIVO', 'EM_RENOVACAO', 'INATIVO')),

  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_talhoes_produtor ON public.talhoes(produtor_id);
CREATE INDEX IF NOT EXISTS idx_talhoes_propriedade ON public.talhoes(propriedade_id);

-- 2. Despesas de produção
CREATE TABLE IF NOT EXISTS public.despesas_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produtor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talhao_id UUID REFERENCES public.talhoes(id) ON DELETE SET NULL,

  categoria TEXT NOT NULL
    CHECK (categoria IN ('INSUMOS', 'MAO_DE_OBRA', 'DEFENSIVOS', 'MAQUINAS', 'TRANSPORTE', 'OUTROS')),
  descricao TEXT NOT NULL,
  valor DECIMAL(12, 2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  safra TEXT,                     -- "2025/26"
  comprovante_url TEXT,

  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despesas_produtor ON public.despesas_producao(produtor_id);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON public.despesas_producao(categoria);
CREATE INDEX IF NOT EXISTS idx_despesas_data ON public.despesas_producao(data);

-- 3. RLS
ALTER TABLE public.talhoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtor_own_talhoes" ON public.talhoes
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);

CREATE POLICY "produtor_own_despesas" ON public.despesas_producao
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);

-- 4. Triggers updated_at
CREATE TRIGGER talhoes_updated_at
  BEFORE UPDATE ON public.talhoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER despesas_updated_at
  BEFORE UPDATE ON public.despesas_producao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Atualizar FK de lotes para talhoes
ALTER TABLE public.lotes
  ADD CONSTRAINT fk_lotes_talhao
  FOREIGN KEY (talhao_id) REFERENCES public.talhoes(id) ON DELETE SET NULL;
