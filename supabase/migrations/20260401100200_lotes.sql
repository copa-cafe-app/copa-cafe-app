-- ============================================
-- 003_lotes.sql — Tabela de lotes de café
-- ============================================

CREATE TABLE IF NOT EXISTS lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produtor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talhao_id UUID,                              -- FK para talhoes (quando tabela existir)
  status TEXT NOT NULL DEFAULT 'RASCUNHO'
    CHECK (status IN ('RASCUNHO', 'DISPONIVEL', 'EM_NEGOCIACAO', 'VENDIDO', 'ENCERRADO')),

  -- Café
  variedade TEXT NOT NULL,
  processo TEXT NOT NULL
    CHECK (processo IN ('NATURAL', 'LAVADO', 'HONEY', 'DESCASCADO', 'CEREJA_DESCASCADO', 'OUTRO')),
  safra TEXT NOT NULL,                          -- "2024/25"
  peneira TEXT,
  pontuacao_cupping DECIMAL(4, 1),              -- 0-100
  notas_sensoriais TEXT,                        -- "Chocolate, caramelo, frutas vermelhas"

  -- Volume e preço
  quantidade_sacas INTEGER NOT NULL,
  preco_por_saca DECIMAL(10, 2),                -- null = "aceito propostas"
  preco_negociavel BOOLEAN DEFAULT TRUE,

  -- Rastreabilidade
  qrcode_hash TEXT UNIQUE,
  altitude_metros INTEGER,
  data_colheita DATE,

  fotos_urls TEXT[],

  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lotes_produtor ON lotes(produtor_id);
CREATE INDEX IF NOT EXISTS idx_lotes_status ON lotes(status);

-- RLS
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtor vê próprios lotes"
  ON lotes FOR SELECT
  USING (auth.uid() = produtor_id);

CREATE POLICY "Produtor cria próprios lotes"
  ON lotes FOR INSERT
  WITH CHECK (auth.uid() = produtor_id);

CREATE POLICY "Produtor atualiza próprios lotes"
  ON lotes FOR UPDATE
  USING (auth.uid() = produtor_id);

CREATE POLICY "Produtor deleta próprios lotes"
  ON lotes FOR DELETE
  USING (auth.uid() = produtor_id);

-- Trigger de updated_at
CREATE TRIGGER update_lotes_updated_at
  BEFORE UPDATE ON lotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
