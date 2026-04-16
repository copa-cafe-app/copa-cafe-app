-- ============================================
-- Adiciona colunas bebida e cata na tabela lotes
-- ============================================

ALTER TABLE lotes
  ADD COLUMN IF NOT EXISTS bebida TEXT
    CHECK (bebida IN ('Estritamente Mole', 'Mole', 'Apenas Mole', 'Dura', 'Riada', 'Rio', 'Rio Zona')),
  ADD COLUMN IF NOT EXISTS cata INTEGER;
