/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TopTelemetryBus } from './components/TopTelemetryBus';
import { AbyssalViewport3D } from './components/AbyssalViewport3D';
import { CrtInstrumentDashboard } from './components/CrtInstrumentDashboard';
import { BathymetricTacticalMap } from './components/BathymetricTacticalMap';
import { FleetEconomyDeck } from './components/FleetEconomyDeck';
import { CrewLogTerminal } from './components/CrewLogTerminal';
import {
  AbyssalNode,
  CrewLogEntry,
  EngineeringUpgrades,
  InfrastructureCounts,
  PassingVessel,
  ScoutDrone,
  SubmersibleTelemetry,
  Waypoint,
  WorkspaceMode,
} from './game/types';
import {
  COOP_CALLOUT_POOL,
  INITIAL_CREW_LOGS,
  INITIAL_NODES,
  INITIAL_SCOUT_DRONES,
  INITIAL_VESSELS,
} from './game/seed';
import {
  computeEconomicTick,
  discoverNodesInSonarRadius,
  findNearestNode,
  getMaxCrushDepthMeters,
  getSeafloorDepthMeters,
  getSonarPingRadius,
  getUpgradeCost,
  INFRASTRUCTURE_COSTS,
} from './game/rules';
import { soundFX } from './game/sound';
import { ShieldAlert, Terminal, X } from 'lucide-react';

function formatTimeNow(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

export default function App() {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('UNIFIED');
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  // Economic & Resource Bus State (matches prompt specifications: 14,850 CR, 185 kW, 1,240 L, 68 Tons)
  const [credits, setCredits] = useState<number>(14850);
  const [creditRatePerSec, setCreditRatePerSec] = useState<number>(42);
  const [solarKw, setSolarKw] = useState<number>(185);
  const [solarEfficiency, setSolarEfficiency] = useState<number>(0.82);
  const [distilledH2O, setDistilledH2O] = useState<number>(1240);
  const [rareNodules, setRareNodules] = useState<number>(68);
  const [batteryCells, setBatteryCells] = useState<number>(14);

  // Surface Infrastructure & Submersible Upgrades
  const [infrastructure, setInfrastructure] = useState<InfrastructureCounts>({
    solarBarges: 4,
    relayDrones: 2,
    distillationRigs: 2,
    seabedHarvesters: 1,
  });

  const [upgrades, setUpgrades] = useState<EngineeringUpgrades>({
    hullTier: 1,
    capacitorTier: 1,
    sonarTier: 1,
  });

  // Submersible Telemetry (Initial depth -3,420m, battery 78.4%)
  const [telemetry, setTelemetry] = useState<SubmersibleTelemetry>({
    x: -14,
    z: -18,
    depthMeters: -3420,
    headingRad: 0.35,
    pitchDeg: -2.4,
    rollDeg: 0.0,
    speedKnots: 0.0,
    batteryPercent: 78.4,
    maxBatteryCapacity: 100,
    batteryDrainRate: -1.2,
    floodlightsOn: true,
    sonarActive: false,
    autopilotEnabled: false,
    cameraMode: 'CHASE',
  });

  const [waypoint, setWaypoint] = useState<Waypoint>({
    active: true,
    label: 'WP-ALPHA',
    x: 24,
    z: -16,
    targetDepthMeters: getSeafloorDepthMeters(24, -16),
  });

  const [nodes, setNodes] = useState<AbyssalNode[]>(INITIAL_NODES);
  const [scoutDrones, setScoutDrones] = useState<ScoutDrone[]>(INITIAL_SCOUT_DRONES);
  const [vessels, setVessels] = useState<PassingVessel[]>(INITIAL_VESSELS);
  const [crewLogs, setCrewLogs] = useState<CrewLogEntry[]>(INITIAL_CREW_LOGS);
  const [simulateCoopCrew, setSimulateCoopCrew] = useState<boolean>(true);
  const [sonarPulseTrigger, setSonarPulseTrigger] = useState<number>(0);

  const isThrustingRef = useRef<boolean>(false);
  const coopIdxRef = useRef<number>(0);

  const appendLog = useCallback(
    (actor: string, category: CrewLogEntry['category'], message: string) => {
      setCrewLogs((prev) => [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: formatTimeNow(),
          actor,
          category,
          message,
        },
        ...prev.slice(0, 29),
      ]);
    },
    []
  );

  // Mirror state on document.body for automated testing & accessibility inspection
  useEffect(() => {
    document.body.dataset.state = briefingOpen ? 'paused' : 'playing';
    document.body.dataset.workspace = workspaceMode;
  }, [briefingOpen, workspaceMode]);

  // Continuous 1000ms Economic & Autonomous Fleet Loop
  const simSnapshotRef = useRef({
    credits,
    distilledH2O,
    rareNodules,
    batteryCells,
    telemetry,
    infrastructure,
    upgrades,
    nodes,
    simulateCoopCrew,
  });

  useEffect(() => {
    simSnapshotRef.current = {
      credits,
      distilledH2O,
      rareNodules,
      batteryCells,
      telemetry,
      infrastructure,
      upgrades,
      nodes,
      simulateCoopCrew,
    };
  }, [
    credits,
    distilledH2O,
    rareNodules,
    batteryCells,
    telemetry,
    infrastructure,
    upgrades,
    nodes,
    simulateCoopCrew,
  ]);

  useEffect(() => {
    let tickCounter = 0;

    const interval = setInterval(() => {
      tickCounter += 1;
      const snap = simSnapshotRef.current;
      const discoveredCount = snap.nodes.filter((n) => n.discovered).length;

      const eco = computeEconomicTick(
        {
          credits: snap.credits,
          distilledH2O: snap.distilledH2O,
          rareNodules: snap.rareNodules,
          batteryCells: snap.batteryCells,
          batteryPercent: snap.telemetry.batteryPercent,
          depthMeters: snap.telemetry.depthMeters,
          floodlightsOn: snap.telemetry.floodlightsOn,
          isThrusting: isThrustingRef.current,
          infrastructure: snap.infrastructure,
          upgrades: snap.upgrades,
          discoveredNodesCount: discoveredCount,
        },
        1
      );

      setCredits(eco.credits);
      setCreditRatePerSec(eco.creditRatePerSec);
      setSolarKw(eco.solarKw + 5); // +5kW auxiliary mast array
      setDistilledH2O(eco.distilledH2O);
      setRareNodules(eco.rareNodules);
      setBatteryCells(eco.batteryCells);

      // Subtle daylight solar cycle oscillation (0.76 .. 0.94)
      setSolarEfficiency(Number((0.84 + Math.sin(tickCounter * 0.08) * 0.08).toFixed(2)));

      setTelemetry((prev) => ({
        ...prev,
        batteryPercent: eco.batteryPercent,
        batteryDrainRate: eco.netBatteryRatePerSec,
      }));

      // Advance autonomous scout drones along their vector paths
      setScoutDrones((prevDrones) =>
        prevDrones.map((d) => {
          const dx = d.targetX - d.x;
          const dz = d.targetZ - d.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 3) {
            return {
              ...d,
              targetX: -d.targetX,
              targetZ: -d.targetZ,
              status: 'SCANNING',
            };
          }
          const step = Math.min(dist, 2.2);
          const nx = Number((d.x + (dx / dist) * step).toFixed(1));
          const nz = Number((d.z + (dz / dist) * step).toFixed(1));
          return {
            ...d,
            x: nx,
            z: nz,
            depthMeters: getSeafloorDepthMeters(nx, nz) + 120,
          };
        })
      );

      // Update passing vessels shipping lane distances
      setVessels((prevVessels) =>
        prevVessels.map((v) => {
          const nextDist = Number((v.distanceKm - 0.05).toFixed(2));
          if (nextDist <= 0.6) {
            return { ...v, distanceKm: 7.4 };
          }
          return { ...v, distanceKm: nextDist };
        })
      );

      // Periodic Simulated Multiplayer Co-Op Crew Actions
      if (snap.simulateCoopCrew && tickCounter % 8 === 0) {
        const event = COOP_CALLOUT_POOL[coopIdxRef.current % COOP_CALLOUT_POOL.length];
        coopIdxRef.current += 1;
        appendLog(event.actor, event.category, event.message);
        if (event.bonusCredits) {
          setCredits((c) => c + event.bonusCredits!);
        }
        if (event.bonusH2O) {
          setDistilledH2O((h) => h + event.bonusH2O!);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [appendLog]);

  // Active Sonar Ping Handler
  const maxCrushDepth = getMaxCrushDepthMeters(upgrades.hullTier);
  const sonarRadius = getSonarPingRadius(upgrades.sonarTier);

  const handlePingSonar = useCallback(() => {
    soundFX.playSonarPing();
    setSonarPulseTrigger((c) => c + 1);

    const { updatedNodes, newlyDiscovered } = discoverNodesInSonarRadius(
      nodes,
      telemetry.x,
      telemetry.z,
      sonarRadius
    );

    if (newlyDiscovered.length > 0) {
      setNodes(updatedNodes);
      const codes = newlyDiscovered.map((n) => `${n.code} (${n.name})`).join(', ');
      appendLog(
        'AUTARX_BOT :: SONAR',
        'SONAR',
        `Active sonar echo locked ${newlyDiscovered.length} new anomaly signature(s): ${codes}.`
      );
    } else {
      const { node: nearest, distanceMeters } = findNearestNode(
        nodes,
        telemetry.x,
        telemetry.z
      );
      appendLog(
        'AUTARX_BOT :: SONAR',
        'SONAR',
        `3D acoustic torus wave swept ${sonarRadius * 8}m radius. Nearest signature: ${
          nearest ? `${nearest.code} at ${distanceMeters}m` : 'NONE'
        }.`
      );
    }
  }, [nodes, telemetry.x, telemetry.z, sonarRadius, appendLog]);

  // Deploy Collector Claw / Extract Sample Handler
  const handleExtractSample = useCallback(
    (targetNode: AbyssalNode) => {
      soundFX.playHarvestClaw();

      const creditGain = targetNode.creditValue;
      const noduleGain = targetNode.noduleYield;

      setCredits((c) => c + creditGain);
      setRareNodules((n) => Number((n + noduleGain).toFixed(1)));

      setNodes((prev) =>
        prev.map((n) =>
          n.id === targetNode.id
            ? { ...n, discovered: true, harvestedCount: n.harvestedCount + 1 }
            : n
        )
      );

      appendLog(
        'IZZY :: HELM',
        'ECONOMY',
        `Collector claw extracted sample from ${targetNode.code}: +${creditGain} CR, +${noduleGain}t Rare Nodules.`
      );
    },
    [appendLog]
  );

  // Set Waypoint on Bathymetric Map
  const handleSetWaypoint = useCallback(
    (x: number, z: number) => {
      const targetDepth = getSeafloorDepthMeters(x, z);
      setWaypoint({
        active: true,
        label: 'WP-ALPHA',
        x,
        z,
        targetDepthMeters: targetDepth,
      });
      appendLog(
        'IZZY :: HELM',
        'HELM',
        `Updated navigation beacon WP-ALPHA to Sector Grid X:${x} Z:${z} (Seafloor ${targetDepth}m).`
      );
    },
    [appendLog]
  );

  // Dispatch Autonomous Scout Drone to Waypoint
  const handleDispatchScoutDrone = useCallback(() => {
    setScoutDrones((prev) => {
      const next = [...prev];
      if (next.length > 0) {
        next[0] = {
          ...next[0],
          targetX: waypoint.x,
          targetZ: waypoint.z,
          status: 'VECTORING',
        };
      }
      return next;
    });

    // Also reveal any node very close to the waypoint when scout drone is dispatched
    const { updatedNodes, newlyDiscovered } = discoverNodesInSonarRadius(
      nodes,
      waypoint.x,
      waypoint.z,
      36
    );
    if (newlyDiscovered.length > 0) {
      setNodes(updatedNodes);
      appendLog(
        'AUTARX_BOT :: SONAR',
        'SONAR',
        `AUV-VANGUARD-1 vectored to WP-ALPHA and pinpointed ${newlyDiscovered
          .map((n) => n.code)
          .join(', ')}!`
      );
    } else {
      appendLog(
        'AUTARX_BOT :: SONAR',
        'SONAR',
        `Dispatched AUV-VANGUARD-1 on autonomous reconnaissance vector to WP-ALPHA (X:${waypoint.x} Z:${waypoint.z}).`
      );
    }
  }, [waypoint, nodes, appendLog]);

  // Build Surface Infrastructure
  const handleBuildInfrastructure = useCallback(
    (key: keyof InfrastructureCounts) => {
      const cost = INFRASTRUCTURE_COSTS[key];
      if (credits < cost) return;

      soundFX.playTradeConfirm();
      setCredits((c) => c - cost);
      setInfrastructure((prev) => ({
        ...prev,
        [key]: prev[key] + 1,
      }));

      const names: Record<keyof InfrastructureCounts, string> = {
        solarBarges: 'Solar Panel Barge (+45 kW)',
        relayDrones: 'Battery Relay Drone (Trench Tether)',
        distillationRigs: 'Desalination & Distillation Rig (+15 L/s H2O)',
        seabedHarvesters: 'Autonomous Seabed Harvester (+25 CR/s)',
      };

      appendLog(
        'LUCAS :: LOGISTICS',
        'ECONOMY',
        `Commissioned ${names[key]} for ${cost.toLocaleString()} CR.`
      );
    },
    [credits, appendLog]
  );

  // Execute Passing Vessel Trade Contract
  const handleExecuteTrade = useCallback(
    (vessel: PassingVessel) => {
      if (vessel.resourceWanted === 'H2O' && distilledH2O < vessel.amountWanted) return;
      if (vessel.resourceWanted === 'NODULES' && rareNodules < vessel.amountWanted) return;
      if (vessel.resourceWanted === 'BATTERY_CELLS' && batteryCells < vessel.amountWanted) return;

      soundFX.playTradeConfirm();

      if (vessel.resourceWanted === 'H2O') {
        setDistilledH2O((h) => h - vessel.amountWanted);
      } else if (vessel.resourceWanted === 'NODULES') {
        setRareNodules((n) => Number((n - vessel.amountWanted).toFixed(1)));
      } else {
        setBatteryCells((b) => Number((b - vessel.amountWanted).toFixed(1)));
      }

      setCredits((c) => c + vessel.creditPayout);

      // Rotate contract demand slightly for continuous replayability
      setVessels((prev) =>
        prev.map((v) =>
          v.id === vessel.id
            ? {
                ...v,
                amountWanted: Math.round(v.amountWanted * 1.15),
                creditPayout: Math.round(v.creditPayout * 1.18),
              }
            : v
        )
      );

      appendLog(
        'LUCAS :: LOGISTICS',
        'ECONOMY',
        `Completed surface tender transfer with ${vessel.name}: +${vessel.creditPayout.toLocaleString()} CR.`
      );
    },
    [distilledH2O, rareNodules, batteryCells, appendLog]
  );

  // Purchase Submersible Engineering Upgrade
  const handlePurchaseUpgrade = useCallback(
    (key: keyof EngineeringUpgrades) => {
      const currentTier = upgrades[key];
      const cost = getUpgradeCost(key, currentTier);
      if (credits < cost) return;

      soundFX.playTradeConfirm();
      setCredits((c) => c - cost);
      setUpgrades((prev) => ({
        ...prev,
        [key]: prev[key] + 1,
      }));

      if (key === 'capacitorTier') {
        setTelemetry((prev) => ({
          ...prev,
          batteryPercent: Math.min(100, prev.batteryPercent + 25),
        }));
      }

      const labels: Record<keyof EngineeringUpgrades, string> = {
        hullTier: `Titanium Hull Reinforcement Tier ${currentTier + 1} (Max Crush ${getMaxCrushDepthMeters(
          currentTier + 1
        ).toLocaleString()}m)`,
        capacitorTier: `Solid-State Capacitor Bank Tier ${currentTier + 1}`,
        sonarTier: `Wide-Spectrum Phased Sonar Tier ${currentTier + 1} (${
          getSonarPingRadius(currentTier + 1) * 8
        }m Scan Radius)`,
      };

      appendLog(
        'SYS_CORE',
        'HELM',
        `Installed ${labels[key]} on DSV-AUTARX-01 (-${cost.toLocaleString()} CR).`
      );
    },
    [upgrades, credits, appendLog]
  );

  // Emergency Ascend / Trim Ballast
  const handleEmergencyAscend = useCallback(() => {
    soundFX.playWarningBeep();
    setTelemetry((prev) => ({
      ...prev,
      depthMeters: Math.min(-1200, prev.depthMeters + 450),
    }));
    appendLog(
      'IZZY :: HELM',
      'ALERT',
      'Emergency ballast purge triggered! Ascending +450m to relieve hydrostatic hull pressure.'
    );
  }, [appendLog]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundFX.muted = next;
      return next;
    });
  }, []);

  const { node: nearestNode, distanceMeters: nearestNodeDistanceMeters } = findNearestNode(
    nodes,
    telemetry.x,
    telemetry.z
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#05070B] text-[#F8FAFC] font-mono select-none flex flex-col">
      {/* MODULE A: Top Telemetry & Multiplayer Crew Bus */}
      <TopTelemetryBus
        credits={credits}
        creditRatePerSec={creditRatePerSec}
        solarKw={solarKw}
        solarEfficiency={solarEfficiency}
        distilledH2O={distilledH2O}
        rareNodules={rareNodules}
        workspaceMode={workspaceMode}
        onSelectWorkspaceMode={setWorkspaceMode}
        simulateCoopCrew={simulateCoopCrew}
        onToggleSimulateCoop={() => setSimulateCoopCrew((s) => !s)}
        muted={muted}
        onToggleMute={handleToggleMute}
        onOpenBriefingModal={() => setBriefingOpen(true)}
      />

      {/* MAIN TACTICAL WORKSPACE */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto lg:overflow-hidden p-2">
        {workspaceMode === 'UNIFIED' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 h-full min-h-0">
            {/* Left 7 Columns: 3D Bathymetric Sonar Viewport + Retro CRT Instrument Dashboard */}
            <div className="lg:col-span-7 flex flex-col h-full min-h-[460px] border border-[#1E2638] bg-[#0B0E17] overflow-hidden">
              <AbyssalViewport3D
                telemetry={telemetry}
                onUpdateTelemetry={setTelemetry}
                nodes={nodes}
                scoutDrones={scoutDrones}
                infrastructure={infrastructure}
                waypoint={waypoint}
                sonarRadius={sonarRadius}
                sonarPulseTrigger={sonarPulseTrigger}
                onPingSonar={handlePingSonar}
                onDeployCollectorClaw={handleExtractSample}
                onSetThrusting={(t) => {
                  isThrustingRef.current = t;
                }}
              />
              <CrtInstrumentDashboard
                telemetry={telemetry}
                maxCrushDepth={maxCrushDepth}
                nearestNode={nearestNode}
                nearestNodeDistanceMeters={nearestNodeDistanceMeters}
                onToggleFloodlights={() =>
                  setTelemetry((prev) => ({
                    ...prev,
                    floodlightsOn: !prev.floodlightsOn,
                  }))
                }
                onPingSonar={handlePingSonar}
                onExtractSample={handleExtractSample}
                onEmergencyAscend={handleEmergencyAscend}
              />
            </div>

            {/* Right 5 Columns: Bathymetric Tactical Map + Surface Barges & Fleet Economy */}
            <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-2 h-full min-h-0">
              <div className="min-h-[260px] lg:min-h-0 h-full overflow-hidden">
                <BathymetricTacticalMap
                  telemetry={telemetry}
                  nodes={nodes}
                  scoutDrones={scoutDrones}
                  infrastructure={infrastructure}
                  waypoint={waypoint}
                  sonarRadius={sonarRadius}
                  onSetWaypoint={handleSetWaypoint}
                  onToggleAutopilot={() =>
                    setTelemetry((prev) => ({
                      ...prev,
                      autopilotEnabled: !prev.autopilotEnabled,
                    }))
                  }
                  onDispatchScoutDrone={handleDispatchScoutDrone}
                />
              </div>

              <div className="min-h-[280px] lg:min-h-0 h-full overflow-hidden">
                <FleetEconomyDeck
                  credits={credits}
                  distilledH2O={distilledH2O}
                  rareNodules={rareNodules}
                  batteryCells={batteryCells}
                  infrastructure={infrastructure}
                  upgrades={upgrades}
                  vessels={vessels}
                  onBuildInfrastructure={handleBuildInfrastructure}
                  onExecuteTrade={handleExecuteTrade}
                  onPurchaseUpgrade={handlePurchaseUpgrade}
                />
              </div>
            </div>
          </div>
        )}

        {workspaceMode === 'HELM_3D' && (
          <div className="flex flex-col h-full min-h-0 border border-[#1E2638] bg-[#0B0E17] overflow-hidden">
            <AbyssalViewport3D
              telemetry={telemetry}
              onUpdateTelemetry={setTelemetry}
              nodes={nodes}
              scoutDrones={scoutDrones}
              infrastructure={infrastructure}
              waypoint={waypoint}
              sonarRadius={sonarRadius}
              sonarPulseTrigger={sonarPulseTrigger}
              onPingSonar={handlePingSonar}
              onDeployCollectorClaw={handleExtractSample}
              onSetThrusting={(t) => {
                isThrustingRef.current = t;
              }}
            />
            <CrtInstrumentDashboard
              telemetry={telemetry}
              maxCrushDepth={maxCrushDepth}
              nearestNode={nearestNode}
              nearestNodeDistanceMeters={nearestNodeDistanceMeters}
              onToggleFloodlights={() =>
                setTelemetry((prev) => ({
                  ...prev,
                  floodlightsOn: !prev.floodlightsOn,
                }))
              }
              onPingSonar={handlePingSonar}
              onExtractSample={handleExtractSample}
              onEmergencyAscend={handleEmergencyAscend}
            />
          </div>
        )}

        {workspaceMode === 'TACTICAL_MAP' && (
          <div className="h-full min-h-0 overflow-hidden">
            <BathymetricTacticalMap
              telemetry={telemetry}
              nodes={nodes}
              scoutDrones={scoutDrones}
              infrastructure={infrastructure}
              waypoint={waypoint}
              sonarRadius={sonarRadius}
              onSetWaypoint={handleSetWaypoint}
              onToggleAutopilot={() =>
                setTelemetry((prev) => ({
                  ...prev,
                  autopilotEnabled: !prev.autopilotEnabled,
                }))
              }
              onDispatchScoutDrone={handleDispatchScoutDrone}
              expanded
            />
          </div>
        )}

        {workspaceMode === 'FLEET_ECONOMY' && (
          <div className="h-full min-h-0 overflow-hidden">
            <FleetEconomyDeck
              credits={credits}
              distilledH2O={distilledH2O}
              rareNodules={rareNodules}
              batteryCells={batteryCells}
              infrastructure={infrastructure}
              upgrades={upgrades}
              vessels={vessels}
              onBuildInfrastructure={handleBuildInfrastructure}
              onExecuteTrade={handleExecuteTrade}
              onPurchaseUpgrade={handlePurchaseUpgrade}
              expanded
            />
          </div>
        )}
      </main>

      {/* BOTTOM TERMINAL COMMS LOG */}
      <CrewLogTerminal logs={crewLogs} />

      {/* MISSION BRIEFING & TACTICAL MANUAL MODAL */}
      {briefingOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="briefing-modal-title"
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
        >
          <div className="bg-[#0B0E17] border border-[#38BDF8] max-w-xl w-full p-5 space-y-4 crt-scanlines">
            <div className="flex items-center justify-between border-b border-[#1E2638] pb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-[#FFD700]">
                <Terminal className="w-4 h-4 text-[#38BDF8]" />
                <h2 id="briefing-modal-title">
                  AUTARX // ABYSSAL_VECTOR v1.0 — MISSION BRIEFING
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setBriefingOpen(false)}
                aria-label="Close Mission Briefing"
                className="p-1 text-slate-400 hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <p>
                Welcome to <strong className="text-[#F8FAFC]">MARIANA HADAL SECTOR 09</strong>. You are operating the multi-station command deck linking surface solar distillation barges to the deep-trench robotic submersible{' '}
                <strong className="text-[#FFD700]">DSV-AUTARX-01</strong>.
              </p>

              <div className="bg-[#05070B] border border-[#1E2638] p-3 space-y-1.5 text-[11px]">
                <div className="text-[#38BDF8] font-bold">STATION OPERATING DIRECTIVES:</div>
                <div>
                  1. <strong className="text-[#FFD700]">HELM &amp; 3D SONAR:</strong> Pilot with{' '}
                  <code>W/A/S/D</code> or Arrow Keys, adjust depth with <code>Q/E</code>, and press{' '}
                  <code>SPACEBAR</code> or <code>[PING SONAR]</code> to sweep the trench for hydrothermal vents &amp; polymetallic nodules.
                </div>
                <div>
                  2. <strong className="text-[#10B981]">RESOURCE EXTRACTION:</strong> Approach within 120m of any node and trigger{' '}
                  <code>[DEPLOY COLLECTOR CLAW]</code> or <code>[EXTRACT SAMPLE]</code> for instant Credits &amp; Rare Nodules.
                </div>
                <div>
                  3. <strong className="text-[#38BDF8]">BATHYMETRIC VECTORING:</strong> Click anywhere on the 2D contour map to place beacon <code>WP-ALPHA</code>, engage Autopilot, or dispatch autonomous scout drones.
                </div>
                <div className="flex items-center gap-1.5 text-[#F43F5E] pt-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Monitor Hydrostatic Crush Depth (-4,500m Tier 1). Upgrade Titanium Hull Reinforcement to reach deeper trench fissures.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#1E2638]">
              <button
                type="button"
                data-start="true"
                onClick={() => setBriefingOpen(false)}
                className="px-4 py-1.5 bg-[#38BDF8] text-[#05070B] font-bold text-xs hover:bg-[#F8FAFC] cursor-pointer"
              >
                [RESUME COMMAND DECK]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
