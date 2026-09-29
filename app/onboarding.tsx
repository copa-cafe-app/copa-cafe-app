import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useRef } from 'react';
import { FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';

const { width } = Dimensions.get('window');

const slides = [
  {
    icon: 'sun',
    title: 'Gestão da Fazenda',
    subtitle: 'Controle talhões, atividades de campo e custos de produção em um só lugar.',
    color: '#2E7D32',
    bg: '#E8F5E9',
  },
  {
    icon: 'trending-up',
    title: 'Cotações em Tempo Real',
    subtitle: 'Acompanhe o preço do café arábica e conilon, configure alertas e simule suas vendas.',
    color: '#1565C0',
    bg: '#E3F2FD',
  },
  {
    icon: 'package',
    title: 'Lotes e Rastreabilidade',
    subtitle: 'Cadastre seus lotes com QR Code, compartilhe via WhatsApp e conecte-se com compradores.',
    color: '#E65100',
    bg: '#FFF3E0',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const { setOnboardingDone } = useAuthStore();
  const insets = useSafeAreaInsets();

  async function handleFinish() {
    await AsyncStorage.setItem('@copa_cafe_onboarding_done', 'true');
    setOnboardingDone(true);
    router.replace('/(auth)/login');
  }

  function handleNext() {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  }

  return (
    <View style={styles.container}>
      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleFinish}>
        <Text style={styles.skipText}>Pular</Text>
      </TouchableOpacity>

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/vertical.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(idx);
        }}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
              <Feather name={item.icon as any} size={48} color={item.color} />
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
        ))}
      </View>

      {/* Button */}
      <TouchableOpacity style={[styles.nextBtn, { marginBottom: 40 + insets.bottom }]} onPress={handleNext}>
        <Text style={styles.nextText}>
          {currentIndex === slides.length - 1 ? 'Começar' : 'Próximo'}
        </Text>
        <Feather name={currentIndex === slides.length - 1 ? 'check' : 'arrow-right'} size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  skipBtn: { position: 'absolute', top: 60, right: spacing.lg, zIndex: 10 },
  skipText: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '600' },
  logoContainer: { alignItems: 'center', marginTop: 80, marginBottom: spacing.lg },
  logo: { width: 200, height: 170 },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  slideTitle: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  slideSubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.md },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.primary },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, height: 56, borderRadius: borderRadius.md, marginHorizontal: spacing.lg, marginBottom: 40 },
  nextText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '700' },
});
