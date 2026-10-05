import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeLogoProps {
  size?: number;
  className?: string;
}

export const ThreeLogo: React.FC<ThreeLogoProps> = ({ size = 36, className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 4.2;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    currentMount.innerHTML = '';
    currentMount.appendChild(renderer.domElement);

    // Group
    const group = new THREE.Group();
    scene.add(group);

    // Inner Core: Futuristic Icosahedron
    const coreGeometry = new THREE.IcosahedronGeometry(1.05, 0);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(coreMesh);

    // Outer Wireframe Halo: Cyan glowing telemetry lattice
    const wireframeGeometry = new THREE.IcosahedronGeometry(1.28, 1);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    group.add(wireframeMesh);

    // Orbiting Token Particle Ring
    const particleCount = 18;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 1.6 + Math.sin(i * 2) * 0.1;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x34d399,
      size: 0.08,
      transparent: true,
      opacity: 0.9,
    });
    const particleRing = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particleRing);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const emeraldLight = new THREE.PointLight(0x10b981, 3.5, 10);
    emeraldLight.position.set(2, 3, 2);
    scene.add(emeraldLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 3.0, 10);
    cyanLight.position.set(-2, -2, -2);
    scene.add(cyanLight);

    // Interactive Hover speedup
    let hoverSpeed = 1;
    const handleMouseEnter = () => {
      hoverSpeed = 2.5;
    };
    const handleMouseLeave = () => {
      hoverSpeed = 1;
    };

    currentMount.addEventListener('mouseenter', handleMouseEnter);
    currentMount.addEventListener('mouseleave', handleMouseLeave);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Smooth multi-axis rotation
      group.rotation.y += 0.9 * delta * hoverSpeed;
      group.rotation.x += 0.4 * delta * hoverSpeed;
      wireframeMesh.rotation.y -= 0.5 * delta * hoverSpeed;
      particleRing.rotation.z += 0.8 * delta * hoverSpeed;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      currentMount.removeEventListener('mouseenter', handleMouseEnter);
      currentMount.removeEventListener('mouseleave', handleMouseLeave);
      if (currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      wireframeGeometry.dispose();
      wireframeMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center shrink-0 cursor-pointer ${className}`}
      title="TokenTrail 3D Engine"
    />
  );
};
