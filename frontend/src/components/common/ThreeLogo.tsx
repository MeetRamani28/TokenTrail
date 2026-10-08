import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeLogoProps {
  size?: number;
  className?: string;
  interactive?: boolean;
}

export const ThreeLogo: React.FC<ThreeLogoProps> = ({
  size = 140,
  className = '',
  interactive = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Root group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 2. Base Circular Gunmetal Emblem Badge
    const badgeGroup = new THREE.Group();
    rootGroup.add(badgeGroup);

    // Outer Beveled Cylinder (Medal Body)
    const medalGeo = new THREE.CylinderGeometry(1.65, 1.65, 0.22, 64);
    medalGeo.rotateX(Math.PI / 2);
    const medalMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a, // Slate-900 / dark gunmetal
      metalness: 0.88,
      roughness: 0.22,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });
    const medalMesh = new THREE.Mesh(medalGeo, medalMat);
    badgeGroup.add(medalMesh);

    // Chamfered Inner Rim Ring
    const rimGeo = new THREE.TorusGeometry(1.52, 0.07, 24, 64);
    const rimMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.18,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.z = 0.1;
    badgeGroup.add(rimMesh);

    // Dark Recessed Face
    const faceGeo = new THREE.CircleGeometry(1.44, 64);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x070b14,
      metalness: 0.7,
      roughness: 0.4,
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = 0.11;
    badgeGroup.add(faceMesh);

    // Outer Neon Halo Ring (Cyan-Violet rim glow)
    const haloGeo = new THREE.TorusGeometry(1.68, 0.025, 16, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.z = 0.05;
    badgeGroup.add(haloMesh);

    // 3. Sculptural 3D 'T' Ribbon Logo (Option 4)
    const tGroup = new THREE.Group();
    rootGroup.add(tGroup);

    // --- Top Crossbar of 'T' ---
    const crossbarPoints = [
      new THREE.Vector3(-0.95, 0.68, 0.26),
      new THREE.Vector3(-0.55, 0.74, 0.32),
      new THREE.Vector3(0.0, 0.76, 0.34),
      new THREE.Vector3(0.55, 0.73, 0.32),
      new THREE.Vector3(0.95, 0.68, 0.26),
    ];
    const crossbarCurve = new THREE.CatmullRomCurve3(crossbarPoints);
    const crossbarGeo = new THREE.TubeGeometry(crossbarCurve, 48, 0.13, 16, false);

    // Custom gradient coloring along vertices
    const crossbarMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8, // Sky-cyan
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      metalness: 0.65,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const crossbarMesh = new THREE.Mesh(crossbarGeo, crossbarMat);
    tGroup.add(crossbarMesh);

    // Left Tip Cap (Cyan Glow Accent)
    const leftCapGeo = new THREE.SphereGeometry(0.13, 16, 16);
    const leftCapMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });
    const leftCap = new THREE.Mesh(leftCapGeo, leftCapMat);
    leftCap.position.copy(crossbarPoints[0]);
    tGroup.add(leftCap);

    // Right Tip Flourish (Violet Accent)
    const rightCapGeo = new THREE.SphereGeometry(0.13, 16, 16);
    const rightCapMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
    });
    const rightCap = new THREE.Mesh(rightCapGeo, rightCapMat);
    rightCap.position.copy(crossbarPoints[crossbarPoints.length - 1]);
    tGroup.add(rightCap);

    // --- Vertical Stem & Curving Ribbon Loop of 'T' ---
    const stemPoints = [
      new THREE.Vector3(0.0, 0.76, 0.34),
      new THREE.Vector3(0.04, 0.38, 0.35),
      new THREE.Vector3(-0.04, -0.05, 0.35),
      new THREE.Vector3(-0.16, -0.52, 0.32),
      new THREE.Vector3(0.0, -0.82, 0.28), // Loop bottom
      new THREE.Vector3(0.26, -0.62, 0.24), // Loop return
      new THREE.Vector3(0.24, -0.22, 0.20), // Loop tuck inside
    ];
    const stemCurve = new THREE.CatmullRomCurve3(stemPoints);
    const stemGeo = new THREE.TubeGeometry(stemCurve, 64, 0.13, 16, false);

    const stemMat = new THREE.MeshPhysicalMaterial({
      color: 0xa855f7, // Vibrant violet
      emissive: 0x7c3aed,
      emissiveIntensity: 0.35,
      metalness: 0.65,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    tGroup.add(stemMesh);

    // 4. Subtle Floating Token Particles around emblem
    const particleCount = 20;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 1.9 + Math.sin(i * 3) * 0.15;
      particlePos[i * 3] = Math.cos(angle) * radius;
      particlePos[i * 3 + 1] = Math.sin(angle) * radius;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.05,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particles);

    // 5. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    // Electric Cyan Key Light (Top-Left)
    const cyanLight = new THREE.PointLight(0x06b6d4, 4.0, 10);
    cyanLight.position.set(-2.5, 3.0, 3.5);
    scene.add(cyanLight);

    // Neon Violet Fill Light (Bottom-Right)
    const violetLight = new THREE.PointLight(0xa855f7, 3.5, 10);
    violetLight.position.set(2.5, -2.5, 3.0);
    scene.add(violetLight);

    // Rim/Backlight for metallic silhouette
    const backRimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    backRimLight.position.set(0, 4, -3);
    scene.add(backRimLight);

    // 6. Interactive Mouse Parallax & Animation
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotY = x * 0.85;
      targetRotX = -y * 0.85;
    };

    const handleMouseLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };

    if (interactive) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    // 7. Render Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Gentle floating / breathing idle motion
      const idleTiltY = Math.sin(elapsed * 1.2) * 0.08;
      const idleTiltX = Math.cos(elapsed * 0.9) * 0.05;

      // Smooth damping toward mouse target
      currentRotX += (targetRotX + idleTiltX - currentRotX) * 0.08;
      currentRotY += (targetRotY + idleTiltY - currentRotY) * 0.08;

      rootGroup.rotation.x = currentRotX;
      rootGroup.rotation.y = currentRotY;

      // Subtle particle rotation
      particles.rotation.z = elapsed * 0.08;

      // Subtle glow pulse on halo
      haloMat.opacity = 0.65 + Math.sin(elapsed * 2.5) * 0.2;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      if (interactive) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      medalGeo.dispose();
      medalMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      faceGeo.dispose();
      faceMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      crossbarGeo.dispose();
      crossbarMat.dispose();
      stemGeo.dispose();
      stemMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [size, interactive]);

  return (
    <div
      ref={mountRef}
      className={`inline-flex items-center justify-center cursor-pointer select-none transition-transform hover:scale-105 ${className}`}
      style={{ width: size, height: size }}
      title="TokenTrail 3D Ribbon Emblem"
    />
  );
};
