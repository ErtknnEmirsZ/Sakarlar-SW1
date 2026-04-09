import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Platform,
  KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Search, X, Zap, Camera, Settings, Package } from 'lucide-react-native';
import { formatPrice } from '../utils/format';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#0F0F0F',
  surface: '#1C1C1C',
  highlight: '#2A2A2A',
  primary: '#F5C518',
  text: '#FFFFFF',
  sub: '#9A9A9A',
  border: '#2E2E2E',
  temizlik: '#3B82F6',
  ambalaj: '#8B5CF6',
  gida: '#F97316',
};

const ITEM_HEIGHT = 72;

const CATEGORIES = [
  { key: 'all',      label: 'Tümü'     },
  { key: 'temizlik', label: 'Temizlik' },
  { key: 'ambalaj',  label: 'Ambalaj'  },
  { key: 'gida',     label: 'Gıda'     },
] as const;

type CategoryKey = 'all' | 'temizlik' | 'ambalaj' | 'gida';

interface Product {
  id: string;
  product_name: string;
  barcode: string;
  price: number;
  category: string;
  search_count?: number;
}

export default function MainScreen() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [speedMode, setSpeedMode] = useState(false);
  const [category, setCategory] = useState<CategoryKey>('all');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const fetchProducts = useCallback(async (q: string, cat: CategoryKey) => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (cat !== 'all') params.set('category', cat);
      const url = `${BACKEND_URL}/api/products${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Fetch error:', e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts('', 'all');
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setLoading(true);
    searchTimer.current = setTimeout(() => {
      fetchProducts(query, category);
    }, 150);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, category, fetchProducts]);

  const handleCategoryChange = (cat: CategoryKey) => {
    setCategory(cat);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const getCatLabel = (cat: string) => {
    if (cat === 'ambalaj') return 'Ambalaj';
    if (cat === 'gida') return 'Gıda';
    return 'Temizlik';
  };

  const getCatStyle = (cat: string) => {
    if (cat === 'ambalaj') return styles.catBadgeAmbalaj;
    if (cat === 'gida') return styles.catBadgeGida;
    return styles.catBadgeTemizlik;
  };

  const renderItem = useCallback(({ item, index }: { item: Product; index: number }) => (
    <TouchableOpacity
      testID={`product-item-${index}`}
      style={styles.row}
      onPress={() => router.push(`/product/${item.id}`)}
      activeOpacity={0.6}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowNameRow}>
          {(item.search_count ?? 0) >= 3 && (
            <Text style={styles.popBadge}>🔥</Text>
          )}
          <Text style={styles.rowName} numberOfLines={2}>{item.product_name}</Text>
        </View>
        <View style={[styles.catBadge, getCatStyle(item.category)]}>
          <Text style={styles.catBadgeText}>{getCatLabel(item.category)}</Text>
        </View>
      </View>
      <Text style={styles.rowPrice}>{formatPrice(item.price)}</Text>
    </TouchableOpacity>
  ), [router]);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const catColor = (cat: CategoryKey) => {
    if (cat === 'temizlik') return C.temizlik;
    if (cat === 'ambalaj') return C.ambalaj;
    if (cat === 'gida') return C.gida;
    return C.primary;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>SpecTrun & Şakarlar SW</Text>
          <TouchableOpacity
            testID="admin-button"
            style={styles.headerBtn}
            onPress={() => router.push('/admin')}
          >
            <Settings size={20} color={C.sub} />
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
        <View style={styles.catBar}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                testID={`category-${c.key}`}
                style={[
                  styles.catBtn,
                  active && { backgroundColor: catColor(c.key as CategoryKey), borderColor: catColor(c.key as CategoryKey) },
                ]}
                onPress={() => handleCategoryChange(c.key as CategoryKey)}
              >
                <Text style={[styles.catBtnText, active && styles.catBtnTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {!loading && (
            <Text style={styles.countPill}>{products.length}</Text>
          )}
        </View>

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
          initialNumToRender={20}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.empty}>
              {loading ? (
                <ActivityIndicator color={C.primary} size="large" />
              ) : (
                <>
                  <Package size={52} color={C.highlight} />
                  <Text style={styles.emptyTitle}>
                    {query.length > 0 ? 'Ürün bulunamadı' : 'Ürün yok'}
                  </Text>
                  <Text style={styles.emptyHint}>
                    {query.length > 0 ? `"${query}" için sonuç yok` : 'Arama yapın veya barkod tarayın'}
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }}
          >
            <Zap size={15} color={speedMode ? '#0A0A0A' : C.sub} strokeWidth={2.5} />
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
              <Camera size={26} color="#0A0A0A" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
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
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    flex: 1,
    marginRight: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Category bar
  catBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: 'transparent',
  },
  catBtnText: {
    color: C.sub,
    fontSize: 13,
    fontWeight: '600',
  },
  catBtnTextActive: {
    color: '#0A0A0A',
  },
  countPill: {
    marginLeft: 'auto' as any,
    color: C.sub,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: C.highlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // List
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: ITEM_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowLeft: { flex: 1, marginRight: 10 },
  rowName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 4,
  },
  catBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeTemizlik: { backgroundColor: 'rgba(59,130,246,0.2)' },
  catBadgeAmbalaj: { backgroundColor: 'rgba(139,92,246,0.2)' },
  catBadgeGida: { backgroundColor: 'rgba(249,115,22,0.2)' },
  catBadgeText: { fontSize: 10, fontWeight: '700', color: C.sub },
  rowNameRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  popBadge: { fontSize: 13, marginRight: 4, lineHeight: 20 },
  rowPrice: {
    color: C.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    minWidth: 90,
    textAlign: 'right',
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  emptyHint: { color: C.sub, fontSize: 14, textAlign: 'center' },

  // Bottom Bar
  bottomBar: {
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 4 : 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.highlight,
  },
  speedBtnActive: { backgroundColor: C.primary },
  speedText: { color: C.sub, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  speedTextActive: { color: '#0A0A0A' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.highlight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    padding: 0,
  },
  scanBtn: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
