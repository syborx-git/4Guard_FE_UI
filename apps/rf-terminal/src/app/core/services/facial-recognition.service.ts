/**
 * @file facial-recognition.service.ts
 * @description Reconocimiento facial multi-operador para la Terminal RF (tablet compartida).
 * - Todo el procesamiento ocurre en el dispositivo (ningún video sale de la tablet).
 * - Padrón de operadores guardado localmente (offline-first, ADR-012).
 * - Motor: @vladmandic/face-api (TinyFaceDetector + landmarks tiny + descriptor de 128 puntos).
 */
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface FaceOperatorProfile {
  id: string;
  employeeCode: string;
  fullName: string;
  role: 'OPERATOR' | 'ADMIN';
  title: string;
  /** Muestras de descriptor facial (128 floats cada una). Vacío = sin rostro enrolado. */
  descriptors: number[][];
  photo?: string; // miniatura dataURL
  enrolledAt?: string;
}

export interface FaceMatch {
  profile: FaceOperatorProfile;
  distance: number;
  confidence: number; // 0-100
}

const STORAGE_KEY = '4g_face_profiles_v1';
const MODELS_URL = 'assets/face-models';
/** Distancia euclidiana máxima para considerar la misma persona (face-api recomienda 0.6; usamos 0.5 por seguridad). */
const MATCH_THRESHOLD = 0.5;

/**
 * Operadores estándar del catálogo de 4GUARD WMS (ADR-012).
 * Homologados con STANDARD_FORKLIFT_OPERATORS en el backend y admin-console.
 */
const DEFAULT_OPERATOR_PROFILES: FaceOperatorProfile[] = [
  { id: '852584b7-37c7-4a5f-b4dc-c7b6097a9c51', employeeCode: 'MC-001', fullName: 'Hector Villalva Ayala', role: 'OPERATOR', title: 'Líder de Turno', descriptors: [] },
  { id: 'b51345cb-bc76-4b3c-8386-d7595c14a83a', employeeCode: 'MC-002', fullName: 'Alex Gabriel Perez Garduño', role: 'OPERATOR', title: 'Operador Especialista', descriptors: [] },
  { id: '401954d5-dcc8-48bb-8a17-48a68d31580b', employeeCode: 'MC-003', fullName: 'Alfredo Ramirez Gonzalez', role: 'OPERATOR', title: 'Operador de Andén', descriptors: [] },
  { id: '721954d5-ecc8-48bb-8a17-48a68d31580c', employeeCode: 'MC-004', fullName: 'Carlos Mendez Morales', role: 'OPERATOR', title: 'Montacarguista Senior', descriptors: [] },
];

function isBannedOperator(p: { id?: string; employeeCode?: string; fullName?: string }): boolean {
  const name = (p.fullName || '').toLowerCase();
  const code = (p.employeeCode || '').toLowerCase();
  const id = (p.id || '').toLowerCase();
  return (
    name.includes('christian') ||
    name.includes('barraza') ||
    name.includes('mario s') ||
    id.includes('christian') ||
    id.includes('alejandro') ||
    id.includes('mario') ||
    code.includes('vip')
  );
}

@Injectable({ providedIn: 'root' })
export class FacialRecognitionService {
  private readonly http = inject(HttpClient);
  private faceapi: any = null;
  private modelsPromise: Promise<void> | null = null;
  private stream: MediaStream | null = null;

  readonly modelsReady = signal(false);
  readonly profiles = signal<FaceOperatorProfile[]>(this.loadProfiles());

  constructor() {
    // Sincronizar catálogo real de montacarguistas desde el backend
    this.loadBackendOperators();
  }

  // ── Padrón ──────────────────────────────────────────────────────────────
  private loadProfiles(): FaceOperatorProfile[] {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const saved = JSON.parse(raw) as FaceOperatorProfile[];
        // Filtrar perfiles obsoletos o de demo que ya no deben figurar
        const cleanSaved = saved.filter((p) => !isBannedOperator(p));
        const merged = [...cleanSaved];
        for (const d of DEFAULT_OPERATOR_PROFILES) {
          if (!merged.some((p) => p.id === d.id || p.employeeCode === d.employeeCode)) {
            merged.push({ ...d });
          }
        }
        return merged;
      }
    } catch {}
    return DEFAULT_OPERATOR_PROFILES.map((p) => ({ ...p }));
  }

  /**
   * Consulta el backend (/api/v1/forklift-operators?status=ACTIVO) para obtener la lista
   * actualizada de montacarguistas activos registrados en la base de datos y conserva
   * los descriptores biométricos enrolados previamente en el dispositivo.
   */
  async loadBackendOperators(): Promise<void> {
    try {
      const apiBase = (environment as any).apiBaseUrl ?? '';
      const url = `${apiBase}/api/v1/forklift-operators?status=ACTIVO`;
      const res: any = await firstValueFrom(
        this.http.get<any>(url).pipe(
          catchError(() => of(null))
        )
      );

      const rawList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      if (rawList && rawList.length > 0) {
        const currentProfiles = this.profiles();
        const merged: FaceOperatorProfile[] = rawList
          .filter((op: any) => !isBannedOperator({ id: op.id, employeeCode: op.code, fullName: op.fullName }))
          .map((op: any) => {
            const code = op.code || 'MC-001';
            const fullName = (
              op.fullName ||
              `${op.firstName || ''} ${op.lastNamePaternal || ''} ${op.lastNameMaternal || ''}`
            ).trim() || 'Montacarguista';
            const title = op.jobTitle || 'Montacarguista';
            const id = op.id || `op-${code.toLowerCase()}`;

            // Buscar si ya tiene enrolamiento de rostro previo en esta tablet
            const existing = currentProfiles.find((p) => p.id === id || p.employeeCode === code);
            return {
              id,
              employeeCode: code,
              fullName,
              role: 'OPERATOR' as const,
              title,
              descriptors: existing?.descriptors || [],
              photo: existing?.photo,
              enrolledAt: existing?.enrolledAt,
            };
          });

        if (merged.length > 0) {
          this.profiles.set(merged);
          this.persist();
        }
      }
    } catch (err) {
      console.warn('[FacialRecognitionService] No se pudieron sincronizar operadores del backend:', err);
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profiles()));
    } catch {}
  }

  hasAnyEnrolled(): boolean {
    return this.profiles().some((p) => p.descriptors.length > 0);
  }

  saveEnrollment(profileId: string, samples: Float32Array[], photo?: string): void {
    this.profiles.update((list) =>
      list.map((p) =>
        p.id === profileId
          ? {
              ...p,
              descriptors: samples.map((s) => Array.from(s)),
              photo: photo || p.photo,
              enrolledAt: new Date().toISOString(),
            }
          : p
      )
    );
    this.persist();
  }

  removeEnrollment(profileId: string): void {
    this.profiles.update((list) =>
      list.map((p) => (p.id === profileId ? { ...p, descriptors: [], photo: undefined, enrolledAt: undefined } : p))
    );
    this.persist();
  }

  // ── Modelos ─────────────────────────────────────────────────────────────
  async loadModels(): Promise<void> {
    if (this.modelsReady()) return;
    if (!this.modelsPromise) {
      this.modelsPromise = (async () => {
        try {
          const dynamicImport = new Function('modulePath', 'return import(modulePath)');
          this.faceapi = await dynamicImport('@vladmandic/face-api');
        } catch (importErr) {
          console.warn('[FaceAPI] Módulo no disponible o no compilado en este entorno.', importErr);
          throw new Error('Reconocimiento facial no soportado en este dispositivo.');
        }

        if (!this.faceapi?.nets) {
          throw new Error('El motor de face-api no se inicializó correctamente.');
        }

        await Promise.all([
          this.faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          this.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
          this.faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        this.modelsReady.set(true);
      })().catch((err) => {
        this.modelsPromise = null;
        throw err;
      });
    }
    return this.modelsPromise;
  }

  // ── Cámara ──────────────────────────────────────────────────────────────
  async startCamera(video: HTMLVideoElement): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('La cámara no está disponible. Verifica HTTPS o el permiso de Chrome para esta página.');
    }
    this.stopCamera();
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { facingMode: 'user' }, audio: false },
      { video: true, audio: false },
    ];
    let lastErr: any = null;
    for (const c of attempts) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(c);
        if (this.stream.getVideoTracks().length) break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!this.stream) {
      throw new Error(
        lastErr?.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Actívalo en los permisos de Chrome para esta página.'
          : 'No se pudo abrir la cámara frontal.'
      );
    }
    video.srcObject = this.stream;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    await video.play().catch(() => {});
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  // ── Detección / Comparación ─────────────────────────────────────────────
  /** Devuelve el descriptor del rostro más grande en cuadro, o null si no hay rostro. */
  async captureDescriptor(video: HTMLVideoElement): Promise<Float32Array | null> {
    if (!this.faceapi || video.readyState < 2) return null;
    const result = await this.faceapi
      .detectSingleFace(video, new this.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    return result ? (result.descriptor as Float32Array) : null;
  }

  /** Foto en miniatura del cuadro actual del video (para el avatar del operador). */
  captureThumbnail(video: HTMLVideoElement): string | undefined {
    try {
      const size = 160;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      const s = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - s) / 2;
      const sy = (video.videoHeight - s) / 2;
      ctx.drawImage(video, sx, sy, s, s, 0, 0, size, size);
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch {
      return undefined;
    }
  }

  private distance(a: ArrayLike<number>, b: ArrayLike<number>): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  identify(descriptor: Float32Array): FaceMatch | null {
    let best: FaceMatch | null = null;
    for (const profile of this.profiles()) {
      for (const sample of profile.descriptors) {
        const dist = this.distance(descriptor, sample);
        if (!best || dist < best.distance) {
          best = { profile, distance: dist, confidence: Math.max(0, Math.round((1 - dist) * 100)) };
        }
      }
    }
    return best && best.distance <= MATCH_THRESHOLD ? best : null;
  }
}

