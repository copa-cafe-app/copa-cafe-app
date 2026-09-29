// Cache local simples (AsyncStorage + JSON) pra mostrar o último dado bom quando
// a internet da roça falha. Tudo em try/catch: cache é conveniência, nunca pode
// derrubar a tela — se o armazenamento der erro, a leitura só volta null.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@copa_cafe_cache:';

export interface CacheEntry<T> {
  data: T;
  /** Epoch em ms de quando o dado foi salvo (= quando veio da rede). */
  savedAt: number;
}

export const CACHE_KEYS = {
  copaPrices: 'copa_prices',
  market: 'coffee_prices',
  weather: (loc: string) => `weather:${loc}`,
  forecast: (loc: string) => `forecast:${loc}`,
  geocode: (query: string) => `geocode:${query}`,
  propriedades: (userId: string) => `propriedades:${userId}`,
} as const;

export async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.savedAt !== 'number') return null;
    return parsed as CacheEntry<T>;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<number> {
  const savedAt = Date.now();
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt }));
  } catch {
    // sem espaço / storage indisponível — segue sem cache
  }
  return savedAt;
}

/** "29/09 às 14:32" — formato curto pro aviso de dado offline. */
export function formatCacheStamp(savedAt: number): string {
  const d = new Date(savedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
