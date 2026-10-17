import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Navigation,
  Radio,
} from 'lucide-react';
import {
  AbyssalNode,
  InfrastructureCounts,
  ScoutDrone,
  SubmersibleTelemetry,
  Waypoint,
} from '../game/types';
import {
  depthMetersToWorldY,
  findNearestNode,
  getTerrainElevationWorld,
  worldYToDepthMeters,
} from '../game/rules';

interface AbyssalViewport3DProps {
  telemetry: SubmersibleTelemetry;
  onUpdateTelemetry: (updater: (prev: SubmersibleTelemetry) => SubmersibleTelemetry) => void;
  nodes: AbyssalNode[];
  scoutDrones: ScoutDrone[];
  infrastructure: InfrastructureCounts;
  waypoint: Waypoint;
  sonarRadius: number;
  sonarPulseTrigger: number;
  onPingSonar: () => void;
  onDeployCollectorClaw: (node: AbyssalNode) => void;
  onSetThrusting: (thrusting: boolean) => void;
}

export const AbyssalViewport3D: React.FC<AbyssalViewport3DProps> = ({
  telemetry,
  onUpdateTelemetry,
  nodes,
  scoutDrones,
  infrastructure,
  waypoint,
  sonarRadius,
  sonarPulseTrigger,
  onPingSonar,
  onDeployCollectorClaw,
  onSetThrusting,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [clawAnimActive, setClawAnimActive] = useState(false);

  // Store latest props in refs so the 60fps WebGL loop never tears down on React state changes
  const stateRef = useRef({
    telemetry,
    nodes,
    scoutDrones,
    infrastructure,
    waypoint,
    sonarRadius,
    onUpdateTelemetry,
    onPingSonar,
    onDeployCollectorClaw,
    onSetThrusting,
  });

  useEffect(() => {
    stateRef.current = {
      telemetry,
      nodes,
      scoutDrones,
      infrastructure,
      waypoint,
      sonarRadius,
      onUpdateTelemetry,
      onPingSonar,
      onDeployCollectorClaw,
      onSetThrusting,
    };
  }, [
    telemetry,
    nodes,
    scoutDrones,
    infrastructure,
    waypoint,
    sonarRadius,
    onUpdateTelemetry,
    onPingSonar,
    onDeployCollectorClaw,
    onSetThrusting,
  ]);

  // Mutable simulation physics state inside Three.js
  const simRef = useRef({
    x: telemetry.x,
    y: depthMetersToWorldY(telemetry.depthMeters),
    z: telemetry.z,
    heading: telemetry.headingRad,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yawRate: 0,
    sonarRingActive: false,
    sonarRingProgress: 0,
    sonarOriginX: 0,
    sonarOriginY: 0,
    sonarOriginZ: 0,
    clawTimer: 0,
    keys: new Set<string>(),
    buttonThrust: {
      forward: false,
      reverse: false,
      left: false,
      right: false,
      ascend: false,
      descend: false,
    },
  });

  // Trigger 3D sonar torus wave whenever sonarPulseTrigger increments
  useEffect(() => {
    if (sonarPulseTrigger > 0) {
      const s = simRef.current;
      s.sonarRingActive = true;
      s.sonarRingProgress = 0;
      s.sonarOriginX = s.x;
      s.sonarOriginY = s.y - 2;
      s.sonarOriginZ = s.z;
    }
  }, [sonarPulseTrigger]);

  // Keep sim position synced if emergency ascend or external teleport occurs
  useEffect(() => {
    const targetY = depthMetersToWorldY(telemetry.depthMeters);
    if (Math.abs(targetY - simRef.current.y) > 2.2) {
      simRef.current.y = targetY;
    }
  }, [telemetry.depthMeters]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070b);
    scene.fog = new THREE.FogExp2(0x05070b, 0.0085);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.5, 420);
    camera.position.set(0, 8, 22);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isHeadless,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio environment reflection for metallic pressure hull & glass dome
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Lighting rig: warm key light + cool abyssal hemisphere fill
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x05070b, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffefc2, 1.35);
    dirLight.position.set(40, 90, 35);
    scene.add(dirLight);

    // -------------------------------------------------------------------------
    // 1. PROCEDURAL BATHYMETRIC WIREFRAME SEAFLOOR (Nostromo / Rutt-Etra style)
    // -------------------------------------------------------------------------
    const terrainSize = 240;
    const segments = isHeadless ? 48 : 76;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const colorHelper = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getTerrainElevationWorld(vx, vz);
      posAttr.setY(i, vy);

      // Depth-based vertex coloring for the dark abyssal base mesh
      const normalizedH = THREE.MathUtils.clamp((vy + 30) / 30, 0, 1);
      colorHelper.setHSL(0.56, 0.65, 0.04 + normalizedH * 0.12);
      colors[i * 3] = colorHelper.r;
      colors[i * 3 + 1] = colorHelper.g;
      colors[i * 3 + 2] = colorHelper.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const baseTerrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.15,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const baseTerrainMesh = new THREE.Mesh(terrainGeo, baseTerrainMat);
    scene.add(baseTerrainMesh);

    const wireTerrainMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
    });
    const wireTerrainMesh = new THREE.Mesh(terrainGeo, wireTerrainMat);
    wireTerrainMesh.position.y = 0.04;
    scene.add(wireTerrainMesh);

    // -------------------------------------------------------------------------
    // 2. COMPOSITE 10-PART HAZARD-YELLOW SUBMERSIBLE (DSV-AUTARX-01)
    // -------------------------------------------------------------------------
    const subGroup = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.32,
      metalness: 0.65,
    });
    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1e2638,
      roughness: 0.6,
      metalness: 0.8,
    });
    const cyanGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });
    const glassDomeMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transmission: 0.85,
      opacity: 1,
      transparent: true,
      roughness: 0.1,
      metalness: 0.1,
      ior: 1.5,
      depthWrite: false,
    });

    // Part 1: Main Cylindrical Pressure Hull
    const mainHullGeo = new THREE.CapsuleGeometry(1.15, 2.6, 8, 16);
    mainHullGeo.rotateZ(Math.PI / 2);
    mainHullGeo.rotateY(Math.PI / 2);
    const mainHull = new THREE.Mesh(mainHullGeo, hullMat);
    subGroup.add(mainHull);

    // Part 2: Forward Acrylic Viewport Dome
    const domeGeo = new THREE.SphereGeometry(0.95, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    domeGeo.rotateX(-Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeo, glassDomeMat);
    domeMesh.position.set(0, 0.05, -1.65);
    domeMesh.renderOrder = 2;
    subGroup.add(domeMesh);

    // Part 3: Dorsal Conning Sail & Sensor Mast
    const sailGeo = new THREE.BoxGeometry(0.7, 0.9, 1.3);
    const sailMesh = new THREE.Mesh(sailGeo, hullMat);
    sailMesh.position.set(0, 1.15, -0.1);
    subGroup.add(sailMesh);

    // Part 4 & 5: Port and Starboard Ballast Skids
    const skidGeo = new THREE.BoxGeometry(0.42, 0.38, 3.4);
    const portSkid = new THREE.Mesh(skidGeo, darkTrimMat);
    portSkid.position.set(-1.1, -0.85, 0);
    const stbdSkid = new THREE.Mesh(skidGeo, darkTrimMat);
    stbdSkid.position.set(1.1, -0.85, 0);
    subGroup.add(portSkid, stbdSkid);

    // Part 6 & 7: Twin Rear Vector Thruster Shrouds + Cyan Impellers
    const thrusterGeo = new THREE.CylinderGeometry(0.42, 0.5, 0.8, 12);
    thrusterGeo.rotateX(Math.PI / 2);
    const portThruster = new THREE.Mesh(thrusterGeo, darkTrimMat);
    portThruster.position.set(-0.75, 0, 2.15);
    const stbdThruster = new THREE.Mesh(thrusterGeo, darkTrimMat);
    stbdThruster.position.set(0.75, 0, 2.15);

    const nozzleGlowGeo = new THREE.CircleGeometry(0.34, 12);
    const portGlow = new THREE.Mesh(nozzleGlowGeo, cyanGlowMat);
    portGlow.position.set(-0.75, 0, 2.57);
    const stbdGlow = new THREE.Mesh(nozzleGlowGeo, cyanGlowMat);
    stbdGlow.position.set(0.75, 0, 2.57);
    subGroup.add(portThruster, stbdThruster, portGlow, stbdGlow);

    // Part 8 & 9: Dual Articulated Collector Claws
    const clawGroup = new THREE.Group();
    const armGeo = new THREE.BoxGeometry(0.18, 0.18, 1.4);
    const leftArm = new THREE.Mesh(armGeo, darkTrimMat);
    leftArm.position.set(-0.7, -0.5, -2.1);
    const rightArm = new THREE.Mesh(armGeo, darkTrimMat);
    rightArm.position.set(0.7, -0.5, -2.1);
    const pincerGeo = new THREE.TorusGeometry(0.26, 0.06, 6, 12, Math.PI * 1.3);
    pincerGeo.rotateX(Math.PI / 2);
    const leftPincer = new THREE.Mesh(pincerGeo, hullMat);
    leftPincer.position.set(-0.7, -0.5, -2.85);
    const rightPincer = new THREE.Mesh(pincerGeo, hullMat);
    rightPincer.position.set(0.7, -0.5, -2.85);
    clawGroup.add(leftArm, rightArm, leftPincer, rightPincer);
    subGroup.add(clawGroup);

    // Part 10: Dual-Cone Volumetric Spotlight Beams + Real SpotLight
    const spotlightGroup = new THREE.Group();
    const coneGeo = new THREE.ConeGeometry(3.2, 16, 16, 1, true);
    coneGeo.translate(0, -8, 0);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const leftCone = new THREE.Mesh(coneGeo, coneMat);
    leftCone.position.set(-0.6, -0.1, -1.9);
    const rightCone = new THREE.Mesh(coneGeo, coneMat);
    rightCone.position.set(0.6, -0.1, -1.9);
    spotlightGroup.add(leftCone, rightCone);

    const bowSpotLight = new THREE.SpotLight(0xfffaed, 18, 55, Math.PI / 4, 0.45, 1.2);
    bowSpotLight.position.set(0, 0.2, -1.8);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, -4, -22);
    subGroup.add(spotTarget);
    bowSpotLight.target = spotTarget;
    spotlightGroup.add(bowSpotLight);
    subGroup.add(spotlightGroup);

    scene.add(subGroup);

    // Seafloor Depth Projection Ring directly below DSV-AUTARX-01
    const groundRingGeo = new THREE.RingGeometry(1.4, 1.85, 24);
    groundRingGeo.rotateX(-Math.PI / 2);
    const groundRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const groundRingMesh = new THREE.Mesh(groundRingGeo, groundRingMat);
    scene.add(groundRingMesh);

    // Pooled Zero-GC Thruster Particle Trail
    const trailCount = 36;
    const trailPositions = new Float32Array(trailCount * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.45,
      transparent: true,
      opacity: 0.75,
    });
    const trailPoints = new THREE.Points(trailGeo, trailMat);
    scene.add(trailPoints);
    let trailCursor = 0;

    // -------------------------------------------------------------------------
    // 3. ACTIVE SONAR PULSE TORUS WAVE
    // -------------------------------------------------------------------------
    const sonarRingGeo = new THREE.RingGeometry(0.85, 1.0, 48);
    sonarRingGeo.rotateX(-Math.PI / 2);
    const sonarRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const sonarRingMesh = new THREE.Mesh(sonarRingGeo, sonarRingMat);
    sonarRingMesh.visible = false;
    scene.add(sonarRingMesh);

    // -------------------------------------------------------------------------
    // 4. HYDROTHERMAL VENTS (#F43F5E) & POLYMETALLIC NODULES (#FFD700)
    // -------------------------------------------------------------------------
    const nodeMeshes = new Map<string, THREE.Group>();
    const ventMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.65,
      roughness: 0.4,
    });
    const noduleMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.8,
    });
    const beaconRingGeo = new THREE.RingGeometry(2.6, 3.1, 24);
    beaconRingGeo.rotateX(-Math.PI / 2);

    stateRef.current.nodes.forEach((n) => {
      const g = new THREE.Group();
      const groundY = getTerrainElevationWorld(n.x, n.z);
      g.position.set(n.x, groundY, n.z);

      if (n.type === 'VENT') {
        // Multi-spire hydrothermal chimney cluster
        const mainSpire = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6.5, 8), ventMat);
        mainSpire.position.y = 3.25;
        const sideSpire = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.2, 7), ventMat);
        sideSpire.position.set(1.2, 2.1, 0.6);
        g.add(mainSpire, sideSpire);
      } else {
        // Crystalline polymetallic nodule cluster
        for (let k = 0; k < 5; k++) {
          const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), noduleMat);
          const angle = (k / 5) * Math.PI * 2;
          crystal.position.set(Math.cos(angle) * 1.4, 0.8 + (k % 2) * 0.4, Math.sin(angle) * 1.4);
          g.add(crystal);
        }
      }

      const ringMat = new THREE.MeshBasicMaterial({
        color: n.type === 'VENT' ? 0xf43f5e : 0xffd700,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: n.discovered ? 0.85 : 0.18,
      });
      const markerRing = new THREE.Mesh(beaconRingGeo, ringMat);
      markerRing.position.y = 0.25;
      markerRing.name = 'markerRing';
      g.add(markerRing);

      scene.add(g);
      nodeMeshes.set(n.id, g);
    });

    // -------------------------------------------------------------------------
    // 5. SURFACE LAYER (0m / Y=+28): SOLAR BARGES & BATTERY RELAY DRONES
    // -------------------------------------------------------------------------
    const surfaceY = 28;
    const surfaceGrid = new THREE.GridHelper(220, 22, 0x38bdf8, 0x1e2638);
    surfaceGrid.position.y = surfaceY;
    scene.add(surfaceGrid);

    const bargeGroup = new THREE.Group();
    const maxBarges = 10;
    const bargeMeshes: THREE.Group[] = [];
    const relayMeshes: THREE.Mesh[] = [];
    const tetherLines: THREE.Line[] = [];

    const bargeWireMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      wireframe: true,
    });
    const relayMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
    });
    const tetherMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.3,
    });

    for (let i = 0; i < maxBarges; i++) {
      const b = new THREE.Group();
      const bx = (i - 4.5) * 18;
      const bz = (i % 2 === 0 ? -1 : 1) * 20;
      b.position.set(bx, surfaceY, bz);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 4.5), bargeWireMat);
      b.add(deck);
      bargeGroup.add(b);
      bargeMeshes.push(b);

      // Vertical tether line & relay drone
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(bx, surfaceY, bz),
        new THREE.Vector3(bx, -15, bz),
      ]);
      const line = new THREE.Line(lineGeo, tetherMat);
      scene.add(line);
      tetherLines.push(line);

      const droneMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), relayMat);
      droneMesh.position.set(bx, surfaceY - 5, bz);
      scene.add(droneMesh);
      relayMeshes.push(droneMesh);
    }
    scene.add(bargeGroup);

    // -------------------------------------------------------------------------
    // 6. WAYPOINT BEACON (WP-ALPHA) IN 3D SPACE
    // -------------------------------------------------------------------------
    const wpGroup = new THREE.Group();
    const wpBeamGeo = new THREE.CylinderGeometry(0.35, 0.35, 45, 12, 1, true);
    const wpBeamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const wpBeam = new THREE.Mesh(wpBeamGeo, wpBeamMat);
    wpBeam.position.y = 22.5;
    wpGroup.add(wpBeam);
    scene.add(wpGroup);

    // Pre-warm shaders
    renderer.compile(scene, camera);

    // -------------------------------------------------------------------------
    // KEYBOARD INPUT LISTENERS (WASD / Arrows / Q / E / Space)
    // -------------------------------------------------------------------------
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const code = e.code;
      if (code === 'Space') {
        e.preventDefault();
        stateRef.current.onPingSonar();
        return;
      }
      simRef.current.keys.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      simRef.current.keys.delete(e.code);
    };

    const handleBlur = () => {
      simRef.current.keys.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    // Responsive ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0 && cr.height > 0) {
          camera.aspect = cr.width / cr.height;
          camera.updateProjectionMatrix();
          renderer.setSize(cr.width, cr.height);
        }
      }
    });
    resizeObserver.observe(container);

    // -------------------------------------------------------------------------
    // ANIMATION & KINEMATICS LOOP
    // -------------------------------------------------------------------------
    const clock = new THREE.Clock();
    let animFrameId = 0;
    let lastReactSync = 0;
    let lastRenderTime = 0;
    const scratchCamTarget = new THREE.Vector3();
    const scratchCamPos = new THREE.Vector3();

    const animate = (nowMs: number) => {
      animFrameId = requestAnimationFrame(animate);

      // In headless Chromium, throttle software WebGL rendering to ~15fps so snapshots/screenshots never stall
      if (isHeadless && nowMs - lastRenderTime < 65) {
        return;
      }
      lastRenderTime = nowMs;

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();

      const s = simRef.current;
      const currentProps = stateRef.current;

      // Determine active pilot commands
      const forward =
        s.keys.has('KeyW') || s.keys.has('ArrowUp') || s.buttonThrust.forward;
      const reverse =
        s.keys.has('KeyS') || s.keys.has('ArrowDown') || s.buttonThrust.reverse;
      const turnLeft =
        s.keys.has('KeyA') || s.keys.has('ArrowLeft') || s.buttonThrust.left;
      const turnRight =
        s.keys.has('KeyD') || s.keys.has('ArrowRight') || s.buttonThrust.right;
      const ascend =
        s.keys.has('KeyQ') || s.keys.has('ShiftLeft') || s.buttonThrust.ascend;
      const descend =
        s.keys.has('KeyE') || s.keys.has('ControlLeft') || s.buttonThrust.descend;

      let thrustInput = (forward ? 1 : 0) - (reverse ? 1 : 0);
      let yawInput = (turnLeft ? 1 : 0) - (turnRight ? 1 : 0);
      const verticalInput = (ascend ? 1 : 0) - (descend ? 1 : 0);

      // Autopilot toward WP-ALPHA if enabled and no manual override
      if (
        currentProps.telemetry.autopilotEnabled &&
        currentProps.waypoint.active &&
        thrustInput === 0 &&
        yawInput === 0
      ) {
        const dx = currentProps.waypoint.x - s.x;
        const dz = currentProps.waypoint.z - s.z;
        const distToWp = Math.hypot(dx, dz);
        if (distToWp > 2.5) {
          const desiredHeading = Math.atan2(-dx, -dz);
          let diff = desiredHeading - s.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          yawInput = THREE.MathUtils.clamp(diff * 1.8, -1, 1);
          thrustInput = 0.85;
        }
      }

      // Smooth yaw & velocity damping
      s.yawRate = THREE.MathUtils.damp(s.yawRate, yawInput * 1.55, 6, dt);
      s.heading += s.yawRate * dt;

      const forwardDirX = -Math.sin(s.heading);
      const forwardDirZ = -Math.cos(s.heading);
      const targetSpeed = thrustInput * 16.0;

      s.vx = THREE.MathUtils.damp(s.vx, forwardDirX * targetSpeed, 4.5, dt);
      s.vz = THREE.MathUtils.damp(s.vz, forwardDirZ * targetSpeed, 4.5, dt);
      s.vy = THREE.MathUtils.damp(s.vy, verticalInput * 7.5, 5.0, dt);

      s.x = THREE.MathUtils.clamp(s.x + s.vx * dt, -105, 105);
      s.z = THREE.MathUtils.clamp(s.z + s.vz * dt, -105, 105);

      const floorY = getTerrainElevationWorld(s.x, s.z);
      s.y = THREE.MathUtils.clamp(s.y + s.vy * dt, floorY + 2.4, surfaceY - 2);

      // Pitch and Roll gyro response
      s.pitch = THREE.MathUtils.damp(s.pitch, verticalInput * 14 - thrustInput * 4, 6, dt);
      s.roll = THREE.MathUtils.damp(s.roll, -s.yawRate * 12, 6, dt);

      // Update Submersible 3D transform
      subGroup.position.set(s.x, s.y, s.z);
      subGroup.rotation.order = 'YXZ';
      subGroup.rotation.y = s.heading;
      subGroup.rotation.x = THREE.MathUtils.degToRad(s.pitch);
      subGroup.rotation.z = THREE.MathUtils.degToRad(s.roll);

      // Spotlight visibility
      spotlightGroup.visible = currentProps.telemetry.floodlightsOn;

      // Collector Claw extraction animation
      if (s.clawTimer > 0) {
        s.clawTimer = Math.max(0, s.clawTimer - dt);
        const extend = Math.sin((1 - s.clawTimer / 0.8) * Math.PI) * 1.15;
        clawGroup.position.z = -extend;
      } else {
        clawGroup.position.z = 0;
      }

      // Ground projection ring directly on seafloor
      groundRingMesh.position.set(s.x, floorY + 0.12, s.z);

      // Update thruster particle trail
      const speedMag = Math.hypot(s.vx, s.vz, s.vy);
      if (speedMag > 0.4) {
        const posArr = trailGeo.attributes.position.array as Float32Array;
        posArr[trailCursor * 3] = s.x - forwardDirX * 2.5 + (Math.random() - 0.5) * 0.8;
        posArr[trailCursor * 3 + 1] = s.y + (Math.random() - 0.5) * 0.4;
        posArr[trailCursor * 3 + 2] = s.z - forwardDirZ * 2.5 + (Math.random() - 0.5) * 0.8;
        trailCursor = (trailCursor + 1) % trailCount;
        trailGeo.attributes.position.needsUpdate = true;
      }

      // Update Active Sonar Pulse Torus Wave
      if (s.sonarRingActive) {
        s.sonarRingProgress += dt * 0.55;
        if (s.sonarRingProgress >= 1) {
          s.sonarRingActive = false;
          sonarRingMesh.visible = false;
        } else {
          sonarRingMesh.visible = true;
          const currentRadius = s.sonarRingProgress * currentProps.sonarRadius;
          sonarRingMesh.position.set(
            s.sonarOriginX,
            getTerrainElevationWorld(s.sonarOriginX, s.sonarOriginZ) + 1.5,
            s.sonarOriginZ
          );
          sonarRingMesh.scale.setScalar(Math.max(1, currentRadius));
          sonarRingMat.opacity = (1 - s.sonarRingProgress) * 0.9;
        }
      }

      // Update Hydrothermal Vents & Polymetallic Nodules highlight state
      currentProps.nodes.forEach((n) => {
        const g = nodeMeshes.get(n.id);
        if (!g) return;
        const ring = g.getObjectByName('markerRing') as THREE.Mesh | undefined;
        if (ring) {
          const mat = ring.material as THREE.MeshBasicMaterial;
          mat.opacity = n.discovered ? 0.65 + 0.25 * Math.sin(elapsed * 4) : 0.15;
          ring.scale.setScalar(n.discovered ? 1 + 0.08 * Math.sin(elapsed * 3) : 0.75);
        }
      });

      // Update Surface Barges & Relay Drones based on purchased count
      const bargeCount = currentProps.infrastructure.solarBarges;
      const relayCount = currentProps.infrastructure.relayDrones;
      for (let i = 0; i < maxBarges; i++) {
        bargeMeshes[i].visible = i < bargeCount;
        const relayActive = i < relayCount && i < bargeCount;
        relayMeshes[i].visible = relayActive;
        tetherLines[i].visible = relayActive;
        if (relayActive) {
          const descendCycle = (Math.sin(elapsed * 0.8 + i * 1.3) + 1) * 0.5;
          relayMeshes[i].position.y = THREE.MathUtils.lerp(surfaceY - 2, s.y + 3, descendCycle);
          relayMeshes[i].rotation.y = elapsed * 2;
        }
      }

      // Update Waypoint 3D Beacon
      if (currentProps.waypoint.active) {
        wpGroup.visible = true;
        const wpFloorY = getTerrainElevationWorld(
          currentProps.waypoint.x,
          currentProps.waypoint.z
        );
        wpGroup.position.set(currentProps.waypoint.x, wpFloorY, currentProps.waypoint.z);
        wpGroup.rotation.y = elapsed * 0.8;
      } else {
        wpGroup.visible = false;
      }

      // Smooth Camera Tracking
      const camMode = currentProps.telemetry.cameraMode;
      if (camMode === 'BOW_DOME') {
        scratchCamPos.set(
          s.x + forwardDirX * 1.8,
          s.y + 0.35,
          s.z + forwardDirZ * 1.8
        );
        scratchCamTarget.set(
          s.x + forwardDirX * 22,
          s.y - 1.5,
          s.z + forwardDirZ * 22
        );
      } else if (camMode === 'ORBIT') {
        const orbitAngle = elapsed * 0.35;
        scratchCamPos.set(
          s.x + Math.cos(orbitAngle) * 26,
          s.y + 14,
          s.z + Math.sin(orbitAngle) * 26
        );
        scratchCamTarget.set(s.x, s.y, s.z);
      } else {
        // Default CHASE camera
        scratchCamPos.set(
          s.x - forwardDirX * 16,
          s.y + 6.5,
          s.z - forwardDirZ * 16
        );
        scratchCamTarget.set(
          s.x + forwardDirX * 10,
          s.y - 1.0,
          s.z + forwardDirZ * 10
        );
      }

      camera.position.lerp(scratchCamPos, 1 - Math.exp(-6 * dt));
      camera.lookAt(scratchCamTarget);

      renderer.render(scene, camera);

      // Sync telemetry to React HUD at ~8Hz so React never reconciles at 60Hz
      if (nowMs - lastReactSync > 125) {
        lastReactSync = nowMs;
        const isThrustingNow =
          thrustInput !== 0 || yawInput !== 0 || verticalInput !== 0;
        currentProps.onSetThrusting(isThrustingNow);
        currentProps.onUpdateTelemetry((prev) => ({
          ...prev,
          x: Number(s.x.toFixed(1)),
          z: Number(s.z.toFixed(1)),
          depthMeters: worldYToDepthMeters(s.y),
          headingRad: s.heading,
          pitchDeg: Number(s.pitch.toFixed(1)),
          rollDeg: Number(s.roll.toFixed(1)),
          speedKnots: Number((speedMag * 0.65).toFixed(1)),
        }));
      }
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      renderer.dispose();
    };
  }, []);

  const { node: nearestNode, distanceMeters: nearestDistMeters } = findNearestNode(
    nodes,
    telemetry.x,
    telemetry.z
  );

  const handleTriggerClaw = () => {
    if (!nearestNode) return;
    simRef.current.clawTimer = 0.8;
    setClawAnimActive(true);
    setTimeout(() => setClawAnimActive(false), 800);
    onDeployCollectorClaw(nearestNode);
  };

  const setThrustButton = (
    key: keyof typeof simRef.current.buttonThrust,
    active: boolean
  ) => {
    simRef.current.buttonThrust[key] = active;
  };

  const handleStepPilot = (
    dx: number,
    dz: number,
    dy: number,
    dHeading: number
  ) => {
    const s = simRef.current;
    s.heading += dHeading;
    const forwardDirX = -Math.sin(s.heading);
    const forwardDirZ = -Math.cos(s.heading);
    s.x = THREE.MathUtils.clamp(s.x + forwardDirX * dz + dx, -105, 105);
    s.z = THREE.MathUtils.clamp(s.z + forwardDirZ * dz, -105, 105);
    const floorY = getTerrainElevationWorld(s.x, s.z);
    s.y = THREE.MathUtils.clamp(s.y + dy, floorY + 2.4, 26);

    onUpdateTelemetry((prev) => ({
      ...prev,
      x: Number(s.x.toFixed(1)),
      z: Number(s.z.toFixed(1)),
      depthMeters: worldYToDepthMeters(s.y),
      headingRad: s.heading,
    }));
  };

  const cycleCameraMode = () => {
    const modes: Array<SubmersibleTelemetry['cameraMode']> = ['CHASE', 'ORBIT', 'BOW_DOME'];
    onUpdateTelemetry((prev) => {
      const nextIdx = (modes.indexOf(prev.cameraMode) + 1) % modes.length;
      return { ...prev, cameraMode: modes[nextIdx] };
    });
  };

  return (
    <div className="relative flex-1 w-full h-full min-h-[260px] bg-[#05070B] overflow-hidden select-none">
      {/* Isolated WebGL Mount Container */}
      <div
        ref={mountRef}
        data-testid="webgl-sonar-viewport"
        className="absolute inset-0 w-full h-full"
      />

      {/* Top-Left Minimal Spec & Telemetry Overlay */}
      <div className="absolute top-2 left-2 pointer-events-none flex flex-col gap-1 z-10">
        <div className="bg-[#0B0E17]/90 border border-[#1E2638] px-2 py-0.5 text-[10px] flex items-center gap-1.5">
          <span className="text-[#FFD700] font-bold">DSV-AUTARX-01</span>
          <span className="text-slate-500 hidden sm:inline">//</span>
          <span className="text-[#38BDF8] hidden sm:inline">SONAR CAM: {telemetry.cameraMode}</span>
        </div>
        <div className="hidden sm:flex bg-[#0B0E17]/90 border border-[#1E2638] px-2 py-0.5 text-[10px] text-slate-300 tabular-nums items-center gap-2">
          <span>POS: X={telemetry.x.toFixed(0)} Z={telemetry.z.toFixed(0)}</span>
          <span>//</span>
          <span>CLEARANCE: {Math.max(2, Math.round(telemetry.depthMeters - worldYToDepthMeters(getTerrainElevationWorld(telemetry.x, telemetry.z))))}m</span>
          {waypoint.active && (
            <>
              <span>//</span>
              <span className="text-[#38BDF8]">
                WP-ALPHA: X={waypoint.x.toFixed(0)} Z={waypoint.z.toFixed(0)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Top-Right Camera & Autopilot Quick Switch */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        <button
          type="button"
          onClick={cycleCameraMode}
          className="px-2 py-0.5 bg-[#0B0E17] border border-[#1E2638] hover:border-[#38BDF8] text-[10px] font-semibold text-[#F8FAFC] flex items-center gap-1 cursor-pointer whitespace-nowrap"
        >
          <Camera className="w-3 h-3 text-[#38BDF8]" />
          <span>CAM: {telemetry.cameraMode}</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onUpdateTelemetry((prev) => ({
              ...prev,
              autopilotEnabled: !prev.autopilotEnabled,
            }))
          }
          aria-pressed={telemetry.autopilotEnabled}
          className={`px-2 py-0.5 border text-[10px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
            telemetry.autopilotEnabled
              ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
              : 'bg-[#0B0E17] border-[#1E2638] text-slate-400 hover:text-[#F8FAFC]'
          }`}
        >
          <Navigation className="w-3 h-3" />
          <span>AUTO: {telemetry.autopilotEnabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Center Viewport Occlusion) */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center w-[96%] max-w-[820px]">
        <button
          type="button"
          onClick={() => setHudCollapsed((c) => !c)}
          className="px-2 py-0.5 bg-[#0B0E17] border border-b-0 border-[#1E2638] text-[9px] text-slate-400 hover:text-[#38BDF8] flex items-center gap-1 cursor-pointer"
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-2.5 h-2.5" />
              <span>SHOW HELM DOCK</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-2.5 h-2.5" />
              <span>HIDE HELM DOCK</span>
            </>
          )}
        </button>

        {!hudCollapsed && (
          <div className="w-full bg-[#0B0E17]/95 border border-[#1E2638] px-2 py-1.5 flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
            {/* On-Screen Tactical Thruster Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Yaw Left (A)"
                onMouseDown={() => setThrustButton('left', true)}
                onMouseUp={() => setThrustButton('left', false)}
                onMouseLeave={() => setThrustButton('left', false)}
                onClick={() => handleStepPilot(0, 0, 0, 0.28)}
                className="px-1.5 py-1 bg-[#05070B] border border-[#1E2638] hover:border-[#FFD700] text-[#F8FAFC] flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3 h-3 text-[#FFD700]" />
                <span>YAW L</span>
              </button>

              <button
                type="button"
                aria-label="Thrust Forward (W)"
                onMouseDown={() => setThrustButton('forward', true)}
                onMouseUp={() => setThrustButton('forward', false)}
                onMouseLeave={() => setThrustButton('forward', false)}
                onClick={() => handleStepPilot(0, 6, 0, 0)}
                className="px-2 py-1 bg-[#05070B] border border-[#1E2638] hover:border-[#FFD700] text-[#FFD700] font-bold flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              >
                <ArrowUp className="w-3 h-3" />
                <span>FWD</span>
              </button>

              <button
                type="button"
                aria-label="Thrust Reverse (S)"
                onMouseDown={() => setThrustButton('reverse', true)}
                onMouseUp={() => setThrustButton('reverse', false)}
                onMouseLeave={() => setThrustButton('reverse', false)}
                onClick={() => handleStepPilot(0, -6, 0, 0)}
                className="px-1.5 py-1 bg-[#05070B] border border-[#1E2638] hover:border-[#FFD700] text-[#F8FAFC] flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              >
                <ArrowDown className="w-3 h-3 text-[#FFD700]" />
                <span>REV</span>
              </button>

              <button
                type="button"
                aria-label="Yaw Right (D)"
                onMouseDown={() => setThrustButton('right', true)}
                onMouseUp={() => setThrustButton('right', false)}
                onMouseLeave={() => setThrustButton('right', false)}
                onClick={() => handleStepPilot(0, 0, 0, -0.28)}
                className="px-1.5 py-1 bg-[#05070B] border border-[#1E2638] hover:border-[#FFD700] text-[#F8FAFC] flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              >
                <span>YAW R</span>
                <ArrowRight className="w-3 h-3 text-[#FFD700]" />
              </button>
            </div>

            {/* Depth Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onMouseDown={() => setThrustButton('ascend', true)}
                onMouseUp={() => setThrustButton('ascend', false)}
                onMouseLeave={() => setThrustButton('ascend', false)}
                onClick={() => handleStepPilot(0, 0, 2.0, 0)}
                className="px-1.5 py-1 bg-[#05070B] border border-[#1E2638] hover:border-[#38BDF8] text-[#F8FAFC] cursor-pointer whitespace-nowrap"
              >
                [Q: UP]
              </button>
              <button
                type="button"
                onMouseDown={() => setThrustButton('descend', true)}
                onMouseUp={() => setThrustButton('descend', false)}
                onMouseLeave={() => setThrustButton('descend', false)}
                onClick={() => handleStepPilot(0, 0, -2.0, 0)}
                className="px-1.5 py-1 bg-[#05070B] border border-[#1E2638] hover:border-[#38BDF8] text-[#F8FAFC] cursor-pointer whitespace-nowrap"
              >
                [E: DN]
              </button>
            </div>

            {/* Active Sonar Pulse & Collector Claw Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPingSonar}
                data-testid="ping-sonar-btn"
                className="px-2 py-1 bg-[#38BDF8]/20 border border-[#38BDF8] text-[#38BDF8] hover:bg-[#38BDF8] hover:text-[#05070B] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Radio className="w-3 h-3 shrink-0" />
                <span>[PING SONAR]</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerClaw}
                disabled={!nearestNode}
                data-testid="deploy-claw-btn"
                className={`px-2 py-1 border font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                  clawAnimActive
                    ? 'bg-[#FFD700] border-[#FFD700] text-[#05070B]'
                    : 'bg-[#FFD700]/15 border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700] hover:text-[#05070B]'
                }`}
              >
                <Crosshair className="w-3 h-3 shrink-0" />
                <span>
                  [DEPLOY COLLECTOR CLAW{nearestNode ? `: ${nearestDistMeters}m` : ''}]
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
