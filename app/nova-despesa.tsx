import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Image, Modal, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { safraDaData } from '../src/utils/safra';
import { parseBRL, formatBRL } from '../src/utils/format';
import { despesaService, mensagemErroAmigavel } from '../src/services/despesa.service';

const CATEGORIAS = [
  { value: 'INSUMOS', label: 'Insumos' },
  { value: 'MAO_DE_OBRA', label: 'Mão de obra' },
  { value: 'DEFENSIVOS', label: 'Defensivos' },
  { value: 'MAQUINAS', label: 'Máquinas' },
  { value: 'TRANSPORTE', label: 'Transporte' },
  { value: 'OUTROS', label: 'Outros' },
];

const categoriaLabel = (v: string) => CATEGORIAS.find((c) => c.value === v)?.label || 'Outros';

interface ScanItem {
  descricao: string;
  valor: string;
  categoria: string;
  data: string;
}

function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateBR(text: string): Date | null {
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
  if (d.getDate() !== parseInt(dd) || d.getMonth() !== parseInt(mm) - 1) return null;
  return d;
}

function todayBR(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toISODate(text: string): string | null {
  const parsed = parseDateBR(text);
  if (!parsed) return null;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isoToBR(iso: string | null | undefined): string {
  if (!iso) return todayBR();
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return todayBR();
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function mediaTypeFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export default function NovaDespesaScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  // Modo edição: /nova-despesa?id=<uuid>
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!editId;
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  // Despesa do Diário não pode ser editada aqui: mantém o formulário oculto.
  const [doDiario, setDoDiario] = useState(false);
  // URL do comprovante já salvo (edição). Se imageUri === este valor, não re-envia.
  const [comprovanteExistente, setComprovanteExistente] = useState<string | null>(null);
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataDespesa, setDataDespesa] = useState(todayBR());
  const [vendor, setVendor] = useState('');
  const [showCat, setShowCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocrRaw, setOcrRaw] = useState<any>(null);

  const [multiItems, setMultiItems] = useState<ScanItem[] | null>(null);
  const [showMulti, setShowMulti] = useState(false);
  const [editCatIdx, setEditCatIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!editId) return;
    let cancel = false;
    despesaService
      .get(editId)
      .then((d) => {
        if (cancel) return;
        if (!d) {
          Alert.alert('Despesa não encontrada', 'Ela pode ter sido excluída.', [{ text: 'OK', onPress: () => router.back() }]);
          return;
        }
        if (d.atividade_id) {
          setDoDiario(true);
          // Despesa do Diário: quem manda é a atividade (syncDespesa sobrescreveria a edição).
          setDoDiario(true);
          Alert.alert(
            'Despesa do Diário de Campo',
            'Esta despesa veio do Diário de Campo — edite pela atividade.',
            [
              { text: 'Voltar', style: 'cancel', onPress: () => router.back() },
              { text: 'Abrir Diário', onPress: () => router.replace('/diario') },
            ],
            { cancelable: false },
          );
          return;
        }
        setCategoria(d.categoria || 'OUTROS');
        setDescricao(d.descricao || '');
        setVendor(d.vendor || '');
        setValor(formatBRL(d.valor, false));
        setDataDespesa(isoToBR(d.data));
        setImageUri(d.comprovante_url);
        setComprovanteExistente(d.comprovante_url);
      })
      .catch((err) => {
        if (cancel) return;
        Alert.alert(
          'Erro',
          mensagemErroAmigavel(err, 'Não foi possível abrir a despesa. Tente novamente.'),
          [{ text: 'OK', onPress: () => router.back() }],
        );
      })
      .finally(() => { if (!cancel) setLoadingEdit(false); });
    return () => { cancel = true; };
  }, [editId]);

  async function pickImage(source: 'camera' | 'gallery', withBase64: boolean) {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', source === 'camera' ? 'Precisamos de acesso à câmera.' : 'Precisamos de acesso à galeria.');
      return null;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      quality: 0.6,
      allowsEditing: true,
      base64: withBase64,
      mediaTypes: ['images'],
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0];
  }

  async function pickFromGallery() {
    setShowImageOptions(false);
    const asset = await pickImage('gallery', false);
    if (asset) {
      setImageUri(asset.uri);
      setImageBase64(null);
    }
  }

  async function takePhoto() {
    setShowImageOptions(false);
    const asset = await pickImage('camera', false);
    if (asset) {
      setImageUri(asset.uri);
      setImageBase64(null);
    }
  }

  async function scanFromSource(source: 'camera' | 'gallery') {
    setShowScanOptions(false);
    const asset = await pickImage(source, true);
    if (!asset || !asset.base64) return;

    setImageUri(asset.uri);
    setImageBase64(asset.base64);
    setScanning(true);

    try {
      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: {
          image_base64: asset.base64,
          media_type: mediaTypeFromUri(asset.uri),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setOcrRaw(data);
      applyOcrResult(data);
    } catch (err: any) {
      Alert.alert('Erro ao escanear', mensagemErroAmigavel(err, 'Não foi possível ler o documento. Preencha manualmente.'));
    } finally {
      setScanning(false);
    }
  }

  function applyOcrResult(data: any) {
    const itens = Array.isArray(data?.itens) ? data.itens : [];
    const vendorDetected = data?.vendor || '';
    const docDate = data?.data_documento;

    if (itens.length === 0) {
      Alert.alert('Nenhum item identificado', 'Não foi possível extrair dados. Preencha manualmente.');
      return;
    }

    if (itens.length === 1) {
      const item = itens[0];
      setDescricao(item.descricao || '');
      setValor(String(item.valor ?? '').replace('.', ','));
      setCategoria(CATEGORIAS.some((c) => c.value === item.categoria) ? item.categoria : 'OUTROS');
      setDataDespesa(isoToBR(item.data || docDate));
      setVendor(vendorDetected);
      const confianca = data?.confianca ?? 0;
      Alert.alert(
        'Dados extraídos',
        `Confira os campos preenchidos antes de salvar.${confianca < 70 ? '\n\nConfiança baixa — revise com atenção.' : ''}`
      );
      return;
    }

    // multi items
    const mapped: ScanItem[] = itens.map((it: any) => ({
      descricao: it.descricao || '',
      valor: String(it.valor ?? '').replace('.', ','),
      categoria: CATEGORIAS.some((c) => c.value === it.categoria) ? it.categoria : 'OUTROS',
      data: isoToBR(it.data || docDate),
    }));
    setMultiItems(mapped);
    setVendor(vendorDetected);
    setShowMulti(true);
  }

  async function uploadComprovante(): Promise<string | null> {
    if (!imageUri || !user?.id) return null;

    const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const response = await fetch(imageUri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error } = await supabase.storage
      .from('comprovantes')
      .upload(fileName, arrayBuffer, {
        contentType: mediaTypeFromUri(imageUri),
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('comprovantes')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  }

  async function handleSave() {
    if (!categoria || !descricao || !valor) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios');
      return;
    }
    const valorNum = parseBRL(valor);
    if (valorNum == null || valorNum <= 0) {
      Alert.alert('Atenção', 'Valor inválido');
      return;
    }
    const isoDate = toISODate(dataDespesa);
    if (!isoDate) {
      Alert.alert('Atenção', 'Data inválida. Use o formato DD/MM/AAAA');
      return;
    }
    if (!user?.id) return;

    setSaving(true);
    try {
      if (isEdit && editId) {
        // Mantém o comprovante já salvo; só envia se o usuário trocou a foto.
        let comprovanteUrl: string | null = null;
        if (imageUri) {
          comprovanteUrl = imageUri === comprovanteExistente ? comprovanteExistente : await uploadComprovante();
        }
        await despesaService.update(editId, {
          categoria,
          descricao,
          valor: valorNum,
          data: isoDate,
          safra: safraDaData(isoDate),
          comprovante_url: comprovanteUrl,
          vendor: vendor || null,
        });
        Alert.alert('Sucesso', 'Despesa atualizada!');
        router.back();
        return;
      }

      let comprovanteUrl: string | null = null;
      if (imageUri) {
        comprovanteUrl = await uploadComprovante();
      }

      const { error } = await supabase.from('despesas_producao').insert({
        produtor_id: user.id,
        categoria,
        descricao,
        valor: valorNum,
        data: isoDate,
        safra: safraDaData(isoDate),
        comprovante_url: comprovanteUrl,
        vendor: vendor || null,
        ocr_raw: ocrRaw,
      });
      if (error) throw error;
      Alert.alert('Sucesso', 'Despesa registrada!');
      router.back();
    } catch (err: any) {
      Alert.alert('Erro', mensagemErroAmigavel(err, 'Não foi possível salvar a despesa. Tente novamente.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMulti() {
    if (!multiItems || !user?.id) return;

    const rows = [];
    for (let i = 0; i < multiItems.length; i++) {
      const it = multiItems[i];
      const valorNum = parseBRL(it.valor);
      const isoDate = toISODate(it.data);
      if (!it.descricao || valorNum == null || valorNum <= 0 || !isoDate) {
        Alert.alert('Atenção', `Revise o item ${i + 1}: descrição, valor e data são obrigatórios.`);
        return;
      }
      rows.push({
        produtor_id: user.id,
        categoria: it.categoria,
        descricao: it.descricao,
        valor: valorNum,
        data: isoDate,
        safra: safraDaData(isoDate),
        vendor: vendor || null,
        ocr_raw: ocrRaw,
      });
    }

    setSaving(true);
    try {
      let comprovanteUrl: string | null = null;
      if (imageUri) {
        comprovanteUrl = await uploadComprovante();
      }
      const rowsWithUrl = rows.map((r) => ({ ...r, comprovante_url: comprovanteUrl }));

      const { error } = await supabase.from('despesas_producao').insert(rowsWithUrl);
      if (error) throw error;
      Alert.alert('Sucesso', `${rows.length} despesas registradas!`);
      router.back();
    } catch (err: any) {
      Alert.alert('Erro', mensagemErroAmigavel(err, 'Não foi possível salvar a despesa. Tente novamente.'));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editId) return;
    Alert.alert(
      'Excluir despesa?',
      `"${descricao || 'Despesa'}" será apagada. Isso não pode ser desfeito.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await despesaService.remove(editId);
              router.back();
            } catch (err) {
              Alert.alert('Erro', mensagemErroAmigavel(err, 'Não foi possível excluir a despesa. Tente novamente.'));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  function updateMultiItem(idx: number, patch: Partial<ScanItem>) {
    setMultiItems((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function removeMultiItem(idx: number) {
    setMultiItems((prev) => prev?.filter((_, i) => i !== idx) ?? null);
  }

  if (loadingEdit || doDiario) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Editar despesa' : 'Nova Despesa'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Scan CTA (só no cadastro — o scan pode gerar várias despesas) */}
      {!isEdit && (<>
      <TouchableOpacity
        style={styles.scanBtn}
        onPress={() => setShowScanOptions(true)}
        disabled={scanning}
      >
        {scanning ? (
          <>
            <ActivityIndicator color={colors.white} />
            <Text style={styles.scanBtnText}>Lendo documento...</Text>
          </>
        ) : (
          <>
            <Feather name="zap" size={18} color={colors.white} />
            <Text style={styles.scanBtnText}>Escanear recibo, NF ou caderno</Text>
          </>
        )}
      </TouchableOpacity>
      <Text style={styles.scanHint}>Foto do documento e preenchemos os campos pra você</Text>
      </>)}

      <Text style={styles.label}>Categoria</Text>
      <TouchableOpacity style={styles.select} onPress={() => setShowCat(!showCat)}>
        <Text style={categoria ? styles.selectText : styles.placeholder}>{categoria ? categoriaLabel(categoria) : 'Selecione'}</Text>
        <Feather name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>
      {showCat && (
        <View style={styles.dropdown}>
          {CATEGORIAS.map((c) => (
            <TouchableOpacity key={c.value} style={styles.dropItem} onPress={() => { setCategoria(c.value); setShowCat(false); }}>
              <Text style={styles.dropText}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>Descrição</Text>
      <TextInput style={styles.input} value={descricao} onChangeText={setDescricao} placeholder="Ex: Adubo NPK 20-05-20" placeholderTextColor={colors.textLight} />

      <Text style={styles.label}>Fornecedor (opcional)</Text>
      <TextInput style={styles.input} value={vendor} onChangeText={setVendor} placeholder="Ex: Agropecuária Central" placeholderTextColor={colors.textLight} />

      <Text style={styles.label}>Valor</Text>
      <View style={styles.priceRow}>
        <Text style={styles.prefix}>R$</Text>
        <TextInput style={[styles.input, { flex: 1 }]} value={valor} onChangeText={setValor} placeholder="0,00" keyboardType="decimal-pad" placeholderTextColor={colors.textLight} />
      </View>

      <Text style={styles.label}>Data da Despesa</Text>
      <View style={styles.dateRow}>
        <Feather name="calendar" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={dataDespesa}
          onChangeText={(text) => setDataDespesa(formatDateInput(text))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
          placeholderTextColor={colors.textLight}
        />
      </View>

      <Text style={styles.label}>Comprovante / Cupom Fiscal</Text>
      {imageUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.changeBtn} onPress={() => setShowImageOptions(true)}>
              <Feather name="refresh-cw" size={14} color={colors.primary} />
              <Text style={styles.changeBtnText}>Trocar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeBtn} onPress={() => { setImageUri(null); setImageBase64(null); setOcrRaw(null); }}>
              <Feather name="trash-2" size={14} color={colors.error} />
              <Text style={styles.removeBtnText}>Remover</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadArea} onPress={() => setShowImageOptions(true)}>
          <Feather name="camera" size={28} color={colors.textLight} />
          <Text style={styles.uploadText}>Anexar foto do comprovante</Text>
          <Text style={styles.uploadSubtext}>Toque para tirar foto ou escolher da galeria</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Registrar Despesa'}</Text>
      </TouchableOpacity>

      {isEdit && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
          <Feather name="trash-2" size={18} color={colors.error} />
          <Text style={styles.deleteBtnText}>Excluir despesa</Text>
        </TouchableOpacity>
      )}

      {/* Modal de opções de imagem (comprovante manual) */}
      <Modal visible={showImageOptions} transparent animationType="fade" onRequestClose={() => setShowImageOptions(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowImageOptions(false)}>
          <View style={[styles.modalContent, { paddingBottom: spacing.xxl + insets.bottom }]}>
            <Text style={styles.modalTitle}>Anexar Comprovante</Text>
            <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
              <Feather name="camera" size={20} color={colors.primary} />
              <Text style={styles.modalOptionText}>Tirar Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={pickFromGallery}>
              <Feather name="image" size={20} color={colors.primary} />
              <Text style={styles.modalOptionText}>Escolher da Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowImageOptions(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de opções de scan */}
      <Modal visible={showScanOptions} transparent animationType="fade" onRequestClose={() => setShowScanOptions(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowScanOptions(false)}>
          <View style={[styles.modalContent, { paddingBottom: spacing.xxl + insets.bottom }]}>
            <Text style={styles.modalTitle}>Escanear Documento</Text>
            <TouchableOpacity style={styles.modalOption} onPress={() => scanFromSource('camera')}>
              <Feather name="camera" size={20} color={colors.primary} />
              <Text style={styles.modalOptionText}>Tirar Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => scanFromSource('gallery')}>
              <Feather name="image" size={20} color={colors.primary} />
              <Text style={styles.modalOptionText}>Escolher da Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowScanOptions(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal múltiplos itens */}
      <Modal visible={showMulti} transparent animationType="slide" onRequestClose={() => setShowMulti(false)}>
        <View style={styles.fullModal}>
          <View style={styles.fullModalHeader}>
            <TouchableOpacity onPress={() => setShowMulti(false)}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.fullModalTitle}>{multiItems?.length || 0} itens encontrados</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl + insets.bottom }} keyboardShouldPersistTaps="handled">
            <Text style={styles.multiHint}>Revise, edite ou remova os itens antes de salvar.</Text>
            {multiItems?.map((it, idx) => (
              <View key={idx} style={styles.multiCard}>
                <View style={styles.multiCardHeader}>
                  <Text style={styles.multiIdx}>#{idx + 1}</Text>
                  <TouchableOpacity onPress={() => removeMultiItem(idx)}>
                    <Feather name="trash-2" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.multiInput}
                  value={it.descricao}
                  onChangeText={(t) => updateMultiItem(idx, { descricao: t })}
                  placeholder="Descrição"
                  placeholderTextColor={colors.textLight}
                />
                <View style={styles.multiRow}>
                  <TextInput
                    style={[styles.multiInput, { flex: 1 }]}
                    value={it.valor}
                    onChangeText={(t) => updateMultiItem(idx, { valor: t })}
                    placeholder="Valor"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textLight}
                  />
                  <TextInput
                    style={[styles.multiInput, { flex: 1 }]}
                    value={it.data}
                    onChangeText={(t) => updateMultiItem(idx, { data: formatDateInput(t) })}
                    placeholder="DD/MM/AAAA"
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholderTextColor={colors.textLight}
                  />
                </View>
                <TouchableOpacity style={styles.multiCatBtn} onPress={() => setEditCatIdx(editCatIdx === idx ? null : idx)}>
                  <Text style={styles.multiCatText}>{categoriaLabel(it.categoria)}</Text>
                  <Feather name="chevron-down" size={14} color={colors.textLight} />
                </TouchableOpacity>
                {editCatIdx === idx && (
                  <View style={styles.dropdown}>
                    {CATEGORIAS.map((c) => (
                      <TouchableOpacity key={c.value} style={styles.dropItem} onPress={() => { updateMultiItem(idx, { categoria: c.value }); setEditCatIdx(null); }}>
                        <Text style={styles.dropText}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSaveMulti} disabled={saving || !multiItems?.length}>
              <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : `Salvar ${multiItems?.length || 0} despesas`}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  selectText: { fontSize: fontSize.md, color: colors.text },
  placeholder: { fontSize: fontSize.md, color: colors.textLight },
  dropdown: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginTop: 4 },
  dropItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropText: { fontSize: fontSize.md, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prefix: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  // Scan CTA
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.xs },
  scanBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  scanHint: { fontSize: fontSize.xs, color: colors.textLight, textAlign: 'center' },
  // Upload area
  uploadArea: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: spacing.lg, gap: spacing.xs },
  uploadText: { fontSize: fontSize.md, fontWeight: '500', color: colors.textSecondary, marginTop: spacing.xs },
  uploadSubtext: { fontSize: fontSize.xs, color: colors.textLight },
  // Preview
  previewContainer: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  previewImage: { width: '100%', height: 200, resizeMode: 'cover' },
  previewActions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, padding: spacing.md },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  changeBtnText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  removeBtnText: { fontSize: fontSize.sm, color: colors.error, fontWeight: '500' },
  // Save button
  saveBtn: { backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  saveBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 52, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error, marginTop: spacing.md },
  deleteBtnText: { color: colors.error, fontSize: fontSize.md, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, marginBottom: spacing.sm },
  modalOptionText: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  modalCancel: { alignItems: 'center', padding: spacing.md, marginTop: spacing.sm },
  modalCancelText: { fontSize: fontSize.md, color: colors.textLight, fontWeight: '500' },
  // Full modal (multi)
  fullModal: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  fullModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  fullModalTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  multiHint: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  multiCard: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  multiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  multiIdx: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  multiInput: { backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, fontSize: fontSize.sm, color: colors.text, marginBottom: spacing.sm },
  multiRow: { flexDirection: 'row', gap: spacing.sm },
  multiCatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  multiCatText: { fontSize: fontSize.sm, color: colors.text },
});
