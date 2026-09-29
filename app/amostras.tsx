import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Linking, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { amostraConfig, processoLabels, type AmostraStatus } from '../src/services/lote.service';

// Tela da equipe Copa: amostras enviadas pelos produtores, para aprovar ou
// reprovar. Os dados vêm das funções amostras_copa / avaliar_amostra, que
// recusam quem não tem users.is_copa_staff.

interface Amostra {
  lote_id: string;
  amostra_status: AmostraStatus;
  amostra_enviada_em: string | null;
  amostra_avaliada_em: string | null;
  amostra_motivo: string | null;
  variedade: string;
  processo: string;
  safra: string;
  quantidade_sacas: number;
  bebida: string | null;
  cata: number | null;
  peneira: string | null;
  preco_por_saca: number | null;
  qrcode_hash: string | null;
  produtor_nome: string | null;
  produtor_telefone: string | null;
  fazenda_nome: string | null;
  municipio: string | null;
  estado: string | null;
}

function formatData(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AmostrasScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [aba, setAba] = useState<'pendentes' | 'avaliadas'>('pendentes');
  const [amostras, setAmostras] = useState<Amostra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState<Amostra | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    const { data, error } = await supabase.rpc('amostras_copa', { p_pendentes: aba === 'pendentes' });
    if (error) {
      setErro('Não foi possível carregar as amostras. Verifique sua internet e tente de novo.');
    } else {
      setAmostras((data || []) as Amostra[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [aba]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      carregar();
    }, [carregar])
  );

  async function avaliar(a: Amostra, aprovada: boolean, motivoTexto?: string) {
    setSalvando(true);
    const { error } = await supabase.rpc('avaliar_amostra', {
      p_lote_id: a.lote_id,
      p_aprovada: aprovada,
      p_motivo: motivoTexto || null,
    });
    setSalvando(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível registrar a avaliação. Talvez ela já tenha sido avaliada — atualize a lista.');
      return;
    }
    setReprovando(null);
    setMotivo('');
    setAmostras((lista) => lista.filter((x) => x.lote_id !== a.lote_id));
  }

  function confirmarAprovacao(a: Amostra) {
    Alert.alert('Aprovar amostra', `Aprovar a amostra de ${a.produtor_nome || 'produtor'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprovar', onPress: () => avaliar(a, true) },
    ]);
  }

  function abrirWhatsAppProdutor(a: Amostra) {
    const tel = (a.produtor_telefone || '').replace(/\D/g, '');
    if (!tel) return;
    Linking.openURL(`https://wa.me/${tel}`).catch(() =>
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp.')
    );
  }

  if (!profile?.is_copa_staff) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Feather name="lock" size={40} color={colors.textLight} />
        <Text style={styles.vazio}>Área restrita à equipe Copa Café.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltarLink}>
          <Text style={styles.voltarLinkText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderItem({ item: a }: { item: Amostra }) {
    const cfg = amostraConfig[a.amostra_status];
    const local = [a.fazenda_nome, [a.municipio, a.estado].filter(Boolean).join('/')].filter(Boolean).join(' – ');
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.produtor}>{a.produtor_nome || 'Produtor'}</Text>
            {local ? <Text style={styles.local}>{local}</Text> : null}
          </View>
          {a.produtor_telefone ? (
            <TouchableOpacity
              onPress={() => abrirWhatsAppProdutor(a)}
              style={styles.whatsBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Falar com o produtor no WhatsApp"
            >
              <Feather name="message-circle" size={20} color="#25D366" />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.detalhe}>
          {a.quantidade_sacas} sacas • {a.variedade} ({processoLabels[a.processo] || a.processo}) • safra {a.safra}
        </Text>
        <Text style={styles.detalhe}>
          {[a.bebida && `Bebida ${a.bebida}`, a.cata != null && `Cata ${a.cata}%`, a.peneira && `Peneira ${a.peneira}`]
            .filter(Boolean)
            .join(' • ') || 'Sem classificação informada'}
        </Text>

        {aba === 'pendentes' ? (
          <>
            <Text style={styles.data}>Enviada em {formatData(a.amostra_enviada_em)}</Text>
            <View style={styles.acoes}>
              <TouchableOpacity
                style={[styles.acaoBtn, styles.reprovarBtn]}
                onPress={() => { setMotivo(''); setReprovando(a); }}
                disabled={salvando}
              >
                <Feather name="x" size={18} color={colors.error} />
                <Text style={[styles.acaoText, { color: colors.error }]}>Reprovar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acaoBtn, styles.aprovarBtn]}
                onPress={() => confirmarAprovacao(a)}
                disabled={salvando}
              >
                <Feather name="check" size={18} color={colors.white} />
                <Text style={[styles.acaoText, { color: colors.white }]}>Aprovar</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={[styles.resultado, { backgroundColor: cfg.bg }]}>
            <Feather name={cfg.icon as any} size={16} color={cfg.color} />
            <Text style={[styles.resultadoText, { color: cfg.color }]}>
              {cfg.label} em {formatData(a.amostra_avaliada_em)}
              {a.amostra_motivo ? ` — ${a.amostra_motivo}` : ''}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Amostras recebidas</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.abas}>
        {(['pendentes', 'avaliadas'] as const).map((k) => (
          <TouchableOpacity key={k} style={[styles.aba, aba === k && styles.abaAtiva]} onPress={() => setAba(k)}>
            <Text style={[styles.abaText, aba === k && styles.abaTextAtiva]}>
              {k === 'pendentes' ? 'Aguardando' : 'Avaliadas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={amostras}
          keyExtractor={(a) => a.lote_id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Feather name={erro ? 'wifi-off' : 'inbox'} size={40} color={colors.textLight} />
              <Text style={styles.vazio}>
                {erro || (aba === 'pendentes' ? 'Nenhuma amostra aguardando avaliação.' : 'Nenhuma amostra avaliada ainda.')}
              </Text>
              {erro ? (
                <TouchableOpacity onPress={() => { setLoading(true); carregar(); }} style={styles.voltarLink}>
                  <Text style={styles.voltarLinkText}>Tentar de novo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      <Modal visible={!!reprovando} transparent animationType="slide" onRequestClose={() => setReprovando(null)}>
        <View style={styles.modalFundo}>
          <View style={[styles.modal, { paddingBottom: spacing.lg + insets.bottom }]}>
            <Text style={styles.modalTitulo}>Reprovar amostra</Text>
            <Text style={styles.modalSub}>{reprovando?.produtor_nome}</Text>
            <Text style={styles.label}>Motivo (o produtor vai ver)</Text>
            <TextInput
              style={styles.input}
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ex.: umidade acima de 12%, muitos defeitos"
              placeholderTextColor={colors.textLight}
              multiline
            />
            <View style={styles.acoes}>
              <TouchableOpacity style={[styles.acaoBtn, styles.cancelarBtn]} onPress={() => setReprovando(null)} disabled={salvando}>
                <Text style={[styles.acaoText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acaoBtn, { backgroundColor: colors.error }]}
                onPress={() => reprovando && avaliar(reprovando, false, motivo.trim())}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={[styles.acaoText, { color: colors.white }]}>Reprovar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 72, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  abas: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  aba: { flex: 1, height: 44, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  abaAtiva: { backgroundColor: colors.primary, borderColor: colors.primary },
  abaText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  abaTextAtiva: { color: colors.white },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  produtor: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  local: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  whatsBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  detalhe: { fontSize: fontSize.sm, color: colors.text },
  data: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs },
  acoes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  acaoBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  aprovarBtn: { backgroundColor: colors.success },
  reprovarBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
  cancelarBtn: { backgroundColor: colors.surfaceVariant },
  acaoText: { fontSize: fontSize.md, fontWeight: '700' },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: borderRadius.md, marginTop: spacing.sm },
  resultadoText: { fontSize: fontSize.sm, fontWeight: '600', flex: 1 },
  vazio: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },
  voltarLink: { padding: spacing.md },
  voltarLinkText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg },
  modalTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modalSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { minHeight: 80, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: fontSize.md, color: colors.text, textAlignVertical: 'top' },
});
