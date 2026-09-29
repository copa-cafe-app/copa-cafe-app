import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { validatePassword } from '../src/utils/validators';
import { supabase } from '../src/services/supabase';

export default function SegurancaScreen() {
  const [showModal, setShowModal] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  function openModal() {
    setNovaSenha('');
    setConfirmar('');
    setError('');
    setShowPassword(false);
    setShowModal(true);
  }

  async function handleChangePassword() {
    const senhaCheck = validatePassword(novaSenha);
    if (!senhaCheck.valid) { setError(senhaCheck.message!); return; }
    if (novaSenha !== confirmar) { setError('As senhas não conferem'); return; }
    setSaving(true);
    setError('');
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: novaSenha });
      if (updErr) throw updErr;
      setShowModal(false);
      Alert.alert('Sucesso', 'Senha alterada com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Não foi possível alterar a senha');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Voltar">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Segurança</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardIcon}>
            <Feather name="key" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Senha</Text>
            <Text style={styles.cardSubtitle}>Altere a senha de acesso à sua conta</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.changeBtn} onPress={openModal}>
          <Feather name="lock" size={16} color={colors.primary} />
          <Text style={styles.changeBtnText}>Alterar senha</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sessão</Text>
        <Text style={styles.infoText}>Você está logado neste dispositivo. Para sair, vá em Perfil → Sair da conta.</Text>
      </View>

      {/* Modal de alteração de senha */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alterar senha</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Fechar">
                <Feather name="x" size={22} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nova senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={novaSenha}
                  onChangeText={(v) => { setNovaSenha(v); setError(''); }}
                  secureTextEntry={!showPassword}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor={colors.textLight}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textLight} />
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>1 maiúscula, 1 número, mín. 8 caracteres</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirmar nova senha</Text>
              <TextInput
                style={styles.input}
                value={confirmar}
                onChangeText={(v) => { setConfirmar(v); setError(''); }}
                secureTextEntry={!showPassword}
                placeholder="Repita a nova senha"
                placeholderTextColor={colors.textLight}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, saving && { opacity: 0.5 }]} onPress={handleChangePassword} disabled={saving}>
                <Text style={styles.confirmBtnText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  cardIcon: { width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  changeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 46, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface },
  changeBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginTop: spacing.xs },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  modalContent: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  field: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: spacing.md },
  hint: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 4 },
  errorText: { fontSize: fontSize.sm, color: colors.error, marginBottom: spacing.sm },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  confirmBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: fontSize.md, fontWeight: '700', color: colors.white },
});
