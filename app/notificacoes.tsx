import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/constants/config';

interface Notificacao {
  id: string;
  tipo: 'cotacao' | 'clima' | 'lembrete' | 'sistema';
  titulo: string;
  mensagem: string;
  lida: boolean;
  data: string;
  icon: string;
  iconColor: string;
}

export default function NotificacoesScreen() {
  const { user } = useAuthStore();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateNotifications();
  }, []);

  async function generateNotifications() {
    const notifs: Notificacao[] = [];
    const now = new Date();

    // 1. Checar alertas de preço disparados
    if (user?.id) {
      try {
        const [alertasRes, pricesRes] = await Promise.all([
          supabase.from('alertas_preco').select('*').eq('produtor_id', user.id).eq('ativo', true),
          fetch(`${SUPABASE_URL}/functions/v1/coffee-prices`, {
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          }).then((r) => r.json()),
        ]);

        if (alertasRes.data && pricesRes.arabica) {
          for (const alerta of alertasRes.data) {
            const precoAtual = alerta.tipo_cafe === 'ARABICA' ? pricesRes.arabica.preco_saca : pricesRes.conilon.preco_saca;
            const disparou = alerta.condicao === 'ACIMA' ? precoAtual >= alerta.preco_alvo : precoAtual <= alerta.preco_alvo;
            if (disparou) {
              notifs.push({
                id: `alerta-${alerta.id}`,
                tipo: 'cotacao',
                titulo: `${alerta.tipo_cafe === 'ARABICA' ? 'Arábica' : 'Conilon'} ${alerta.condicao === 'ACIMA' ? 'acima' : 'abaixo'} de R$ ${alerta.preco_alvo}`,
                mensagem: `Cotação atual: R$ ${precoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Seu alerta foi atingido!`,
                lida: alerta.disparado,
                data: now.toISOString(),
                icon: 'trending-up',
                iconColor: '#2E7D32',
              });
              if (!alerta.disparado) {
                await supabase.from('alertas_preco').update({ disparado: true, disparado_em: now.toISOString() }).eq('id', alerta.id);
              }
            }
          }
        }

        // 2. Checar clima (alerta se chuva > 70%)
        // Weather info from the store would be nice, but let's keep it simple
        notifs.push({
          id: 'clima-dica',
          tipo: 'clima',
          titulo: 'Dica de manejo',
          mensagem: 'Verifique a previsão do tempo antes de aplicar defensivos. Chuva pode comprometer a eficácia.',
          lida: false,
          data: new Date(now.getTime() - 3600000).toISOString(),
          icon: 'cloud',
          iconColor: '#1565C0',
        });

        // 3. Lembrete do diário
        const { data: ultimaAtividade } = await supabase
          .from('atividades_campo')
          .select('data')
          .eq('produtor_id', user.id)
          .order('data', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ultimaAtividade) {
          const lastDate = new Date(ultimaAtividade.data + 'T00:00:00');
          const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 7) {
            notifs.push({
              id: 'diario-lembrete',
              tipo: 'lembrete',
              titulo: 'Diário de Campo',
              mensagem: `Faz ${diffDays} dias desde sua última atividade registrada. Mantenha seu diário atualizado!`,
              lida: false,
              data: new Date(now.getTime() - 7200000).toISOString(),
              icon: 'book-open',
              iconColor: '#F57F17',
            });
          }
        } else {
          notifs.push({
            id: 'diario-inicio',
            tipo: 'lembrete',
            titulo: 'Comece seu Diário de Campo',
            mensagem: 'Registre suas atividades diárias para ter um histórico completo da sua lavoura.',
            lida: false,
            data: new Date(now.getTime() - 7200000).toISOString(),
            icon: 'book-open',
            iconColor: '#F57F17',
          });
        }

        // 4. Lotes sem preço
        const { data: lotesRascunho } = await supabase
          .from('lotes')
          .select('id')
          .eq('produtor_id', user.id)
          .eq('status', 'RASCUNHO');

        if (lotesRascunho && lotesRascunho.length > 0) {
          notifs.push({
            id: 'lotes-rascunho',
            tipo: 'sistema',
            titulo: `${lotesRascunho.length} lote(s) em rascunho`,
            mensagem: 'Publique seus lotes para que compradores possam encontrá-los.',
            lida: false,
            data: new Date(now.getTime() - 86400000).toISOString(),
            icon: 'package',
            iconColor: colors.primary,
          });
        }

        // 5. Marketplace - novos produtos
        notifs.push({
          id: 'marketplace-novo',
          tipo: 'sistema',
          titulo: 'Marketplace de Insumos',
          mensagem: 'Novos produtos disponíveis! Confira fertilizantes, defensivos e mudas para sua lavoura.',
          lida: true,
          data: new Date(now.getTime() - 172800000).toISOString(),
          icon: 'shopping-bag',
          iconColor: '#7B1FA2',
        });

      } catch {}
    }

    setNotificacoes(notifs);
    setLoading(false);
  }

  function formatTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificações</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {notificacoes.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Feather name="bell" size={48} color={colors.textLight} />
            <Text style={styles.emptyText}>Nenhuma notificação</Text>
          </View>
        ) : (
          notificacoes.map((n) => (
            <View key={n.id} style={[styles.notifCard, !n.lida && styles.notifUnread]}>
              <View style={[styles.notifIcon, { backgroundColor: n.iconColor + '20' }]}>
                <Feather name={n.icon as any} size={20} color={n.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.notifHeader}>
                  <Text style={[styles.notifTitle, !n.lida && { fontWeight: '700' }]}>{n.titulo}</Text>
                  {!n.lida && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifMsg}>{n.mensagem}</Text>
                <Text style={styles.notifTime}>{formatTimeAgo(n.data)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 72, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  list: { padding: spacing.md, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary, marginTop: spacing.md },
  notifCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  notifUnread: { backgroundColor: '#F5F9FF', borderColor: colors.primary + '30' },
  notifIcon: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  notifTitle: { fontSize: fontSize.md, fontWeight: '500', color: colors.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  notifMsg: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  notifTime: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 6 },
});
