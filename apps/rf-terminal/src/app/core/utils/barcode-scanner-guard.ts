/**
 * Utilidades compartidas para escaneo por cámara en Terminal RF:
 * 1. Anti-Rebote (Debounce / Same-Code Cooldown) para evitar múltiples disparos en una sola pasada.
 * 2. Mejoras de hardware de cámara (autoenfoque continuo, exposición anti-deslumbramiento y FullHD).
 * 3. Configuración ZXing con TRY_HARDER y formatos industriales 1D/2D.
 */

export class BarcodeDebounceGuard {
  private lastCode = '';
  private lastScannedAt = 0;

  constructor(private readonly sameCodeCooldownMs: number = 3000) {}

  /**
   * Evalúa si el código detectado por cámara debe procesarse.
   * Si es el mismo código dentro de la ventana de enfriamiento (por defecto 3s),
   * retorna false para ignorarlo silenciosamente sin pitar ni mostrar error.
   */
  shouldProcess(rawCode: string): boolean {
    const clean = (rawCode || '').trim().toUpperCase();
    if (!clean) return false;

    const now = Date.now();
    if (clean === this.lastCode && now - this.lastScannedAt < this.sameCodeCooldownMs) {
      return false;
    }

    this.lastCode = clean;
    this.lastScannedAt = now;
    return true;
  }

  /** Reinicia la memoria del último código leído (ej. al cerrar cámara o cambiar de modo). */
  reset(): void {
    this.lastCode = '';
    this.lastScannedAt = 0;
  }
}

/**
 * Construye la escalera de constraints de cámara priorizando alta resolución (1080p -> 720p -> fallback)
 * para que las barras finas de códigos GS1-128 / Code-128 no pierdan nitidez.
 */
export function buildCameraConstraintsLadder(mode: 'environment' | 'user'): MediaStreamConstraints[] {
  return [
    {
      video: {
        facingMode: { ideal: mode },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: mode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: { facingMode: { ideal: mode } }, audio: false },
    { video: { facingMode: mode }, audio: false },
    { video: true, audio: false },
  ];
}

/**
 * Aplica mejoras de autoenfoque continuo y control de exposición anti-deslumbramiento
 * sobre el stream de video activo si el hardware de la tablet lo soporta.
 */
export async function applyCameraEnhancements(stream: MediaStream | null): Promise<void> {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (!track || typeof track.getCapabilities !== 'function' || typeof track.applyConstraints !== 'function') {
    return;
  }

  try {
    const caps = track.getCapabilities() as any;
    const advanced: Record<string, any> = {};

    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
      advanced['focusMode'] = 'continuous';
    }
    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
      advanced['exposureMode'] = 'continuous';
    }
    if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
      advanced['whiteBalanceMode'] = 'continuous';
    }
    // Reducir ligeramente la compensación de exposición si el sensor lo permite para evitar deslumbramiento en etiquetas blancas
    if (caps.exposureCompensation && typeof caps.exposureCompensation.min === 'number' && caps.exposureCompensation.min < 0) {
      advanced['exposureCompensation'] = Math.max(caps.exposureCompensation.min, -0.5);
    }

    if (Object.keys(advanced).length > 0) {
      await track.applyConstraints({ advanced: [advanced] } as any);
    }
  } catch {
    // Algunos drivers Android/iOS lanzan OverconstrainedError en advanced; ignorar de forma segura
  }
}

/**
 * Crea un lector ZXing optimizado con TRY_HARDER y lista explícita de formatos de almacén 1D/2D.
 */
export function createEnhancedZxingReader(ZXing: any): any {
  try {
    if (ZXing.DecodeHintType && ZXing.BarcodeFormat) {
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.ITF,
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.UPC_E,
        ZXing.BarcodeFormat.QR_CODE,
        ZXing.BarcodeFormat.DATA_MATRIX,
      ]);
      return new ZXing.BrowserMultiFormatReader(hints);
    }
  } catch {
    // Fallback al constructor estándar si la versión UMD difiere
  }
  return new ZXing.BrowserMultiFormatReader();
}
