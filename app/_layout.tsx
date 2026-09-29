import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { colors } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { supabase } from '../src/services/supabase';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, initialized, profile, initialize, onboardingDone, setOnboardingDone } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initialize();
    AsyncStorage.getItem('@copa_cafe_onboarding_done').then((val) => {
      setOnboardingDone(val === 'true');
    });

    // Ouvir evento de recuperação de senha (após setSession abaixo, o Supabase
    // emite PASSWORD_RECOVERY automaticamente)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/redefinir-senha');
      }
    });

    // Captura tokens do deep link (copa-cafe://redefinir-senha#access_token=...&type=recovery)
    // O email do Supabase abre a página web em docs/redefinir-senha.html que faz o redirect
    // pra esse scheme, trazendo os tokens no fragment.
    const handleDeepLink = async (url: string | null) => {
      if (!url || url.indexOf('#') === -1) return;
      const fragment = url.split('#')[1];
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');
      if (type === 'recovery' && accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    };
    Linking.getInitialURL().then(handleDeepLink);
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!initialized || onboardingDone === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inCadastro = segments[0] === '(auth)' && (segments as string[])[1] === 'cadastro';
    const inCadastroConcluido = inCadastro && (segments as string[])[2] === 'concluido';
    const inOnboarding = segments[0] === 'onboarding';
    const inRedefinirSenha = segments[0] === 'redefinir-senha';
    // Tela pública de preços: acessível sem login (vem do "Ver preço do café
    // hoje" no login). Logado também pode abrir — não redireciona.
    const inPublicPrecos = segments[0] === 'precos';

    if (inRedefinirSenha) return; // Não interferir na redefinição de senha
    if (inCadastroConcluido) return; // Não interferir na tela de conclusão

    if (!onboardingDone && !inOnboarding) {
      // Primeiro acesso → onboarding
      router.replace('/onboarding');
    } else if (!user && !inAuthGroup && !inOnboarding && !inPublicPrecos) {
      // Não logado → login
      router.replace('/(auth)/login');
    } else if (user && !profile && !inCadastro) {
      // Logado mas sem perfil → completar cadastro
      router.replace('/(auth)/cadastro/perfil');
    } else if (user && profile && inAuthGroup) {
      // Logado com perfil completo → tabs
      router.replace('/(tabs)');
    }
  }, [user, initialized, profile, segments, onboardingDone]);

  if (!initialized || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthGuard>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
          // Evita o back button mostrar o nome cru da rota anterior (ex.: "(auth)/login")
          headerBackTitle: 'Voltar',
        }}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="precos" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sms-login" options={{ title: 'Login por SMS', headerShown: true }} />
        <Stack.Screen name="(auth)/recuperar-senha" options={{ title: 'Recuperar Senha', headerShown: true }} />
        <Stack.Screen name="(auth)/cadastro/index" options={{ title: 'Cadastro', headerShown: true }} />
        <Stack.Screen name="(auth)/cadastro/verificacao" options={{ title: 'Verificação', headerShown: true }} />
        <Stack.Screen name="(auth)/cadastro/perfil" options={{ title: 'Seus Dados', headerShown: true }} />
        <Stack.Screen name="(auth)/cadastro/fazenda" options={{ title: 'Sua Fazenda', headerShown: true }} />
        <Stack.Screen name="(auth)/cadastro/termos" options={{ title: 'Termos', headerShown: true }} />
        <Stack.Screen name="(auth)/cadastro/concluido" options={{ headerShown: false }} />
        <Stack.Screen name="diario" options={{ headerShown: false }} />
        <Stack.Screen name="perfil-dados" options={{ headerShown: false }} />
        <Stack.Screen name="perfil-propriedade" options={{ headerShown: false }} />
        <Stack.Screen name="perfil-seguranca" options={{ headerShown: false }} />
        <Stack.Screen name="perfil-privacidade" options={{ headerShown: false }} />
        <Stack.Screen name="perfil-ajuda" options={{ headerShown: false }} />
        <Stack.Screen name="perfil-sobre" options={{ headerShown: false }} />
        <Stack.Screen name="novo-lote" options={{ headerShown: false }} />
        <Stack.Screen name="talhoes" options={{ headerShown: false }} />
        <Stack.Screen name="custos" options={{ headerShown: false }} />
        <Stack.Screen name="nova-despesa" options={{ headerShown: false }} />
        <Stack.Screen name="analise-planta" options={{ headerShown: false }} />
        <Stack.Screen name="simulador-venda" options={{ headerShown: false }} />
        <Stack.Screen name="alertas-preco" options={{ headerShown: false }} />
        <Stack.Screen name="notificacoes" options={{ headerShown: false }} />
        <Stack.Screen name="notificacoes-config" options={{ headerShown: false }} />
        <Stack.Screen name="fale-conosco" options={{ headerShown: false }} />
        <Stack.Screen name="lote-detalhe" options={{ headerShown: false }} />
        <Stack.Screen name="marketplace" options={{ headerShown: false }} />
        <Stack.Screen name="produto-detalhe" options={{ headerShown: false }} />
        <Stack.Screen name="carrinho" options={{ headerShown: false }} />
        <Stack.Screen name="certificacoes" options={{ headerShown: false }} />
        <Stack.Screen name="redefinir-senha" options={{ title: 'Redefinir Senha', headerShown: false }} />
      </Stack>
    </AuthGuard>
  );
}
