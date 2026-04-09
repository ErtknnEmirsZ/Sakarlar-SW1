import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Zap, AlertCircle, CheckCircle } from 'lucide-react-native';
import { formatPrice } from '../utils/format';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SW } = Dimensions.get('window');
const SCAN_SIZE = SW * 0.7;

const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  highlight: '#262626',
  primary: '#EAB308',
  text: '#FFFFFF',
  sub: '#A3A3A3',
  error: '#EF4444',
  success: '#22C55E',
};

interface ScanResult {
  type: 'found' | 'not_found';
  product?: { id: string; product_name: string; price: number };
  barcode?: string;
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const cooldown = useRef(false);
  const router = useRouter();
  const { speedMode, mode } = useLocalSearchParams<{ speedMode?: string; mode?: string }>();

  const isSpeedMode = speedMode === '1';
  const isSelectMode = mode === 'select';

  const handleBarcode = async ({ data }: { data: string }) => {
    if (cooldown.current || loading) return;
    cooldown.current = true;
    setScanning(false);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/products/barcode/${encodeURIComponent(data)}`);
      if (res.ok) {
        const product = await res.json();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setResult({ type: 'found', product });

        if (isSelectMode) {
          // Pass barcode back to calling screen
          const { scanStore } = await import('../utils/scanStore');
          scanStore.pendingBarcode = data;
          setTimeout(() => router.back(), 800);
          return;
        }

        if (isSpeedMode) {
          setTimeout(() => {
            setResult(null);
            setLoading(false);
            cooldown.current = false;
            setScanning(true);
          }, 1800);
        } else {
          setLoading(false);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResult({ type: 'not_found', barcode: data });
        setLoading(false);

        setTimeout(() => {
          setResult(null);
          cooldown.current = false;
          setScanning(true);
        }, isSpeedMode ? 1000 : 2500);
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
        <AlertCircle size={48} color={C.error} />
        <Text style={styles.permText}>Kamera izni gerekli</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_a', 'upc_e', 'itf14'],
        }}
        onBarcodeScanned={scanning ? handleBarcode : undefined}
      />

      {/* Dark Overlay */}
      <View style={styles.overlayTop} />
      <View style={styles.overlayRow}>
        <View style={styles.overlaySide} />
        <View style={[styles.scanWindow, isSpeedMode && styles.scanWindowActive]} />
        <View style={styles.overlaySide} />
      </View>
      <View style={styles.overlayBottom} />

      {/* Back Button */}
      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
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

      {/* Hint Text */}
      {!result && !loading && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Barkodu çerçeve içine alın</Text>
        </View>
      )}

      {/* Loading */}
      {loading && !result && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      )}

      {/* Result Overlay */}
      {result && (
        <View style={styles.resultBox} testID="scan-result">
          {result.type === 'found' && result.product ? (
            <>
              <CheckCircle size={28} color={C.success} />
              <Text style={styles.resultName} numberOfLines={2}>
                {result.product.product_name}
              </Text>
              <Text style={styles.resultPrice}>{formatPrice(result.product.price)}</Text>
              {!isSpeedMode && !isSelectMode && (
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
            </>
          )}
        </View>
      )}
    </View>
  );
}

const OVERLAY_H = (Dimensions.get('window').height - SCAN_SIZE) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  permText: { color: C.text, fontSize: 16, textAlign: 'center' },
  permBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permBtnText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },

  // Overlay
  overlayTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: OVERLAY_H,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  overlayRow: {
    position: 'absolute',
    top: OVERLAY_H,
    left: 0, right: 0,
    height: SCAN_SIZE,
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  scanWindow: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
  },
  scanWindowActive: {
    borderColor: '#EAB308',
    borderWidth: 2.5,
  },
  overlayBottom: {
    position: 'absolute',
    top: OVERLAY_H + SCAN_SIZE,
    left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },

  // Top Bar
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  backBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAB308',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  speedBadgeText: {
    color: '#0A0A0A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Hint
  hint: {
    position: 'absolute',
    top: OVERLAY_H + SCAN_SIZE + 24,
    left: 0, right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },

  // Loading
  loadingBox: {
    position: 'absolute',
    bottom: 60,
    left: 0, right: 0,
    alignItems: 'center',
  },

  // Result
  resultBox: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 4,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  detailBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: C.highlight,
    alignItems: 'center',
  },
  detailBtnText: { color: C.text, fontWeight: '600', fontSize: 15 },
  scanAgainBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  scanAgainText: { color: '#0A0A0A', fontWeight: '700', fontSize: 15 },
  notFoundText: {
    color: C.error,
    fontSize: 22,
    fontWeight: '800',
  },
  notFoundBarcode: {
    color: C.sub,
    fontSize: 14,
  },
});
