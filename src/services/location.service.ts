import * as Location from 'expo-location';

export const locationService = {
  async requestPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  async getCurrentLocation() {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    };
  },

  async getCityName(lat: number, lng: number) {
    const [result] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!result) return null;
    return result.city || result.subregion || result.region || null;
  },
};
