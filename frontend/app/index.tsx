import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Search, X, Zap, Camera, Settings, Package } from 'lucide-react-native';
import { formatPrice } from '../utils/format';

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

const ITEM_HEIGHT = 64;

interface Product {
  id: string;
  product_name: string;
  barcode: string;
  price: number;
}

export default function MainScreen() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [speedMode, setSpeedMode] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const fetchProducts = useCallback(async (q: string) => {
    try {
      const url = q.trim()
        ? `${BACKEND_URL}/api/products?q=${encodeURIComponent(q.trim())}`
        : `${BACKEND_URL}/api/products`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setProducts(data);
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts('');
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setLoading(true);
    searchTimer.current = setTimeout(() => {
      fetchProducts(query);
    }, 150);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, fetchProducts]);

  const renderItem = useCallback(({ item, index }: { item: Product; index: number }) => (
    <TouchableOpacity
      testID={`product-item-${index}`}
      style={styles.row}
      onPress={() => router.push(`/product/${item.id}`)}
      activeOpacity={0.65}
    >
      <Text style={styles.rowName} numberOfLines={1}>{item.product_name}</Text>
      <Text style={styles.rowPrice}>{formatPrice(item.price)}</Text>
    </TouchableOpacity>
  ), [router]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Şakarlar SW</Text>
          <TouchableOpacity
            testID="admin-button"
            style={styles.headerBtn}
            onPress={() => router.push('/admin')}
          >
            <Settings size={22} color={C.sub} />
          </TouchableOpacity>
        </View>

        {/* Product Count */}
        {!loading && (
          <View style={styles.countBar}>
            <Text style={styles.countText}>{products.length} ürün</Text>
          </View>
        )}

        {/* Product List */}
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          maxToRenderPerBatch={20}
          initialNumToRender={25}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.empty}>
              {loading ? (
                <ActivityIndicator color={C.primary} size="large" />
              ) : (
                <>
                  <Package size={48} color={C.highlight} />
                  <Text style={styles.emptyText}>
                    {query.length > 0 ? 'Ürün bulunamadı' : 'Ürün listesi yükleniyor...'}
                  </Text>
                </>
              )}
            </View>
          }
        />

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          {/* Speed Mode */}
          <TouchableOpacity
            testID="speed-mode-toggle"
            style={[styles.speedBtn, speedMode && styles.speedBtnActive]}
            onPress={() => {
              setSpeedMode(!speedMode);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Zap size={14} color={speedMode ? '#0A0A0A' : C.sub} strokeWidth={2.5} />
            <Text style={[styles.speedText, speedMode && styles.speedTextActive]}>
              HIZ MODU {speedMode ? 'AÇIK' : 'KAPALI'}
            </Text>
          </TouchableOpacity>

          {/* Search Row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Search size={18} color={C.sub} />
              <TextInput
                testID="search-input"
                style={styles.searchInput}
                placeholder="Ürün adı ara..."
                placeholderTextColor={C.sub}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity testID="clear-search" onPress={() => setQuery('')}>
                  <X size={18} color={C.sub} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              testID="scan-button"
              style={styles.scanBtn}
              onPress={() =>
                router.push({
                  pathname: '/scanner',
                  params: { speedMode: speedMode ? '1' : '0' },
                })
              }
            >
              <Camera size={26} color="#0A0A0A" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: C.highlight,
  },
  countBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: C.bg,
  },
  countText: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: ITEM_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowName: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    fontWeight: '500',
    marginRight: 12,
  },
  rowPrice: {
    color: C.primary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 16,
  },
  emptyText: {
    color: C.sub,
    fontSize: 15,
    textAlign: 'center',
  },
  bottomBar: {
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.highlight,
  },
  speedBtnActive: {
    backgroundColor: C.primary,
  },
  speedText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  speedTextActive: {
    color: '#0A0A0A',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.highlight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    padding: 0,
  },
  scanBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
