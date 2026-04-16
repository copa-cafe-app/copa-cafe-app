import { create } from 'zustand';
import { locationService } from '../services/location.service';
import { weatherService, type WeatherData, type DailyForecast } from '../services/weather.service';
import { userService } from '../services/user.service';

interface WeatherState {
  weather: WeatherData | null;
  cityName: string | null;
  loading: boolean;
  error: string | null;
  forecast: DailyForecast[] | null;
  forecastLoading: boolean;
  forecastError: string | null;
  fetchWeatherByCity: (municipio: string, estado?: string) => Promise<void>;
  fetchWeather: (userId?: string) => Promise<void>;
  fetchForecast: (municipio?: string, estado?: string) => Promise<void>;
}

async function getGpsCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const granted = await locationService.requestPermission();
    if (!granted) return null;
    return await locationService.getCurrentLocation();
  } catch {
    return null;
  }
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  weather: null,
  cityName: null,
  loading: false,
  error: null,
  forecast: null,
  forecastLoading: false,
  forecastError: null,

  // Fetch weather by city name (preferred — uses farm location)
  fetchWeatherByCity: async (municipio: string, estado?: string) => {
    set({ loading: true, error: null });
    try {
      const geo = await weatherService.geocodeCity(municipio, estado);
      if (geo) {
        const weather = await weatherService.getCurrentWeather(geo.lat, geo.lng);
        set({ weather, cityName: geo.name, loading: false });
        return;
      }
      // Geocode failed — fallback to GPS
      const coords = await getGpsCoords();
      if (coords) {
        const [weather, cityName] = await Promise.all([
          weatherService.getCurrentWeather(coords.lat, coords.lng),
          locationService.getCityName(coords.lat, coords.lng),
        ]);
        set({ weather, cityName, loading: false });
      } else {
        set({ error: 'Não foi possível obter localização', loading: false });
      }
    } catch {
      set({ error: 'Erro ao buscar clima', loading: false });
    }
  },

  // Fetch weather by GPS
  fetchWeather: async (userId?: string) => {
    set({ loading: true, error: null });
    try {
      const coords = await getGpsCoords();
      if (!coords) {
        set({ error: 'Permissão de localização negada', loading: false });
        return;
      }

      const [weather, cityName] = await Promise.all([
        weatherService.getCurrentWeather(coords.lat, coords.lng),
        locationService.getCityName(coords.lat, coords.lng),
      ]);

      set({ weather, cityName, loading: false });

      if (userId) {
        userService.updateProfile(userId, { coordenadas: coords }).catch(() => {});
      }
    } catch {
      set({ error: 'Erro ao buscar clima', loading: false });
    }
  },

  // Fetch 7-day forecast (by city or GPS fallback)
  fetchForecast: async (municipio?: string, estado?: string) => {
    set({ forecastLoading: true, forecastError: null });
    try {
      let lat: number | undefined, lng: number | undefined;
      let resolvedCity: string | null = null;

      if (municipio) {
        const geo = await weatherService.geocodeCity(municipio, estado);
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
          set({ forecastError: 'Não foi possível obter localização', forecastLoading: false });
          return;
        }
        lat = coords.lat;
        lng = coords.lng;
      }

      const forecast = await weatherService.getDailyForecast(lat, lng);
      set({
        forecast,
        forecastLoading: false,
        // Update cityName if we resolved one and current is null
        ...(resolvedCity && !get().cityName ? { cityName: resolvedCity } : {}),
      });
    } catch {
      set({ forecastError: 'Erro ao buscar previsão', forecastLoading: false });
    }
  },
}));
