import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';

export default function SobreScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sobre</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.logoSection}>
        <Image source={require('../assets/vertical.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appName}>Copa Café</Text>
        <Text style={styles.version}>Versão 1.0.0</Text>
        <Text style={styles.tagline}>Gestão inteligente para cafeicultores</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>O que é o Copa Café?</Text>
        <Text style={styles.cardText}>
          O Copa Café é um aplicativo de gestão completo para produtores de café. Acompanhe suas lavouras, gerencie lotes, monitore cotações em tempo real e tome decisões mais inteligentes para o seu negócio.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Funcionalidades</Text>
        <View style={styles.featureRow}><Feather name="check-circle" size={16} color={colors.primary} /><Text style={styles.featureText}>Gestão de lotes e rastreabilidade</Text></View>
        <View style={styles.featureRow}><Feather name="check-circle" size={16} color={colors.primary} /><Text style={styles.featureText}>Diário de campo com calendário</Text></View>
        <View style={styles.featureRow}><Feather name="check-circle" size={16} color={colors.primary} /><Text style={styles.featureText}>Cotações do café em tempo real</Text></View>
        <View style={styles.featureRow}><Feather name="check-circle" size={16} color={colors.primary} /><Text style={styles.featureText}>Previsão do tempo por localização</Text></View>
        <View style={styles.featureRow}><Feather name="check-circle" size={16} color={colors.primary} /><Text style={styles.featureText}>Análise de saúde da planta com IA</Text></View>
        <View style={styles.featureRow}><Feather name="check-circle" size={16} color={colors.primary} /><Text style={styles.featureText}>Controle de custos de produção</Text></View>
      </View>

      <Text style={styles.footer}>Feito com amor para os cafeicultores do Brasil</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  logoSection: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 80, height: 80, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  appName: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.primary },
  version: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  tagline: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  cardText: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  featureText: { fontSize: fontSize.md, color: colors.text },
  footer: { textAlign: 'center', fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.lg },
});
