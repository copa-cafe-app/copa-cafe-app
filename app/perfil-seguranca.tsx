import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';

export default function SegurancaScreen() {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleChangePassword() {
    if (novaSenha.length < 8) { Alert.alert('Erro', 'A nova senha deve ter no mínimo 8 caracteres'); return; }
    if (novaSenha !== confirmar) { Alert.alert('Erro', 'As senhas não conferem'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      Alert.alert('Sucesso', 'Senha alterada com sucesso!');
      setSenhaAtual(''); setNovaSenha(''); setConfirmar('');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível alterar a senha');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Segurança</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Alterar Senha</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nova senha</Text>
          <View style={styles.passwordRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={novaSenha} onChangeText={setNovaSenha} secureTextEntry={!showPassword} placeholder="Mínimo 8 caracteres" placeholderTextColor={colors.textLight} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirmar nova senha</Text>
          <TextInput style={styles.input} value={confirmar} onChangeText={setConfirmar} secureTextEntry={!showPassword} placeholder="Repita a nova senha" placeholderTextColor={colors.textLight} />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleChangePassword} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Alterar senha'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sessão</Text>
        <Text style={styles.infoText}>Você está logado neste dispositivo. Para sair, vá em Perfil → Sair da conta.</Text>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: spacing.md },
  saveBtn: { backgroundColor: colors.primary, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  saveBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
});
