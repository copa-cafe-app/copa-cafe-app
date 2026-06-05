-- Troca o índice único PARCIAL por um índice único simples em atividade_id.
-- Motivo: o upsert(onConflict: 'atividade_id') do PostgREST não casa com índice
-- parcial (precisaria do predicado WHERE no ON CONFLICT). Num índice simples,
-- o Postgres trata múltiplos NULL como distintos, então despesas manuais
-- (atividade_id NULL) continuam permitidas sem conflito.

DROP INDEX IF EXISTS uq_despesas_atividade;
CREATE UNIQUE INDEX IF NOT EXISTS uq_despesas_atividade
  ON public.despesas_producao(atividade_id);
