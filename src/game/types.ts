export type WorkspaceMode = 'UNIFIED' | 'HELM_3D' | 'TACTICAL_MAP' | 'FLEET_ECONOMY';

export type NodeType = 'VENT' | 'NODULE';

export interface AbyssalNode {
  id: string;
  code: string;
  name: string;
  type: NodeType;
  x: number; // World X (-120 to +120)
  z: number; // World Z (-120 to +120)
  depthMeters: number; // e.g. -3100 to -6800
  discovered: boolean;
  harvestedCount: number;
  maxYield: number;
  creditValue: number;
  noduleYield: number;
}

export interface ScoutDrone {
  id: string;
  callsign: string;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  depthMeters: number;
  status: 'PATROLLING' | 'VECTORING' | 'SCANNING' | 'RECHARGING';
}

export interface PassingVessel {
  id: string;
  name: string;
  vesselClass: string;
  distanceKm: number;
  etaSeconds: number;
  resourceWanted: 'H2O' | 'BATTERY_CELLS' | 'NODULES';
  amountWanted: number;
  creditPayout: number;
}

export interface CrewLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  category: 'SONAR' | 'HELM' | 'ECONOMY' | 'COOP' | 'ALERT';
  message: string;
}

export interface SubmersibleTelemetry {
  x: number;
  z: number;
  depthMeters: number; // Negative values, e.g. -3420
  headingRad: number; // 0 = North (-Z)
  pitchDeg: number;
  rollDeg: number;
  speedKnots: number;
  batteryPercent: number;
  maxBatteryCapacity: number; // 100 base, upgraded via capacitor bank
  batteryDrainRate: number; // %/s net
  floodlightsOn: boolean;
  sonarActive: boolean;
  autopilotEnabled: boolean;
  cameraMode: 'CHASE' | 'ORBIT' | 'BOW_DOME';
}

export interface Waypoint {
  active: boolean;
  label: string;
  x: number;
  z: number;
  targetDepthMeters: number;
}

export interface InfrastructureCounts {
  solarBarges: number;
  relayDrones: number;
  distillationRigs: number;
  seabedHarvesters: number;
}

export interface EngineeringUpgrades {
  hullTier: number; // Base 1 (-4,500m), +1,500m per tier above 1
  capacitorTier: number; // Base 1, reduces thruster drain & adds capacity
  sonarTier: number; // Base 1, increases sonar ping radius & scan duration
}

export interface SimulationState {
  credits: number;
  creditRatePerSec: number;
  solarKw: number;
  solarEfficiency: number; // 0..1 daylight efficiency
  distilledH2O: number;
  rareNodules: number;
  batteryCells: number;
  maxCrushDepth: number; // e.g., -4500
  sonarRadius: number; // World units, base 48
  simulateCoopCrew: boolean;
  infrastructure: InfrastructureCounts;
  upgrades: EngineeringUpgrades;
  nodes: AbyssalNode[];
  scoutDrones: ScoutDrone[];
  vessels: PassingVessel[];
}
