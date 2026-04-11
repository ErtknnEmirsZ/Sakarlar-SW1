import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LogIn, LogOut, Shield, Info, ChevronRight } from 'lucide-react-native';
import { authStore } from '../utils/authStore';

const C = {
  bg: '#0F0F0F',
  surface: '#1C1C1C',
  highlight: '#2A2A2A',
  primary: '#F5C518',
  text: '#FFFFFF',
  sub: '#9A9A9A',
  border: '#2E2E2E',
  error: '#EF4444',
  success: '#22C55E',
};

export default function SettingsScreen() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      authStore.init().then(setIsAdmin);
    }, [])
  );

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Hata', 'Kullanıcı adı ve şifre gerekli');
      return;
    }
    setLoading(true);
    const ok = await authStore.login(username.trim(), password);
    setLoading(false);
    if (ok) {
      setIsAdmin(true);
      setUsername('');
      setPassword('');
      setShowLogin(false);
      Alert.alert('Başarılı', 'Yönetici olarak giriş yapıldı');
    } else {
      Alert.alert('Hata', 'Giriş başarısız. Lütfen tekrar deneyin.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Cıkış', 'Yönetici çıkışı yapılsın mı?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          await authStore.logout();
          setIsAdmin(false);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Info size={15} color={C.primary} />
            <Text style={styles.sectionTitle}>UYGULAMA</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.logoBadgeRow}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoBadgeText}>ST</Text>
              </View>
              <View>
                <Text style={styles.appName}>SpecTrun SW</Text>
                <Text style={styles.appSub}>& Şakarlar</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.appDesc}>Depo Fiyat Kontrol Sistemi</Text>
            <Text style={styles.appVersion}>Sürüm 3.0</Text>
          </View>
        </View>

        {/* Admin Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={15} color={C.primary} />
            <Text style={styles.sectionTitle}>YÖNETİCİ</Text>
          </View>

          {isAdmin ? (
            <View style={styles.adminCard}>
              <View style={styles.adminStatusRow}>
                <View style={styles.adminDot} />
                <Text style={styles.adminActiveText}>Yönetici olarak giriş yapıldı</Text>
              </View>
              <TouchableOpacity
                style={styles.adminPanelBtn}
                onPress={() => router.push('/admin')}
              >
                <Text style={styles.adminPanelBtnText}>Yönetim Paneline Git</Text>
                <ChevronRight size={16} color="#0A0A0A" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <LogOut size={15} color={C.error} />
                <Text style={styles.logoutBtnText}>Çıkış Yap</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.loginSection}>
              {!showLogin ? (
                <TouchableOpacity
                  style={styles.showLoginBtn}
                  onPress={() => setShowLogin(true)}
                >
                  <LogIn size={16} color={C.sub} />
                  <Text style={styles.showLoginText}>Yönetici Girişi</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.loginForm}>
                  <Text style={styles.loginFormTitle}>Yönetici Girişi</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Kullanıcı adı"
                    placeholderTextColor={C.sub}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Şifre"
                    placeholderTextColor={C.sub}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                  <TouchableOpacity
                    style={[styles.loginBtn, loading && { opacity: 0.6 }]}
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#0A0A0A" size="small" />
                    ) : (
                      <LogIn size={15} color="#0A0A0A" />
                    )}
                    <Text style={styles.loginBtnText}>
                      {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => { setShowLogin(false); setUsername(''); setPassword(''); }}
                  >
                    <Text style={styles.cancelBtnText}>İptal</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 24 },
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  logoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  appName: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  appSub: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  appDesc: { color: C.sub, fontSize: 13 },
  appVersion: { color: C.highlight, fontSize: 11, fontWeight: '600' },

  adminCard: {
    backgroundColor: 'rgba(34,197,94,0.07)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    gap: 12,
  },
  adminStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.success,
  },
  adminActiveText: {
    color: C.success,
    fontSize: 14,
    fontWeight: '600',
  },
  adminPanelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.primary,
    paddingVertical: 13,
    borderRadius: 10,
  },
  adminPanelBtnText: { color: '#0A0A0A', fontWeight: '700', fontSize: 14 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  logoutBtnText: { color: C.error, fontSize: 13, fontWeight: '600' },

  loginSection: {},
  showLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  showLoginText: { color: C.sub, fontSize: 14, fontWeight: '500' },

  loginForm: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  loginFormTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    backgroundColor: C.highlight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 14,
    borderRadius: 10,
  },
  loginBtnText: { color: '#0A0A0A', fontSize: 15, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelBtnText: { color: C.sub, fontSize: 13 },
});
