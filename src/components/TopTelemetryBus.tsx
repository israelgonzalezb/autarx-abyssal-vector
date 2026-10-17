import React from 'react';
import { Volume2, VolumeX, HelpCircle, Users, Layers } from 'lucide-react';
import { WorkspaceMode } from '../game/types';
import { formatAsciiBar } from '../game/rules';

interface TopTelemetryBusProps {
  credits: number;
  creditRatePerSec: number;
  solarKw: number;
  solarEfficiency: number;
  distilledH2O: number;
  rareNodules: number;
  workspaceMode: WorkspaceMode;
  onSelectWorkspaceMode: (mode: WorkspaceMode) => void;
  simulateCoopCrew: boolean;
  onToggleSimulateCoop: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onOpenBriefingModal: () => void;
}

const WORKSPACE_TABS: Array<{ mode: WorkspaceMode; label: string; shortLabel: string }> = [
  { mode: 'UNIFIED', label: '[00 // UNIFIED COMMAND DECK]', shortLabel: '00 // UNIFIED' },
  { mode: 'HELM_3D', label: '[01 // HELM & 3D SONAR PILOT]', shortLabel: '01 // 3D HELM' },
  { mode: 'TACTICAL_MAP', label: '[02 // BATHYMETRIC TACTICAL MAP]', shortLabel: '02 // MAP' },
  { mode: 'FLEET_ECONOMY', label: '[03 // SURFACE BARGES & FLEET ECONOMY]', shortLabel: '03 // ECONOMY' },
];

export const TopTelemetryBus: React.FC<TopTelemetryBusProps> = ({
  credits,
  creditRatePerSec,
  solarKw,
  solarEfficiency,
  distilledH2O,
  rareNodules,
  workspaceMode,
  onSelectWorkspaceMode,
  simulateCoopCrew,
  onToggleSimulateCoop,
  muted,
  onToggleMute,
  onOpenBriefingModal,
}) => {
  const solarBar = formatAsciiBar(solarEfficiency, 10);

  return (
    <header className="w-full bg-[#0B0E17] border-b border-[#1E2638] shrink-0 select-none z-20">
      {/* Row 1: Primary Telemetry & Co-Op Crew Bus */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-[#1E2638] text-[11px] leading-tight">
        {/* Left: Sector Identification */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-block w-2 h-2 bg-[#FFD700]" aria-hidden="true" />
          <span className="font-bold tracking-wider text-[#F8FAFC]">
            AUTARX // ABYSSAL_VECTOR
          </span>
          <span className="hidden xl:inline text-[#38BDF8]">
            // SECTOR: MARIANA_HADAL_09 (11°21&apos;N 142°12&apos;E)
          </span>
        </div>

        {/* Center: Economic & Power Bus */}
        <div
          className="flex flex-wrap items-center gap-3 md:gap-4 tabular-nums"
          data-testid="telemetry-economic-bus"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">CREDITS:</span>
            <span className="font-bold text-[#10B981]" data-testid="credits-readout">
              {credits.toLocaleString()} CR
            </span>
            <span className="text-[#10B981] text-[10px]">
              (+{creditRatePerSec}/s)
            </span>
          </div>

          <span className="text-[#1E2638] hidden sm:inline">//</span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">SOLAR GENERATION:</span>
            <span className="font-bold text-[#FFD700]" data-testid="solar-readout">
              {solarKw} kW
            </span>
            <span className="text-[#FFD700] hidden md:inline">{solarBar}</span>
          </div>

          <span className="text-[#1E2638] hidden sm:inline">//</span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">DISTILLED H2O:</span>
            <span className="font-bold text-[#38BDF8]" data-testid="h2o-readout">
              {distilledH2O.toLocaleString()} L
            </span>
          </div>

          <span className="text-[#1E2638] hidden sm:inline">//</span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">RARE NODULES:</span>
            <span className="font-bold text-[#FFD700]" data-testid="nodules-readout">
              {rareNodules.toFixed(1)} Tons
            </span>
          </div>
        </div>

        {/* Right: Multiplayer Co-Op Crew Status & Simulation Switch */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 text-[10px]">
            <Users className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span className="px-1.5 py-0.5 bg-[#05070B] border border-[#1E2638] text-[#FFD700]">
              [IZZY :: HELM]
            </span>
            <span className="px-1.5 py-0.5 bg-[#05070B] border border-[#1E2638] text-[#10B981]">
              [LUCAS :: LOGISTICS]
            </span>
            <span className="px-1.5 py-0.5 bg-[#05070B] border border-[#1E2638] text-[#38BDF8]">
              [AUTARX_BOT :: SONAR]
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleSimulateCoop}
            aria-pressed={simulateCoopCrew}
            className={`px-2 py-1 text-[10px] font-semibold tracking-wide border transition-colors cursor-pointer whitespace-nowrap ${
              simulateCoopCrew
                ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                : 'bg-[#05070B] border-[#1E2638] text-slate-400 hover:text-[#F8FAFC]'
            }`}
          >
            [SIMULATE CO-OP CREW ACTIONS: {simulateCoopCrew ? 'ON' : 'OFF'}]
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute Audio Telemetry' : 'Mute Audio Telemetry'}
            className="p-1 bg-[#05070B] border border-[#1E2638] text-slate-300 hover:text-[#38BDF8] hover:border-[#38BDF8] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-[#F43F5E]" /> : <Volume2 className="w-3.5 h-3.5 text-[#38BDF8]" />}
          </button>

          <button
            type="button"
            onClick={onOpenBriefingModal}
            aria-label="Open Mission Briefing and Controls"
            className="px-2 py-1 bg-[#05070B] border border-[#1E2638] text-[10px] text-[#38BDF8] hover:bg-[#38BDF8]/15 transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
          >
            <HelpCircle className="w-3 h-3" />
            <span className="hidden sm:inline">BRIEFING</span>
          </button>
        </div>
      </div>

      {/* Row 2: Crew Role / Workspace Mode Switcher */}
      <nav
        aria-label="Crew Station Workspace Modes"
        className="flex items-center justify-between gap-2 px-3 py-1 bg-[#05070B] text-[11px] overflow-x-auto"
      >
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-slate-400 mr-1 flex items-center gap-1 shrink-0">
            <Layers className="w-3 h-3 text-[#38BDF8]" />
            STATION DECK:
          </span>
          {WORKSPACE_TABS.map((tab) => {
            const active = workspaceMode === tab.mode;
            return (
              <button
                key={tab.mode}
                type="button"
                onClick={() => onSelectWorkspaceMode(tab.mode)}
                aria-current={active ? 'page' : undefined}
                className={`px-2 py-0.5 text-[10px] font-semibold tracking-wide border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#F8FAFC]'
                    : 'bg-[#0B0E17] border-[#1E2638] text-slate-400 hover:text-[#F8FAFC] hover:border-slate-600'
                }`}
              >
                <span className="hidden lg:inline">{tab.label}</span>
                <span className="lg:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden xl:flex items-center gap-2 text-[10px] text-slate-400 whitespace-nowrap shrink-0">
          <span>PILOT: [WASD]</span>
          <span>//</span>
          <span>DEPTH: [Q/E]</span>
          <span>//</span>
          <span className="text-[#38BDF8]">SONAR: [SPACE]</span>
        </div>
      </nav>
    </header>
  );
};
