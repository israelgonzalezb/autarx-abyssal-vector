import React, { useState } from 'react';
import { Anchor, Cpu, Factory, Ship, Shield, Sun, Zap } from 'lucide-react';
import {
  EngineeringUpgrades,
  InfrastructureCounts,
  PassingVessel,
} from '../game/types';
import {
  getMaxCrushDepthMeters,
  getSonarPingRadius,
  getUpgradeCost,
  INFRASTRUCTURE_COSTS,
} from '../game/rules';

interface FleetEconomyDeckProps {
  credits: number;
  distilledH2O: number;
  rareNodules: number;
  batteryCells: number;
  infrastructure: InfrastructureCounts;
  upgrades: EngineeringUpgrades;
  vessels: PassingVessel[];
  onBuildInfrastructure: (key: keyof InfrastructureCounts) => void;
  onExecuteTrade: (vessel: PassingVessel) => void;
  onPurchaseUpgrade: (key: keyof EngineeringUpgrades) => void;
  expanded?: boolean;
}

export const FleetEconomyDeck: React.FC<FleetEconomyDeckProps> = ({
  credits,
  distilledH2O,
  rareNodules,
  batteryCells,
  infrastructure,
  upgrades,
  vessels,
  onBuildInfrastructure,
  onExecuteTrade,
  onPurchaseUpgrade,
  expanded = false,
}) => {
  const [activeTab, setActiveTab] = useState<'INFRA' | 'TRADE' | 'UPGRADES'>('INFRA');

  const hullCost = getUpgradeCost('hullTier', upgrades.hullTier);
  const capCost = getUpgradeCost('capacitorTier', upgrades.capacitorTier);
  const sonarCost = getUpgradeCost('sonarTier', upgrades.sonarTier);

  const canFulfillVessel = (v: PassingVessel) => {
    if (v.resourceWanted === 'H2O') return distilledH2O >= v.amountWanted;
    if (v.resourceWanted === 'NODULES') return rareNodules >= v.amountWanted;
    if (v.resourceWanted === 'BATTERY_CELLS') return batteryCells >= v.amountWanted;
    return false;
  };

  return (
    <section
      aria-label="Automated Fleet Economy and Surface Logistics Deck"
      className="bg-[#0B0E17] border border-[#1E2638] flex flex-col h-full overflow-hidden select-none"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1E2638] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#10B981]">
          <Factory className="w-3.5 h-3.5 text-[#FFD700]" />
          <span>SURFACE LOGISTICS &amp; FLEET ECONOMY</span>
        </div>
        <span className="text-[10px] text-[#FFD700] tabular-nums">
          CELL BANK: {batteryCells.toFixed(0)} UNITS
        </span>
      </div>

      {/* Sub-navigation tabs when in compact Unified view */}
      {!expanded && (
        <div className="grid grid-cols-3 border-b border-[#1E2638] bg-[#05070B] text-[10px] font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('INFRA')}
            className={`py-1.5 border-r border-[#1E2638] cursor-pointer transition-colors ${
              activeTab === 'INFRA'
                ? 'bg-[#38BDF8]/15 text-[#38BDF8]'
                : 'text-slate-400 hover:text-[#F8FAFC]'
            }`}
          >
            01 // SURFACE RIGS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TRADE')}
            className={`py-1.5 border-r border-[#1E2638] cursor-pointer transition-colors ${
              activeTab === 'TRADE'
                ? 'bg-[#10B981]/15 text-[#10B981]'
                : 'text-slate-400 hover:text-[#F8FAFC]'
            }`}
          >
            02 // SHIP TRADE
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('UPGRADES')}
            className={`py-1.5 cursor-pointer transition-colors ${
              activeTab === 'UPGRADES'
                ? 'bg-[#FFD700]/15 text-[#FFD700]'
                : 'text-slate-400 hover:text-[#F8FAFC]'
            }`}
          >
            03 // ENGINEERING
          </button>
        </div>
      )}

      {/* Content Area */}
      <div
        className={`flex-1 overflow-y-auto p-2.5 ${
          expanded ? 'grid grid-cols-1 lg:grid-cols-3 gap-3' : 'space-y-2.5'
        }`}
      >
        {/* 1. SURFACE INFRASTRUCTURE BUILDER */}
        {(expanded || activeTab === 'INFRA') && (
          <div className="space-y-2">
            {expanded && (
              <div className="text-xs font-bold text-[#38BDF8] border-b border-[#1E2638] pb-1">
                01 // SURFACE INFRASTRUCTURE BUILDER
              </div>
            )}

            {/* Solar Panel Barge */}
            <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#FFD700] flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5" />
                  SOLAR PANEL BARGE
                </span>
                <span className="text-[#F8FAFC] tabular-nums" data-testid="solar-barge-count">
                  ACTIVE: {infrastructure.solarBarges}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Generates +45 kW surface power during daylight cycle &amp; charges battery cells.
              </p>
              <button
                type="button"
                disabled={credits < INFRASTRUCTURE_COSTS.solarBarges}
                onClick={() => onBuildInfrastructure('solarBarges')}
                data-testid="buy-solar-barge-btn"
                className={`w-full py-1 px-2 text-[10px] font-bold border transition-colors cursor-pointer ${
                  credits >= INFRASTRUCTURE_COSTS.solarBarges
                    ? 'bg-[#FFD700]/15 border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700] hover:text-[#05070B]'
                    : 'bg-[#0B0E17] border-[#1E2638] text-slate-500 cursor-not-allowed'
                }`}
              >
                [BUILD SOLAR PANEL BARGE // {INFRASTRUCTURE_COSTS.solarBarges} CR]
              </button>
            </div>

            {/* Battery Relay Drone */}
            <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#10B981] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  BATTERY RELAY DRONE
                </span>
                <span className="text-[#F8FAFC] tabular-nums" data-testid="relay-drone-count">
                  ACTIVE: {infrastructure.relayDrones}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Automatically ferries charge from surface barges down to active submersibles.
              </p>
              <button
                type="button"
                disabled={credits < INFRASTRUCTURE_COSTS.relayDrones}
                onClick={() => onBuildInfrastructure('relayDrones')}
                data-testid="buy-relay-drone-btn"
                className={`w-full py-1 px-2 text-[10px] font-bold border transition-colors cursor-pointer ${
                  credits >= INFRASTRUCTURE_COSTS.relayDrones
                    ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981] hover:bg-[#10B981] hover:text-[#05070B]'
                    : 'bg-[#0B0E17] border-[#1E2638] text-slate-500 cursor-not-allowed'
                }`}
              >
                [DEPLOY BATTERY RELAY DRONE // {INFRASTRUCTURE_COSTS.relayDrones} CR]
              </button>
            </div>

            {/* Desalination & Distillation Rig */}
            <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#38BDF8] flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5" />
                  DESALINATION &amp; DISTILLATION RIG
                </span>
                <span className="text-[#F8FAFC] tabular-nums">
                  ACTIVE: {infrastructure.distillationRigs}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Converts seawater into pure H2O (+15 L/s) &amp; electrolysis O2/H2 fuel for trade.
              </p>
              <button
                type="button"
                disabled={credits < INFRASTRUCTURE_COSTS.distillationRigs}
                onClick={() => onBuildInfrastructure('distillationRigs')}
                className={`w-full py-1 px-2 text-[10px] font-bold border transition-colors cursor-pointer ${
                  credits >= INFRASTRUCTURE_COSTS.distillationRigs
                    ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#38BDF8] hover:bg-[#38BDF8] hover:text-[#05070B]'
                    : 'bg-[#0B0E17] border-[#1E2638] text-slate-500 cursor-not-allowed'
                }`}
              >
                [BUILD DISTILLATION RIG // {INFRASTRUCTURE_COSTS.distillationRigs.toLocaleString()} CR]
              </button>
            </div>

            {/* Autonomous Seabed Harvester */}
            <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#FFD700] flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  AUTONOMOUS SEABED HARVESTER
                </span>
                <span className="text-[#F8FAFC] tabular-nums">
                  ACTIVE: {infrastructure.seabedHarvesters}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Passively mines discovered polymetallic nodule nodes (+25 CR/s &amp; +0.5t/s).
              </p>
              <button
                type="button"
                disabled={credits < INFRASTRUCTURE_COSTS.seabedHarvesters}
                onClick={() => onBuildInfrastructure('seabedHarvesters')}
                className={`w-full py-1 px-2 text-[10px] font-bold border transition-colors cursor-pointer ${
                  credits >= INFRASTRUCTURE_COSTS.seabedHarvesters
                    ? 'bg-[#FFD700]/15 border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700] hover:text-[#05070B]'
                    : 'bg-[#0B0E17] border-[#1E2638] text-slate-500 cursor-not-allowed'
                }`}
              >
                [DEPLOY SEABED HARVESTER // {INFRASTRUCTURE_COSTS.seabedHarvesters.toLocaleString()} CR]
              </button>
            </div>
          </div>
        )}

        {/* 2. PASSING VESSEL TRADE & CONTRACT EXCHANGE */}
        {(expanded || activeTab === 'TRADE') && (
          <div className="space-y-2">
            {expanded && (
              <div className="text-xs font-bold text-[#10B981] border-b border-[#1E2638] pb-1">
                02 // PASSING VESSEL TRADE &amp; CONTRACT EXCHANGE
              </div>
            )}

            {vessels.map((vessel) => {
              const ready = canFulfillVessel(vessel);
              return (
                <div
                  key={vessel.id}
                  className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F8FAFC] flex items-center gap-1.5">
                      <Ship className="w-3.5 h-3.5 text-[#38BDF8]" />
                      {vessel.name}
                    </span>
                    <span className="text-[10px] text-[#38BDF8] tabular-nums">
                      RNG: {vessel.distanceKm.toFixed(1)} km
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>CLASS: {vessel.vesselClass}</span>
                    <span className="text-[#10B981] font-bold">
                      PAYOUT: +{vessel.creditPayout.toLocaleString()} CR
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-300 bg-[#0B0E17] px-2 py-1 border border-[#1E2638] tabular-nums">
                    CONTRACT REQUIRES:{' '}
                    <strong className="text-[#FFD700]">
                      {vessel.amountWanted}{' '}
                      {vessel.resourceWanted === 'H2O'
                        ? 'L DISTILLED H2O'
                        : vessel.resourceWanted === 'NODULES'
                        ? 'Tons RARE NODULES'
                        : 'BATTERY CELLS'}
                    </strong>
                  </div>

                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => onExecuteTrade(vessel)}
                    data-testid={`trade-${vessel.id}-btn`}
                    className={`w-full py-1 px-2 text-[10px] font-bold border transition-colors cursor-pointer ${
                      ready
                        ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981] hover:bg-[#10B981] hover:text-[#05070B]'
                        : 'bg-[#0B0E17] border-[#1E2638] text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {ready
                      ? `[FULFILL CONTRACT // +${vessel.creditPayout.toLocaleString()} CR]`
                      : `[INSUFFICIENT ${vessel.resourceWanted} STOCK]`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. SUBMERSIBLE ENGINEERING & HULL UPGRADES */}
        {(expanded || activeTab === 'UPGRADES') && (
          <div className="space-y-2">
            {expanded && (
              <div className="text-xs font-bold text-[#FFD700] border-b border-[#1E2638] pb-1">
                03 // SUBMERSIBLE ENGINEERING &amp; HULL UPGRADES
              </div>
            )}

            {/* Titanium Hull Reinforcement */}
            <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#FFD700] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  TITANIUM HULL REINFORCEMENT
                </span>
                <span className="text-[#38BDF8] tabular-nums" data-testid="hull-tier-readout">
                  TIER {upgrades.hullTier}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Increases Crush Depth limit by +1,500m per tier (Current:{' '}
                {getMaxCrushDepthMeters(upgrades.hullTier).toLocaleString()}m &rarr; Next:{' '}
                {getMaxCrushDepthMeters(upgrades.hullTier + 1).toLocaleString()}m).
              </p>
              <button
                type="button"
                disabled={credits < hullCost}
                onClick={() => onPurchaseUpgrade('hullTier')}
                data-testid="upgrade-hull-btn"
                className={`w-full py-1 px-2 text-[10px] font-bold border transition-colors cursor-pointer ${
                  credits >= hullCost
                    ? 'bg-[#FFD700]/15 border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700] hover:text-[#05070B]'
                    : 'bg-[#0B0E17] border-[#1E2638] text-slate-500 cursor-not-allowed'
                }`}
              >
                [UPGRADE TITANIUM HULL // {hullCost.toLocaleString()} CR]
              </button>
            </div>

            {/* Solid-State Capacitor Bank */}
            <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#10B981] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  SOLID-STATE CAPACITOR BANK
                </span>
                <span className="text-[#38BDF8] tabular-nums">
                  TIER {upgrades.capacitorTier}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Increases max battery capacity, recharges +25% immediately, and cuts thruster drain by 18%.
              </p>
              <button
                type="button"
                disabled={credits < capCost}
                onClick={() => onPurchaseUpgrade('capacitorTier')}
                data-testid="upgrade-capacitor-btn"
                className={`w-full py-1 px-2 text-[10px] font-bold border transition-colors cursor-pointer ${
                  credits >= capCost
                    ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981] hover:bg-[#10B981] hover:text-[#05070B]'
                    : 'bg-[#0B0E17] border-[#1E2638] text-slate-500 cursor-not-allowed'
                }`}
              >
                [UPGRADE CAPACITOR BANK // {capCost.toLocaleString()} CR]
              </button>
            </div>

            {/* Wide-Spectrum Phased Sonar */}
            <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#38BDF8] flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  WIDE-SPECTRUM PHASED SONAR
                </span>
                <span className="text-[#38BDF8] tabular-nums">
                  TIER {upgrades.sonarTier}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Expands active 3D sonar ping radius ({getSonarPingRadius(upgrades.sonarTier) * 8}m &rarr;{' '}
                {getSonarPingRadius(upgrades.sonarTier + 1) * 8}m) and deep-trench scan resolution.
              </p>
              <button
                type="button"
                disabled={credits < sonarCost}
                onClick={() => onPurchaseUpgrade('sonarTier')}
                data-testid="upgrade-sonar-btn"
                className={`w-full py-1 px-2 text-[10px] font-bold border transition-colors cursor-pointer ${
                  credits >= sonarCost
                    ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#38BDF8] hover:bg-[#38BDF8] hover:text-[#05070B]'
                    : 'bg-[#0B0E17] border-[#1E2638] text-slate-500 cursor-not-allowed'
                }`}
              >
                [UPGRADE PHASED SONAR // {sonarCost.toLocaleString()} CR]
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
