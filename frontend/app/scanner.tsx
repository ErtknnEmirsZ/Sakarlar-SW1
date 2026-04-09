import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  SafeAreaView, ActivityIndicator, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Zap, AlertCircle, CheckCircle } from 'lucide-react-native';
import { formatPrice } from '../utils/format';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SW, height: SH } = Dimensions.get('window');
const SCAN_SIZE = Math.min(SW * 0.7, 280);
const OVERLAY_H = (SH - SCAN_SIZE) / 2;

const C = {
  bg: '#0F0F0F',
  surface: '#1C1C1C',
  highlight: '#2A2A2A',
  primary: '#F5C518',
  text: '#FFFFFF',
  sub: '#9A9A9A',
  error: '#EF4444',
  success: '#22C55E',
};

interface ScanResult {
  type: 'found' | 'not_found';
  product?: { id: string; product_name: string; price: number; category?: string };
  barcode?: string;
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const cooldown = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { speedMode, mode } = useLocalSearchParams<{ speedMode?: string; mode?: string }>();

  const isSpeedMode = speedMode === '1';
  const isSelectMode = mode === 'select';

  const showResult = (res: ScanResult) => {
    setResult(res);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const handleBarcode = async ({ data }: { data: string }) => {
    if (cooldown.current || loading) return;
    cooldown.current = true;
    setScanning(false);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/products/barcode/${encodeURIComponent(data)}`);
      setLoading(false);

      if (res.ok) {
        const product = await res.json();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        showResult({ type: 'found', product });

        if (isSelectMode) {
          const { scanStore } = await import('../utils/scanStore');
          scanStore.pendingBarcode = data;
          setTimeout(() => router.back(), 700);
          return;
        }

        // Speed mode: full screen 1 second then auto-continue
        const delay = isSpeedMode ? 1000 : 0;
        if (delay > 0) {
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              setResult(null);
              cooldown.current = false;
              setScanning(true);
            });
          }, delay);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        showResult({ type: 'not_found', barcode: data });

        // Always auto-return after 1s when not found
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            setResult(null);
            cooldown.current = false;
            setScanning(true);
          });
        }, 1000);
      }
    } catch {
      setLoading(false);
      cooldown.current = false;
      setScanning(true);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <AlertCircle size={52} color={C.error} />
        <Text style={styles.permText}>Kamera izni gerekli</Text>
        <Text style={styles.permSub}>Barkod taramak için kamera iznine ihtiyaç var</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>İzin Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Geri Dön</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_a', 'upc_e', 'itf14', 'codabar'],
        }}
        onBarcodeScanned={scanning && !loading ? handleBarcode : undefined}
      />

      {/* Overlay: dark except scan window */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayRow}>
          <View style={styles.overlaySide} />
          <View style={[styles.scanWindow, isSpeedMode && styles.scanWindowActive]} />
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Top Bar */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity
          testID="scanner-back"
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <X size={22} color={C.text} />
        </TouchableOpacity>
        {isSpeedMode && (
          <View style={styles.speedBadge}>
            <Zap size={13} color="#0A0A0A" />
            <Text style={styles.speedBadgeText}>HIZ MODU</Text>
          </View>
        )}
      </SafeAreaView>

      {/* Hint */}
      {!result && !loading && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>Barkodu çerçeve içine alın</Text>
        </View>
      )}

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingBox} pointerEvents="none">
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      )}

      {/* ─── SPEED MODE: Full screen price ─── */}
      {result && isSpeedMode && result.type === 'found' && result.product && (
        <Animated.View style={[styles.fullScreen, { opacity: fadeAnim }]} pointerEvents="none">
          <CheckCircle size={40} color={C.success} />
          <Text style={styles.fullName} numberOfLines={3}>
            {result.product.product_name}
          </Text>
          <Text style={styles.fullPrice}>{formatPrice(result.product.price)}</Text>
        </Animated.View>
      )}

      {/* ─── SPEED MODE: Not found ─── */}
      {result && isSpeedMode && result.type === 'not_found' && (
        <Animated.View style={[styles.fullScreenError, { opacity: fadeAnim }]} pointerEvents="none">
          <AlertCircle size={40} color={C.error} />
          <Text style={styles.fullNotFound}>Ürün Bulunamadı</Text>
          <Text style={styles.fullBarcode}>{result.barcode}</Text>
        </Animated.View>
      )}

      {/* ─── NORMAL MODE: Bottom sheet ─── */}
      {result && !isSpeedMode && (
        <Animated.View style={[styles.resultBox, { opacity: fadeAnim }]} testID="scan-result">
          {result.type === 'found' && result.product ? (
            <>
              <CheckCircle size={26} color={C.success} />
              <Text style={styles.resultName} numberOfLines={2}>
                {result.product.product_name}
              </Text>
              <Text style={styles.resultPrice}>{formatPrice(result.product.price)}</Text>
              {!isSelectMode && (
                <View style={styles.resultActions}>
                  <TouchableOpacity
                    testID="view-detail-btn"
                    style={styles.detailBtn}
                    onPress={() => router.push(`/product/${result.product!.id}`)}
                  >
                    <Text style={styles.detailBtnText}>Detay</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="scan-again-btn"
                    style={styles.scanAgainBtn}
                    onPress={() => {
                      setResult(null);
                      cooldown.current = false;
                      setScanning(true);
                    }}
                  >
                    <Text style={styles.scanAgainText}>Tekrar Tara</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <>
              <AlertCircle size={28} color={C.error} />
              <Text style={styles.notFoundText}>Ürün Bulunamadı</Text>
              <Text style={styles.notFoundBarcode}>{result.barcode}</Text>
              <TouchableOpacity
                style={styles.scanAgainBtn}
                onPress={() => {
                  setResult(null);
                  cooldown.current = false;
                  setScanning(true);
                }}
              >
                <Text style={styles.scanAgainText}>Tekrar Tara</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  permText: { color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permSub: { color: C.sub, fontSize: 14, textAlign: 'center' },
  permBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permBtnText: { color: '#0A0A0A', fontSize: 16, fontWeight: '800' },
  backLink: { marginTop: 8 },
  backLinkText: { color: C.sub, fontSize: 14 },

  // Overlay sections
  overlayTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: OVERLAY_H,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  overlayRow: {
    position: 'absolute',
    top: OVERLAY_H, left: 0, right: 0,
    height: SCAN_SIZE,
    flexDirection: 'row',
  },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
  scanWindow: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 14,
  },
  scanWindowActive: {
    borderColor: '#F5C518',
    borderWidth: 3,
  },
  overlayBottom: {
    position: 'absolute',
    top: OVERLAY_H + SCAN_SIZE,
    left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
  },
  backBtn: {
    width: 46, height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5C518',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  speedBadgeText: {
    color: '#0A0A0A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // Hint
  hint: {
    position: 'absolute',
    top: OVERLAY_H + SCAN_SIZE + 20,
    left: 0, right: 0,
    alignItems: 'center',
  },
  hintText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },

  // Loading
  loadingBox: {
    position: 'absolute',
    top: OVERLAY_H + SCAN_SIZE / 2 - 20,
    left: 0, right: 0,
    alignItems: 'center',
  },

  // ── Full screen speed mode result ──────────────────────────
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  fullName: {
    color: '#0A0A0A',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
    maxWidth: SW - 64,
  },
  fullPrice: {
    color: '#0A0A0A',
    fontSize: 76,
    fontWeight: '900',
    letterSpacing: -3,
    textAlign: 'center',
  },
  fullScreenError: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C1C1C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  fullNotFound: {
    color: '#EF4444',
    fontSize: 32,
    fontWeight: '800',
  },
  fullBarcode: {
    color: C.sub,
    fontSize: 16,
    letterSpacing: 1,
  },

  // ── Normal mode bottom sheet ───────────────────────────────
  resultBox: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    padding: 24,
    paddingBottom: 36,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    alignItems: 'center',
    gap: 10,
  },
  resultName: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  resultPrice: {
    color: C.primary,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
  },
  resultActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  detailBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: C.highlight,
    alignItems: 'center',
  },
  detailBtnText: { color: C.text, fontWeight: '600', fontSize: 15 },
  scanAgainBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  scanAgainText: { color: '#0A0A0A', fontWeight: '800', fontSize: 15 },
  notFoundText: { color: C.error, fontSize: 22, fontWeight: '800' },
  notFoundBarcode: { color: C.sub, fontSize: 14, letterSpacing: 1 },
});
