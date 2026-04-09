import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ActivityIndicator, TouchableOpacity, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Package, Barcode, ArrowLeft } from 'lucide-react-native';
import { formatPrice } from '../../utils/format';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  highlight: '#262626',
  primary: '#EAB308',
  text: '#FFFFFF',
  sub: '#A3A3A3',
  border: '#2A2A2A',
};

interface Product {
  id: string;
  product_name: string;
  barcode: string;
  price: number;
}

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    fetch(`${BACKEND_URL}/api/products/${id}`)
      .then((r) => r.json())
      .then(setProduct)
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
        <Package size={48} color={C.highlight} />
        <Text style={styles.notFoundText}>Ürün bulunamadı</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="product-detail">
      <View style={styles.card}>
        <Text style={styles.label}>ÜRÜN ADI</Text>
        <Text style={styles.productName}>{product.product_name}</Text>

        <View style={styles.divider} />

        <Text style={styles.priceLabel}>FİYAT</Text>
        <Text style={styles.price} testID="product-price">{formatPrice(product.price)}</Text>

        <View style={styles.divider} />

        <View style={styles.barcodeRow}>
          <Barcode size={20} color={C.sub} />
          <Text style={styles.barcodeText}>{product.barcode}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    padding: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    gap: 16,
  },
  notFoundText: { color: C.sub, fontSize: 16 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 24,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  label: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  productName: {
    color: C.text,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 20,
  },
  priceLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  price: {
    color: C.primary,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 60,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barcodeText: {
    color: C.sub,
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});
