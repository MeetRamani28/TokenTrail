import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function TokenParticles() {
  const pointsRef = useRef<THREE.Points>(null!);
  const count = 120;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const color1 = new THREE.Color('#10b981'); // Emerald
    const color2 = new THREE.Color('#06b6d4'); // Cyan
    const color3 = new THREE.Color('#6366f1'); // Indigo

    for (let i = 0; i < count; i++) {
      // Spiral trail along z and x axes
      const theta = (i / count) * Math.PI * 6;
      const radius = 2.5 + Math.sin(i * 0.2) * 1.0;
      pos[i * 3] = Math.cos(theta) * radius + (Math.random() - 0.5) * 0.8;
      pos[i * 3 + 1] = ((i / count) - 0.5) * 8 + (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 2] = Math.sin(theta) * radius + (Math.random() - 0.5) * 0.8;

      const mixed = color1.clone().lerp(color2, i / count).lerp(color3, (i % 10) / 10);
      col[i * 3] = mixed.r;
      col[i * 3 + 1] = mixed.g;
      col[i * 3 + 2] = mixed.b;
    }
    return [pos, col];
  }, [count]);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.15;
      pointsRef.current.rotation.x += delta * 0.05;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export const TokenTrailCanvas: React.FC = () => {
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Check user preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);

    // Pause when tab is hidden
    const visHandler = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', visHandler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, []);

  if (isReducedMotion || !isVisible) {
    return (
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-cyan-950/20 to-transparent pointer-events-none" />
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none opacity-60">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 60 }}
        gl={{ antialias: false, powerPreference: 'low-power' }}
      >
        <TokenParticles />
      </Canvas>
    </div>
  );
};
