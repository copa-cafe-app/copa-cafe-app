-- Tabela de atividades de campo (Diário de Campo)
CREATE TABLE atividades_campo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produtor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ADUBACAO', 'PULVERIZACAO', 'PODA', 'COLHEITA', 'IRRIGACAO', 'OUTRO')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data DATE NOT NULL,
  custo DECIMAL(10,2),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Index para buscar atividades por produtor e data
CREATE INDEX idx_atividades_produtor_data ON atividades_campo(produtor_id, data);

-- RLS: produtor só vê as próprias atividades
ALTER TABLE atividades_campo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtor vê próprias atividades"
  ON atividades_campo FOR SELECT
  USING (auth.uid() = produtor_id);

CREATE POLICY "Produtor cria próprias atividades"
  ON atividades_campo FOR INSERT
  WITH CHECK (auth.uid() = produtor_id);

CREATE POLICY "Produtor deleta próprias atividades"
  ON atividades_campo FOR DELETE
  USING (auth.uid() = produtor_id);
