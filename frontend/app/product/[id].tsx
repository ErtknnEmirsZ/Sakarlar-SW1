import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ActivityIndicator, TouchableOpacity, TextInput,
  ScrollView, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShoppingCart, Scale, Package, ArrowLeft, Plus, Minus } from 'lucide-react-native';
import { formatPrice } from '../../utils/format';
import { useCartStore } from '../../utils/cartStore';

import { Platform } from 'react-native';

const BACKEND_URL = Platform.OS === 'web' ? 'http://localhost:8001' : process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#0F0F0F', surface: '#1C1C1C', highlight: '#2A2A2A',
  primary: '#F5C518', text: '#FFFFFF', sub: '#9A9A9A',
  border: '#2E2E2E', success: '#22C55E', error: '#EF4444',
  warning: '#FBBF24', temizlik: '#3B82F6',
  ambalaj: '#8B5CF6', gida: '#F97316',
};

interface Product {
  id: string;
  product_name: string;
  barcode: string;
  price: number;
  category: string;
  stock_quantity?: number | null;
  vat_excluded_price?: number | null;
  quantity_type?: string;
  box_quantity?: number;
  is_weight_based?: boolean;
}

// Quick-pick buttons for weight and unit modes
const WEIGHT_PRESETS = [0.25, 0.5, 1, 2, 5];
const UNIT_PRESETS   = [1, 2, 5, 10, 20];

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState('1');
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const { addItem, totalCount } = useCartStore();
  const cartCount = totalCount();

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`${BACKEND_URL}/api/products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) {
          setProduct(data);
          setQty(data.is_weight_based ? '1.000' : '1');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch(`${BACKEND_URL}/api/products/${id}/view`, { method: 'POST' }).catch(() => {});
  }, [id]);

  const parsedQty = parseFloat(qty.replace(',', '.')) || 0;
  const total     = product ? product.price * parsedQty : 0;
  const isWeight  = product?.is_weight_based ?? false;
  const unitLabel = isWeight ? 'kg' : (product?.quantity_type ?? 'adet');

  const handleAddToCart = useCallback(() => {
    if (!product || parsedQty <= 0) return;
    addItem(product, parsedQty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }, [product, parsedQty, addItem]);

  const adjustQty = (delta: number) => {
    if (!product) return;
    const step = isWeight ? 0.25 : 1;
    const next = Math.max(isWeight ? 0.25 : 1, parsedQty + delta * step);
    setQty(isWeight ? next.toFixed(3) : String(next));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={C.primary} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorCenter}>
          <Text style={styles.errorText}>Ürün bulunamadı</Text>
          <TouchableOpacity style={styles.backBtn2} onPress={() => router.back()}>
            <Text style={styles.backBtn2Text}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const catColor =
    product.category === 'ambalaj' ? C.ambalaj :
    product.category === 'gida'    ? C.gida : C.temizlik;
  const catLabel =
    product.category === 'ambalaj' ? 'Ambalaj' :
    product.category === 'gida'    ? 'Gıda' :
    product.category === 'temizlik'? 'Temizlik' : 'Diğer';

  const qty_n = product.stock_quantity ?? null;
  const stockColor =
    qty_n == null ? '#9A9A9A' :
    qty_n === 0   ? C.error :
    qty_n < 10    ? '#F97316' :
    qty_n <= 50   ? C.warning : C.success;
  const stockLabel =
    qty_n == null ? 'Bilinmiyor' :
    qty_n === 0   ? 'Tükendi • 0 adet' :
    qty_n < 10    ? `Az Kaldı • ${qty_n} adet` :
    `Stok: ${qty_n} adet`;

  const boxQty    = product.box_quantity ?? 1;
  const qType     = product.quantity_type ?? 'adet';
  const boxPrice  = boxQty > 1 ? product.price * boxQty : null;

  return (
    <SafeAreaView style={styles.container} testID="product-detail">
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>

        {/* ── Price Hero ─────────────────────────────────────────────── */}
        <View style={styles.priceHero}>
          {/* Unit price */}
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>
              {isWeight ? 'KG FIYATI' : 'BİRİM FİYATI'}
            </Text>
            <Text style={styles.price} testID="product-price">{formatPrice(product.price)}</Text>
            {product.vat_excluded_price != null && product.vat_excluded_price > 0 && (
              <Text style={styles.vatPrice}>KDV Hariç: {formatPrice(product.vat_excluded_price)}</Text>
            )}
          </View>

          {/* Box price (unit products with box_quantity > 1) */}
          {!isWeight && boxPrice != null && (
            <>
              <View style={styles.priceDivider} />
              <View style={styles.priceBlock}>
                <Text style={styles.priceLabel}>{qType.toUpperCase()} ({boxQty} ADET)</Text>
                <Text style={[styles.price, styles.boxPriceText]}>{formatPrice(boxPrice)}</Text>
                <Text style={styles.boxPriceSub}>{boxQty} × {formatPrice(product.price)}</Text>
              </View>
            </>
          )}

          {/* Cart badge */}
          {cartCount > 0 && (
            <TouchableOpacity
              style={styles.cartBadge}
              onPress={() => router.push('/cart')}
            >
              <ShoppingCart size={16} color="#0A0A0A" />
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Info Card ──────────────────────────────────────────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.productName} testID="product-name">{product.product_name}</Text>
          <View style={styles.tagsRow}>
            <View style={[styles.catBadge, { backgroundColor: catColor + '22', borderColor: catColor }]}>
              <Text style={[styles.catBadgeText, { color: catColor }]}>{catLabel}</Text>
            </View>
            {isWeight && (
              <View style={styles.weightBadge}>
                <Scale size={10} color={C.primary} />
                <Text style={styles.weightBadgeText}>KG Ürün</Text>
              </View>
            )}
            {boxQty > 1 && !isWeight && (
              <View style={styles.boxBadge}>
                <Package size={10} color={C.success} />
                <Text style={styles.boxBadgeText}>{boxQty}'li {qType}</Text>
              </View>
            )}
            <View style={[styles.stockBadge, { backgroundColor: stockColor + '22' }]}>
              <Text style={[styles.stockBadgeText, { color: stockColor }]}>{stockLabel}</Text>
            </View>
          </View>
          {/* Barcode */}
          <View style={styles.barcodeRow}>
            <Text style={styles.barcodeLabel}>BARKOD</Text>
            <Text style={styles.barcodeValue}>{product.barcode}</Text>
          </View>
        </View>

        {/* ── Quantity Calculator ────────────────────────────────────── */}
        <View style={styles.calcSection}>
          <Text style={styles.calcTitle}>
            {isWeight ? '⚖️ KG HESAPLAYICI' : '🧮 MİKTAR HESAPLAYICI'}
          </Text>

          {/* Quick presets */}
          <View style={styles.presetRow}>
            {(isWeight ? WEIGHT_PRESETS : UNIT_PRESETS).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.preset, parsedQty === p && styles.presetActive]}
                onPress={() => setQty(isWeight ? p.toFixed(3) : String(p))}
              >
                <Text style={[styles.presetText, parsedQty === p && styles.presetTextActive]}>
                  {isWeight ? `${p} kg` : `${p} adet`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Manual input row */}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustQty(-1)}>
              <Minus size={18} color={C.text} />
            </TouchableOpacity>

            <View style={styles.inputWrap}>
              <TextInput
                style={styles.qtyInput}
                value={qty}
                onChangeText={setQty}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <Text style={styles.qtyUnit}>{unitLabel}</Text>
            </View>

            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustQty(1)}>
              <Plus size={18} color={C.text} />
            </TouchableOpacity>
          </View>

          {/* Total */}
          {parsedQty > 0 && (
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>TOPLAM</Text>
              <Text style={styles.totalPrice}>{formatPrice(total)}</Text>
              <Text style={styles.totalDetail}>
                {formatPrice(product.price)} × {parsedQty}{unitLabel}
              </Text>
            </View>
          )}
        </View>

        {/* ── Add to Cart ────────────────────────────────────────────── */}
        <View style={styles.cartActions}>
          <TouchableOpacity
            style={[styles.addBtn, added && styles.addBtnDone]}
            onPress={handleAddToCart}
            disabled={parsedQty <= 0}
          >
            <ShoppingCart size={20} color="#0A0A0A" />
            <Text style={styles.addBtnText}>
              {added ? '✓ Sepete Eklendi' : `Sepete Ekle — ${formatPrice(total)}`}
            </Text>
          </TouchableOpacity>

          {cartCount > 0 && (
            <TouchableOpacity style={styles.viewCartBtn} onPress={() => router.push('/cart')}>
              <Text style={styles.viewCartText}>Sepeti Görüntüle ({cartCount})</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { color: C.sub, fontSize: 16 },
  backBtn2: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  backBtn2Text: { color: '#0A0A0A', fontWeight: '700' },

  // Price Hero
  priceHero: {
    backgroundColor: C.surface, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: C.border,
    position: 'relative',
  },
  priceBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 16 },
  priceDivider: { width: 1, height: 60, backgroundColor: C.border },
  priceLabel: { color: C.sub, fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6, textAlign: 'center' },
  price: { color: C.primary, fontSize: 36, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  boxPriceText: { color: C.success, fontSize: 30 },
  boxPriceSub: { color: C.sub, fontSize: 10, marginTop: 2, textAlign: 'center' },
  vatPrice: { color: C.sub, fontSize: 11, marginTop: 3, textAlign: 'center' },
  cartBadge: {
    position: 'absolute', top: 12, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  cartBadgeText: { color: '#0A0A0A', fontSize: 12, fontWeight: '800' },

  // Info Card
  infoCard: { backgroundColor: C.surface, padding: 20, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  productName: { color: C.text, fontSize: 20, fontWeight: '800', lineHeight: 28 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  catBadgeText: { fontSize: 11, fontWeight: '700' },
  weightBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary },
  weightBadgeText: { color: C.primary, fontSize: 11, fontWeight: '700' },
  boxBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: C.success + '20', borderWidth: 1, borderColor: C.success },
  boxBadgeText: { color: C.success, fontSize: 11, fontWeight: '700' },
  stockBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stockBadgeText: { fontSize: 11, fontWeight: '700' },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barcodeLabel: { color: C.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  barcodeValue: { color: C.text, fontSize: 14, letterSpacing: 2, fontFamily: 'monospace' },

  // Calculator
  calcSection: {
    backgroundColor: C.surface, marginTop: 8,
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.border, gap: 14,
  },
  calcTitle: { color: C.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: C.highlight, borderWidth: 1, borderColor: C.border,
  },
  presetActive: { backgroundColor: C.primary + '20', borderColor: C.primary },
  presetText: { color: C.sub, fontSize: 12, fontWeight: '600' },
  presetTextActive: { color: C.primary },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center',
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.highlight, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, height: 52,
  },
  qtyInput: { flex: 1, color: C.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  qtyUnit: { color: C.sub, fontSize: 13, fontWeight: '600' },
  totalBox: {
    backgroundColor: C.bg, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 4,
  },
  totalLabel: { color: C.sub, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  totalPrice: { color: C.primary, fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  totalDetail: { color: C.sub, fontSize: 11 },

  // Cart Actions
  cartActions: { padding: 16, gap: 10 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.primary, paddingVertical: 16, borderRadius: 14,
  },
  addBtnDone: { backgroundColor: C.success },
  addBtnText: { color: '#0A0A0A', fontSize: 15, fontWeight: '800' },
  viewCartBtn: {
    paddingVertical: 13, borderRadius: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.primary, backgroundColor: C.primary + '10',
  },
  viewCartText: { color: C.primary, fontSize: 14, fontWeight: '700' },
});
