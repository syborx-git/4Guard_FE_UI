/**
 * @file ghost-cursor.component.ts
 * @description Componente Angular para la animación Ghost Cursor con Three.js / WebGL.
 * Restaura el shader equilibrado del componente original para mantener el fondo oscuro
 * y generar la nube fluida de humo neón siguiendo el puntero del ratón.
 */

import {
  Component,
  ElementRef,
  Input,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject,
  PLATFORM_ID,
  NgZone
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

@Component({
  selector: 'fg-ghost-cursor',
  standalone: true,
  imports: [CommonModule],
  template: `<div #container class="ghost-cursor" [ngStyle]="containerStyles"></div>`,
  styleUrl: './ghost-cursor.component.css'
})
export class GhostCursorComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  @Input() trailLength = 50;
  @Input() inertia = 0.5;
  @Input() grainIntensity = 0.04;
  @Input() bloomStrength = 0.15;
  @Input() bloomRadius = 1.0;
  @Input() bloomThreshold = 0.025;
  @Input() brightness = 2.0;
  @Input() blobSize = 1.2;
  @Input() color = '#38bdf8'; // Azul brillante 4GUARD
  @Input() mixBlendMode = 'screen';
  @Input() edgeIntensity = 0;
  @Input() maxDevicePixelRatio = 1.5;
  @Input() targetPixels?: number;
  @Input() fadeDelayMs?: number;
  @Input() fadeDurationMs?: number;
  @Input() zIndex = 1;

  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);

  private renderer?: THREE.WebGLRenderer;
  private composer?: EffectComposer;
  private material?: THREE.ShaderMaterial;
  private bloomPass?: UnrealBloomPass;
  private filmPass?: ShaderPass;

  private trailBuf: THREE.Vector2[] = [];
  private head = 0;

  private rafId: number | null = null;
  private resizeObserver?: ResizeObserver;
  private currentMouse = new THREE.Vector2(0.5, 0.5);
  private velocity = new THREE.Vector2(0, 0);
  private fadeOpacity = 0.0; // Inicia transparente hasta que el usuario mueva el ratón
  private lastMoveTime = 0;
  private pointerActive = false;
  private isRunning = false;
  private hasValidSize = false;

  private listenerCleanups: (() => void)[] = [];

  get containerStyles() {
    return {
      zIndex: this.zIndex
    };
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.ngZone.runOutsideAngular(() => {
      this.initThreeScene();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.material) return;

    if (changes['color']) {
      const c = new THREE.Color(this.color);
      this.material.uniforms['iBaseColor'].value.set(c.r, c.g, c.b);
    }
    if (changes['brightness']) {
      this.material.uniforms['iBrightness'].value = this.brightness;
    }
    if (changes['blobSize']) {
      this.material.uniforms['iBlobSize'].value = this.blobSize;
    }
    if (changes['edgeIntensity']) {
      this.material.uniforms['iEdgeIntensity'].value = this.edgeIntensity;
    }
    if (changes['grainIntensity'] && this.filmPass?.uniforms['intensity']) {
      this.filmPass.uniforms['intensity'].value = this.grainIntensity;
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private initThreeScene(): void {
    const host = this.containerRef.nativeElement;
    const parent = host.parentElement || host;
    if (!host) return;

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const pixelBudget = this.targetPixels ?? (isTouch ? 0.9e6 : 1.3e6);
    const fadeDelay = this.fadeDelayMs ?? (isTouch ? 500 : 1000);
    const fadeDuration = this.fadeDurationMs ?? (isTouch ? 1000 : 1500);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isTouch,
      alpha: true,
      depth: false,
      stencil: false,
      powerPreference: isTouch ? 'low-power' : 'high-performance',
      premultipliedAlpha: false,
      preserveDrawingBuffer: false
    });
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;

    renderer.domElement.style.pointerEvents = 'none';
    if (this.mixBlendMode) {
      renderer.domElement.style.mixBlendMode = String(this.mixBlendMode);
    }

    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geom = new THREE.PlaneGeometry(2, 2);

    const maxTrail = Math.max(1, Math.floor(this.trailLength));
    this.trailBuf = Array.from({ length: maxTrail }, () => new THREE.Vector2(0.5, 0.5));
    this.head = 0;

    const baseColor = new THREE.Color(this.color);

    const baseVertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float iTime;
      uniform vec3  iResolution;
      uniform vec2  iMouse;
      uniform vec2  iPrevMouse[MAX_TRAIL_LENGTH];
      uniform float iOpacity;
      uniform float iScale;
      uniform vec3  iBaseColor;
      uniform float iBrightness;
      uniform float iBlobSize;
      uniform float iEdgeIntensity;
      varying vec2  vUv;

      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453123); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f *= f * (3. - 2. * f);
        return mix(mix(hash(i + vec2(0.,0.)), hash(i + vec2(1.,0.)), f.x),
                   mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
      }
      float fbm(vec2 p){
        float v = 0.0;
        float a = 0.5;
        mat2 m = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for(int i=0;i<5;i++){
          v += a * noise(p);
          p = m * p * 2.0;
          a *= 0.5;
        }
        return v;
      }
      vec3 tint1(vec3 base){ return mix(base, vec3(1.0), 0.15); }
      vec3 tint2(vec3 base){ return mix(base, vec3(0.8, 0.9, 1.0), 0.25); }

      vec4 blob(vec2 p, vec2 mousePos, float intensity, float activity) {
        vec2 q = vec2(fbm(p * iScale + iTime * 0.1), fbm(p * iScale + vec2(5.2,1.3) + iTime * 0.1));
        vec2 r = vec2(fbm(p * iScale + q * 1.5 + iTime * 0.15), fbm(p * iScale + q * 1.5 + vec2(8.3,2.8) + iTime * 0.15));

        float smoke = fbm(p * iScale + r * 0.8);
        float radius = (0.5 + 0.3 * (1.0 / max(0.1, iScale))) * iBlobSize;
        float distFactor = 1.0 - smoothstep(0.0, radius * activity, length(p - mousePos));
        float alpha = pow(smoke, 2.2) * distFactor;

        vec3 c1 = tint1(iBaseColor);
        vec3 c2 = tint2(iBaseColor);
        vec3 color = mix(c1, c2, sin(iTime * 0.5) * 0.5 + 0.5);

        return vec4(color * alpha * intensity, alpha * intensity);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
        vec2 mouse = (iMouse * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);

        vec3 colorAcc = vec3(0.0);
        float alphaAcc = 0.0;

        vec4 b = blob(uv, mouse, 1.0, iOpacity);
        colorAcc += b.rgb;
        alphaAcc += b.a;

        for (int i = 0; i < MAX_TRAIL_LENGTH; i++) {
          vec2 pm = (iPrevMouse[i] * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
          float t = 1.0 - float(i) / float(MAX_TRAIL_LENGTH);
          t = pow(t, 2.0);
          if (t > 0.01) {
            vec4 bt = blob(uv, pm, t * 0.8, iOpacity);
            colorAcc += bt.rgb;
            alphaAcc += bt.a;
          }
        }

        colorAcc *= iBrightness;

        vec2 uv01 = gl_FragCoord.xy / iResolution.xy;
        float edgeDist = min(min(uv01.x, 1.0 - uv01.x), min(uv01.y, 1.0 - uv01.y));
        float distFromEdge = clamp(edgeDist * 2.0, 0.0, 1.0);
        float k = clamp(iEdgeIntensity, 0.0, 1.0);
        float edgeMask = mix(1.0 - k, 1.0, distFromEdge);

        float outAlpha = clamp(alphaAcc * iOpacity * edgeMask, 0.0, 1.0);
        gl_FragColor = vec4(colorAcc, outAlpha);
      }
    `;

    const FilmGrainShader = {
      uniforms: {
        tDiffuse: { value: null },
        iTime: { value: 0 },
        intensity: { value: this.grainIntensity }
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float iTime;
        uniform float intensity;
        varying vec2 vUv;

        float hash1(float n){ return fract(sin(n)*43758.5453); }

        void main(){
          vec4 color = texture2D(tDiffuse, vUv);
          float n = hash1(vUv.x*1000.0 + vUv.y*2000.0 + iTime) * 2.0 - 1.0;
          color.rgb += n * intensity * color.rgb;
          gl_FragColor = color;
        }
      `
    };

    const UnpremultiplyShader = {
      uniforms: { tDiffuse: { value: null } },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          float a = max(c.a, 1e-5);
          vec3 straight = c.rgb / a;
          gl_FragColor = vec4(clamp(straight, 0.0, 1.0), c.a);
        }
      `
    };

    const material = new THREE.ShaderMaterial({
      defines: { MAX_TRAIL_LENGTH: maxTrail },
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3(1, 1, 1) },
        iMouse: { value: new THREE.Vector2(0.5, 0.5) },
        iPrevMouse: { value: this.trailBuf.map((v) => v.clone()) },
        iOpacity: { value: 0.0 },
        iScale: { value: 1.0 },
        iBaseColor: { value: new THREE.Vector3(baseColor.r, baseColor.g, baseColor.b) },
        iBrightness: { value: this.brightness },
        iBlobSize: { value: this.blobSize },
        iEdgeIntensity: { value: this.edgeIntensity }
      },
      vertexShader: baseVertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    this.material = material;

    const mesh = new THREE.Mesh(geom, material);
    scene.add(mesh);

    const composer = new EffectComposer(renderer);
    this.composer = composer;

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      this.bloomStrength,
      this.bloomRadius,
      this.bloomThreshold
    );
    this.bloomPass = bloomPass;
    composer.addPass(bloomPass);

    const filmPass = new ShaderPass(FilmGrainShader);
    this.filmPass = filmPass;
    composer.addPass(filmPass);

    const unpremultiplyPass = new ShaderPass(UnpremultiplyShader);
    composer.addPass(unpremultiplyPass);

    const calculateScale = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const base = 600;
      const current = Math.min(Math.max(1, r.width), Math.max(1, r.height));
      return Math.max(0.5, Math.min(2.0, current / base));
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const cssW = Math.max(Math.floor(rect.width), Math.floor(parent.getBoundingClientRect().width));
      const cssH = Math.max(Math.floor(rect.height), Math.floor(parent.getBoundingClientRect().height));

      if (cssW <= 0 || cssH <= 0) {
        this.hasValidSize = false;
        return;
      }

      const currentDPR = Math.min(
        window.devicePixelRatio || 1,
        this.maxDevicePixelRatio
      );
      const need = cssW * cssH * currentDPR * currentDPR;
      const scale = need <= pixelBudget ? 1 : Math.max(0.5, Math.min(1, Math.sqrt(pixelBudget / Math.max(1, need))));
      const pixelRatio = currentDPR * scale;

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(cssW, cssH, false);

      composer.setPixelRatio(pixelRatio);
      composer.setSize(cssW, cssH);

      const wpx = Math.max(1, Math.floor(cssW * pixelRatio));
      const hpx = Math.max(1, Math.floor(cssH * pixelRatio));
      material.uniforms['iResolution'].value.set(wpx, hpx, 1);
      material.uniforms['iScale'].value = calculateScale(host);
      bloomPass.setSize(wpx, hpx);

      this.hasValidSize = true;
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    this.resizeObserver = ro;
    ro.observe(parent);
    ro.observe(host);

    const start = performance.now();

    const animate = () => {
      if (!this.renderer || !this.composer) return;

      if (!this.hasValidSize) {
        this.rafId = requestAnimationFrame(animate);
        return;
      }

      const now = performance.now();
      const t = (now - start) / 1000;

      const mat = this.material!;
      const comp = this.composer!;

      if (this.pointerActive) {
        this.velocity.set(
          this.currentMouse.x - mat.uniforms['iMouse'].value.x,
          this.currentMouse.y - mat.uniforms['iMouse'].value.y
        );
        mat.uniforms['iMouse'].value.copy(this.currentMouse);
        this.fadeOpacity = 1.0;
      } else {
        this.velocity.multiplyScalar(this.inertia);
        if (this.velocity.lengthSq() > 1e-6) {
          mat.uniforms['iMouse'].value.add(this.velocity);
        }
        const dt = now - this.lastMoveTime;
        if (dt > fadeDelay) {
          const k = Math.min(1, (dt - fadeDelay) / fadeDuration);
          this.fadeOpacity = Math.max(0, 1 - k);
        }
      }

      const N = this.trailBuf.length;
      this.head = (this.head + 1) % N;
      this.trailBuf[this.head].copy(mat.uniforms['iMouse'].value);
      const arr = mat.uniforms['iPrevMouse'].value;
      for (let i = 0; i < N; i++) {
        const srcIdx = (this.head - i + N) % N;
        arr[i].copy(this.trailBuf[srcIdx]);
      }

      mat.uniforms['iOpacity'].value = this.fadeOpacity;
      mat.uniforms['iTime'].value = t;

      if (this.filmPass?.uniforms['iTime']) {
        this.filmPass.uniforms['iTime'].value = t;
      }

      comp.render();

      if (!this.pointerActive && this.fadeOpacity <= 0.001) {
        this.isRunning = false;
        this.rafId = null;
        return;
      }

      this.rafId = requestAnimationFrame(animate);
    };

    const ensureLoop = () => {
      if (!this.isRunning) {
        this.isRunning = true;
        this.rafId = requestAnimationFrame(animate);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = THREE.MathUtils.clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = THREE.MathUtils.clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);

      // Solo activar si el puntero está dentro del rectángulo del panel o cerca
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        this.currentMouse.set(x, y);
        this.pointerActive = true;
        this.lastMoveTime = performance.now();
        ensureLoop();
      } else if (this.pointerActive) {
        this.pointerActive = false;
        this.lastMoveTime = performance.now();
        ensureLoop();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    this.listenerCleanups.push(() => {
      window.removeEventListener('pointermove', onPointerMove);
    });

    ensureLoop();
  }

  private cleanup(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isRunning = false;
    this.hasValidSize = false;

    this.listenerCleanups.forEach((fn) => fn());
    this.listenerCleanups = [];

    this.resizeObserver?.disconnect();

    if (this.material) {
      this.material.dispose();
      this.material = undefined;
    }
    if (this.composer) {
      this.composer.dispose();
      this.composer = undefined;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      this.renderer = undefined;
    }
  }
}
