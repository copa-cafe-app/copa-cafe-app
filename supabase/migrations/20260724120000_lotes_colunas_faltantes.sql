-- ============================================================================
-- Repara a divergência entre o schema de produção e a migration original de
-- `lotes` (20260401100200_lotes.sql). As colunas abaixo nunca chegaram no
-- banco de produção, e a ausência de `peneira` fazia TODA criação de lote
-- falhar (o insert de app/novo-lote.tsx sempre envia esse campo) — por isso
-- a tabela `lotes` estava com ZERO registros desde o lançamento.
--
-- As demais colunas são lidas por app/lote-detalhe.tsx (peneira, altitude,
-- data de colheita, preço negociável) e o `qrcode_hash` é gravado pelo botão
-- de gerar QR Code, que também falhava.
-- ============================================================================

ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS peneira          TEXT,
  ADD COLUMN IF NOT EXISTS preco_negociavel BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS qrcode_hash      TEXT,
  ADD COLUMN IF NOT EXISTS altitude_metros  INTEGER,
  ADD COLUMN IF NOT EXISTS data_colheita    DATE;

-- `qrcode_hash` precisa ser único (rastreabilidade do lote).
CREATE UNIQUE INDEX IF NOT EXISTS lotes_qrcode_hash_key
  ON public.lotes (qrcode_hash)
  WHERE qrcode_hash IS NOT NULL;
