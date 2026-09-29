-- ============================================
-- Amostra do lote: produtor envia, equipe Copa aprova/reprova no app
-- ============================================

-- 1. Equipe Copa. Coluna fora dos grants de coluna de users
--    (20260929120000), então o usuário não consegue se promover.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_copa_staff boolean NOT NULL DEFAULT false;

-- 2. Estado da amostra no lote
ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS amostra_status text
    CHECK (amostra_status IN ('ENVIADA', 'APROVADA', 'REPROVADA')),
  ADD COLUMN IF NOT EXISTS amostra_enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS amostra_avaliada_em timestamptz,
  ADD COLUMN IF NOT EXISTS amostra_avaliada_por uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amostra_motivo text;

CREATE INDEX IF NOT EXISTS idx_lotes_amostra_status ON public.lotes (amostra_status, amostra_enviada_em);

CREATE OR REPLACE FUNCTION public.is_copa_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT is_copa_staff FROM public.users WHERE id = auth.uid()), false);
$$;

-- 3. O produtor só pode ENVIAR (de vazio/reprovada para ENVIADA). Aprovar e
--    reprovar só pela função avaliar_amostra (equipe Copa).
CREATE OR REPLACE FUNCTION public.lotes_guard_amostra()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('copa.avaliando_amostra', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.amostra_status := NULL;
    NEW.amostra_enviada_em := NULL;
    NEW.amostra_avaliada_em := NULL;
    NEW.amostra_avaliada_por := NULL;
    NEW.amostra_motivo := NULL;
    RETURN NEW;
  END IF;

  IF NEW.amostra_status IS DISTINCT FROM OLD.amostra_status THEN
    IF NEW.amostra_status = 'ENVIADA'
       AND (OLD.amostra_status IS NULL OR OLD.amostra_status = 'REPROVADA') THEN
      NEW.amostra_enviada_em := now();
      NEW.amostra_avaliada_em := NULL;
      NEW.amostra_avaliada_por := NULL;
      NEW.amostra_motivo := NULL;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Alteração de amostra não permitida';
  END IF;

  -- Status igual: campos da avaliação não mudam pelo produtor
  NEW.amostra_enviada_em := OLD.amostra_enviada_em;
  NEW.amostra_avaliada_em := OLD.amostra_avaliada_em;
  NEW.amostra_avaliada_por := OLD.amostra_avaliada_por;
  NEW.amostra_motivo := OLD.amostra_motivo;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lotes_guard_amostra ON public.lotes;
CREATE TRIGGER lotes_guard_amostra
  BEFORE INSERT OR UPDATE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public.lotes_guard_amostra();

-- 4. Equipe Copa: lista de amostras (pendentes ou já avaliadas)
CREATE OR REPLACE FUNCTION public.amostras_copa(p_pendentes boolean DEFAULT true)
RETURNS TABLE (
  lote_id uuid,
  amostra_status text,
  amostra_enviada_em timestamptz,
  amostra_avaliada_em timestamptz,
  amostra_motivo text,
  variedade text,
  processo text,
  safra text,
  quantidade_sacas numeric,
  bebida text,
  cata numeric,
  peneira text,
  preco_por_saca numeric,
  qrcode_hash text,
  produtor_nome text,
  produtor_telefone text,
  fazenda_nome text,
  municipio text,
  estado text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_copa_staff() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe Copa';
  END IF;
  RETURN QUERY
    SELECT l.id, l.amostra_status, l.amostra_enviada_em, l.amostra_avaliada_em, l.amostra_motivo,
           l.variedade, l.processo, l.safra, l.quantidade_sacas::numeric, l.bebida, l.cata::numeric,
           l.peneira, l.preco_por_saca::numeric, l.qrcode_hash,
           u.nome, u.telefone,
           p.nome, coalesce(p.municipio, u.municipio), coalesce(p.estado, u.estado)
    FROM public.lotes l
    JOIN public.users u ON u.id = l.produtor_id
    LEFT JOIN public.propriedades p ON p.id = l.propriedade_id
    WHERE CASE WHEN p_pendentes
               THEN l.amostra_status = 'ENVIADA'
               ELSE l.amostra_status IN ('APROVADA', 'REPROVADA') END
    ORDER BY CASE WHEN p_pendentes THEN l.amostra_enviada_em END ASC,
             l.amostra_avaliada_em DESC NULLS LAST
    LIMIT 200;
END;
$$;

-- 5. Equipe Copa: aprovar / reprovar
CREATE OR REPLACE FUNCTION public.avaliar_amostra(p_lote_id uuid, p_aprovada boolean, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_copa_staff() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe Copa';
  END IF;
  PERFORM set_config('copa.avaliando_amostra', 'on', true);
  UPDATE public.lotes
    SET amostra_status = CASE WHEN p_aprovada THEN 'APROVADA' ELSE 'REPROVADA' END,
        amostra_avaliada_em = now(),
        amostra_avaliada_por = auth.uid(),
        amostra_motivo = nullif(trim(p_motivo), '')
    WHERE id = p_lote_id AND amostra_status = 'ENVIADA';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Amostra não está aguardando avaliação';
  END IF;
  PERFORM set_config('copa.avaliando_amostra', 'off', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.amostras_copa(boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.avaliar_amostra(uuid, boolean, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_copa_staff() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.amostras_copa(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.avaliar_amostra(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_copa_staff() TO authenticated;

NOTIFY pgrst, 'reload schema';
