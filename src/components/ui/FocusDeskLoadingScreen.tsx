'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

// Module-level in-memory cache to prevent re-fetching and re-triangulating on route switches
let cachedSvgText: string | null = null;
let svgFetchPromise: Promise<string> | null = null;
let cachedTemplateGroup: THREE.Group | null = null;

function buildTemplateGroup(svgText: string): THREE.Group {
  const loader = new SVGLoader();
  const svgData = loader.parse(svgText);
  const svgGroup = new THREE.Group();

  svgData.paths.forEach((path: any) => {
    const hexColor = path.color?.getHex() ?? 0x2563eb;
    const isDarkShade = hexColor === 0x000000 || hexColor < 0x222222;

    // Physical 3D Materials tailored for the obsidian and blue segments
    const material = new THREE.MeshPhysicalMaterial({
      color: isDarkShade ? 0x0f172a : hexColor,
      metalness: isDarkShade ? 0.85 : 0.65,
      roughness: isDarkShade ? 0.22 : 0.16,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      reflectivity: 0.85,
      side: THREE.DoubleSide,
    });

    const shapes = SVGLoader.createShapes(path);

    shapes.forEach((shape: any) => {
      // Real 3D Extrude Geometry with beveled edges
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 26,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 2,
        bevelSize: 2.2,
        bevelThickness: 2.5,
      });

      const mesh = new THREE.Mesh(geometry, material);
      svgGroup.add(mesh);
    });
  });

  // Compute Bounding Box to center the 3D model precisely at (0, 0, 0)
  const box = new THREE.Box3().setFromObject(svgGroup);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Normalize scale to fit nicely in 3D viewport
  const maxDim = Math.max(size.x, size.y);
  const targetSize = 2.4;
  const scale = targetSize / (maxDim || 1);

  // Invert Y axis because SVG coordinates have Y pointing down
  svgGroup.position.x = -center.x;
  svgGroup.position.y = -center.y;
  svgGroup.position.z = -center.z;

  const wrapper = new THREE.Group();
  wrapper.add(svgGroup);
  wrapper.scale.set(scale, -scale, scale);

  return wrapper;
}

function getTemplateGroup(): Promise<THREE.Group> {
  if (cachedTemplateGroup) {
    return Promise.resolve(cachedTemplateGroup);
  }

  if (cachedSvgText) {
    try {
      cachedTemplateGroup = buildTemplateGroup(cachedSvgText);
      return Promise.resolve(cachedTemplateGroup);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  if (!svgFetchPromise) {
    svgFetchPromise = fetch('/focusdesk-logo-transparent.svg')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load SVG: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        cachedSvgText = text;
        return text;
      })
      .catch((err) => {
        svgFetchPromise = null;
        throw err;
      });
  }

  return svgFetchPromise.then((text) => {
    if (!cachedTemplateGroup) {
      cachedTemplateGroup = buildTemplateGroup(text);
    }
    return cachedTemplateGroup;
  });
}

// Warm up / prefetch immediately when module loads in browser
if (typeof window !== 'undefined') {
  getTemplateGroup().catch(() => {});
}

interface FocusDeskLoadingScreenProps {
  fullScreen?: boolean;
}

export function FocusDeskLoadingScreen({
  fullScreen = false,
}: FocusDeskLoadingScreenProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(() => Boolean(cachedTemplateGroup));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId: number;
    let isDisposed = false;

    // Dimensions
    const width = container.clientWidth || 240;
    const height = container.clientHeight || 240;

    // Scene
    const scene = new THREE.Scene();

    // Camera with natural perspective
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    // WebGL Renderer with full transparency & high precision
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Studio Lighting setup for realistic 3D specular shine & depth
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    // Key Light (White metallic reflection)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(5, 7, 6);
    scene.add(keyLight);

    // Fill Light (Sky blue accent reflection)
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    fillLight.position.set(-6, -3, 4);
    scene.add(fillLight);

    // Back / Rim Light for specular contour highlights
    const rimLight = new THREE.DirectionalLight(0x60a5fa, 2.2);
    rimLight.position.set(0, 6, -5);
    scene.add(rimLight);

    // Specular Glint Point Light
    const glintLight = new THREE.PointLight(0xffffff, 1.5, 15);
    glintLight.position.set(2, 3, 4);
    scene.add(glintLight);

    // Master 3D Logo Group
    const rootPivot = new THREE.Group();
    scene.add(rootPivot);

    const modelGroup = new THREE.Group();
    rootPivot.add(modelGroup);

    // Soft 3D Ground Shadow Mesh on floor
    const shadowGeo = new THREE.PlaneGeometry(3.6, 1.2);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
      grad.addColorStop(0.5, 'rgba(39, 129, 202, 0.18)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.8;
    scene.add(shadowMesh);

    // Add 3D Extruded Model (instantly from memory cache if available, or fetch once)
    if (cachedTemplateGroup) {
      modelGroup.add(cachedTemplateGroup.clone(true));
      setIsLoaded(true);
    } else {
      getTemplateGroup()
        .then((template) => {
          if (isDisposed) return;
          modelGroup.add(template.clone(true));
          setIsLoaded(true);
        })
        .catch((err) => {
          console.error('Failed to load 3D SVG model:', err);
        });
    }

    // Animation Clock
    const clock = new THREE.Clock();

    const animate = () => {
      if (isDisposed) return;
      animationFrameId = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();

      // Continuous upright 360-degree 3D spin without tilting
      rootPivot.rotation.y = t * 1.55;
      rootPivot.rotation.x = 0;
      rootPivot.rotation.z = 0;

      // Gentle organic breathing scale (scale 0.95 <-> 1.06)
      const breathe = 1.0 + Math.sin(t * 2.2) * 0.055;
      rootPivot.scale.set(breathe, breathe, breathe);

      // Subtle vertical floating hover
      rootPivot.position.y = Math.sin(t * 2.2) * 0.10;

      // Ground shadow tracks breathing scale & floating height
      const shadowScale = 1.0 + Math.sin(t * 2.2) * 0.12;
      shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
      shadowMat.opacity = 0.45 - Math.sin(t * 2.2) * 0.10;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || 240;
      const h = container.clientHeight || 240;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${
        fullScreen
          ? 'fixed inset-0 z-50 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md'
          : 'w-full min-h-[70vh] py-16 flex-1'
      }`}
      aria-label="Loading content"
      role="status"
    >
      {/* Soft Ambient Light Pulse Behind the 3D Model */}
      <div className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-[#2781CA]/20 via-sky-400/15 to-blue-600/10 blur-3xl pointer-events-none animate-pulse" />

      {/* Real-Time WebGL 3D Canvas Mount */}
      <div
        ref={mountRef}
        className={`relative w-64 h-64 flex items-center justify-center transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

export default FocusDeskLoadingScreen;
