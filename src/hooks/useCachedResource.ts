// Stale-while-revalidate: ao montar, mostra o último dado salvo; `refresh()`
// busca na rede, e se falhar mantém o dado do cache e marca `offline` pra tela
// mostrar o aviso "Sem conexão — mostrando ... de 29/09 às 14:32".

import { useCallback, useEffect, useRef, useState } from 'react';
import { readCache, writeCache } from '../utils/cache';

export interface CachedResource<T> {
  data: T | null;
  /** Quando o dado exibido veio da rede (ms). */
  savedAt: number | null;
  /** true enquanto não há dado nenhum pra mostrar e a busca está rolando. */
  loading: boolean;
  /** true quando a última busca falhou e estamos mostrando dado salvo. */
  offline: boolean;
  /** true quando a última busca falhou e não há nada salvo. */
  failed: boolean;
  refresh: () => Promise<void>;
}

export function useCachedResource<T>(key: string, fetcher: () => Promise<T>): CachedResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasFresh = useRef(false);
  const hasData = useRef(false);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    readCache<T>(key).then((entry) => {
      if (!mounted.current) return;
      // Se a rede já respondeu antes do disco, não sobrescreve com o velho.
      if (entry && !hasFresh.current) {
        hasData.current = true;
        setData(entry.data);
        setSavedAt(entry.savedAt);
      }
    });
    return () => { mounted.current = false; };
  }, [key]);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetcherRef.current();
      const at = await writeCache(key, fresh);
      if (!mounted.current) return;
      hasFresh.current = true;
      hasData.current = true;
      setData(fresh);
      setSavedAt(at);
      setOffline(false);
      setFailed(false);
    } catch {
      if (!mounted.current) return;
      // O cache pode não ter sido lido ainda — confere direto.
      if (!hasData.current) {
        const entry = await readCache<T>(key);
        if (!mounted.current) return;
        if (entry) {
          hasData.current = true;
          setData(entry.data);
          setSavedAt(entry.savedAt);
        }
      }
      setOffline(hasData.current);
      setFailed(!hasData.current);
    }
  }, [key]);

  // Sem dado e sem falha registrada = ainda buscando (cache ou rede).
  const loading = data == null && !failed;

  return { data, savedAt, loading, offline, failed, refresh };
}
