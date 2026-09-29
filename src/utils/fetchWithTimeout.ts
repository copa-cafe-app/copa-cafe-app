// Internet rural costuma "pendurar" em vez de falhar: sem timeout o fetch fica
// esperando minutos e a tela fica girando. Cortamos em ~12s e caímos no cache.

export const DEFAULT_TIMEOUT_MS = 12000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Timeout pra promessas que fazem fetch por dentro e não aceitam `signal`
 * (ex.: services de outros módulos). Não cancela a requisição, só para de esperar.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo esgotado')), timeoutMs);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}
