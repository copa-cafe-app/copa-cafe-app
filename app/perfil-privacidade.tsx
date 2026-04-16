import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function PrivacidadeScreen() {
  const { user } = useAuthStore();

  function handleExportData() {
    Alert.alert('Exportar Dados', 'Seus dados serão enviados para o email cadastrado em até 48 horas.\n\nDeseja continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Solicitar', onPress: () => Alert.alert('Solicitação enviada', 'Você receberá seus dados por email.') },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert('Excluir Conta', 'Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos.\n\nTem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir minha conta', style: 'destructive', onPress: () => Alert.alert('Atenção', 'Entre em contato com o suporte para confirmar a exclusão.') },
    ]);
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
        <TouchableOpacity style={styles.actionBtn} onPress={handleExportData}>
          <Feather name="download" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Exportar meus dados</Text>
            <Text style={styles.actionSub}>Receba uma cópia dos seus dados por email</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleDeleteAccount}>
          <Feather name="trash-2" size={20} color={colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: colors.error }]}>Excluir minha conta</Text>
            <Text style={styles.actionSub}>Remover todos os dados permanentemente</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textLight} />
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
