import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Camera, Save, Trash2 } from 'lucide-react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#0F0F0F',
  surface: '#1C1C1C',
  highlight: '#2A2A2A',
  primary: '#F5C518',
  text: '#FFFFFF',
  sub: '#9A9A9A',
  border: '#2E2E2E',
  error: '#EF4444',
  temizlik: '#3B82F6',
  ambalaj: '#8B5CF6',
};

type Category = 'temizlik' | 'ambalaj';

export default function AddProductScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const isEdit = !!productId;

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<Category>('temizlik');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isEdit && productId) {
      setLoading(true);
      fetch(`${BACKEND_URL}/api/products/${productId}`)
        .then((r) => r.json())
        .then((p) => {
          if (!p || !p.id) return;
          setName(p.product_name || '');
          setBarcode(p.barcode || '');
          setPrice(String(p.price ?? '').replace('.', ','));
          setCategory((p.category === 'ambalaj' ? 'ambalaj' : 'temizlik') as Category);
        })
        .catch(() => Alert.alert('Hata', 'Ürün yüklenemedi'))
        .finally(() => setLoading(false));
    }
  }, [productId]);

  // Receive barcode from scanner
  useFocusEffect(
    useCallback(() => {
      import('../../utils/scanStore').then(({ scanStore }) => {
        if (scanStore.pendingBarcode) {
          setBarcode(scanStore.pendingBarcode);
          scanStore.pendingBarcode = null;
        }
      }).catch(() => {});
    }, [])
  );

  const handleSave = async () => {
    const trimName = name.trim();
    const trimBarcode = barcode.trim();
    if (!trimName) { Alert.alert('Uyarı', 'Ürün adı zorunludur'); return; }
    if (!trimBarcode) { Alert.alert('Uyarı', 'Barkod zorunludur'); return; }
    const priceNum = parseFloat(price.replace(',', '.'));
    if (isNaN(priceNum) || priceNum < 0) { Alert.alert('Uyarı', 'Geçerli bir fiyat girin'); return; }

    setSaving(true);
    try {
      const body = { product_name: trimName, barcode: trimBarcode, price: priceNum, category };
      const url = isEdit ? `${BACKEND_URL}/api/products/${productId}` : `${BACKEND_URL}/api/products`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.back();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Hata', err.detail || 'Kayıt başarısız');
      }
    } catch {
      Alert.alert('Hata', 'Sunucuya bağlanılamadı');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Ürün Sil', 'Bu ürün silinsin mi?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${BACKEND_URL}/api/products/${productId}`, { method: 'DELETE' });
            router.back();
          } catch {
            Alert.alert('Hata', 'Silme işlemi başarısız');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Category Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>KATEGORİ *</Text>
            <View style={styles.catRow}>
              <TouchableOpacity
                testID="category-temizlik"
                style={[styles.catBtn, category === 'temizlik' && styles.catBtnActiveTemizlik]}
                onPress={() => setCategory('temizlik')}
              >
                <Text style={[styles.catBtnText, category === 'temizlik' && styles.catBtnTextActive]}>
                  Temizlik
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="category-ambalaj"
                style={[styles.catBtn, category === 'ambalaj' && styles.catBtnActiveAmbalaj]}
                onPress={() => setCategory('ambalaj')}
              >
                <Text style={[styles.catBtnText, category === 'ambalaj' && styles.catBtnTextActive]}>
                  Ambalaj
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Product Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ÜRÜN ADI *</Text>
            <TextInput
              testID="product-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ürün adını girin"
              placeholderTextColor={C.sub}
              autoCapitalize="words"
            />
          </View>

          {/* Barcode */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>BARKOD *</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                testID="barcode-input"
                style={[styles.input, { flex: 1 }]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Barkod numarası"
                placeholderTextColor={C.sub}
                keyboardType="numeric"
                autoCorrect={false}
              />
              <TouchableOpacity
                testID="scan-barcode-btn"
                style={styles.scanBtn}
                onPress={() => router.push({ pathname: '/scanner', params: { mode: 'select' } })}
              >
                <Camera size={22} color="#0A0A0A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Price */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FİYAT (₺) *</Text>
            <TextInput
              testID="price-input"
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0,00"
              placeholderTextColor={C.sub}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            testID="save-product-btn"
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#0A0A0A" size="small" />
            ) : (
              <Save size={20} color="#0A0A0A" />
            )}
            <Text style={styles.saveBtnText}>
              {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Kaydet'}
            </Text>
          </TouchableOpacity>

          {/* Delete Button (edit only) */}
          {isEdit && (
            <TouchableOpacity
              testID="delete-product-btn"
              style={styles.deleteBtn}
              onPress={handleDelete}
            >
              <Trash2 size={18} color={C.error} />
              <Text style={styles.deleteBtnText}>Ürünü Sil</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  scroll: { padding: 20, gap: 20 },
  fieldGroup: { gap: 8 },
  fieldLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: C.text,
    fontSize: 16,
  },
  catRow: { flexDirection: 'row', gap: 10 },
  catBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  catBtnActiveTemizlik: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: '#3B82F6',
  },
  catBtnActiveAmbalaj: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderColor: '#8B5CF6',
  },
  catBtnText: { color: C.sub, fontSize: 15, fontWeight: '600' },
  catBtnTextActive: { color: C.text },
  barcodeRow: { flexDirection: 'row', gap: 8 },
  scanBtn: {
    width: 52, height: 52,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveBtnText: { color: '#0A0A0A', fontSize: 17, fontWeight: '800' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.error,
    marginTop: 4,
  },
  deleteBtnText: { color: C.error, fontSize: 15, fontWeight: '600' },
});
