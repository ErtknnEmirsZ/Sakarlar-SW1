import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1A1A1A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          contentStyle: { backgroundColor: '#0A0A0A' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="scanner"
          options={{ title: 'Barkod Tara', presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen name="product/[id]" options={{ title: 'Ürün Detayı' }} />
        <Stack.Screen name="admin/index" options={{ title: 'Yönetim Paneli' }} />
        <Stack.Screen name="admin/add" options={{ title: 'Ürün Ekle/Düzenle' }} />
        <Stack.Screen name="settings" options={{ title: 'Ayarlar' }} />
      </Stack>
    </>
  );
}
