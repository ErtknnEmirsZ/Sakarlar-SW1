import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatPrice } from '../../utils/format';

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

interface Product {
  id: string;
  product_name: string;
  barcode: string;
  price: number;
  category: string;
  stock_quantity?: number | null;
  vat_excluded_price?: number | null;
}

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`${BACKEND_URL}/api/products/${id}`)
      .then((r) => r.json())
      .then((data) => { if (data && data.id) setProduct(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>Ürün bulunamadı</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const catColor =
    product.category === 'ambalaj' ? C.ambalaj :
    product.category === 'gida' ? C.gida : C.temizlik;
  const catLabel =
    product.category === 'ambalaj' ? 'Ambalaj' :
    product.category === 'gida' ? 'Gıda' : 'Temizlik';

  const qty = product.stock_quantity;
  const stockColor =
    qty == null ? '#9A9A9A' :
    qty === 0 ? '#EF4444' :
    qty < 10 ? '#F97316' :
    qty <= 50 ? '#FBBF24' : '#22C55E';
  const stockLabel =
    qty == null ? 'Bilinmiyor' :
    qty === 0 ? 'Tükendi • 0 adet' :
    qty < 10 ? `Az Kaldı • ${qty} adet` :
    `Stok: ${qty} adet`;

  return (
    <SafeAreaView style={styles.container} testID="product-detail">
      {/* Price Hero */}
      <View style={styles.priceHero}>
        <Text style={styles.priceLabel}>FİYAT</Text>
        <Text style={styles.price} testID="product-price">{formatPrice(product.price)}</Text>
        {product.vat_excluded_price != null && product.vat_excluded_price > 0 && (
          <Text style={styles.vatPrice}>
            KDV Hariç: {formatPrice(product.vat_excluded_price)}
          </Text>
        )}
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        {/* Category + Stock row */}
        <View style={styles.badgesRow}>
          <View style={[styles.catBadge, { backgroundColor: catColor + '22', borderColor: catColor + '44' }]}>
            <Text style={[styles.catText, { color: catColor }]}>{catLabel.toUpperCase()}</Text>
          </View>
          <View style={[styles.stockBadge, { backgroundColor: stockColor + '1A', borderColor: stockColor + '44' }]}>
            <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
            <Text style={[styles.stockText, { color: stockColor }]}>{stockLabel}</Text>
          </View>
        </View>

        {/* Name */}
        <Text style={styles.nameLabel}>ÜRÜN ADI</Text>
        <Text style={styles.name}>{product.product_name}</Text>

        <View style={styles.divider} />

        {/* Barcode */}
        <Text style={styles.barcodeLabel}>BARKOD</Text>
        <Text style={styles.barcode} testID="product-barcode">{product.barcode}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg, gap: 16,
  },
  notFoundText: { color: C.sub, fontSize: 16 },
  backBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 10, backgroundColor: C.highlight,
  },
  backBtnText: { color: C.text, fontSize: 15, fontWeight: '600' },

  // Price Hero
  priceHero: {
    backgroundColor: C.surface,
    alignItems: 'center',
    paddingVertical: 36,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  priceLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  price: {
    color: C.primary,
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 70,
  },
  vatPrice: {
    color: C.sub,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
  },

  // Info Card
  card: {
    margin: 16,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  catBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  catText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockText: { fontSize: 11, fontWeight: '700' },
  nameLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  name: {
    color: C.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 18 },
  barcodeLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  barcode: {
    color: C.sub,
    fontSize: 16,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
});
