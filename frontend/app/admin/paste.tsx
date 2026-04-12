import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ArrowLeft, Zap, Upload, RotateCcw, CheckCircle, FileText } from 'lucide-react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BATCH_SIZE = 200;

const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  highlight: '#262626',
  primary: '#EAB308',
  text: '#FFFFFF',
  sub: '#A3A3A3',
  border: '#2A2A2A',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#FBBF24',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ParsedProduct {
  product_name: string;
  barcode: string;
  price: number;
  category: string;
  stock_quantity: number;
  vat_excluded_price: number | null;
}

// ─── Price normalization ───────────────────────────────────────────────────────
const normalizePrice = (raw: string): number => {
  let s = raw.replace(/[₺TLtl\s]/gi, '').trim();
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');  // 1.234,50 → 1234.50
    } else {
      s = s.replace(/,/g, '');                     // 1,234.50 → 1234.50
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return parseFloat(s) || 0;
};

// ─── Auto-detect category from product name ────────────────────────────────────
const detectCategory = (name: string): string => {
  const l = name.toLowerCase();
  if (/temizlik|deterjan|sabun|çamaşır|bulaşık|wc|banyo|cam|havlu|mendil|sünger|dezenfektan|klor|çöp\s*poşeti/.test(l))
    return 'temizlik';
  if (/streç|koli\s*band|naylon|ambalaj|kağıt\s*poşet|plastik\s*torba|etiket|kraft|köpük\s*naylon|balonlu/.test(l))
    return 'ambalaj';
  if (/\btuz\b|şeker|^un\b|makarna|pirinç|yağ\b|çay\b|kahve|\bsu\b|süt|ekmek|peynir|gıda/.test(l))
    return 'gida';
  return 'diger';
};

// ─── Parse structured line (tab / pipe / semicolon) ────────────────────────────
const parseStructuredLine = (parts: string[]): ParsedProduct | null => {
  if (parts.length < 2) return null;

  let barcode = '';
  let barcodeIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (/^\d{8,13}$/.test(parts[i].trim())) {
      barcode = parts[i].trim();
      barcodeIdx = i;
      break;
    }
  }
  if (!barcode) return null;

  let price = 0;
  let priceIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (i === barcodeIdx) continue;
    const p = parts[i].replace(/[₺TLtl\s]/gi, '');
    if (/^\d{1,8}[.,]\d{1,2}$/.test(p) || /^\d{1,6}$/.test(p) && parseFloat(p) > 0) {
      price = normalizePrice(parts[i]);
      priceIdx = i;
      break;
    }
  }

  let stock_quantity = 0;
  let qtyIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (i === barcodeIdx || i === priceIdx) continue;
    const qtyM = parts[i].match(/^(\d+)\s*(?:adet|pcs|qty)?$/i);
    if (qtyM && parseInt(qtyM[1]) < 1000000) {
      stock_quantity = parseInt(qtyM[1], 10);
      qtyIdx = i;
      break;
    }
  }

  const used = new Set([barcodeIdx, priceIdx, qtyIdx].filter((i) => i !== -1));
  const nameParts = parts.filter((_, i) => !used.has(i) && parts[i].trim().length > 1);
  let name = nameParts.join(' ').trim().replace(/^[-.,\s]+/, '').replace(/[-.,\s]+$/, '');

  if (!name || name.length < 2) return null;
  name = name.charAt(0).toUpperCase() + name.slice(1);

  return { product_name: name, barcode, price, category: detectCategory(name), stock_quantity, vat_excluded_price: null };
};

// ─── Parse unstructured line ──────────────────────────────────────────────────
const parseUnstructuredLine = (line: string): ParsedProduct | null => {
  const bm = line.match(/(?<!\d)(\d{8,13})(?!\d)/);
  if (!bm) return null;
  const barcode = bm[1];

  let work = line.replace(bm[0], ' ');

  // Price: number with decimal + optional currency
  const pm = work.match(/\b(\d{1,6}(?:[.,]\d{3})*[.,]\d{1,2}|\d{1,8}[.,]\d{1,2}|\d{1,8})\s*(?:₺|TL|tl)\b/);
  let price = 0;
  if (pm) { price = normalizePrice(pm[0]); work = work.replace(pm[0], ' '); }

  // Quantity with keyword
  const qm = work.match(/\b(\d+)\s*(?:adet|pcs|piece|ad\.?)\b/i);
  let stock_quantity = 0;
  if (qm) { stock_quantity = parseInt(qm[1]) || 0; work = work.replace(qm[0], ' '); }

  let name = work.replace(/[|;:()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^[-.,\s]+/, '').replace(/[-.,\s]+$/, '');

  if (!name || name.length < 2) return null;
  name = name.charAt(0).toUpperCase() + name.slice(1);

  return { product_name: name, barcode, price, category: detectCategory(name), stock_quantity, vat_excluded_price: null };
};

// ─── Main text parser ─────────────────────────────────────────────────────────
const parseTextData = (text: string): ParsedProduct[] => {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length >= 5);
  const map = new Map<string, ParsedProduct>();

  for (const line of lines) {
    try {
      if (/^(barkod|barcode|ürün\s*adı|product\s*name|fiyat|price|stok|stock|#)\b/i.test(line)) continue;

      let product: ParsedProduct | null = null;

      if (line.includes('\t')) {
        product = parseStructuredLine(line.split('\t').map((p) => p.trim()));
      } else if (line.includes('|')) {
        product = parseStructuredLine(line.split('|').map((p) => p.trim()));
      } else if (line.includes(';')) {
        product = parseStructuredLine(line.split(';').map((p) => p.trim()));
      } else {
        product = parseUnstructuredLine(line);
      }

      if (product && product.barcode && !map.has(product.barcode)) {
        map.set(product.barcode, product);
      }
    } catch { continue; }
  }

  return Array.from(map.values());
};

// ─── Stock color helper ───────────────────────────────────────────────────────
const stockColor = (qty: number) =>
  qty === 0 ? C.error : qty < 10 ? '#F97316' : qty <= 50 ? C.warning : C.success;

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function PasteScreen() {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedProduct[]>([]);
  const [stage, setStage] = useState<'input' | 'preview' | 'done'>('input');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const router = useRouter();

  const handleParse = useCallback(() => {
    if (!rawText.trim()) { Alert.alert('Uyarı', 'Lütfen ürün verisi yapıştırın'); return; }
    const products = parseTextData(rawText);
    if (products.length === 0) {
      Alert.alert(
        'Ürün Bulunamadı',
        'Geçerli barkod içeren satır bulunamadı.\n\nDesteklenen formatlar:\n• Barkod | Ad | Fiyat | Stok\n• Tab ile ayrılmış sütunlar (Excel yapıştır)\n• Virgül ya da noktalı virgül ayraçlı'
      );
      return;
    }
    setParsed(products);
    setStage('preview');
  }, [rawText]);

  const sendBatches = async (products: ParsedProduct[]) => {
    const total = products.length;
    const batches: ParsedProduct[][] = [];
    for (let i = 0; i < total; i += BATCH_SIZE) batches.push(products.slice(i, i + BATCH_SIZE));

    for (let i = 0; i < batches.length; i++) {
      const res = await fetch(`${BACKEND_URL}/api/products/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: batches[i],
          is_first_batch: i === 0,
          is_last_batch: i === batches.length - 1,
          mode: 'upsert',
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Hata'); }
      const done = Math.min((i + 1) * BATCH_SIZE, total);
      setImportProgress(done / total);
      setImportStatus(`${done.toLocaleString()} / ${total.toLocaleString()} ürün işlendi...`);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportProgress(0);
    setImportStatus('Yükleniyor...');
    try {
      await sendBatches(parsed);
      setImportedCount(parsed.length);
      setStage('done');
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Yükleme sırasında hata oluştu');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setRawText(''); setParsed([]); setStage('input'); setImportProgress(0); setImportStatus('');
  };

  // ── STAGE: input ──────────────────────────────────────────────────────────────
  if (stage === 'input') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <ArrowLeft size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Veri Yapıştır</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <FileText size={14} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Desteklenen Formatlar</Text>
              <Text style={styles.infoText}>
                {'Barkod | Ad | Fiyat | Stok\nExcel\'den kopyala-yapıştır (Tab)\nVirgül veya noktalı virgül ayraçlı'}
              </Text>
            </View>
          </View>

          {/* Text Area */}
          <View style={styles.textAreaWrapper}>
            <TextInput
              style={styles.textArea}
              multiline
              value={rawText}
              onChangeText={setRawText}
              placeholder={
                '8690001001001\tÇöp Poşeti Büyük\t12.50\t100\n' +
                '8690001001002\tÇamaşır Suyu 5L\t85.00\t50\n\n' +
                '— veya —\n\n' +
                '8690001001003 | Koli Bandı | 22,00 | 200'
              }
              placeholderTextColor={C.border}
              textAlignVertical="top"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {rawText.length > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={() => setRawText('')}>
                <Text style={styles.clearBtnText}>Temizle</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Char count */}
          {rawText.length > 0 && (
            <Text style={styles.charCount}>
              {rawText.split('\n').filter((l) => l.trim().length > 5).length} satır
            </Text>
          )}

          {/* Parse Button */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, !rawText.trim() && styles.primaryBtnDisabled]}
              onPress={handleParse}
              disabled={!rawText.trim()}
            >
              <Zap size={18} color="#0A0A0A" />
              <Text style={styles.primaryBtnText}>Analiz Et</Text>
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  // ── STAGE: preview ────────────────────────────────────────────────────────────
  if (stage === 'preview') {
    const previewItems = parsed.slice(0, 50);

    return (
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStage('input')}>
            <ArrowLeft size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ön İzleme</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryNum}>{parsed.length}</Text>
            <Text style={styles.summaryLabel}>ürün bulundu</Text>
          </View>
          <Text style={styles.summaryNote}>
            ✓ Mevcut ürünler korunur{'\n'}✓ Aynı barkodlular güncellenir{'\n'}✓ Yeni barkodlular eklenir
          </Text>
        </View>

        {/* Column headers */}
        <View style={styles.colHeader}>
          <Text style={[styles.colText, { flex: 1 }]}>ÜRÜN ADI • BARKOD</Text>
          <Text style={[styles.colText, { width: 90, textAlign: 'right' }]}>FİYAT • STOK</Text>
        </View>

        {/* Preview list */}
        <View style={{ flex: 1 }}>
          <FlashList
            data={previewItems}
            keyExtractor={(item) => item.barcode}
            estimatedItemSize={58}
            renderItem={({ item }) => (
              <View style={styles.previewRow}>
                <View style={styles.previewLeft}>
                  <Text style={styles.previewName} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={styles.previewBarcode}>{item.barcode}</Text>
                </View>
                <View style={styles.previewRight}>
                  <Text style={styles.previewPrice}>
                    {item.price > 0 ? `₺${item.price.toFixed(2)}` : '—'}
                  </Text>
                  {item.stock_quantity >= 0 && (
                    <Text style={[styles.previewQty, { color: stockColor(item.stock_quantity) }]}>
                      {item.stock_quantity === 0 ? 'Tükendi' : `${item.stock_quantity} adet`}
                    </Text>
                  )}
                </View>
              </View>
            )}
            ListFooterComponent={
              parsed.length > 50
                ? <Text style={styles.moreText}>+ {(parsed.length - 50).toLocaleString()} ürün daha...</Text>
                : null
            }
          />
        </View>

        {/* Import button */}
        <View style={styles.bottomActions}>
          {importing ? (
            <View style={styles.progressBox}>
              <Text style={styles.progressText}>{importStatus}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${importProgress * 100}%` as any }]} />
              </View>
              <Text style={styles.progressPct}>{Math.round(importProgress * 100)}%</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleImport}>
              <Upload size={18} color="#0A0A0A" />
              <Text style={styles.primaryBtnText}>{parsed.length.toLocaleString()} Ürünü Aktar</Text>
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>
    );
  }

  // ── STAGE: done ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.doneCenter}>
        <CheckCircle size={72} color={C.success} strokeWidth={1.5} />
        <Text style={styles.doneTitle}>{importedCount.toLocaleString()} Ürün Aktarıldı</Text>
        <Text style={styles.doneSub}>
          Mevcut ürünler güncellendi, yeni ürünler eklendi.{'\n'}Diğer ürünler korundu.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Panele Dön</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
          <RotateCcw size={15} color={C.sub} />
          <Text style={styles.secondaryBtnText}>Yeni Veri Yapıştır</Text>
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
  backBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, backgroundColor: C.highlight,
  },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '700' },

  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    margin: 12, padding: 12,
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  infoTitle: { color: C.primary, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  infoText: { color: C.sub, fontSize: 12, lineHeight: 18 },

  textAreaWrapper: { flex: 1, marginHorizontal: 12, marginBottom: 4 },
  textArea: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, padding: 14, color: C.text, fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 20,
  },
  clearBtn: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: C.highlight, borderRadius: 6,
  },
  clearBtnText: { color: C.sub, fontSize: 11, fontWeight: '600' },
  charCount: {
    color: C.sub, fontSize: 11, textAlign: 'right',
    paddingHorizontal: 16, paddingBottom: 4,
  },

  bottomActions: {
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, paddingVertical: 15, borderRadius: 12,
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { color: '#0A0A0A', fontSize: 15, fontWeight: '800' },

  // Preview
  summaryBox: {
    backgroundColor: C.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, gap: 6,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  summaryNum: { color: C.primary, fontSize: 40, fontWeight: '900' },
  summaryLabel: { color: C.text, fontSize: 18, fontWeight: '600' },
  summaryNote: { color: C.sub, fontSize: 12, lineHeight: 18 },

  colHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: C.highlight,
  },
  colText: { color: C.sub, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  previewRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
    minHeight: 58,
  },
  previewLeft: { flex: 1, gap: 3, paddingRight: 12 },
  previewName: { color: C.text, fontSize: 13, fontWeight: '500' },
  previewBarcode: { color: C.sub, fontSize: 11, letterSpacing: 1.5 },
  previewRight: { alignItems: 'flex-end', gap: 2, minWidth: 80 },
  previewPrice: { color: C.primary, fontSize: 15, fontWeight: '800' },
  previewQty: { fontSize: 10, fontWeight: '700' },
  moreText: {
    color: C.sub, fontSize: 12, textAlign: 'center',
    paddingVertical: 16, paddingBottom: 80,
  },

  progressBox: { gap: 8 },
  progressText: { color: C.text, fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  progressPct: { color: C.sub, fontSize: 11, textAlign: 'right' },

  // Done
  doneCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 },
  doneTitle: { color: C.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  doneSub: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10,
  },
  secondaryBtnText: { color: C.sub, fontSize: 13, fontWeight: '600' },
});
