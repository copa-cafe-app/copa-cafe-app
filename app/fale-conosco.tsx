import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/constants/config';

const MAX = 200;

export default function FaleConoscoScreen() {
  const { profile } = useAuthStore();
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function handleEnviar() {
    if (!mensagem.trim()) { setError('Escreva sua mensagem'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/fale-conosco`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          nome: profile?.nome || '',
          telefone: profile?.telefone || '',
          mensagem: mensagem.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível enviar');
      setEnviado(true);
    } catch (err: any) {
      setError(err.message || 'Não foi possível enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <View style={[styles.container, { paddingTop: 72, paddingHorizontal: spacing.md }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fale Conosco</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.successBox}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={36} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Mensagem enviada!</Text>
          <Text style={styles.successText}>Recebemos sua mensagem e entraremos em contato pelo telefone cadastrado.</Text>
          <TouchableOpacity style={styles.sendBtn} onPress={() => router.back()}>
            <Text style={styles.sendBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fale Conosco</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.iconCircle}>
        <Feather name="message-circle" size={32} color={colors.primary} />
      </View>

      <Text style={styles.title}>Como podemos ajudar?</Text>
      <Text style={styles.subtitle}>
        Escreva sua mensagem e nossa equipe entrará em contato pelo telefone cadastrado na sua conta.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Sua mensagem</Text>
        <TextInput
          style={styles.textarea}
          value={mensagem}
          onChangeText={(v) => { setMensagem(v.slice(0, MAX)); setError(''); }}
          placeholder="Conte pra gente o que você precisa..."
          placeholderTextColor={colors.textLight}
          multiline
          maxLength={MAX}
          textAlignVertical="top"
        />
        <Text style={styles.counter}>{mensagem.length}/{MAX}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <TouchableOpacity
        style={[styles.sendBtn, (loading || !mensagem.trim()) && { opacity: 0.5 }]}
        onPress={handleEnviar}
        disabled={loading || !mensagem.trim()}
      >
        {loading ? <ActivityIndicator color={colors.white} /> : (
          <>
            <Feather name="send" size={18} color={colors.white} />
            <Text style={styles.sendBtnText}>Enviar mensagem</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  field: { marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  textarea: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, fontSize: fontSize.md, color: colors.text, minHeight: 120,
  },
  counter: { fontSize: fontSize.xs, color: colors.textLight, textAlign: 'right', marginTop: 4 },
  errorText: { fontSize: fontSize.sm, color: colors.error, marginTop: 4 },
  sendBtn: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  successTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  successText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
});
