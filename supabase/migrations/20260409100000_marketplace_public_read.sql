-- ============================================
-- marketplace_public_read.sql — Allow public read access to marketplace
--
-- Problem: RLS policies on fornecedores and produtos_marketplace
-- required auth.uid() IS NOT NULL, which blocks reads when there's
-- any session issue (expired token, race condition on app load, etc).
-- Marketplace data is not sensitive — it should be readable by anyone.
-- ============================================

-- 1. Drop the old authenticated-only read policies
DROP POLICY IF EXISTS "fornecedores_read_all" ON public.fornecedores;
DROP POLICY IF EXISTS "produtos_read_all" ON public.produtos_marketplace;

-- 2. Create public read policies (no auth required)
CREATE POLICY "fornecedores_public_read" ON public.fornecedores
  FOR SELECT USING (true);

CREATE POLICY "produtos_public_read" ON public.produtos_marketplace
  FOR SELECT USING (true);
