-- ============================================
-- Lote ligado à fazenda + registro da oferta à Copa
-- Colunas opcionais: o build 1.0.2 (que não as envia) segue funcionando.
-- ============================================

ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS propriedade_id uuid REFERENCES public.propriedades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ofertado_copa_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_lotes_propriedade ON public.lotes (propriedade_id);

-- A fazenda do lote tem que ser do próprio produtor
CREATE OR REPLACE FUNCTION public.lotes_check_propriedade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.propriedade_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.propriedades p
    WHERE p.id = NEW.propriedade_id AND p.produtor_id = NEW.produtor_id
  ) THEN
    RAISE EXCEPTION 'Fazenda inválida para este lote';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lotes_check_propriedade ON public.lotes;
CREATE TRIGGER lotes_check_propriedade
  BEFORE INSERT OR UPDATE OF propriedade_id, produtor_id ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public.lotes_check_propriedade();

NOTIFY pgrst, 'reload schema';
