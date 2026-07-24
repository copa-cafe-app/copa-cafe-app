import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';

interface Certificacao {
  id: string;
  tipo: string;
  certificadora: string | null;
  numero_certificado: string | null;
  validade: string | null;
  status: string;
}

const TIPOS_CERT = [
  'UTZ/Rainforest Alliance',
  'Rainforest Alliance',
  'Orgânico (IBD)',
  'Orgânico (Ecocert)',
  '4C Association',
  'Certifica Minas Café',
  'Fair Trade',
  'C.A.F.E. Practices (Starbucks)',
  'Nespresso AAA',
  'Cup of Excellence',
  'Outro',
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  ATIVO: { label: 'Ativo', color: '#2E7D32', bg: '#E8F5E9' },
  VENCIDO: { label: 'Vencido', color: '#C62828', bg: '#FFEBEE' },
  EM_RENOVACAO: { label: 'Em Renovação', color: '#F57F17', bg: '#FFF8E1' },
  CANCELADO: { label: 'Cancelado', color: '#666', bg: '#E8E8E8' },
};

export default function CertificacoesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [certs, setCerts] = useState<Certificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tipo, setTipo] = useState('');
  const [certificadora, setCertificadora] = useState('');
  const [numero, setNumero] = useState('');
  const [validade, setValidade] = useState('');
  const [showTipos, setShowTipos] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setLoading(true);
      supabase
        .from('certificacoes')
        .select('*')
        .eq('produtor_id', user.id)
        .order('criado_em', { ascending: false })
        .then(({ data }) => {
          if (data) setCerts(data as Certificacao[]);
          setLoading(false);
        });
    }, [user?.id])
  );

  async function handleSave() {
    if (!tipo || !user?.id) return;
    setSaving(true);
    try {
      // Get propriedade_id
      const { data: prop } = await supabase.from('propriedades').select('id').eq('produtor_id', user.id).limit(1).maybeSingle();

      const { error } = await supabase.from('certificacoes').insert({
        produtor_id: user.id,
        propriedade_id: prop?.id || null,
        tipo,
        certificadora: certificadora || null,
        numero_certificado: numero || null,
        validade: validade || null,
      });
      if (error) throw error;
      setShowModal(false);
      setTipo(''); setCertificadora(''); setNumero(''); setValidade('');
      // Reload
      const { data } = await supabase.from('certificacoes').select('*').eq('produtor_id', user.id).order('criado_em', { ascending: false });
      if (data) setCerts(data as Certificacao[]);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Excluir', 'Remover esta certificação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          await supabase.from('certificacoes').delete().eq('id', id);
          setCerts((prev) => prev.filter((c) => c.id !== id));
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
        <Text style={styles.headerTitle}>Certificações</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {certs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="award" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Nenhuma certificação</Text>
              <Text style={styles.emptySubtext}>Adicione suas certificações para valorizar seus lotes</Text>
            </View>
          ) : (
            certs.map((c) => {
              const st = statusConfig[c.status] || statusConfig.ATIVO;
              return (
                <TouchableOpacity key={c.id} style={styles.card} onLongPress={() => handleDelete(c.id)}>
                  <View style={styles.cardIcon}>
                    <Feather name="award" size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTipo}>{c.tipo}</Text>
                    {c.certificadora && <Text style={styles.cardSub}>{c.certificadora}</Text>}
                    {c.numero_certificado && <Text style={styles.cardSub}>N° {c.numero_certificado}</Text>}
                    {c.validade && (
                      <Text style={styles.cardSub}>
                        Validade: {new Date(c.validade + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={[styles.fab, { bottom: spacing.lg + insets.bottom }]} onPress={() => setShowModal(true)}>
        <Feather name="plus" size={26} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Nova Certificação</Text>

            <Text style={styles.label}>Tipo de certificação</Text>
            <TouchableOpacity style={styles.select} onPress={() => setShowTipos(!showTipos)}>
              <Text style={tipo ? styles.selectValue : styles.selectPlaceholder}>{tipo || 'Selecione'}</Text>
              <Feather name="chevron-down" size={16} color={colors.textLight} />
            </TouchableOpacity>
            {showTipos && (
              <View style={styles.dropdown}>
                {TIPOS_CERT.map((t) => (
                  <TouchableOpacity key={t} style={styles.dropItem} onPress={() => { setTipo(t); setShowTipos(false); }}>
                    <Text style={styles.dropText}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Certificadora (opcional)</Text>
            <TextInput style={styles.input} value={certificadora} onChangeText={setCertificadora} placeholder="Nome da certificadora" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Número do certificado (opcional)</Text>
            <TextInput style={styles.input} value={numero} onChangeText={setNumero} placeholder="Ex: BR-2026-001234" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Validade (opcional)</Text>
            <TextInput style={styles.input} value={validade} onChangeText={setValidade} placeholder="AAAA-MM-DD" placeholderTextColor={colors.textLight} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, (!tipo || saving) && { opacity: 0.5 }]} onPress={handleSave} disabled={!tipo || saving}>
                <Text style={styles.saveText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
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
  emptySubtext: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.xs, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  cardIcon: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  cardTipo: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  cardSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  statusText: { fontSize: fontSize.xs, fontWeight: '600' },
  fab: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  selectValue: { fontSize: fontSize.md, color: colors.text },
  selectPlaceholder: { fontSize: fontSize.md, color: colors.textLight },
  dropdown: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginTop: 4, maxHeight: 200 },
  dropItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropText: { fontSize: fontSize.md, color: colors.text },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.lg },
  cancelBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  saveBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});
