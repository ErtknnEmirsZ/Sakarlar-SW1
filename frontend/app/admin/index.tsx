import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { Plus, Upload, Search, X, Edit3, Trash2, Package, Shield } from 'lucide-react-native';
import { authStore } from '../../utils/authStore';
import { formatPrice } from '../../utils/format';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BATCH_SIZE = 300;

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

interface Product {
  id: string;
  product_name: string;
  barcode: string;
  price: number;
  stock_quantity?: number;
}

interface ParsedProduct {
  product_name: string;
  barcode: string;
  price: number;
  category: string;
  stock_quantity: number;
  vat_excluded_price: number | null;
}

const formatImportDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch { return ''; }
};

// ─── Column detection ─────────────────────────────────────────────────────────
const detectColumns = (keys: string[]) => {
  const lk = keys.map(k => k.toLowerCase().trim());
  const find = (patterns: string[]) => keys[lk.findIndex(k => patterns.some(p => k.includes(p)))] ?? null;
  return {
    name:    find(['product_name', 'urun_adi', 'urun', 'ürün', 'isim', 'name', 'ad']),
    barcode: find(['barcode', 'barkod', 'ean', 'kod']),
    price:   find(['price', 'fiyat', 'ucret', 'ücret', 'tutar']),
    cat:     find(['category', 'kategori', 'cat']),
    stock:   find(['stock_quantity', 'stock', 'stok', 'miktar', 'adet']),
    vat:     find(['kdv_haric', 'vat_excl', 'kdvsiz', 'haris', 'hariç']),
  };
};

const CAT_MAP: Record<string, string> = {
  temizlik: 'temizlik', ambalaj: 'ambalaj',
  gida: 'gida', 'g\u0131da': 'gida',
};

const normalizeRows = (rows: any[]): ParsedProduct[] => {
  if (!rows.length) return [];
  const cols = detectColumns(Object.keys(rows[0]));
  if (!cols.barcode) return [];

  const map = new Map<string, ParsedProduct>();
  for (const row of rows) {
    try {
      const barcode = String(row[cols.barcode] ?? '').trim();
      if (!barcode || barcode === '' || barcode.toLowerCase() === 'nan') continue;

      const name = cols.name ? String(row[cols.name] ?? '').trim() : '';
      if (!name || name.toLowerCase() === 'nan') continue;

      const priceRaw = cols.price ? String(row[cols.price] ?? '0').replace(',', '.') : '0';
      const price = parseFloat(priceRaw) || 0;

      const catRaw = cols.cat ? String(row[cols.cat] ?? '').toLowerCase().trim() : '';
      const category = CAT_MAP[catRaw] ?? 'diger';

      const stockRaw = cols.stock ? String(row[cols.stock] ?? '0').replace(',', '.') : '0';
      const stock_quantity = Math.max(0, Math.floor(parseFloat(stockRaw) || 0));

      const vatRaw = cols.vat ? String(row[cols.vat] ?? '').replace(',', '.').trim() : '';
      const vat_excluded_price = vatRaw && vatRaw !== 'nan' ? (parseFloat(vatRaw) || null) : null;

      map.set(barcode, { product_name: name, barcode, price, category, stock_quantity, vat_excluded_price });
    } catch {
      continue;
    }
  }
  return Array.from(map.values());
};

// ─── File reading (web vs native) ─────────────────────────────────────────────
const readFileAsUint8 = async (uri: string): Promise<Uint8Array> => {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return new Uint8Array(await res.arrayBuffer());
  }
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
};

const parseFile = async (uri: string): Promise<any[]> => {
  const data = await readFileAsUint8(uri);
  const wb = XLSX.read(data, { type: 'array', cellDates: false, sheetRows: 0 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
};

// ─── Stock label helper ────────────────────────────────────────────────────────
const stockLabel = (qty?: number) => {
  if (qty == null) return null;
  if (qty === 0) return { text: 'Tüken', color: C.error };
  if (qty < 10) return { text: `Az:${qty}`, color: '#F97316' };
  if (qty <= 50) return { text: `${qty}`, color: C.warning };
  return { text: `${qty}`, color: C.success };
};


export default function AdminScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [temizlikCount, setTemizlikCount] = useState(0);
  const [ambalajCount, setAmbalajCount] = useState(0);
  const [gidaCount, setGidaCount] = useState(0);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const router = useRouter();
  const importAbort = useRef(false);

  const loadProducts = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const url = q.trim()
        ? `${BACKEND_URL}/api/products?q=${encodeURIComponent(q)}`
        : `${BACKEND_URL}/api/products`;
      const data = await (await fetch(url)).json();
      setProducts(Array.isArray(data) ? data : []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [sr, se] = await Promise.all([fetch(`${BACKEND_URL}/api/stats`), fetch(`${BACKEND_URL}/api/settings`)]);
      const stats = await sr.json();
      setTotalCount(stats.total_products || 0);
      setTemizlikCount(stats.temizlik || 0);
      setAmbalajCount(stats.ambalaj || 0);
      setGidaCount(stats.gida || 0);
      if (se.ok) { const s = await se.json(); setLastImport(s.last_import || null); }
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    importAbort.current = false;
    authStore.init().then((admin) => {
      setIsAdmin(admin);
      setAuthChecked(true);
      if (admin) { loadProducts(''); loadStats(); }
    });
  }, []));

  const handleDelete = (product: Product) => {
    Alert.alert('Ürün Sil', `"${product.product_name}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${BACKEND_URL}/api/products/${product.id}`, { method: 'DELETE' });
            loadProducts(query); loadStats();
          } catch { Alert.alert('Hata', 'Silme başarısız'); }
        },
      },
    ]);
  };

  // ─── Send batches to backend ─────────────────────────────────────────────────
  const sendBatches = async (products: ParsedProduct[]) => {
    importAbort.current = false;
    const total = products.length;
    const batches: ParsedProduct[][] = [];
    for (let i = 0; i < total; i += BATCH_SIZE) batches.push(products.slice(i, i + BATCH_SIZE));

    for (let i = 0; i < batches.length; i++) {
      if (importAbort.current) throw new Error('abort');
      const batch = batches[i];
      const isFirst = i === 0;
      const isLast = i === batches.length - 1;

      const res = await fetch(`${BACKEND_URL}/api/products/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: batch, is_first_batch: isFirst, is_last_batch: isLast }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Batch upload failed');
      }
      const data = await res.json();
      if (data.last_import) setLastImport(data.last_import);

      const done = Math.min((i + 1) * BATCH_SIZE, total);
      setImportProgress(done / total);
      setImportStatus(`${done.toLocaleString()} / ${total.toLocaleString()} ürün yüklendi...`);
    }
  };

  // ─── Main import handler ─────────────────────────────────────────────────────
  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const ext = (asset.name || '').split('.').pop()?.toLowerCase();

      if (ext === 'xls') {
        Alert.alert('Desteklenmiyor', 'Lütfen .xlsx veya .csv dosyası kullanın');
        return;
      }
      if (ext !== 'xlsx' && ext !== 'csv') {
        Alert.alert('Hata', 'Yalnızca .xlsx ve .csv dosyaları desteklenir');
        return;
      }

      setImporting(true);
      setImportStatus('Dosya okunuyor...');
      setImportProgress(0);

      let rows: any[];
      try {
        rows = await parseFile(asset.uri);
      } catch {
        setImporting(false);
        Alert.alert('Hata', 'Dosya okunamadı. Lütfen doğru formatta dosya yükleyin.');
        return;
      }

      setImportStatus(`${rows.length.toLocaleString()} satır işleniyor...`);
      await new Promise(r => setTimeout(r, 50)); // let UI update

      const products = normalizeRows(rows);
      setImporting(false);

      if (!products.length) {
        Alert.alert('Uyarı', 'Geçerli ürün bulunamadı. "barcode" ve "product_name" sütunları gereklidir.');
        return;
      }

      Alert.alert(
        'Veri Yükle',
        `${products.length.toLocaleString()} ürün hazır.\nMevcut tüm ürünler silinecek. Devam?`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Yükle', style: 'destructive',
            onPress: async () => {
              setImporting(true);
              setImportStatus('Yükleniyor...');
              setImportProgress(0);
              try {
                await sendBatches(products);
                Alert.alert('Başarılı', `${products.length.toLocaleString()} ürün yüklendi`);
                setQuery('');
                loadProducts('');
                loadStats();
              } catch (e: any) {
                if (e.message !== 'abort')
                  Alert.alert('Hata', 'Yükleme sırasında hata oluştu. Tekrar deneyin.');
              } finally {
                setImporting(false);
                setImportProgress(0);
                setImportStatus('');
              }
            },
          },
        ]
      );
    } catch (e: any) {
      setImporting(false);
      Alert.alert('Hata', e.message || 'Dosya seçilemedi');
    }
  };

  // ─── Auth gate ──────────────────────────────────────────────────────────────
  if (!authChecked) {
    return <View style={styles.container}><ActivityIndicator color={C.primary} style={{ marginTop: 60 }} /></View>;
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authGate}>
          <Shield size={52} color={C.primary} />
          <Text style={styles.authTitle}>Yönetici Girişi Gerekli</Text>
          <Text style={styles.authSub}>Ayarlar bölümünden giriş yapın</Text>
          <TouchableOpacity style={styles.authBtn} onPress={() => router.replace('/settings')}>
            <Text style={styles.authBtnText}>Ayarlara Git</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item, index }: { item: Product; index: number }) => {
    const sl = stockLabel(item.stock_quantity);
    return (
      <View testID={`admin-product-${index}`} style={styles.row}>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>{item.product_name}</Text>
          <View style={styles.rowMeta}>
            <Text style={styles.rowPrice}>{formatPrice(item.price)}</Text>
            {sl && (
              <View style={[styles.stockPill, { backgroundColor: sl.color + '22' }]}>
                <Text style={[styles.stockPillText, { color: sl.color }]}>Stok: {sl.text}</Text>
              </View>
            )}
          </View>
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
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Stats Section */}
      <View style={styles.statsSection}>
        <View style={styles.statCards}>
          {[
            { label: 'Toplam', value: totalCount, color: C.primary },
            { label: 'Temizlik', value: temizlikCount, color: '#3B82F6' },
            { label: 'Ambalaj', value: ambalajCount, color: '#8B5CF6' },
            { label: 'Gıda', value: gidaCount, color: '#F97316' },
          ].map(({ label, value, color }) => (
            <View key={label} style={[styles.statCard, { backgroundColor: color + '14' }]}>
              <Text style={[styles.statNum, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Import Button + Progress */}
        {importing ? (
          <View style={styles.progressBox}>
            <Text style={styles.progressText}>{importStatus}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${importProgress * 100}%` }]} />
            </View>
            <Text style={styles.progressPct}>{Math.round(importProgress * 100)}%</Text>
          </View>
        ) : (
          <View style={styles.importSection}>
            <TouchableOpacity
              testID="import-btn"
              style={styles.importBtn}
              onPress={handleImport}
            >
              <Upload size={16} color="#0A0A0A" />
              <Text style={styles.importBtnText}>Excel / CSV Yükle (.xlsx, .csv)</Text>
            </TouchableOpacity>
            {lastImport && (
              <Text style={styles.lastImportText}>Son yükleme: {formatImportDate(lastImport)}</Text>
            )}
          </View>
        )}
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
          onChangeText={(t) => { setQuery(t); loadProducts(t); }}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && <TouchableOpacity onPress={() => { setQuery(''); loadProducts(''); }}><X size={15} color={C.sub} /></TouchableOpacity>}
      </View>

      {/* List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
        removeClippedSubviews
        maxToRenderPerBatch={20}
        initialNumToRender={20}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading
              ? <ActivityIndicator color={C.primary} />
              : <><Package size={36} color={C.highlight} /><Text style={styles.emptyText}>Ürün bulunamadı</Text></>
            }
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
  statsSection: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    padding: 12,
    gap: 10,
  },
  statCards: { flexDirection: 'row', gap: 6 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statNum: { fontSize: 20, fontWeight: '900' },
  statLabel: { color: C.sub, fontSize: 9, fontWeight: '600', marginTop: 2 },
  importSection: { gap: 6 },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 13,
    borderRadius: 10,
  },
  importBtnText: { color: '#0A0A0A', fontWeight: '700', fontSize: 13 },
  lastImportText: { color: C.sub, fontSize: 11, textAlign: 'center' },
  progressBox: {
    backgroundColor: C.highlight,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  progressText: { color: C.text, fontSize: 12, fontWeight: '600' },
  progressTrack: {
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  progressPct: { color: C.sub, fontSize: 11, textAlign: 'right' },
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    minHeight: 64,
  },
  rowInfo: { flex: 1, gap: 4 },
  rowName: { color: C.text, fontSize: 14, fontWeight: '500' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowPrice: { color: C.primary, fontSize: 15, fontWeight: '800' },
  stockPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  stockPillText: { fontSize: 10, fontWeight: '700' },
  rowActions: { flexDirection: 'row', gap: 6 },
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
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: C.sub, fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  authGate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  authTitle: { color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  authSub: { color: C.sub, fontSize: 14, textAlign: 'center' },
  authBtn: { backgroundColor: C.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  authBtnText: { color: '#0A0A0A', fontSize: 15, fontWeight: '700' },
});
