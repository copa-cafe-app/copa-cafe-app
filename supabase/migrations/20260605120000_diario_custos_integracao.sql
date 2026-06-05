-- ============================================
-- Integração Diário de Campo <-> Custos de Produção
-- Um custo lançado numa atividade do Diário cria/atualiza UMA despesa
-- vinculada (origem='DIARIO'). Apagar a atividade remove a despesa (cascade).
-- Evita lançamento duplicado e faz o diário refletir na aba Custos.
-- ============================================

-- 1. Fix: faltava a policy de UPDATE em atividades_campo (editar atividade
--    estava sendo bloqueado pelo RLS).
DROP POLICY IF EXISTS "Produtor atualiza próprias atividades" ON public.atividades_campo;
CREATE POLICY "Produtor atualiza próprias atividades"
  ON public.atividades_campo FOR UPDATE
  USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);

-- 2. Vínculo despesa -> atividade + marcador de origem
ALTER TABLE public.despesas_producao
  ADD COLUMN IF NOT EXISTS atividade_id UUID
    REFERENCES public.atividades_campo(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (origem IN ('MANUAL', 'DIARIO'));

-- 3. Uma despesa por atividade (permite upsert por atividade_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_despesas_atividade
  ON public.despesas_producao(atividade_id)
  WHERE atividade_id IS NOT NULL;
