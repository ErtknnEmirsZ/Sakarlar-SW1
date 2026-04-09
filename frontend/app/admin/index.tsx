import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Plus, Upload, Search, X, Edit3, Trash2, Package } from 'lucide-react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  highlight: '#262626',
  primary: '#EAB308',
  text: '#FFFFFF',
  sub: '#A3A3A3',
  border: '#2A2A2A',
  error: '#EF4444',
};

interface Product {
  id: string;
  product_name: string;
  barcode: string;
  price: number;
}

export default function AdminScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const router = useRouter();

  const loadProducts = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const url = q.trim()
        ? `${BACKEND_URL}/api/products?q=${encodeURIComponent(q)}`
        : `${BACKEND_URL}/api/products`;
      const res = await fetch(url);
      const data = await res.json();
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stats`);
      const data = await res.json();
      setTotalCount(data.total_products);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts('');
      loadStats();
    }, [])
  );

  const handleSearch = (text: string) => {
    setQuery(text);
    loadProducts(text);
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      'Ürün Sil',
      `"${product.product_name}" silinsin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/products/${product.id}`, { method: 'DELETE' });
              loadProducts(query);
              loadStats();
            } catch {
              Alert.alert('Hata', 'Silme işlemi başarısız');
            }
          },
        },
      ]
    );
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setImporting(true);

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'text/csv',
        name: asset.name || 'import.csv',
      } as any);

      const res = await fetch(`${BACKEND_URL}/api/products/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        Alert.alert('Başarılı', `${data.imported} ürün içe aktarıldı.`);
        loadProducts('');
        loadStats();
      } else {
        Alert.alert('Hata', data.detail || 'İçe aktarma başarısız');
      }
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Dosya seçilemedi');
    } finally {
      setImporting(false);
    }
  };

  const renderItem = ({ item, index }: { item: Product; index: number }) => (
    <View testID={`admin-product-${index}`} style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.rowPrice}>{item.price.toFixed(2).replace('.', ',')} ₺</Text>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity
          testID={`edit-btn-${index}`}
          style={styles.editBtn}
          onPress={() => router.push({ pathname: '/admin/add', params: { productId: item.id } })}
        >
          <Edit3 size={16} color={C.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          testID={`delete-btn-${index}`}
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
        >
          <Trash2 size={16} color={C.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{totalCount}</Text>
          <Text style={styles.statLabel}>Toplam Ürün</Text>
        </View>
        <TouchableOpacity
          testID="import-btn"
          style={[styles.importBtn, importing && { opacity: 0.6 }]}
          onPress={handleImport}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator size="small" color="#0A0A0A" />
          ) : (
            <Upload size={18} color="#0A0A0A" />
          )}
          <Text style={styles.importBtnText}>
            {importing ? 'Yükleniyor...' : 'CSV/Excel Yükle'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Search size={16} color={C.sub} />
        <TextInput
          testID="admin-search"
          style={styles.searchInput}
          placeholder="Ürün ara..."
          placeholderTextColor={C.sub}
          value={query}
          onChangeText={handleSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <X size={16} color={C.sub} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color={C.primary} />
            ) : (
              <>
                <Package size={40} color={C.highlight} />
                <Text style={styles.emptyText}>Ürün bulunamadı</Text>
              </>
            )}
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        testID="add-product-btn"
        style={styles.fab}
        onPress={() => router.push('/admin/add')}
      >
        <Plus size={28} color="#0A0A0A" strokeWidth={2.5} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statCard: { gap: 2 },
  statNum: { color: C.primary, fontSize: 28, fontWeight: '900' },
  statLabel: { color: C.sub, fontSize: 12, fontWeight: '500' },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  importBtnText: { color: '#0A0A0A', fontWeight: '700', fontSize: 13 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 15, padding: 0 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { color: C.text, fontSize: 14, fontWeight: '500' },
  rowPrice: { color: C.primary, fontSize: 16, fontWeight: '800' },
  rowActions: { flexDirection: 'row', gap: 8 },
  editBtn: {
    width: 38, height: 38,
    borderRadius: 8,
    backgroundColor: C.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 38, height: 38,
    borderRadius: 8,
    backgroundColor: C.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: { color: C.sub, fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
});
