import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';

const STORAGE_KEY = '@copa_cafe_notif_prefs';

interface Prefs {
  push: boolean;
  alertasPreco: boolean;
  lembretesDiario: boolean;
  avisosClima: boolean;
  novidades: boolean;
  email: boolean;
  sms: boolean;
}

const DEFAULT_PREFS: Prefs = {
  push: true,
  alertasPreco: true,
  lembretesDiario: true,
  avisosClima: true,
  novidades: false,
  email: true,
  sms: true,
};

function Row({ icon, title, subtitle, value, onValueChange, disabled }: {
  icon: string; title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.45 }]}>
      <View style={styles.rowIcon}>
        <Feather name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export default function NotificacoesConfigScreen() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) }); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  function update(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const pushOff = !prefs.push;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificações</Text>
        <View style={{ width: 40 }} />
      </View>

      {!loaded ? null : (
        <>
          <View style={styles.card}>
            <Row
              icon="bell"
              title="Notificações push"
              subtitle="Receber alertas no celular"
              value={prefs.push}
              onValueChange={(v) => update('push', v)}
            />
          </View>

          <Text style={styles.sectionLabel}>O que você quer receber</Text>
          <View style={styles.card}>
            <Row icon="trending-up" title="Alertas de preço" subtitle="Quando a cotação atingir seu alvo" value={prefs.alertasPreco} onValueChange={(v) => update('alertasPreco', v)} disabled={pushOff} />
            <View style={styles.divider} />
            <Row icon="book-open" title="Lembretes do diário" subtitle="Para manter seu diário de campo em dia" value={prefs.lembretesDiario} onValueChange={(v) => update('lembretesDiario', v)} disabled={pushOff} />
            <View style={styles.divider} />
            <Row icon="cloud" title="Avisos de clima" subtitle="Chuva e condições para manejo" value={prefs.avisosClima} onValueChange={(v) => update('avisosClima', v)} disabled={pushOff} />
            <View style={styles.divider} />
            <Row icon="tag" title="Novidades e marketplace" subtitle="Produtos e novidades do app" value={prefs.novidades} onValueChange={(v) => update('novidades', v)} disabled={pushOff} />
          </View>

          <Text style={styles.sectionLabel}>Outros canais</Text>
          <View style={styles.card}>
            <Row icon="mail" title="Email" subtitle="Resumos e avisos importantes por email" value={prefs.email} onValueChange={(v) => update('email', v)} />
            <View style={styles.divider} />
            <Row icon="message-square" title="SMS" subtitle="Avisos críticos por SMS" value={prefs.sms} onValueChange={(v) => update('sms', v)} />
          </View>

          <Text style={styles.footnote}>As notificações push serão ativadas em uma próxima atualização do app. Suas preferências já ficam salvas.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textLight, textTransform: 'uppercase', marginBottom: spacing.sm, marginLeft: spacing.xs, marginTop: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  rowSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 36 + spacing.md },
  footnote: { fontSize: fontSize.xs, color: colors.textLight, lineHeight: 18, marginTop: spacing.md, marginHorizontal: spacing.xs },
});
