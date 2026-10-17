export interface SimpleNode {
  id: string;
  code: string;
  name: string;
  type: 'VENT' | 'NODULE';
  x: number;
  z: number;
  depthMeters: number;
  discovered: boolean;
  harvestedCount: number;
  maxYield: number;
  creditValue: number;
  noduleYield: number;
}

export interface InfrastructureCounts {
  solarBarges: number;
  relayDrones: number;
  distillationRigs: number;
  seabedHarvesters: number;
}

export interface EngineeringUpgrades {
  hullTier: number;
  capacitorTier: number;
  sonarTier: number;
}

export interface EconomySnapshot {
  credits: number;
  distilledH2O: number;
  rareNodules: number;
  batteryCells: number;
  batteryPercent: number;
  depthMeters: number;
  floodlightsOn: boolean;
  isThrusting: boolean;
  infrastructure: InfrastructureCounts;
  upgrades: EngineeringUpgrades;
  discoveredNodesCount: number;
}

export const INFRASTRUCTURE_COSTS = {
  solarBarges: 500,
  relayDrones: 800,
  distillationRigs: 1200,
  seabedHarvesters: 2500,
} as const;

export const UPGRADE_BASE_COSTS = {
  hullTier: 1800,
  capacitorTier: 1400,
  sonarTier: 1600,
} as const;

/**
 * Procedural bathymetric terrain height in Three.js world space and ocean depth in meters.
 * Central trench runs along the X-axis / diagonal with flanking abyssal ridges and seamounts.
 */
export function getTerrainElevationWorld(x: number, z: number): number {
  // Deep central Mariana trough along z ~= 0.25 * x
  const trenchAxisDist = Math.abs(z - 0.18 * x);
  const trenchDip = -18 * Math.exp(-(trenchAxisDist * trenchAxisDist) / 1400);

  // Multi-octave trigonometric ridges and seamounts
  const ridge1 = Math.sin(x * 0.055) * Math.cos(z * 0.055) * 5.5;
  const ridge2 = Math.sin(x * 0.13 + 1.4) * Math.sin(z * 0.11 - 0.8) * 2.4;
  const micro = Math.cos(x * 0.27 - z * 0.23) * 0.85;

  // Flanking continental shelf walls at far Z edges
  const shelfLift = Math.pow(Math.min(Math.abs(z) / 95, 1.3), 2.2) * 11.0;

  return trenchDip + ridge1 + ridge2 + micro + shelfLift - 12.0;
}

/**
 * Converts a Three.js world Y coordinate (-32 to +40) into real-world bathymetric depth in meters (-7500m to 0m).
 * Surface layer is at world Y = +28 (0m).
 */
export function worldYToDepthMeters(worldY: number): number {
  const surfaceY = 28;
  const clampedY = Math.min(surfaceY, worldY);
  // Each world unit below surfaceY = ~125m depth
  const depth = (clampedY - surfaceY) * 125;
  return Math.round(depth);
}

/**
 * Converts real-world depth in meters (-7500m to 0m) to Three.js world Y coordinate.
 */
export function depthMetersToWorldY(depthMeters: number): number {
  const surfaceY = 28;
  return surfaceY + depthMeters / 125;
}

/**
 * Returns the seafloor depth in meters at a given (x, z) world coordinate.
 */
export function getSeafloorDepthMeters(x: number, z: number): number {
  const worldY = getTerrainElevationWorld(x, z);
  return worldYToDepthMeters(worldY);
}

/**
 * Calculates hydrostatic pressure in MPa for a given depth in meters.
 * Approx 10.08 MPa per 1,000 meters of seawater + 0.1 MPa atmospheric.
 */
export function calculatePressureMPa(depthMeters: number): number {
  const absDepth = Math.max(0, -depthMeters);
  const mpa = 0.1 + absDepth * 0.01008;
  return Number(mpa.toFixed(1));
}

/**
 * Computes maximum crush depth in meters based on hull upgrade tier.
 * Tier 1 = -4,500m; each additional tier adds -1,500m depth capability.
 */
export function getMaxCrushDepthMeters(hullTier: number): number {
  const safeTier = Math.max(1, Math.floor(hullTier));
  return -4500 - (safeTier - 1) * 1500;
}

/**
 * Computes active sonar pulse radius in world units based on sonar tier.
 * Base radius = 48 units; each tier increases radius meaningfully.
 */
export function getSonarPingRadius(sonarTier: number): number {
  const safeTier = Math.max(1, Math.floor(sonarTier));
  return 48 + (safeTier - 1) * 28;
}

/**
 * Checks whether the submersible is approaching or exceeding its hull crush depth rating.
 */
export function isHullIntegrityWarning(depthMeters: number, maxCrushDepthMeters: number): boolean {
  // Trigger warning when deeper than 92% of crush limit or exceeding crush limit
  return depthMeters <= maxCrushDepthMeters * 0.92;
}

/**
 * Formats an ASCII block progress bar such as [████████░░]
 */
export function formatAsciiBar(ratio: number, totalBlocks = 10): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * totalBlocks);
  const empty = Math.max(0, totalBlocks - filled);
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * Computes 1 second (or dtSeconds) of the economic & power simulation loop.
 */
export function computeEconomicTick(snapshot: EconomySnapshot, dtSeconds = 1): {
  credits: number;
  creditRatePerSec: number;
  solarKw: number;
  distilledH2O: number;
  rareNodules: number;
  batteryCells: number;
  batteryPercent: number;
  netBatteryRatePerSec: number;
} {
  const { infrastructure, upgrades } = snapshot;

  // Solar generation: 45 kW per solar barge
  const solarKw = infrastructure.solarBarges * 45;

  // Passive credits: base 17 CR/s + 25 CR/s per Autonomous Seabed Harvester + 4 CR/s per discovered node
  const harvesterIncome = infrastructure.seabedHarvesters * 25;
  const telemetryBonus = snapshot.discoveredNodesCount * 3;
  const creditRatePerSec = 17 + harvesterIncome + telemetryBonus;

  // Distilled H2O: +15 L/s per Desalination & Distillation Rig
  const h2oRatePerSec = infrastructure.distillationRigs * 15;

  // Passive nodule mining from autonomous harvesters
  const passiveNoduleRate = infrastructure.seabedHarvesters * 0.5;

  // Battery cell charging on surface from excess solar power
  const cellChargeRate = Math.max(0, Math.floor(solarKw / 90)) * 0.5;

  // Submersible battery drain vs relay drone recharge
  const capacitorReduction = Math.max(0.45, 1 - (upgrades.capacitorTier - 1) * 0.18);
  const baseDrain = 0.65 * capacitorReduction;
  const floodlightDrain = snapshot.floodlightsOn ? 0.35 * capacitorReduction : 0;
  const thrusterDrain = snapshot.isThrusting ? 0.45 * capacitorReduction : 0;
  const totalDrain = baseDrain + floodlightDrain + thrusterDrain;

  // Relay drones ferry charge from surface barges down to the trench
  const maxSupportedRelays = Math.min(infrastructure.relayDrones, infrastructure.solarBarges * 2);
  const relayRecharge = maxSupportedRelays * 0.52;

  const netBatteryRatePerSec = Number((relayRecharge - totalDrain).toFixed(2));
  const nextBattery = Math.max(4, Math.min(100, snapshot.batteryPercent + netBatteryRatePerSec * dtSeconds));

  return {
    credits: Math.round(snapshot.credits + creditRatePerSec * dtSeconds),
    creditRatePerSec,
    solarKw,
    distilledH2O: Math.round(snapshot.distilledH2O + h2oRatePerSec * dtSeconds),
    rareNodules: Number((snapshot.rareNodules + passiveNoduleRate * dtSeconds).toFixed(1)),
    batteryCells: Number((snapshot.batteryCells + cellChargeRate * dtSeconds).toFixed(1)),
    batteryPercent: Number(nextBattery.toFixed(1)),
    netBatteryRatePerSec,
  };
}

/**
 * Evaluates which nodes are within the sonar pulse ring and marks them discovered.
 */
export function discoverNodesInSonarRadius(
  nodes: SimpleNode[],
  subX: number,
  subZ: number,
  radius: number
): { updatedNodes: SimpleNode[]; newlyDiscovered: SimpleNode[] } {
  const newlyDiscovered: SimpleNode[] = [];
  const rSq = radius * radius;

  const updatedNodes = nodes.map((node) => {
    const dx = node.x - subX;
    const dz = node.z - subZ;
    const distSq = dx * dx + dz * dz;
    if (distSq <= rSq && !node.discovered) {
      const updated = { ...node, discovered: true };
      newlyDiscovered.push(updated);
      return updated;
    }
    return node;
  });

  return { updatedNodes, newlyDiscovered };
}

/**
 * Finds the nearest node to the submersible and returns the node and 2D horizontal distance in meters.
 * (1 world unit = 8 meters horizontally)
 */
export function findNearestNode(
  nodes: SimpleNode[],
  subX: number,
  subZ: number
): { node: SimpleNode | null; distanceMeters: number } {
  if (nodes.length === 0) {
    return { node: null, distanceMeters: Infinity };
  }
  let bestNode: SimpleNode | null = null;
  let bestDistUnits = Infinity;

  for (const n of nodes) {
    const dx = n.x - subX;
    const dz = n.z - subZ;
    const d = Math.hypot(dx, dz);
    if (d < bestDistUnits) {
      bestDistUnits = d;
      bestNode = n;
    }
  }

  return {
    node: bestNode,
    distanceMeters: Math.round(bestDistUnits * 8),
  };
}

/**
 * Calculates upgrade cost for a given upgrade key and current tier.
 */
export function getUpgradeCost(key: keyof EngineeringUpgrades, currentTier: number): number {
  const base = UPGRADE_BASE_COSTS[key];
  return Math.round(base * Math.pow(1.55, Math.max(0, currentTier - 1)));
}
