import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { parseBRL } from '../src/utils/format';
import { mensagemErroAmigavel } from '../src/services/despesa.service';

interface Talhao {
  id: string;
  nome: string;
  area_hectares: number;
  variedade: string | null;
  altitude_metros: number | null;
  ano_plantio: number | null;
  status: string;
}

// Número BR -> string pro campo de edição (10.5 -> "10,5").
const numToInput = (n: number | null | undefined) =>
  n == null ? '' : String(n).replace('.', ',');

export default function TalhoesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [area, setArea] = useState('');
  const [variedade, setVariedade] = useState('');
  const [altitude, setAltitude] = useState('');
  const [anoPlantio, setAnoPlantio] = useState('');

  const loadTalhoes = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('talhoes')
      .select('*')
      .eq('produtor_id', user.id)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    setTalhoes((data || []) as Talhao[]);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setLoading(true);
      setLoadError(false);
      loadTalhoes()
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false));
    }, [user?.id, loadTalhoes])
  );

  function resetForm() {
    setEditingId(null);
    setNome(''); setArea(''); setVariedade(''); setAltitude(''); setAnoPlantio('');
  }

  function openNovo() {
    resetForm();
    setShowModal(true);
  }

  function openEditar(t: Talhao) {
    setEditingId(t.id);
    setNome(t.nome || '');
    setArea(numToInput(t.area_hectares));
    setVariedade(t.variedade || '');
    setAltitude(t.altitude_metros != null ? String(t.altitude_metros) : '');
    setAnoPlantio(t.ano_plantio != null ? String(t.ano_plantio) : '');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    resetForm();
  }

  async function handleSave() {
    const areaNum = parseBRL(area);
    if (!nome.trim() || areaNum == null || areaNum <= 0) { Alert.alert('Atenção', 'Preencha nome e uma área válida'); return; }
    if (!user?.id) return;
    // parseBRL aceita "1.050" (milhar) -> 1050; parseInt daria 1.
    const altNum = altitude ? parseBRL(altitude) : null;
    const anoNum = anoPlantio ? parseInt(anoPlantio.replace(/\D/g, ''), 10) : null;
    const fields = {
      nome: nome.trim(),
      area_hectares: areaNum,
      variedade: variedade.trim() || null,
      altitude_metros: altNum != null ? Math.round(altNum) : null,
      ano_plantio: anoNum != null && Number.isFinite(anoNum) ? anoNum : null,
    };
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('talhoes').update(fields).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('talhoes').insert({ produtor_id: user.id, ...fields });
        if (error) throw error;
      }
      Alert.alert('Sucesso', editingId ? 'Talhão atualizado!' : 'Talhão cadastrado!');
      closeModal();
      await loadTalhoes().catch(() => setLoadError(true));
    } catch (err) {
      Alert.alert('Erro', mensagemErroAmigavel(err, 'Não foi possível salvar o talhão. Tente novamente.'));
    } finally {
      setSaving(false);
    }
  }

  function handleExcluir(t: Talhao) {
    Alert.alert(
      'Excluir talhão?',
      `"${t.nome}" será apagado.\n\nAs despesas e lotes ligados a este talhão continuam salvos, mas ficam sem talhão.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('talhoes').delete().eq('id', t.id);
              if (error) throw error;
              setTalhoes((prev) => prev.filter((x) => x.id !== t.id));
            } catch (err) {
              Alert.alert('Erro', mensagemErroAmigavel(err, 'Não foi possível excluir o talhão. Tente novamente.'));
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Talhões</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: 100 + insets.bottom }]}>
          {loadError && (
            <TouchableOpacity
              style={styles.errorBox}
              onPress={() => {
                setLoading(true);
                setLoadError(false);
                loadTalhoes().catch(() => setLoadError(true)).finally(() => setLoading(false));
              }}
            >
              <Feather name="wifi-off" size={16} color={colors.error} />
              <Text style={styles.errorText}>Não foi possível carregar seus talhões. Toque para tentar de novo.</Text>
            </TouchableOpacity>
          )}
          {talhoes.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="grid" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Nenhum talhão cadastrado</Text>
              <Text style={styles.emptySubtext}>Toque no + para criar seu primeiro talhão</Text>
            </View>
          ) : (
            <>
              <Text style={styles.listHint}>Toque num talhão para editar</Text>
              {talhoes.map((t) => (
                <TouchableOpacity key={t.id} style={styles.card} onPress={() => openEditar(t)} activeOpacity={0.7}>
                  <View style={styles.cardIcon}>
                    <Feather name="grid" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{t.nome}</Text>
                    <Text style={styles.cardDetail}>{t.variedade || 'Sem variedade'} • {String(t.area_hectares).replace('.', ',')} ha</Text>
                    {(t.altitude_metros || t.ano_plantio) ? (
                      <Text style={styles.cardDetail}>
                        {t.altitude_metros ? `Altitude: ${t.altitude_metros}m` : ''}
                        {t.altitude_metros && t.ano_plantio ? ' • ' : ''}
                        {t.ano_plantio ? `Plantio: ${t.ano_plantio}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.actionBtn}>
                    <Feather name="edit-2" size={16} color={colors.primary} />
                  </View>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleExcluir(t)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    accessibilityLabel="Excluir talhão"
                  >
                    <Feather name="trash-2" size={16} color={colors.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={[styles.fab, { bottom: spacing.lg + insets.bottom }]} onPress={openNovo}>
        <Feather name="plus" size={26} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: spacing.lg + insets.bottom }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>{editingId ? 'Editar talhão' : 'Novo Talhão'}</Text>

            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: Talhão 5" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Área (hectares)</Text>
            <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="10" keyboardType="decimal-pad" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Variedade</Text>
            <TextInput style={styles.input} value={variedade} onChangeText={setVariedade} placeholder="Ex: Bourbon" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Altitude (metros)</Text>
            <TextInput style={styles.input} value={altitude} onChangeText={setAltitude} placeholder="1050" keyboardType="numeric" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Ano de plantio</Text>
            <TextInput style={styles.input} value={anoPlantio} onChangeText={setAnoPlantio} placeholder="2020" keyboardType="numeric" maxLength={4} placeholderTextColor={colors.textLight} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
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
  listHint: { fontSize: fontSize.xs, color: colors.textLight, marginBottom: spacing.sm },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.xs },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error, backgroundColor: colors.surface, marginBottom: spacing.md },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.error },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  cardName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  cardDetail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  actionBtn: { width: 36, height: 36, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  fab: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  saveBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});
