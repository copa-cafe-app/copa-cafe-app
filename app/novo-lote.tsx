import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Modal, FlatList, SafeAreaView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { supabase } from '../src/services/supabase';
import { coffeeVarieties } from '../src/constants/varieties';
import { safraAtual, safrasSelecao } from '../src/utils/safra';
import { parseBRL, formatBRL } from '../src/utils/format';
import { mensagemErroLote, type Lote } from '../src/services/lote.service';

const PROCESSOS = ['Natural', 'Lavado', 'Honey', 'Descascado', 'Cereja Descascado'];
const SAFRAS = safrasSelecao();
const BEBIDAS = ['Estritamente Mole', 'Mole', 'Apenas Mole', 'Dura', 'Riada', 'Rio', 'Rio Zona'];
const PENEIRAS = ['17/18', '16/17', '15/16', '14/15', '13', 'Moka', 'Bica corrida'];
const MAX_SACAS = 1_000_000;

/** Rótulo do picker a partir do valor salvo (ex.: "CEREJA_DESCASCADO" → "Cereja Descascado"). */
function processoLabelDoValor(valor: string): string {
  return PROCESSOS.find((p) => p.toUpperCase().replace(/ /g, '_') === valor) || '';
}

/**
 * Número inteiro digitado em padrão BR: "1.000" → 1000, "50" → 50.
 * Antes era parseInt, que lia "1.000" como 1 e aceitava NaN/0.
 * Retorna null se vazio, não numérico ou com casas decimais ("1,5").
 */
function parseInteiroBR(valor: string): number | null {
  const n = parseBRL(valor);
  if (n == null || !Number.isInteger(n)) return null;
  return n;
}

type PickerModalProps = {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

function PickerModal({ visible, title, options, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            )}
            style={styles.modalList}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default function NovoLoteScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  // Com ?id=... a tela vira "Editar lote" (pré-preenche e faz UPDATE).
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!editId;
  const [variedade, setVariedade] = useState('');
  const [variedadeOutro, setVariedadeOutro] = useState('');
  const [processo, setProcesso] = useState('');
  const [safra, setSafra] = useState(safraAtual());
  const [sacas, setSacas] = useState('');
  const [preco, setPreco] = useState('');
  const [bebida, setBebida] = useState('');
  const [peneira, setPeneira] = useState('');
  const [cata, setCata] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showVariedade, setShowVariedade] = useState(false);
  const [showProcesso, setShowProcesso] = useState(false);
  const [showBebida, setShowBebida] = useState(false);
  const [showPeneira, setShowPeneira] = useState(false);

  // Safra de um lote antigo pode não estar entre as 3 opções atuais.
  const safrasOpcoes = SAFRAS.includes(safra) ? SAFRAS : [...SAFRAS, safra];

  const carregarLote = useCallback(async () => {
    if (!editId || !user?.id) return;
    setLoadingEdit(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('id', editId)
        .eq('produtor_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setLoadError('Lote não encontrado. Ele pode ter sido excluído.');
        return;
      }
      const l = data as Lote;
      if (coffeeVarieties.includes(l.variedade)) {
        setVariedade(l.variedade);
      } else {
        setVariedade('Outro');
        setVariedadeOutro(l.variedade);
      }
      setProcesso(processoLabelDoValor(l.processo));
      setSafra(l.safra || safraAtual());
      setSacas(l.quantidade_sacas != null ? String(l.quantidade_sacas) : '');
      setPreco(l.preco_por_saca != null ? formatBRL(l.preco_por_saca, false) : '');
      setBebida(l.bebida || '');
      setPeneira(l.peneira || '');
      setCata(l.cata != null ? String(l.cata) : '');
      setNotas(l.notas_sensoriais || '');
    } catch (err) {
      setLoadError(mensagemErroLote(err, 'carregar o lote'));
    } finally {
      setLoadingEdit(false);
    }
  }, [editId, user?.id]);

  useEffect(() => {
    carregarLote();
  }, [carregarLote]);

  async function handleSave() {
    if (!variedade || !processo || !sacas.trim()) {
      Alert.alert('Atenção', 'Preencha variedade, processo e quantidade de sacas');
      return;
    }
    if (variedade === 'Outro' && !variedadeOutro.trim()) {
      Alert.alert('Atenção', 'Informe o nome da variedade');
      return;
    }
    const qtdSacas = parseInteiroBR(sacas);
    if (qtdSacas == null || qtdSacas <= 0) {
      Alert.alert('Quantidade inválida', 'Informe a quantidade de sacas em número inteiro, maior que zero (ex.: 50 ou 1.000).');
      return;
    }
    if (qtdSacas > MAX_SACAS) {
      Alert.alert('Quantidade inválida', 'Confira a quantidade de sacas — o número está alto demais.');
      return;
    }
    let precoNum: number | null = null;
    if (preco.trim()) {
      precoNum = parseBRL(preco);
      if (precoNum == null || precoNum <= 0) {
        Alert.alert('Preço inválido', 'Informe o preço por saca maior que zero (ex.: 1.480,00) ou deixe em branco.');
        return;
      }
    }
    let cataNum: number | null = null;
    if (cata.trim()) {
      cataNum = parseInteiroBR(cata);
      if (cataNum == null || cataNum <= 0 || cataNum > 100) {
        Alert.alert('Cata inválida', 'Informe a cata em % como número inteiro de 1 a 100 (ex.: 20) ou deixe em branco.');
        return;
      }
    }
    if (!user?.id) {
      Alert.alert('Sessão expirada', 'Entre na sua conta novamente para salvar o lote.');
      return;
    }
    const variedadeFinal = variedade === 'Outro' ? variedadeOutro.trim() : variedade;
    const campos = {
      variedade: variedadeFinal,
      processo: processo.toUpperCase().replace(/ /g, '_'),
      safra,
      quantidade_sacas: qtdSacas,
      preco_por_saca: precoNum,
      bebida: bebida || null,
      peneira: peneira || null,
      cata: cataNum,
      notas_sensoriais: notas.trim() || null,
    };
    setSaving(true);
    try {
      if (isEdit) {
        const { data, error } = await supabase
          .from('lotes')
          .update({ ...campos, atualizado_em: new Date().toISOString() })
          .eq('id', editId)
          .eq('produtor_id', user.id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          Alert.alert('Lote não encontrado', 'Este lote não existe mais. Ele pode ter sido excluído.');
          return;
        }
        Alert.alert('Pronto', 'Lote atualizado!');
      } else {
        const { error } = await supabase.from('lotes').insert({
          ...campos,
          produtor_id: user.id,
          status: 'RASCUNHO',
        });
        if (error) throw error;
        Alert.alert('Sucesso', 'Lote criado!');
      }
      router.back();
    } catch (err) {
      Alert.alert('Erro', mensagemErroLote(err, isEdit ? 'salvar as alterações' : 'criar o lote'));
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && (loadingEdit || loadError)) {
    return (
      <View style={[styles.container, styles.centered]}>
        {loadingEdit ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            <Feather name="alert-circle" size={40} color={colors.textLight} />
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={carregarLote}>
              <Text style={styles.retryBtnText}>Tentar de novo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
              <Text style={styles.backLinkText}>Voltar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Editar lote' : 'Novo Lote'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Variedade */}
      <Text style={styles.label}>Variedade</Text>
      <TouchableOpacity style={styles.select} onPress={() => setShowVariedade(true)}>
        <Text style={variedade ? styles.selectText : styles.selectPlaceholder}>{variedade || 'Selecione a variedade'}</Text>
        <Feather name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>
      <PickerModal
        visible={showVariedade}
        title="Variedade"
        options={coffeeVarieties}
        onSelect={setVariedade}
        onClose={() => setShowVariedade(false)}
      />
      {variedade === 'Outro' && (
        <TextInput
          style={[styles.input, { marginTop: spacing.sm }]}
          value={variedadeOutro}
          onChangeText={setVariedadeOutro}
          placeholder="Digite o nome da variedade"
          placeholderTextColor={colors.textLight}
        />
      )}

      {/* Processo */}
      <Text style={styles.label}>Processo</Text>
      <TouchableOpacity style={styles.select} onPress={() => setShowProcesso(true)}>
        <Text style={processo ? styles.selectText : styles.selectPlaceholder}>{processo || 'Selecione o processo'}</Text>
        <Feather name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>
      <PickerModal
        visible={showProcesso}
        title="Processo"
        options={PROCESSOS}
        onSelect={setProcesso}
        onClose={() => setShowProcesso(false)}
      />

      {/* Safra */}
      <Text style={styles.label}>Safra</Text>
      <View style={styles.safraRow}>
        {safrasOpcoes.map((s) => (
          <TouchableOpacity key={s} style={[styles.safraBtn, safra === s && styles.safraBtnActive]} onPress={() => setSafra(s)}>
            <Text style={[styles.safraText, safra === s && styles.safraTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sacas */}
      <Text style={styles.label}>Quantidade de sacas</Text>
      <TextInput style={styles.input} value={sacas} onChangeText={setSacas} placeholder="Ex: 50" keyboardType="number-pad" placeholderTextColor={colors.textLight} />

      {/* Preço */}
      <Text style={styles.label}>Preço por saca (opcional)</Text>
      <View style={styles.priceRow}>
        <Text style={styles.pricePrefix}>R$</Text>
        <TextInput style={[styles.input, { flex: 1 }]} value={preco} onChangeText={setPreco} placeholder="1.480,00" keyboardType="decimal-pad" placeholderTextColor={colors.textLight} />
      </View>

      {/* Bebida */}
      <Text style={styles.label}>Bebida (opcional)</Text>
      <TouchableOpacity style={styles.select} onPress={() => setShowBebida(true)}>
        <Text style={bebida ? styles.selectText : styles.selectPlaceholder}>{bebida || 'Selecione a bebida'}</Text>
        <Feather name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>
      <PickerModal
        visible={showBebida}
        title="Bebida"
        options={BEBIDAS}
        onSelect={setBebida}
        onClose={() => setShowBebida(false)}
      />

      {/* Peneira */}
      <Text style={styles.label}>Peneira (opcional)</Text>
      <TouchableOpacity style={styles.select} onPress={() => setShowPeneira(true)}>
        <Text style={peneira ? styles.selectText : styles.selectPlaceholder}>{peneira || 'Selecione a peneira'}</Text>
        <Feather name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>
      <PickerModal
        visible={showPeneira}
        title="Peneira"
        options={PENEIRAS}
        onSelect={setPeneira}
        onClose={() => setShowPeneira(false)}
      />

      {/* Cata — em %, igual à tabela de preços da Copa (cata 20/25/30%) */}
      <Text style={styles.label}>Cata em % (opcional)</Text>
      <TextInput style={styles.input} value={cata} onChangeText={setCata} placeholder="Ex: 20" keyboardType="number-pad" placeholderTextColor={colors.textLight} />
      <Text style={styles.hint}>Com bebida e cata preenchidas, o app mostra o preço de referência da Copa para o lote.</Text>

      {/* Notas sensoriais */}
      <Text style={styles.label}>Notas sensoriais (opcional)</Text>
      <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={notas} onChangeText={setNotas} placeholder="Ex: Chocolate, caramelo, frutas vermelhas" multiline placeholderTextColor={colors.textLight} />

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Lote'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  selectText: { fontSize: fontSize.md, color: colors.text },
  selectPlaceholder: { fontSize: fontSize.md, color: colors.textLight },
  safraRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  safraBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.surfaceVariant },
  safraBtnActive: { backgroundColor: colors.primary },
  safraText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  safraTextActive: { color: colors.white },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pricePrefix: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  saveBtn: { backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  saveBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  errorText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  retryBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  backLink: { padding: spacing.md, marginTop: spacing.sm },
  backLinkText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modalCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalList: { paddingBottom: spacing.xl },
  modalItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalItemText: { fontSize: fontSize.md, color: colors.text },
});
