import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/stores/authStore';

function SectionButton({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.sectionButton} onPress={onPress}>
      <View style={styles.sectionIcon}>
        <Feather name={icon as any} size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textLight} />
    </TouchableOpacity>
  );
}

interface Propriedade {
  id: string;
  nome: string;
  area_total_hectares: number;
  altitude_metros: number | null;
  regiao_cafeeira: string | null;
}

export default function FazendaScreen() {
  const { user } = useAuthStore();
  const [propriedade, setPropriedade] = useState<Propriedade | null>(null);
  const [talhoesCount, setTalhoesCount] = useState(0);
  const [totalDespesas, setTotalDespesas] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setLoading(true);

      Promise.all([
        supabase.from('propriedades').select('*').eq('produtor_id', user.id).limit(1).single(),
        supabase.from('talhoes').select('id', { count: 'exact', head: true }).eq('produtor_id', user.id),
        supabase.from('despesas_producao').select('valor').eq('produtor_id', user.id),
      ]).then(([propRes, talRes, despRes]) => {
        if (propRes.data) setPropriedade(propRes.data as Propriedade);
        if (talRes.count != null) setTalhoesCount(talRes.count);
        if (despRes.data) setTotalDespesas(despRes.data.reduce((sum: number, d: any) => sum + (d.valor || 0), 0));
      }).finally(() => setLoading(false));
    }, [user?.id])
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header da Propriedade */}
      <View style={styles.card}>
        <View style={styles.propHeader}>
          <View style={styles.propIcon}>
            <Feather name="map-pin" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.propName}>{propriedade?.nome || 'Sem propriedade'}</Text>
            <Text style={styles.propDetail}>
              {propriedade?.regiao_cafeeira || 'Região não informada'} • {propriedade?.area_total_hectares || 0} hectares
            </Text>
            {propriedade?.altitude_metros && (
              <Text style={styles.propDetail}>Altitude: {propriedade.altitude_metros}m</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => router.push('/perfil-propriedade')}>
            <Feather name="edit-2" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Seções */}
      <SectionButton
        icon="grid"
        title="Talhões"
        subtitle={talhoesCount > 0 ? `${talhoesCount} talhão(ões) cadastrado(s)` : 'Nenhum talhão cadastrado'}
        onPress={() => router.push('/talhoes')}
      />
      <SectionButton
        icon="book-open"
        title="Diário de Campo"
        subtitle="Calendário de atividades"
        onPress={() => router.push('/diario')}
      />
      <SectionButton
        icon="dollar-sign"
        title="Custos de Produção"
        subtitle={totalDespesas > 0 ? `Safra 2025/26 • R$ ${totalDespesas.toLocaleString('pt-BR')}` : 'Nenhuma despesa registrada'}
        onPress={() => router.push('/custos')}
      />

      {/* Análise de Planta */}
      <SectionButton
        icon="camera"
        title="Análise de Planta"
        subtitle="Tire uma foto para diagnóstico"
        onPress={() => router.push('/analise-planta')}
      />
      {/* Marketplace escondido até ter pagamento real — reativar com SectionButton → /marketplace */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  propHeader: { flexDirection: 'row', alignItems: 'center' },
  propIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  propName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  propDetail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 1 },
  sectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  sectionSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
});
