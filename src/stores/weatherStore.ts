import { create } from 'zustand';
import { locationService } from '../services/location.service';
import { weatherService, type WeatherData, type DailyForecast } from '../services/weather.service';
import { userService } from '../services/user.service';
import { readCache, writeCache, CACHE_KEYS } from '../utils/cache';
import { withTimeout } from '../utils/fetchWithTimeout';

// Cache offline (stale-while-revalidate): cada busca primeiro mostra o último
// clima/previsão salvo pra aquele local e depois atualiza pela rede. Se a rede
// falhar, fica o dado salvo e `weatherOfflineAt`/`forecastOfflineAt` recebem a
// hora em que ele foi salvo — a tela usa isso pro aviso "Sem conexão — ...".

interface WeatherState {
  weather: WeatherData | null;
  cityName: string | null;
  loading: boolean;
  error: string | null;
  /** Quando != null, `weather` é do cache (rede falhou); valor = quando foi salvo. */
  weatherOfflineAt: number | null;
  forecast: DailyForecast[] | null;
  forecastLoading: boolean;
  forecastError: string | null;
  forecastOfflineAt: number | null;
  fetchWeatherByCity: (municipio: string, estado?: string) => Promise<void>;
  fetchWeather: (userId?: string) => Promise<void>;
  fetchForecast: (municipio?: string, estado?: string) => Promise<void>;
  captureCoords: (userId?: string) => Promise<void>;
}

interface CachedWeather {
  weather: WeatherData;
  cityName: string | null;
}

interface CachedForecast {
  forecast: DailyForecast[];
  cityName: string | null;
}

type Geo = { lat: number; lng: number; name: string };

const GPS_KEY = 'gps';

function locKey(municipio?: string, estado?: string): string {
  if (!municipio) return GPS_KEY;
  return `${municipio}|${estado || ''}`.trim().toLowerCase();
}

async function getGpsCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const granted = await locationService.requestPermission();
    if (!granted) return null;
    return await withTimeout(locationService.getCurrentLocation(), 15000);
  } catch {
    return null;
  }
}

// Coordenada de cidade não muda: geocode fica salvo pra sempre e só vai à rede
// na primeira vez (antes re-geocodificava a cada abertura da home).
async function geocodeCached(municipio: string, estado?: string): Promise<Geo | null> {
  const key = CACHE_KEYS.geocode(locKey(municipio, estado));
  const cached = await readCache<Geo>(key);
  if (cached?.data) return cached.data;
  try {
    const geo = await withTimeout(weatherService.geocodeCity(municipio, estado));
    if (geo) await writeCache(key, geo);
    return geo;
  } catch {
    return null;
  }
}

async function cityNameSafe(lat: number, lng: number): Promise<string | null> {
  try {
    return await withTimeout(locationService.getCityName(lat, lng));
  } catch {
    return null;
  }
}

export const useWeatherStore = create<WeatherState>((set, get) => {
  // Evita que uma busca antiga (ex.: fazenda anterior) sobrescreva a atual.
  let weatherReq = 0;
  let forecastReq = 0;

  async function showCachedWeather(key: string, req: number): Promise<number | null> {
    const cached = await readCache<CachedWeather>(CACHE_KEYS.weather(key));
    if (req !== weatherReq) return null;
    if (cached?.data?.weather) {
      set({ weather: cached.data.weather, cityName: cached.data.cityName, loading: false });
      return cached.savedAt;
    }
    return null;
  }

  async function saveWeather(key: string, req: number, weather: WeatherData, cityName: string | null) {
    await writeCache<CachedWeather>(CACHE_KEYS.weather(key), { weather, cityName });
    if (req !== weatherReq) return;
    set({ weather, cityName, loading: false, error: null, weatherOfflineAt: null });
  }

  function weatherFailed(req: number, cachedAt: number | null, message: string) {
    if (req !== weatherReq) return;
    if (cachedAt != null) {
      set({ loading: false, error: null, weatherOfflineAt: cachedAt });
    } else {
      set({ weather: null, loading: false, error: message, weatherOfflineAt: null });
    }
  }

  return {
    weather: null,
    cityName: null,
    loading: false,
    error: null,
    weatherOfflineAt: null,
    forecast: null,
    forecastLoading: false,
    forecastError: null,
    forecastOfflineAt: null,

    // Fetch weather by city name (preferred — uses farm location)
    fetchWeatherByCity: async (municipio: string, estado?: string) => {
      const req = ++weatherReq;
      const key = locKey(municipio, estado);
      set({ loading: true, error: null, weatherOfflineAt: null });
      const cachedAt = await showCachedWeather(key, req);
      if (req !== weatherReq) return;
      try {
        const geo = await geocodeCached(municipio, estado);
        if (geo) {
          const weather = await withTimeout(weatherService.getCurrentWeather(geo.lat, geo.lng));
          await saveWeather(key, req, weather, geo.name);
          return;
        }
        // Geocode failed — fallback to GPS
        const coords = await getGpsCoords();
        if (coords) {
          const [weather, cityName] = await Promise.all([
            withTimeout(weatherService.getCurrentWeather(coords.lat, coords.lng)),
            cityNameSafe(coords.lat, coords.lng),
          ]);
          await saveWeather(key, req, weather, cityName);
        } else {
          weatherFailed(req, cachedAt, 'Não foi possível obter localização');
        }
      } catch {
        weatherFailed(req, cachedAt, 'Erro ao buscar clima');
      }
    },

    // Fetch weather by GPS
    fetchWeather: async (userId?: string) => {
      const req = ++weatherReq;
      set({ loading: true, error: null, weatherOfflineAt: null });
      const cachedAt = await showCachedWeather(GPS_KEY, req);
      if (req !== weatherReq) return;
      try {
        const coords = await getGpsCoords();
        if (!coords) {
          weatherFailed(req, cachedAt, 'Permissão de localização negada');
          return;
        }

        const [weather, cityName] = await Promise.all([
          withTimeout(weatherService.getCurrentWeather(coords.lat, coords.lng)),
          cityNameSafe(coords.lat, coords.lng),
        ]);

        await saveWeather(GPS_KEY, req, weather, cityName);

        if (userId) {
          userService.updateProfile(userId, { lat: coords.lat, lng: coords.lng }).catch(() => {});
        }
      } catch {
        weatherFailed(req, cachedAt, 'Erro ao buscar clima');
      }
    },

    // Capture the producer's GPS coordinates and persist them on their profile.
    // Runs independently of the weather flow so we still collect coordinates even
    // when the climate card is sourced from the registered farm city.
    captureCoords: async (userId?: string) => {
      if (!userId) return;
      const coords = await getGpsCoords();
      if (!coords) return;
      userService.updateProfile(userId, { lat: coords.lat, lng: coords.lng }).catch(() => {});
    },

    // Fetch 7-day forecast (by city or GPS fallback)
    fetchForecast: async (municipio?: string, estado?: string) => {
      const req = ++forecastReq;
      const key = locKey(municipio, estado);
      set({ forecastLoading: true, forecastError: null, forecastOfflineAt: null });

      const cached = await readCache<CachedForecast>(CACHE_KEYS.forecast(key));
      if (req !== forecastReq) return;
      const hasCached = !!cached?.data?.forecast?.length;
      if (cached && hasCached) {
        set({
          forecast: cached.data.forecast,
          forecastLoading: false,
          ...(cached.data.cityName && !get().cityName ? { cityName: cached.data.cityName } : {}),
        });
      }

      const fail = (message: string) => {
        if (req !== forecastReq) return;
        if (cached && hasCached) {
          set({ forecastLoading: false, forecastError: null, forecastOfflineAt: cached.savedAt });
        } else {
          set({ forecastError: message, forecastLoading: false });
        }
      };

      try {
        let lat: number | undefined, lng: number | undefined;
        let resolvedCity: string | null = null;

        if (municipio) {
          const geo = await geocodeCached(municipio, estado);
          if (geo) {
            lat = geo.lat;
            lng = geo.lng;
            resolvedCity = geo.name;
          }
        }

        // Fallback to GPS if no coords yet
        if (lat == null || lng == null) {
          const coords = await getGpsCoords();
          if (!coords) {
            fail('Não foi possível obter localização');
            return;
          }
          lat = coords.lat;
          lng = coords.lng;
        }

        const forecast = await withTimeout(weatherService.getDailyForecast(lat, lng));
        await writeCache<CachedForecast>(CACHE_KEYS.forecast(key), { forecast, cityName: resolvedCity });
        if (req !== forecastReq) return;
        set({
          forecast,
          forecastLoading: false,
          forecastOfflineAt: null,
          // Update cityName if we resolved one and current is null
          ...(resolvedCity && !get().cityName ? { cityName: resolvedCity } : {}),
        });
      } catch {
        fail('Erro ao buscar previsão');
      }
    },
  };
});
