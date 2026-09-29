import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';

const FAQ = [
  { q: 'Como cadastrar um novo lote?', a: 'Na tela "Lotes", toque no botão "+" no canto inferior direito. Preencha as informações do lote como variedade, processo, safra e quantidade de sacas.' },
  { q: 'Como registrar uma atividade de campo?', a: 'Vá em Fazenda → Diário de Campo. Selecione um dia no calendário e toque no "+" para adicionar uma atividade (adubação, poda, colheita, etc.).' },
  { q: 'Como acompanhar as cotações do café?', a: 'Na aba "Cotações" você encontra os preços atualizados do Arábica e Conilon, além do câmbio USD/BRL.' },
  { q: 'Como analisar a saúde da minha planta?', a: 'Na aba Home, toque em "Saúde da Planta" nos atalhos rápidos. Tire uma foto ou escolha da galeria e a IA vai analisar possíveis doenças.' },
  { q: 'Meus dados estão seguros?', a: 'Sim. Seus dados trafegam criptografados (HTTPS) e ficam protegidos com controle de acesso — só você vê as informações da sua fazenda. Seguimos a LGPD: em Perfil → Privacidade você pode exportar ou excluir seus dados.' },
  { q: 'Como alterar minha senha?', a: 'Vá em Perfil → Segurança → Alterar Senha. Digite a nova senha e confirme.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={styles.faqItem} onPress={() => setOpen(!open)}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{q}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textLight} />
      </View>
      {open && <Text style={styles.faqAnswer}>{a}</Text>}
    </TouchableOpacity>
  );
}

export default function AjudaScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Voltar">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajuda</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.sectionTitle}>Perguntas Frequentes</Text>
      {FAQ.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md },
  faqItem: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  faqAnswer: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginTop: spacing.md },
});
