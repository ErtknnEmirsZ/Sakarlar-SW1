import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Search, X, Zap, Camera, Settings, Package, ShoppingCart } from 'lucide-react-native';
import { formatPrice } from '../utils/format';
import { useCartStore } from '../utils/cartStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#0F0F0F',
  surface: '#1A1A1A',
  highlight: '#252525',
  primary: '#F5C518',
  text: '#FFFFFF',
  sub: '#9A9A9A',
  border: '#2A2A2A',
  temizlik: '#3B82F6',
  ambalaj: '#8B5CF6',
  gida: '#F97316',
  success: '#22C55E',
  warning: '#FBBF24',
  danger: '#EF4444',
};

const ITEM_HEIGHT = 78;

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
  stock_quantity?: number | null;
  vat_excluded_price?: number | null;
  search_count?: number;
  quantity_type?: string;
  box_quantity?: number;
}

// Returns label + color for stock badge
const getStockBadge = (qty?: number | null): { text: string; color: string } | null => {
  if (qty == null) return null;
  if (qty === 0) return { text: 'Tükendi', color: '#EF4444' };
  if (qty < 10)  return { text: `Az: ${qty} adet`, color: '#F97316' };
  if (qty <= 50) return { text: `Stok: ${qty} adet`, color: '#FBBF24' };
  return { text: `Stok: ${qty} adet`, color: '#22C55E' };
};

const getCatLabel = (cat: string) => {
  if (cat === 'ambalaj') return 'Ambalaj';
  if (cat === 'gida') return 'Gıda';
  if (cat === 'diger') return 'Diğer';
  return 'Temizlik';
};

const getCatBadgeStyle = (cat: string) => {
  if (cat === 'ambalaj') return styles.catBadgeAmbalaj;
  if (cat === 'gida') return styles.catBadgeGida;
  return styles.catBadgeTemizlik;
};

const getCatTextStyle = (cat: string) => {
  if (cat === 'ambalaj') return { color: C.ambalaj };
  if (cat === 'gida') return { color: C.gida };
  return { color: C.temizlik };
};

export default function MainScreen() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [speedMode, setSpeedMode] = useState(false);
  const [category, setCategory] = useState<CategoryKey>('all');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  // Sepet sayısını tek selector'da hesapla
  const cartCount = useCartStore(state =>
    state.items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)
  );

  const fetchProducts = useCallback(async (
    q: string,
    cat: CategoryKey,
    pageNum: number = 1,
    append: boolean = false,
  ) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      if (cat !== 'all') params.set('category', cat);
      const url = `${BACKEND_URL}/api/products?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const result = await res.json();
      // Yeni sayfalama formatı: {data, total, page, has_more}
      const data: Product[] = Array.isArray(result) ? result : (result.data ?? []);
      const more: boolean = result.has_more ?? false;
      const total: number = result.total ?? data.length;
      if (append) {
        setProducts(prev => [...prev, ...data]);
      } else {
        setProducts(data);
      }
      setHasMore(more);
      setPage(pageNum);
      setTotalCount(total);
    } catch {
      if (!append) setProducts([]);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setLoading(true);
    setPage(1);
    setHasMore(true);
    searchTimer.current = setTimeout(() => {
      fetchProducts(query, category, 1, false);
    }, 150);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  // Infinite scroll: sonraki sayfayı yükle
  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    fetchProducts(query, category, page + 1, true);
  }, [loadingMore, loading, hasMore, page, query, category, fetchProducts]);

  const handleCategoryChange = (cat: CategoryKey) => {
    setCategory(cat);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const catAccent = (cat: CategoryKey) => {
    if (cat === 'temizlik') return C.temizlik;
    if (cat === 'ambalaj') return C.ambalaj;
    if (cat === 'gida') return C.gida;
    return C.primary;
  };

  const renderItem = useCallback(({ item, index }: { item: Product; index: number }) => {
    const stockBadge = getStockBadge(item.stock_quantity);
    const hasBox = (item.box_quantity ?? 1) > 1;
    const boxPrice = hasBox ? item.price * (item.box_quantity ?? 1) : null;

    return (
      <TouchableOpacity
        testID={`product-item-${index}`}
        style={styles.row}
        onPress={() => router.push(`/product/${item.id}`)}
        activeOpacity={0.55}
      >
        {/* Category color stripe */}
        <View style={[styles.catStripe, getCatBadgeStyle(item.category)]} />

        <View style={styles.rowMain}>
          <View style={styles.rowLeft}>
            {/* Name row */}
            <View style={styles.nameRow}>
              {(item.search_count ?? 0) >= 3 && (
                <Text style={styles.popBadge}>🔥</Text>
              )}
              <Text style={styles.rowName} numberOfLines={2}>{item.product_name}</Text>
            </View>
            {/* Badges row */}
            <View style={styles.badgesRow}>
              <View style={[styles.catBadge, getCatBadgeStyle(item.category)]}>
                <Text style={[styles.catBadgeText, getCatTextStyle(item.category)]}>
                  {getCatLabel(item.category)}
                </Text>
              </View>
              {stockBadge && (
                <View style={[styles.stockBadge, { backgroundColor: stockBadge.color + '20' }]}>
                  <Text style={[styles.stockBadgeText, { color: stockBadge.color }]}>
                    {stockBadge.text}
                  </Text>
                </View>
              )}
              {hasBox && (
                <View style={styles.boxBadge}>
                  <Text style={styles.boxBadgeText}>
                    {item.box_quantity}'li {item.quantity_type ?? 'kutu'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceCol}>
            <Text style={styles.rowPrice}>{formatPrice(item.price)}</Text>
            {boxPrice != null && (
              <Text style={styles.boxPriceSmall}>
                Koli: {formatPrice(boxPrice)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.accentStrip} />
          <View style={styles.headerContent}>
            <View style={styles.logoRow}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoBadgeText}>ST</Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>SpecTrun SW</Text>
                <Text style={styles.headerSubTitle}>& Şakarlar</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {/* Sepet butonu */}
              <TouchableOpacity
                testID="cart-button"
                style={styles.headerBtn}
                onPress={() => router.push('/cart')}
              >
                <ShoppingCart size={20} color={cartCount > 0 ? C.primary : C.sub} />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {cartCount > 99 ? '99+' : Math.round(cartCount)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="settings-button"
                style={styles.headerBtn}
                onPress={() => router.push('/settings')}
              >
                <Settings size={20} color={C.sub} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Category Filter */}
        <View style={styles.catBar}>
          <View style={styles.catBtns}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              const acc = catAccent(c.key as CategoryKey);
              return (
                <TouchableOpacity
                  key={c.key}
                  testID={`category-${c.key}`}
                  style={[
                    styles.catBtn,
                    active && { backgroundColor: acc + '22', borderColor: acc },
                  ]}
                  onPress={() => handleCategoryChange(c.key as CategoryKey)}
                >
                  <Text style={[
                    styles.catBtnText,
                    active && { color: acc, fontWeight: '700' },
                  ]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!loading && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{products.length}</Text>
            </View>
          )}
        </View>

        {/* Product List */}
        <FlashList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={ITEM_HEIGHT}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.4}
          onEndReached={handleLoadMore}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreIndicator}>
                <ActivityIndicator color={C.primary} size="small" />
                <Text style={styles.loadMoreText}>
                  {products.length} / {totalCount} ürün
                </Text>
              </View>
            ) : hasMore && products.length > 0 ? (
              <View style={styles.loadMoreIndicator}>
                <Text style={styles.loadMoreText}>
                  {products.length} / {totalCount} ürün yüklendi
                </Text>
              </View>
            ) : products.length > 0 ? (
              <View style={styles.loadMoreIndicator}>
                <Text style={styles.loadMoreTextDone}>
                  ✓ Tüm {totalCount} ürün yüklendi
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {loading ? (
                <ActivityIndicator color={C.primary} size="large" />
              ) : (
                <>
                  <Package size={44} color={C.highlight} strokeWidth={1.5} />
                  <Text style={styles.emptyTitle}>Ürün bulunamadı</Text>
                  <Text style={styles.emptySub}>
                    {query ? `"${query}" için sonuç yok` : 'Arama kutusuna yazabilirsiniz'}
                  </Text>
                </>
              )}
            </View>
          }
        />

        {/* Bottom Action Bar */}
        <View style={styles.bottomBar}>
          {/* Speed Mode Toggle */}
          <TouchableOpacity
            testID="speed-mode-btn"
            style={[styles.speedBtn, speedMode && styles.speedBtnActive]}
            onPress={() => {
              setSpeedMode(!speedMode);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }}
          >
            <Zap size={14} color={speedMode ? '#0A0A0A' : C.sub} fill={speedMode ? '#0A0A0A' : 'none'} />
            <Text style={[styles.speedBtnText, speedMode && styles.speedBtnTextActive]}>
              {speedMode ? 'Hız Modu AÇİK' : 'Hız Modu'}
            </Text>
          </TouchableOpacity>

          {/* Search Input */}
          <View style={styles.searchBox}>
            <Search size={15} color={C.sub} />
            <TextInput
              testID="search-input"
              style={styles.searchInput}
              placeholder="Ürün ara..."
              placeholderTextColor={C.sub}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <X size={14} color={C.sub} />
              </TouchableOpacity>
            )}
          </View>

          {/* Scanner Button */}
          <TouchableOpacity
            testID="scanner-button"
            style={styles.scanBtn}
            onPress={() => router.push({ pathname: '/scanner', params: { speedMode: speedMode ? '1' : '0' } })}
          >
            <Camera size={22} color="#0A0A0A" />
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  accentStrip: {
    height: 3,
    backgroundColor: C.primary,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerSubTitle: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headerBtn: {
    width: 38, height: 38,
    borderRadius: 10,
    backgroundColor: C.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: '#0A0A0A',
    fontSize: 9,
    fontWeight: '900',
  },
  // ── Infinite scroll footer ─────────────────────────────────
  loadMoreIndicator: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  loadMoreText: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '500',
  },
  loadMoreTextDone: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Category Bar
  catBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 6,
  },
  catBtns: {
    flexDirection: 'row',
    flex: 1,
    gap: 6,
  },
  catBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    backgroundColor: C.highlight,
  },
  catBtnText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: C.highlight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
  },

  // Product List
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    height: ITEM_HEIGHT,
    backgroundColor: C.bg,
  },
  catStripe: {
    width: 3,
    alignSelf: 'stretch',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowLeft: {
    flex: 1,
    gap: 4,
    paddingRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  popBadge: { fontSize: 12, lineHeight: 18 },
  rowName: {
    color: C.text,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 19,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  catBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  catBadgeTemizlik: { backgroundColor: 'rgba(59,130,246,0.12)' },
  catBadgeAmbalaj: { backgroundColor: 'rgba(139,92,246,0.12)' },
  catBadgeGida: { backgroundColor: 'rgba(249,115,22,0.12)' },
  catBadgeText: { fontSize: 10, fontWeight: '700' },

  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  stockBadgeText: { fontSize: 9, fontWeight: '700' },

  priceCol: { alignItems: 'flex-end' },
  rowPrice: {
    color: C.primary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  boxPriceSmall: {
    color: '#22C55E',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  boxBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  boxBadgeText: { color: '#22C55E', fontSize: 9, fontWeight: '700' },

  // Empty state
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: { color: C.sub, fontSize: 16, fontWeight: '600' },
  emptySub: { color: C.highlight, fontSize: 13 },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.highlight,
  },
  speedBtnActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  speedBtnText: { color: C.sub, fontSize: 10, fontWeight: '600' },
  speedBtnTextActive: { color: '#0A0A0A' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.highlight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14, padding: 0 },
  scanBtn: {
    width: 44, height: 44,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
