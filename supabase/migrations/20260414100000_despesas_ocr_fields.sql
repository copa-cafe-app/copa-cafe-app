-- ============================================
-- Adiciona campos para OCR de recibos/NFs em despesas_producao
-- ============================================

ALTER TABLE public.despesas_producao
  ADD COLUMN IF NOT EXISTS vendor TEXT,
  ADD COLUMN IF NOT EXISTS ocr_raw JSONB;

CREATE INDEX IF NOT EXISTS idx_despesas_vendor ON public.despesas_producao(vendor);
