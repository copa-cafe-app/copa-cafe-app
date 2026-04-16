const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export interface WeatherData {
  temperature: number;
  humidity: number;
  rainProbability: number;
  windSpeed: number;
}

export interface DailyForecast {
  date: string; // ISO date string (YYYY-MM-DD)
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  weatherCode: number;
}

export const weatherService = {
  async getCurrentWeather(lat: number, lng: number): Promise<WeatherData> {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m',
      timezone: 'auto',
    });

    const response = await fetch(`${BASE_URL}?${params}`);
    if (!response.ok) throw new Error('Erro ao buscar clima');

    const data = await response.json();
    const current = data.current;

    return {
      temperature: Math.round(current.temperature_2m),
      humidity: current.relative_humidity_2m,
      rainProbability: current.precipitation_probability ?? 0,
      windSpeed: Math.round(current.wind_speed_10m),
    };
  },

  async geocodeCity(city: string, state?: string): Promise<{ lat: number; lng: number; name: string } | null> {
    const trimmedCity = city.trim();
    // Open-Meteo geocoding works best with just the city name
    // Try city alone first (most reliable), then with country filter
    const queries = [trimmedCity, `${trimmedCity} ${state || ''}`.trim()];

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          name: query,
          count: '5',
          language: 'pt',
          format: 'json',
        });
        const response = await fetch(`${GEOCODE_URL}?${params}`);
        if (!response.ok) continue;
        const data = await response.json();
        if (!data.results || data.results.length === 0) continue;
        // Prefer Brazilian results
        const brResult = data.results.find((r: any) => r.country_code === 'BR');
        const r = brResult || data.results[0];
        return { lat: r.latitude, lng: r.longitude, name: r.name };
      } catch {
        continue;
      }
    }
    return null;
  },

  async getDailyForecast(lat: number, lng: number): Promise<DailyForecast[]> {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode',
      timezone: 'auto',
      forecast_days: '7',
    });

    const response = await fetch(`${BASE_URL}?${params}`);
    if (!response.ok) throw new Error('Erro ao buscar previsão');

    const data = await response.json();
    const daily = data.daily;

    return daily.time.map((date: string, i: number) => ({
      date,
      temperatureMax: Math.round(daily.temperature_2m_max[i]),
      temperatureMin: Math.round(daily.temperature_2m_min[i]),
      precipitationProbability: daily.precipitation_probability_max[i] ?? 0,
      weatherCode: daily.weathercode[i],
    }));
  },
};
