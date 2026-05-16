"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type DisposableObject = THREE.Object3D & {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
};

function roundedRectShape(width: number, height: number, radius: number) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  return shape;
}

function createTelegramPlaneGeometry() {
  const shape = new THREE.Shape();

  shape.moveTo(-0.74, -0.16);
  shape.lineTo(0.72, 0.58);
  shape.lineTo(0.24, -0.62);
  shape.lineTo(-0.1, -0.28);
  shape.lineTo(-0.37, -0.57);
  shape.lineTo(-0.28, -0.04);
  shape.lineTo(-0.74, -0.16);

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: 0.035,
    bevelThickness: 0.025,
  });
}

function createSpeechBubbleGeometry() {
  const shape = roundedRectShape(1.8, 0.9, 0.22);

  shape.moveTo(-0.58, -0.45);
  shape.lineTo(-0.34, -0.78);
  shape.lineTo(-0.08, -0.45);

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 8,
    bevelSize: 0.05,
    bevelThickness: 0.035,
  });
}

function makeMenuTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 720;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#070809";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 0, 512, 720);
  gradient.addColorStop(0, "rgba(255,255,255,0.11)");
  gradient.addColorStop(0.44, "rgba(233,196,106,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0.02)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(233,196,106,0.88)";
  context.lineWidth = 4;
  context.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  context.fillStyle = "#F1D49A";
  context.font = "48px Arial";
  context.letterSpacing = "8px";
  context.textAlign = "center";
  context.fillText("MENU", canvas.width / 2, 160);

  context.strokeStyle = "#E9C46A";
  context.lineWidth = 7;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(218, 230);
  context.lineTo(218, 340);
  context.moveTo(196, 230);
  context.lineTo(196, 294);
  context.moveTo(240, 230);
  context.lineTo(240, 294);
  context.moveTo(292, 230);
  context.quadraticCurveTo(330, 276, 292, 340);
  context.stroke();

  context.lineWidth = 5;
  [438, 498, 558].forEach((y, index) => {
    context.beginPath();
    context.moveTo(112, y);
    context.lineTo(index === 1 ? 372 : 400, y);
    context.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  return texture;
}

export function RestaurantThreeBackground() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, root.clientWidth / Math.max(root.clientHeight, 1), 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.36;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.width = "100%";
    root.appendChild(renderer.domElement);

    camera.position.set(0, 0.08, 9.2);

    const heroGroup = new THREE.Group();
    scene.add(heroGroup);

    const blackMetal = new THREE.MeshPhysicalMaterial({
      color: "#121315",
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.9,
      clearcoatRoughness: 0.13,
    });
    const softBlackMetal = new THREE.MeshPhysicalMaterial({
      color: "#17191D",
      metalness: 0.82,
      roughness: 0.24,
      clearcoat: 0.76,
      clearcoatRoughness: 0.18,
    });
    const goldMetal = new THREE.MeshPhysicalMaterial({
      color: "#F0C980",
      emissive: "#7A4208",
      emissiveIntensity: 0.34,
      metalness: 0.96,
      roughness: 0.18,
      clearcoat: 0.55,
      clearcoatRoughness: 0.13,
    });
    const dimGold = new THREE.MeshBasicMaterial({
      color: "#F0B85B",
      transparent: true,
      opacity: 0.84,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const coinGroup = new THREE.Group();
    coinGroup.position.set(-4.72, -1.6, 0.92);
    coinGroup.rotation.set(-0.12, 0.32, -0.08);
    coinGroup.scale.setScalar(1.08);
    heroGroup.add(coinGroup);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.66, 1.82, 0.42, 96), blackMetal);
    pedestal.position.set(0, -1.58, -0.18);
    coinGroup.add(pedestal);

    const pedestalRim = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.035, 10, 128), goldMetal);
    pedestalRim.position.set(0, -1.35, -0.18);
    pedestalRim.rotation.x = Math.PI / 2;
    coinGroup.add(pedestalRim);

    const fallbackBadge = new THREE.Group();
    coinGroup.add(fallbackBadge);

    const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.22, 128), blackMetal);
    coin.rotation.x = Math.PI / 2;
    coin.position.y = -0.22;
    fallbackBadge.add(coin);

    const coinRim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.04, 12, 128), goldMetal);
    coinRim.position.set(0, -0.22, 0.13);
    fallbackBadge.add(coinRim);

    const telegramPlane = new THREE.Mesh(createTelegramPlaneGeometry(), goldMetal);
    telegramPlane.position.set(0, -0.24, 0.19);
    telegramPlane.rotation.z = -0.16;
    telegramPlane.scale.setScalar(0.72);
    fallbackBadge.add(telegramPlane);

    const blenderBadge = new THREE.Group();
    blenderBadge.position.set(0, -0.22, 0.14);
    coinGroup.add(blenderBadge);

    let badgeLoaded = false;
    const loader = new GLTFLoader();
    loader.load(
      "/models/telegram_badge_only_clean.glb",
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();

        box.getSize(size);
        box.getCenter(center);
        model.position.sub(center);

        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        model.scale.setScalar(2.42 / maxDimension);
        model.rotation.set(0, 0, 0);

        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) {
            return;
          }

          object.frustumCulled = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ("envMapIntensity" in material) {
              material.envMapIntensity = 1.8;
            }
            material.needsUpdate = true;
          });
        });

        blenderBadge.add(model);
        fallbackBadge.visible = false;
        badgeLoaded = true;
      },
      undefined,
      () => {
        fallbackBadge.visible = true;
      },
    );

    const chatBubble = new THREE.Group();
    chatBubble.position.set(-3.58, 1.72, 0.7);
    chatBubble.rotation.set(0.2, -0.38, 0.02);
    chatBubble.scale.setScalar(0.96);
    heroGroup.add(chatBubble);

    const bubbleBody = new THREE.Mesh(createSpeechBubbleGeometry(), softBlackMetal);
    chatBubble.add(bubbleBody);
    [-0.36, 0, 0.36].forEach((x) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 24), goldMetal);
      dot.position.set(x, 0.03, 0.18);
      chatBubble.add(dot);
    });

    const menuTexture = makeMenuTexture();
    const menuCard = new THREE.Group();
    menuCard.position.set(4.38, -1.46, 0.78);
    menuCard.rotation.set(-0.06, -0.42, 0.12);
    menuCard.scale.setScalar(1);
    heroGroup.add(menuCard);

    const cardMaterial = new THREE.MeshPhysicalMaterial({
      color: "#090A0B",
      metalness: 0.74,
      roughness: 0.34,
      clearcoat: 0.5,
      map: menuTexture || undefined,
    });
    const card = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.76, 0.065, 8, 8, 1), cardMaterial);
    menuCard.add(card);

    const clocheGroup = new THREE.Group();
    clocheGroup.position.set(4.5, 0.62, 0.82);
    clocheGroup.rotation.set(-0.15, -0.42, 0.08);
    clocheGroup.scale.setScalar(0.98);
    heroGroup.add(clocheGroup);

    const cloche = new THREE.Mesh(new THREE.SphereGeometry(0.72, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), blackMetal);
    cloche.scale.y = 0.78;
    clocheGroup.add(cloche);

    const clocheRim = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.045, 12, 128), goldMetal);
    clocheRim.rotation.x = Math.PI / 2;
    clocheRim.position.y = 0.02;
    clocheGroup.add(clocheRim);

    const clocheKnob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 32), goldMetal);
    clocheKnob.position.y = 0.72;
    clocheGroup.add(clocheKnob);

    const chefGroup = new THREE.Group();
    chefGroup.position.set(4.42, 2.08, 0.58);
    chefGroup.rotation.set(0.1, -0.38, 0.16);
    chefGroup.scale.setScalar(0.95);
    heroGroup.add(chefGroup);

    const chefBand = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.36, 48), blackMetal);
    chefBand.rotation.x = Math.PI / 2;
    chefGroup.add(chefBand);

    const chefRim = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.035, 10, 96), goldMetal);
    chefRim.position.z = 0.18;
    chefGroup.add(chefRim);

    [
      [-0.34, 0.2, 0.02, 0.35],
      [0, 0.36, 0, 0.45],
      [0.34, 0.2, 0.02, 0.34],
      [0.06, 0.08, 0.2, 0.32],
    ].forEach(([x, y, z, radius]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 36), blackMetal);
      puff.position.set(x, y, z);
      chefGroup.add(puff);
    });

    const particleGroup = new THREE.Group();
    particleGroup.position.z = -0.42;
    heroGroup.add(particleGroup);

    const points: THREE.Vector3[] = [];
    for (let index = 0; index < 48; index += 1) {
      const x = ((index * 37) % 100) / 100;
      const y = ((index * 61) % 100) / 100;
      const z = ((index * 29) % 100) / 100;
      const side = index % 2 === 0 ? -1 : 1;
      points.push(new THREE.Vector3(side * (2.85 + x * 2.45), (y - 0.5) * 5.2, -1.2 - z * 1.1));
    }

    const pointPositions = new Float32Array(points.length * 3);
    points.forEach((point, index) => {
      pointPositions[index * 3] = point.x;
      pointPositions[index * 3 + 1] = point.y;
      pointPositions[index * 3 + 2] = point.z;
    });

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));
    const pointMaterial = new THREE.PointsMaterial({
      color: "#E9C46A",
      size: 0.042,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pointCloud = new THREE.Points(pointGeometry, pointMaterial);
    particleGroup.add(pointCloud);

    const linePositions: number[] = [];
    points.forEach((point, index) => {
      for (let next = index + 1; next < points.length; next += 1) {
        const target = points[next];
        if (Math.sign(point.x) === Math.sign(target.x) && point.distanceTo(target) < 1.55) {
          linePositions.push(point.x, point.y, point.z, target.x, target.y, target.z);
        }
      }
    });

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(lineGeometry, dimGold);
    particleGroup.add(lines);

    const marbleSpheres = [
      [-4.9, 1.36, -0.95, 0.18],
      [-2.2, -1.92, -0.82, 0.12],
      [1.65, 2.18, -1.1, 0.1],
      [4.74, 1.48, -0.92, 0.13],
      [2.15, -2.03, -0.86, 0.16],
    ];
    marbleSpheres.forEach(([x, y, z, radius], index) => {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 36), index % 2 === 0 ? goldMetal : blackMetal);
      sphere.position.set(x, y, z);
      particleGroup.add(sphere);
    });

    const ambient = new THREE.AmbientLight("#A7B6BD", 1.15);
    scene.add(ambient);

    const key = new THREE.DirectionalLight("#F7D69B", 7.6);
    key.position.set(-3.8, 4.8, 6.2);
    scene.add(key);

    const rim = new THREE.DirectionalLight("#D7E8FF", 3.2);
    rim.position.set(4.5, 3.4, 5.2);
    scene.add(rim);

    const teal = new THREE.PointLight("#36D6B7", 28, 10);
    teal.position.set(2.3, -1.4, 3.4);
    scene.add(teal);

    const warm = new THREE.PointLight("#E9C46A", 54, 9);
    warm.position.set(-4.2, -0.9, 3.6);
    scene.add(warm);

    const violet = new THREE.PointLight("#7869FF", 28, 8);
    violet.position.set(1.6, 2.9, 3.2);
    scene.add(violet);

    const setSceneScale = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      const isSmall = width < 780;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      heroGroup.scale.setScalar(isSmall ? 0.76 : width < 1120 ? 0.88 : 0.96);
      heroGroup.position.set(isSmall ? 0.1 : 0, isSmall ? -0.1 : 0.04, isSmall ? -0.2 : 0);
    };

    let frameId = 0;
    const render = (time = 0) => {
      const seconds = time * 0.001;

      if (!prefersReducedMotion) {
        coinGroup.rotation.y = 0.32 + Math.sin(seconds * 0.34) * 0.08;
        coinGroup.position.y = -1.6 + Math.sin(seconds * 0.52) * 0.035;
        blenderBadge.rotation.y = Math.sin(seconds * 0.28) * (badgeLoaded ? 0.08 : 0);
        chatBubble.position.y = 1.84 + Math.sin(seconds * 0.62) * 0.06;
        menuCard.rotation.z = 0.12 + Math.sin(seconds * 0.4) * 0.035;
        clocheGroup.rotation.y = -0.42 + Math.sin(seconds * 0.28) * 0.08;
        chefGroup.position.y = 2.2 + Math.sin(seconds * 0.45) * 0.05;
        particleGroup.rotation.z = Math.sin(seconds * 0.12) * 0.04;
        pointMaterial.opacity = 0.58 + Math.sin(seconds * 0.9) * 0.12;
      }

      renderer.render(scene, camera);

      if (!prefersReducedMotion) {
        frameId = window.requestAnimationFrame(render);
      }
    };

    setSceneScale();
    render();

    window.addEventListener("resize", setSceneScale);

    return () => {
      window.removeEventListener("resize", setSceneScale);
      window.cancelAnimationFrame(frameId);

      scene.traverse((object) => {
        const disposable = object as DisposableObject;
        disposable.geometry?.dispose();
        if (Array.isArray(disposable.material)) {
          disposable.material.forEach((material) => material.dispose());
        } else {
          disposable.material?.dispose();
        }
      });

      menuTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={rootRef} className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true" />;
}
