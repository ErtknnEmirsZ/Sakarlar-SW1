import React, { useState, useRef, useEffect } from 'react';
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

// ── Rectangle scan window (wide & short for barcodes) ────────────────────────
const SCAN_W = Math.min(SW * 0.88, 340);
const SCAN_H = Math.round(SCAN_W * 0.30);         // 3:1 ratio — ideal for 1D barcodes
const SCAN_TOP = Math.round(SH * 0.30);            // 30% from top
const CORNER = 22;                                  // corner guide size

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
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { speedMode, mode } = useLocalSearchParams<{ speedMode?: string; mode?: string }>();

  const isSpeedMode = speedMode === '1';
  const isSelectMode = mode === 'select';

  // Animated scan line sweeps across the rectangle
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const showResult = (res: ScanResult) => {
    setResult(res);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const resetScanner = (delay = 0) => {
    const doReset = () => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        setResult(null);
        cooldown.current = false;
        setScanning(true);
      });
    };
    if (delay > 0) {
      setTimeout(doReset, delay);
    } else {
      doReset();
    }
  };

  const handleBarcode = async ({ data }: { data: string }) => {
    if (cooldown.current || loading) return;
    cooldown.current = true;
    setScanning(false);
    setLoading(true);

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/products/barcode/${encodeURIComponent(data)}`
      );
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

        // Speed mode: full screen → auto-return after 1s
        if (isSpeedMode) {
          resetScanner(1000);
        }
        // Normal mode: user manually dismisses
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        showResult({ type: 'not_found', barcode: data });
        // Always auto-return after 1s for "not found"
        resetScanner(1000);
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

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_H - 2],
  });

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13', 'ean8', 'qr', 'code128', 'code39',
            'upc_a', 'upc_e', 'itf14', 'codabar', 'code93',
          ],
        }}
        onBarcodeScanned={scanning && !loading ? handleBarcode : undefined}
      />

      {/* ── Dark overlay with rectangular hole ── */}
      <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' } as any]}>
        {/* Top dark area */}
        <View style={styles.overlayTop} />
        {/* Middle row: dark side | scan window | dark side */}
        <View style={styles.overlayRow}>
          <View style={styles.overlaySide} />

          {/* Scan window (transparent rectangle) */}
          <View style={[styles.scanWindow, isSpeedMode && styles.scanWindowActive]}>
            {/* Corner guides */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {/* Animated scan line */}
            {scanning && (
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}
              />
            )}
          </View>

          <View style={styles.overlaySide} />
        </View>
        {/* Bottom dark area */}
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

      {/* Hint text below scan window */}
      {!result && !loading && (
        <View
          style={styles.hint}
          pointerEvents="none"
        >
          <Text style={styles.hintText}>Barkodu çerçeve içine alın</Text>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingBox} pointerEvents="none">
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      )}

      {/* ── SPEED MODE: Full-screen price ── */}
      {result && isSpeedMode && result.type === 'found' && result.product && (
        <Animated.View
          style={[styles.fullScreen, { opacity: fadeAnim }]}
          pointerEvents="none"
        >
          <CheckCircle size={44} color={C.success} />
          <Text style={styles.fullName} numberOfLines={3}>
            {result.product.product_name}
          </Text>
          <Text style={styles.fullPrice}>{formatPrice(result.product.price)}</Text>
        </Animated.View>
      )}

      {/* ── SPEED MODE: Not found ── */}
      {result && isSpeedMode && result.type === 'not_found' && (
        <Animated.View
          style={[styles.fullScreenError, { opacity: fadeAnim }]}
          pointerEvents="none"
        >
          <AlertCircle size={44} color={C.error} />
          <Text style={styles.fullNotFound}>Ürün Bulunamadı</Text>
          <Text style={styles.fullBarcode}>{result.barcode}</Text>
        </Animated.View>
      )}

      {/* ── NORMAL MODE: Bottom card ── */}
      {result && !isSpeedMode && (
        <Animated.View
          testID="scan-result"
          style={[styles.resultBox, { opacity: fadeAnim }]}
        >
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
                testID="scan-again-btn"
                style={[styles.scanAgainBtn, { width: '80%' }]}
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
    flex: 1, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
    padding: 24, gap: 16,
  },
  permText: { color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permSub: { color: C.sub, fontSize: 14, textAlign: 'center' },
  permBtn: {
    backgroundColor: C.primary, paddingHorizontal: 36,
    paddingVertical: 16, borderRadius: 12,
  },
  permBtnText: { color: '#0A0A0A', fontSize: 16, fontWeight: '800' },
  backLink: { marginTop: 8 },
  backLinkText: { color: C.sub, fontSize: 14 },

  // ── Overlay ────────────────────────────────────────────────
  overlayTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: SCAN_TOP,
    backgroundColor: 'rgba(0,0,0,0.76)',
  },
  overlayRow: {
    position: 'absolute',
    top: SCAN_TOP, left: 0, right: 0,
    height: SCAN_H,
    flexDirection: 'row',
  },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)' },
  overlayBottom: {
    position: 'absolute',
    top: SCAN_TOP + SCAN_H,
    left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.76)',
  },

  // ── Scan window ───────────────────────────────────────────
  scanWindow: {
    width: SCAN_W,
    height: SCAN_H,
    overflow: 'visible',
    position: 'relative',
  },
  scanWindowActive: {},   // speed mode: corners turn yellow (via cornerActive)

  // Corner guide marks
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  cornerTL: {
    top: -2, left: -2,
    borderTopWidth: 3, borderLeftWidth: 3,
    borderTopLeftRadius: 5,
    borderColor: '#F5C518',
  },
  cornerTR: {
    top: -2, right: -2,
    borderTopWidth: 3, borderRightWidth: 3,
    borderTopRightRadius: 5,
    borderColor: '#F5C518',
  },
  cornerBL: {
    bottom: -2, left: -2,
    borderBottomWidth: 3, borderLeftWidth: 3,
    borderBottomLeftRadius: 5,
    borderColor: '#F5C518',
  },
  cornerBR: {
    bottom: -2, right: -2,
    borderBottomWidth: 3, borderRightWidth: 3,
    borderBottomRightRadius: 5,
    borderColor: '#F5C518',
  },

  // Animated scan line
  scanLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 2,
    backgroundColor: 'rgba(245,197,24,0.75)',
  },

  // ── Top bar ───────────────────────────────────────────────
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
    alignItems: 'center', justifyContent: 'center',
  },
  speedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5C518',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  speedBadgeText: {
    color: '#0A0A0A', fontSize: 11, fontWeight: '900', letterSpacing: 0.8,
  },

  // Hint
  hint: {
    position: 'absolute',
    top: SCAN_TOP + SCAN_H + 18,
    left: 0, right: 0,
    alignItems: 'center',
  },
  hintText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },

  // Loading
  loadingBox: {
    position: 'absolute',
    top: SCAN_TOP + SCAN_H / 2 - 18,
    left: 0, right: 0,
    alignItems: 'center',
  },

  // ── Full screen speed mode ─────────────────────────────────
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  fullName: {
    color: '#0A0A0A', fontSize: 26, fontWeight: '700',
    textAlign: 'center', lineHeight: 34,
    maxWidth: SW - 64,
  },
  fullPrice: {
    color: '#0A0A0A', fontSize: 80, fontWeight: '900',
    letterSpacing: -3, textAlign: 'center',
  },
  fullScreenError: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C1C1C',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  fullNotFound: { color: '#EF4444', fontSize: 32, fontWeight: '800' },
  fullBarcode: { color: C.sub, fontSize: 16, letterSpacing: 1 },

  // ── Normal mode bottom card ────────────────────────────────
  resultBox: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    padding: 24, paddingBottom: 40,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    alignItems: 'center', gap: 10,
  },
  resultName: {
    color: C.text, fontSize: 18, fontWeight: '700',
    textAlign: 'center', lineHeight: 24,
  },
  resultPrice: {
    color: C.primary, fontSize: 58, fontWeight: '900', letterSpacing: -2,
  },
  resultActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  detailBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: C.highlight, alignItems: 'center',
  },
  detailBtnText: { color: C.text, fontWeight: '600', fontSize: 15 },
  scanAgainBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: C.primary, alignItems: 'center',
  },
  scanAgainText: { color: '#0A0A0A', fontWeight: '800', fontSize: 15 },
  notFoundText: { color: C.error, fontSize: 22, fontWeight: '800' },
  notFoundBarcode: { color: C.sub, fontSize: 14, letterSpacing: 1 },
});
