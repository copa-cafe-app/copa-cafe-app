import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { useAuthStore } from '../../../src/stores/authStore';

function MenuItem({ icon, title, subtitle, onPress, danger }: { icon: string; title: string; subtitle?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, danger && { backgroundColor: '#FFEBEE' }]}>
        <Feather name={icon as any} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, danger && { color: colors.error }]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textLight} />
    </TouchableOpacity>
  );
}

export default function PerfilScreen() {
  const { signOut, profile } = useAuthStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  async function handleLogout() {
    setShowLogoutModal(false);
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + Info */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Feather name="user" size={40} color={colors.primary} />
        </View>
        <Text style={styles.name}>{profile?.nome || 'Produtor'}</Text>
        <Text style={styles.region}>{profile?.municipio && profile?.estado ? `${profile.municipio} • ${profile.estado}` : 'Localização não definida'}</Text>
        <TouchableOpacity style={styles.editButton} onPress={() => router.push('/perfil-dados')}>
          <Feather name="edit-2" size={14} color={colors.primary} />
          <Text style={styles.editText}>Editar perfil</Text>
        </TouchableOpacity>
      </View>

      {/* Menu */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Conta</Text>
        <MenuItem icon="user" title="Dados Pessoais" subtitle="Nome, CPF, telefone" onPress={() => router.push('/perfil-dados')} />
        <MenuItem icon="map-pin" title="Propriedade" subtitle="Dados da fazenda" onPress={() => router.push('/perfil-propriedade')} />
        <MenuItem icon="award" title="Certificações" subtitle="Gerenciar certificações" onPress={() => router.push('/certificacoes')} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Configurações</Text>
        <MenuItem icon="bell" title="Notificações" subtitle="Push, email, SMS" onPress={() => router.push('/perfil-ajuda')} />
        <MenuItem icon="shield" title="Privacidade (LGPD)" subtitle="Exportar dados, excluir conta" onPress={() => router.push('/perfil-privacidade')} />
        <MenuItem icon="lock" title="Segurança" subtitle="Senha, biometria" onPress={() => router.push('/perfil-seguranca')} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Suporte</Text>
        <MenuItem icon="help-circle" title="Ajuda" onPress={() => router.push('/perfil-ajuda')} />
        <MenuItem icon="message-circle" title="Fale Conosco" onPress={() => router.push('/perfil-ajuda')} />
        <MenuItem icon="info" title="Sobre o Copa Café" subtitle="v1.0.0" onPress={() => router.push('/perfil-sobre')} />
      </View>

      <View style={styles.section}>
        <MenuItem icon="log-out" title="Sair da conta" danger onPress={() => setShowLogoutModal(true)} />
      </View>

      {/* Modal de confirmação */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconCircle}>
              <Feather name="log-out" size={28} color={colors.error} />
            </View>
            <Text style={styles.modalTitle}>Sair da conta</Text>
            <Text style={styles.modalMessage}>Tem certeza que deseja sair? Você precisará fazer login novamente.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleLogout}>
                <Text style={styles.modalConfirmText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  name: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  region: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 6,
  },
  editText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  section: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textLight, textTransform: 'uppercase', marginBottom: spacing.sm, marginLeft: spacing.xs },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuTitle: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  menuSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, width: '85%', alignItems: 'center' },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  modalMessage: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  modalButtons: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  modalCancelButton: { flex: 1, height: 48, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  modalConfirmButton: { flex: 1, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});
