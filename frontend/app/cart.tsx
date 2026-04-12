import React, { useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingCart, X } from 'lucide-react-native';
import { useCartStore, CartItem } from '../utils/cartStore';
import { formatPrice } from '../utils/format';

const C = {
  bg: '#0A0A0A', surface: '#1A1A1A', highlight: '#262626',
  primary: '#EAB308', text: '#FFFFFF', sub: '#A3A3A3',
  border: '#2A2A2A', error: '#EF4444', success: '#22C55E',
};

export default function CartScreen() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, clearCart, totalAmount } = useCartStore();
  const total = totalAmount();

  const handleClear = () => {
    Alert.alert('Sepeti Temizle', 'Tüm ürünler silinecek. Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Temizle', style: 'destructive', onPress: clearCart },
    ]);
  };

  const renderItem = useCallback(({ item }: { item: CartItem }) => {
    const isWeight = item.product.is_weight_based;
    const lineTotal = item.product.price * item.quantity;
    const unitLabel = isWeight ? 'kg' : 'adet';

    return (
      <View style={styles.row}>
        {/* Left: name + barcode */}
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={2}>{item.product.product_name}</Text>
          <Text style={styles.rowBarcode}>{item.product.barcode}</Text>
          <Text style={styles.rowUnit}>
            {formatPrice(item.product.price)} / {unitLabel}
          </Text>
        </View>

        {/* Right: quantity controls + total */}
        <View style={styles.rowRight}>
          <Text style={styles.rowTotal}>{formatPrice(lineTotal)}</Text>

          <View style={styles.qtyRow}>
            {/* Minus / Remove */}
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() =>
                isWeight
                  ? updateQuantity(item.cartId, Math.max(0, +(item.quantity - 0.25).toFixed(3)))
                  : updateQuantity(item.cartId, item.quantity - 1)
              }
            >
              <Minus size={14} color={C.text} />
            </TouchableOpacity>

            <Text style={styles.qtyText}>
              {isWeight ? item.quantity.toFixed(3) : item.quantity} {unitLabel}
            </Text>

            {/* Plus */}
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() =>
                isWeight
                  ? updateQuantity(item.cartId, +(item.quantity + 0.25).toFixed(3))
                  : updateQuantity(item.cartId, item.quantity + 1)
              }
            >
              <Plus size={14} color={C.text} />
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity
              style={[styles.qtyBtn, styles.deleteBtn]}
              onPress={() => removeItem(item.cartId)}
            >
              <X size={14} color={C.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [updateQuantity, removeItem]);

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sepet</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.emptyCenter}>
          <ShoppingCart size={72} color={C.border} strokeWidth={1} />
          <Text style={styles.emptyTitle}>Sepet boş</Text>
          <Text style={styles.emptySub}>Ürün detayından sepete ekleyebilirsiniz</Text>
          <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackText}>Ürünlere Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sepet ({items.length} ürün)</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Trash2 size={18} color={C.error} />
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlashList
        data={items}
        keyExtractor={(item) => item.cartId}
        estimatedItemSize={88}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 160 }}
      />

      {/* Footer total */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>
            {items.reduce((s, i) => s + i.quantity, 0).toFixed(2).replace('.00', '')} kalem
          </Text>
          <Text style={styles.footerTotal}>{formatPrice(total)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => Alert.alert('Ödeme', `Toplam: ${formatPrice(total)}\n\nKasaya iletildi.`, [{ text: 'Tamam', onPress: clearCart }])}
        >
          <Text style={styles.checkoutText}>Ödemeyi Tamamla</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: C.highlight },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: C.highlight },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.bg, minHeight: 88,
  },
  rowInfo: { flex: 1, paddingRight: 12, gap: 3 },
  rowName: { color: C.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  rowBarcode: { color: C.sub, fontSize: 10, letterSpacing: 1 },
  rowUnit: { color: C.sub, fontSize: 11 },
  rowRight: { alignItems: 'flex-end', gap: 8, minWidth: 110 },
  rowTotal: { color: C.primary, fontSize: 17, fontWeight: '900' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: { backgroundColor: 'rgba(239,68,68,0.15)' },
  qtyText: { color: C.text, fontSize: 12, fontWeight: '700', minWidth: 44, textAlign: 'center' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
    padding: 16, gap: 12,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  footerLabel: { color: C.sub, fontSize: 14 },
  footerTotal: { color: C.primary, fontSize: 32, fontWeight: '900' },
  checkoutBtn: {
    backgroundColor: C.primary, paddingVertical: 16,
    borderRadius: 14, alignItems: 'center',
  },
  checkoutText: { color: '#0A0A0A', fontSize: 16, fontWeight: '800' },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  emptyTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
  emptySub: { color: C.sub, fontSize: 14, textAlign: 'center' },
  goBackBtn: { backgroundColor: C.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  goBackText: { color: '#0A0A0A', fontWeight: '800', fontSize: 15 },
});
