import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';

interface Alerta {
  id: string;
  tipo_cafe: 'ARABICA' | 'CONILON';
  condicao: 'ACIMA' | 'ABAIXO';
  preco_alvo: number;
  ativo: boolean;
  disparado: boolean;
}

export default function AlertasPrecoScreen() {
  const { user } = useAuthStore();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [tipoCafe, setTipoCafe] = useState<'ARABICA' | 'CONILON'>('ARABICA');
  const [condicao, setCondicao] = useState<'ACIMA' | 'ABAIXO'>('ACIMA');
  const [precoAlvo, setPrecoAlvo] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setLoading(true);
      supabase
        .from('alertas_preco')
        .select('*')
        .eq('produtor_id', user.id)
        .order('criado_em', { ascending: false })
        .then(({ data }) => {
          if (data) setAlertas(data as Alerta[]);
          setLoading(false);
        });
    }, [user?.id])
  );

  async function handleCreate() {
    if (!precoAlvo || !user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('alertas_preco').insert({
        produtor_id: user.id,
        tipo_cafe: tipoCafe,
        condicao,
        preco_alvo: parseFloat(precoAlvo.replace(',', '.')),
      });
      if (error) throw error;
      setShowModal(false);
      setPrecoAlvo('');
      // Reload
      const { data } = await supabase.from('alertas_preco').select('*').eq('produtor_id', user.id).order('criado_em', { ascending: false });
      if (data) setAlertas(data as Alerta[]);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível criar o alerta');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(alerta: Alerta) {
    await supabase.from('alertas_preco').update({ ativo: !alerta.ativo }).eq('id', alerta.id);
    setAlertas((prev) => prev.map((a) => a.id === alerta.id ? { ...a, ativo: !a.ativo } : a));
  }

  async function handleDelete(id: string) {
    Alert.alert('Excluir alerta', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          await supabase.from('alertas_preco').delete().eq('id', id);
          setAlertas((prev) => prev.filter((a) => a.id !== id));
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alertas de Preço</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {alertas.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Nenhum alerta configurado</Text>
              <Text style={styles.emptySubtext}>Crie um alerta para ser notificado quando o preço atingir seu alvo</Text>
            </View>
          ) : (
            alertas.map((a) => (
              <View key={a.id} style={[styles.card, !a.ativo && styles.cardInactive]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTop}>
                    <View style={[styles.badge, { backgroundColor: a.tipo_cafe === 'ARABICA' ? '#E8F5E9' : '#FFF3E0' }]}>
                      <Text style={[styles.badgeText, { color: a.tipo_cafe === 'ARABICA' ? colors.success : '#E65100' }]}>
                        {a.tipo_cafe === 'ARABICA' ? 'Arábica' : 'Conilon'}
                      </Text>
                    </View>
                    {a.disparado && (
                      <View style={[styles.badge, { backgroundColor: '#E3F2FD' }]}>
                        <Text style={[styles.badgeText, { color: '#1565C0' }]}>Disparado</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardCondition}>
                    {a.condicao === 'ACIMA' ? 'Acima de' : 'Abaixo de'}{' '}
                    <Text style={styles.cardPrice}>R$ {a.preco_alvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => handleToggle(a)} style={styles.toggleBtn}>
                    <Feather name={a.ativo ? 'bell' : 'bell-off'} size={18} color={a.ativo ? colors.primary : colors.textLight} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(a.id)} style={styles.deleteBtn}>
                    <Feather name="trash-2" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Feather name="plus" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Modal criar alerta */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Novo Alerta</Text>

            <Text style={styles.label}>Tipo de café</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn2, tipoCafe === 'ARABICA' && styles.toggleBtn2Active]}
                onPress={() => setTipoCafe('ARABICA')}
              >
                <Text style={[styles.toggleText, tipoCafe === 'ARABICA' && styles.toggleTextActive]}>Arábica</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn2, tipoCafe === 'CONILON' && styles.toggleBtn2Active]}
                onPress={() => setTipoCafe('CONILON')}
              >
                <Text style={[styles.toggleText, tipoCafe === 'CONILON' && styles.toggleTextActive]}>Conilon</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Condição</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn2, condicao === 'ACIMA' && styles.toggleBtn2Active]}
                onPress={() => setCondicao('ACIMA')}
              >
                <Feather name="arrow-up" size={16} color={condicao === 'ACIMA' ? colors.white : colors.text} />
                <Text style={[styles.toggleText, condicao === 'ACIMA' && styles.toggleTextActive]}>Acima de</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn2, condicao === 'ABAIXO' && styles.toggleBtn2Active]}
                onPress={() => setCondicao('ABAIXO')}
              >
                <Feather name="arrow-down" size={16} color={condicao === 'ABAIXO' ? colors.white : colors.text} />
                <Text style={[styles.toggleText, condicao === 'ABAIXO' && styles.toggleTextActive]}>Abaixo de</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Preço alvo (R$/saca)</Text>
            <View style={styles.priceRow}>
              <Text style={styles.prefix}>R$</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={precoAlvo}
                onChangeText={setPrecoAlvo}
                placeholder="2.000,00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!precoAlvo || saving) && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={!precoAlvo || saving}
              >
                <Text style={styles.saveText}>{saving ? 'Salvando...' : 'Criar Alerta'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 72, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  list: { padding: spacing.md, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardInactive: { opacity: 0.5 },
  cardTop: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  badgeText: { fontSize: fontSize.xs, fontWeight: '600' },
  cardCondition: { fontSize: fontSize.md, color: colors.textSecondary },
  cardPrice: { fontWeight: '700', color: colors.text },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn: { padding: spacing.sm },
  deleteBtn: { padding: spacing.sm },
  fab: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg, padding: spacing.lg },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn2: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, height: 44, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  toggleBtn2Active: { borderColor: colors.primary, backgroundColor: colors.primary },
  toggleText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  toggleTextActive: { color: colors.white },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prefix: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.lg, color: colors.text },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  saveBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});
