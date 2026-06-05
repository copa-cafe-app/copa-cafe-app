import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { supabase } from '../src/services/supabase';
import { SUPABASE_URL } from '../src/constants/config';

export default function PrivacidadeScreen() {
  const { signOut } = useAuthStore();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function callFn(name: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha na operação');
    return data;
  }

  function handleExportData() {
    Alert.alert('Exportar Dados', 'Vamos reunir seus dados e enviar para o email cadastrado na sua conta.\n\nDeseja continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Solicitar',
        onPress: async () => {
          setExporting(true);
          try {
            await callFn('export-data');
            Alert.alert('Pronto!', 'Enviamos uma cópia dos seus dados para o seu email. Confira a caixa de entrada (e o spam).');
          } catch (err: any) {
            Alert.alert('Não foi possível exportar', err.message || 'Tente novamente mais tarde.');
          } finally {
            setExporting(false);
          }
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Excluir Conta',
      'Esta ação é irreversível. Sua conta e TODOS os seus dados (fazenda, lotes, diário, custos) serão permanentemente excluídos.\n\nTem certeza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir minha conta',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await callFn('delete-account');
              await signOut();
              Alert.alert('Conta excluída', 'Sua conta e seus dados foram removidos.');
              router.replace('/(auth)/login');
            } catch (err: any) {
              Alert.alert('Não foi possível excluir', err.message || 'Tente novamente mais tarde.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacidade (LGPD)</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Seus Direitos</Text>
        <Text style={styles.cardText}>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</Text>
        <View style={styles.rightRow}><Feather name="check" size={16} color={colors.primary} /><Text style={styles.rightText}>Acessar seus dados pessoais</Text></View>
        <View style={styles.rightRow}><Feather name="check" size={16} color={colors.primary} /><Text style={styles.rightText}>Corrigir dados incompletos ou incorretos</Text></View>
        <View style={styles.rightRow}><Feather name="check" size={16} color={colors.primary} /><Text style={styles.rightText}>Solicitar a exclusão dos seus dados</Text></View>
        <View style={styles.rightRow}><Feather name="check" size={16} color={colors.primary} /><Text style={styles.rightText}>Exportar seus dados em formato legível</Text></View>
        <View style={styles.rightRow}><Feather name="check" size={16} color={colors.primary} /><Text style={styles.rightText}>Revogar consentimentos</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ações</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleExportData} disabled={exporting || deleting}>
          <Feather name="download" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Exportar meus dados</Text>
            <Text style={styles.actionSub}>Receba uma cópia dos seus dados por email</Text>
          </View>
          {exporting ? <ActivityIndicator color={colors.primary} /> : <Feather name="chevron-right" size={18} color={colors.textLight} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleDeleteAccount} disabled={exporting || deleting}>
          <Feather name="trash-2" size={20} color={colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: colors.error }]}>Excluir minha conta</Text>
            <Text style={styles.actionSub}>Remover todos os dados permanentemente</Text>
          </View>
          {deleting ? <ActivityIndicator color={colors.error} /> : <Feather name="chevron-right" size={18} color={colors.textLight} />}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  cardText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rightText: { fontSize: fontSize.sm, color: colors.text },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  actionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  actionSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
