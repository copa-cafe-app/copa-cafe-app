import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useWeatherStore } from '../src/stores/weatherStore';
import { useAuthStore } from '../src/stores/authStore';
import { userService } from '../src/services/user.service';

// WMO weather code to Feather icon + description (PT-BR)
function getWeatherInfo(code: number): { icon: string; description: string } {
  if (code <= 1) return { icon: 'sun', description: 'Céu limpo' };
  if (code <= 3) return { icon: 'cloud', description: 'Parcialmente nublado' };
  if (code >= 45 && code <= 48) return { icon: 'cloud', description: 'Nevoeiro' };
  if (code >= 51 && code <= 67) return { icon: 'cloud-rain', description: 'Chuva' };
  if (code >= 71 && code <= 77) return { icon: 'cloud-snow', description: 'Neve' };
  if (code >= 80 && code <= 82) return { icon: 'cloud-drizzle', description: 'Pancadas' };
  if (code >= 95 && code <= 99) return { icon: 'cloud-lightning', description: 'Tempestade' };
  return { icon: 'cloud', description: 'Nublado' };
}

function getConfidence(dayIndex: number): { label: string; color: string } {
  if (dayIndex <= 1) return { label: 'Alta', color: colors.success };
  if (dayIndex <= 4) return { label: 'Média', color: colors.warning };
  return { label: 'Baixa', color: colors.textLight };
}

function formatDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[date.getDay()];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

export default function PrevisaoScreen() {
  const { forecast, forecastLoading, forecastError, fetchForecast, cityName } = useWeatherStore();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    if (!user?.id) { fetchForecast(); setLoaded(true); return; }
    userService.getPropriedades(user.id).then((props) => {
      const first = props[0];
      if (first?.municipio) {
        fetchForecast(first.municipio, first.estado);
      } else {
        fetchForecast();
      }
      setLoaded(true);
    }).catch(() => { fetchForecast(); setLoaded(true); });
  }, [user?.id]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Voltar">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Previsão 7 dias</Text>
          {cityName && <Text style={styles.headerSubtitle}>{cityName}</Text>}
        </View>
        <Feather name="calendar" size={20} color={colors.primaryLight} />
      </View>

      {forecastLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Buscando previsão...</Text>
        </View>
      ) : forecastError ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={40} color={colors.error} />
          <Text style={styles.errorText}>{forecastError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoaded(false); }}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}>
          {/* Legend */}
          <View style={styles.legendRow}>
            <Text style={styles.legendTitle}>Confiabilidade:</Text>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendLabel}>Alta</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.legendLabel}>Média</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.textLight }]} />
              <Text style={styles.legendLabel}>Baixa</Text>
            </View>
          </View>

          {forecast?.map((day, index) => {
            const weatherInfo = getWeatherInfo(day.weatherCode);
            const confidence = getConfidence(index);
            const isToday = index === 0;

            return (
              <View key={day.date} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                {/* Confidence bar on left */}
                <View style={[styles.confidenceBar, { backgroundColor: confidence.color }]} />

                <View style={styles.dayContent}>
                  {/* Date row */}
                  <View style={styles.dayHeader}>
                    <View>
                      <Text style={styles.dayOfWeek}>
                        {isToday ? 'Hoje' : formatDayOfWeek(day.date)}
                      </Text>
                      <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
                    </View>
                    <View style={styles.confidenceBadge}>
                      <Text style={[styles.confidenceText, { color: confidence.color }]}>
                        {confidence.label}
                      </Text>
                    </View>
                  </View>

                  {/* Weather info row */}
                  <View style={styles.weatherRow}>
                    <View style={styles.weatherIconContainer}>
                      <Feather
                        name={weatherInfo.icon as any}
                        size={28}
                        color={weatherInfo.icon === 'sun' ? colors.warning : colors.primaryLight}
                      />
                    </View>

                    <View style={styles.tempContainer}>
                      <Text style={styles.tempMax}>{day.temperatureMax}°</Text>
                      <Text style={styles.tempMin}>{day.temperatureMin}°</Text>
                    </View>

                    <View style={styles.detailsContainer}>
                      <Text style={styles.weatherDescription}>{weatherInfo.description}</Text>
                      <View style={styles.rainRow}>
                        <Feather name="droplet" size={13} color={colors.info} />
                        <Text style={styles.rainText}>{day.precipitationProbability}%</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          <Text style={styles.disclaimer}>
            Dados: Open-Meteo. Previsões para mais de 3 dias podem variar.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  retryText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  legendTitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  dayCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dayCardToday: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  confidenceBar: {
    width: 4,
  },
  dayContent: {
    flex: 1,
    padding: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  dayOfWeek: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  dayDate: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.sm,
  },
  confidenceText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  weatherIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempContainer: {
    alignItems: 'center',
    minWidth: 50,
  },
  tempMax: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  tempMin: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  detailsContainer: {
    flex: 1,
  },
  weatherDescription: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  rainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rainText: {
    fontSize: fontSize.sm,
    color: colors.info,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
