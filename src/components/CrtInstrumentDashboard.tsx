import React from 'react';
import { AlertTriangle, BatteryCharging, Compass, Crosshair, Lightbulb, Radio, ArrowUpCircle } from 'lucide-react';
import { AbyssalNode, SubmersibleTelemetry } from '../game/types';
import {
  calculatePressureMPa,
  formatAsciiBar,
  isHullIntegrityWarning,
} from '../game/rules';

interface CrtInstrumentDashboardProps {
  telemetry: SubmersibleTelemetry;
  maxCrushDepth: number;
  nearestNode: AbyssalNode | null;
  nearestNodeDistanceMeters: number;
  onToggleFloodlights: () => void;
  onPingSonar: () => void;
  onExtractSample: (node: AbyssalNode) => void;
  onEmergencyAscend: () => void;
}

export const CrtInstrumentDashboard: React.FC<CrtInstrumentDashboardProps> = ({
  telemetry,
  maxCrushDepth,
  nearestNode,
  nearestNodeDistanceMeters,
  onToggleFloodlights,
  onPingSonar,
  onExtractSample,
  onEmergencyAscend,
}) => {
  const pressureMPa = calculatePressureMPa(telemetry.depthMeters);
  const hullWarning = isHullIntegrityWarning(telemetry.depthMeters, maxCrushDepth);
  const depthRatio = Math.min(1, Math.max(0, Math.abs(telemetry.depthMeters) / Math.abs(maxCrushDepth)));
  const batteryBar = formatAsciiBar(telemetry.batteryPercent / 100, 10);

  const headingDeg = ((Math.round((telemetry.headingRad * 180) / Math.PI) % 360) + 360) % 360;
  const canExtract = nearestNode !== null && nearestNodeDistanceMeters <= 120;

  return (
    <section
      aria-label="Retro CRT Submarine Instrument Dashboard"
      className="bg-[#0B0E17] border-t border-[#1E2638] p-2.5 select-none crt-scanlines shrink-0"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {/* 1. Hydrostatic Depth & Crush Gauge */}
        <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#1E2638] pb-1 mb-1.5">
            <span className="text-[10px] font-bold tracking-wider text-[#38BDF8]">
              01 // HYDROSTATIC DEPTH &amp; CRUSH GAUGE
            </span>
            <span className="text-[10px] font-semibold text-[#FFD700] tabular-nums">
              {pressureMPa.toFixed(1)} MPa
            </span>
          </div>

          <div className="flex items-center gap-3 my-1">
            {/* Vertical Depth Column Indicator */}
            <div className="w-4 h-16 bg-[#0B0E17] border border-[#1E2638] relative flex flex-col justify-end overflow-hidden shrink-0">
              <div
                className={`w-full transition-all duration-150 ${
                  hullWarning ? 'bg-[#F43F5E]' : 'bg-[#38BDF8]'
                }`}
                style={{ height: `${Math.round(depthRatio * 100)}%` }}
              />
              {/* Crush limit marker line */}
              <div className="absolute bottom-1 left-0 right-0 border-t border-dashed border-[#F43F5E]" />
            </div>

            <div className="flex-1 min-w-0 tabular-nums">
              <div className="text-xs font-bold text-[#F8FAFC]" data-testid="depth-readout">
                DEPTH: {telemetry.depthMeters.toLocaleString()}m{' '}
                <span className="text-slate-400 font-normal">
                  / MAX HULL: {maxCrushDepth.toLocaleString()}m
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                AMBIENT PRESSURE: <span className="text-[#F8FAFC]">{pressureMPa} MPa</span>
              </div>

              {hullWarning ? (
                <div
                  role="alert"
                  className="mt-1.5 px-1.5 py-0.5 bg-[#F43F5E]/20 border border-[#F43F5E] text-[#F43F5E] text-[10px] font-bold flex items-center justify-between gap-1"
                >
                  <span className="flex items-center gap-1 truncate">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    [! HULL INTEGRITY WARNING !]
                  </span>
                  <button
                    type="button"
                    onClick={onEmergencyAscend}
                    className="px-1.5 py-0.5 bg-[#F43F5E] text-[#05070B] font-bold text-[9px] hover:bg-[#F8FAFC] cursor-pointer shrink-0"
                  >
                    BLOW BALLAST
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#10B981]">
                  <span>HULL STRESS: {(depthRatio * 100).toFixed(0)}% NOMINAL</span>
                  <button
                    type="button"
                    onClick={onEmergencyAscend}
                    className="px-1.5 py-0.5 bg-[#0B0E17] border border-[#1E2638] text-slate-300 hover:border-[#38BDF8] hover:text-[#38BDF8] text-[9px] flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowUpCircle className="w-2.5 h-2.5" />
                    TRIM +400m
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Battery & Capacitor Telemetry */}
        <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#1E2638] pb-1 mb-1.5">
            <span className="text-[10px] font-bold tracking-wider text-[#38BDF8] flex items-center gap-1">
              <BatteryCharging className="w-3 h-3 text-[#FFD700]" />
              02 // CAPACITOR &amp; POWER BUS
            </span>
            <span
              className={`text-[10px] font-bold tabular-nums ${
                telemetry.batteryDrainRate >= 0 ? 'text-[#10B981]' : 'text-[#FFD700]'
              }`}
            >
              {telemetry.batteryDrainRate >= 0
                ? `RECHARGE: +${telemetry.batteryDrainRate.toFixed(2)}%/s`
                : `DRAIN: ${telemetry.batteryDrainRate.toFixed(2)}%/s`}
            </span>
          </div>

          <div className="text-xs font-bold text-[#F8FAFC] tabular-nums" data-testid="battery-readout">
            BATTERY: {telemetry.batteryPercent.toFixed(1)}%{' '}
            <span className="text-[#10B981]">{batteryBar}</span>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-2 text-[10px]">
            <button
              type="button"
              onClick={onToggleFloodlights}
              aria-pressed={telemetry.floodlightsOn}
              className={`px-1.5 py-1 border font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                telemetry.floodlightsOn
                  ? 'bg-[#FFD700]/15 border-[#FFD700] text-[#FFD700]'
                  : 'bg-[#0B0E17] border-[#1E2638] text-slate-400'
              }`}
            >
              <Lightbulb className="w-3 h-3 shrink-0" />
              <span>LIGHTS:{telemetry.floodlightsOn ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onPingSonar}
              className="px-1.5 py-1 bg-[#38BDF8]/15 border border-[#38BDF8] text-[#38BDF8] hover:bg-[#38BDF8]/25 font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Radio className="w-3 h-3 shrink-0" />
              <span>SONAR</span>
            </button>

            <div className="px-1.5 py-1 bg-[#0B0E17] border border-[#1E2638] text-slate-300 flex items-center justify-center tabular-nums whitespace-nowrap">
              {telemetry.speedKnots.toFixed(1)} kt
            </div>
          </div>
        </div>

        {/* 3. Artificial Horizon / Pitch & Roll Gyro */}
        <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#1E2638] pb-1 mb-1.5">
            <span className="text-[10px] font-bold tracking-wider text-[#38BDF8] flex items-center gap-1">
              <Compass className="w-3 h-3" />
              03 // ARTIFICIAL HORIZON &amp; GYRO
            </span>
            <span className="text-[10px] text-[#FFD700] tabular-nums">
              HDG: {String(headingDeg).padStart(3, '0')}°
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Dynamic SVG Artificial Horizon & Heading Indicator */}
            <div className="w-16 h-16 bg-[#0B0E17] border border-[#1E2638] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 64 64" className="w-14 h-14">
                <circle cx="32" cy="32" r="28" fill="#05070B" stroke="#1E2638" strokeWidth="1.5" />
                <g
                  transform={`rotate(${telemetry.rollDeg.toFixed(1)} 32 32) translate(0 ${Math.max(
                    -10,
                    Math.min(10, telemetry.pitchDeg * 0.4)
                  )})`}
                >
                  <line x1="8" y1="32" x2="56" y2="32" stroke="#38BDF8" strokeWidth="1.5" />
                  <line x1="20" y1="24" x2="44" y2="24" stroke="#10B981" strokeWidth="1" strokeDasharray="2 2" />
                  <line x1="20" y1="40" x2="44" y2="40" stroke="#10B981" strokeWidth="1" strokeDasharray="2 2" />
                </g>
                {/* Heading needle */}
                <g transform={`rotate(${headingDeg} 32 32)`}>
                  <polygon points="32,6 29,14 35,14" fill="#FFD700" />
                </g>
                {/* Fixed center reticle */}
                <circle cx="32" cy="32" r="2.5" fill="#FFD700" />
              </svg>
            </div>

            <div className="flex-1 text-[11px] space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-400">PITCH ANGLE:</span>
                <span className="text-[#F8FAFC] font-semibold">{telemetry.pitchDeg.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ROLL TRIM:</span>
                <span className="text-[#F8FAFC] font-semibold">{telemetry.rollDeg.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">GRID COORD:</span>
                <span className="text-[#38BDF8] font-semibold">
                  X:{telemetry.x.toFixed(0)} Z:{telemetry.z.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Downward Optical / Thermal Camera Feed */}
        <div className="bg-[#05070B] border border-[#1E2638] p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#1E2638] pb-1 mb-1.5">
            <span className="text-[10px] font-bold tracking-wider text-[#38BDF8] flex items-center gap-1">
              <Crosshair className="w-3 h-3 text-[#F43F5E]" />
              04 // DOWNWARD OPTICAL / THERMAL FEED
            </span>
            <span
              className={`text-[10px] font-bold tabular-nums ${
                canExtract ? 'text-[#10B981]' : 'text-slate-400'
              }`}
            >
              RNG: {nearestNode ? `${nearestNodeDistanceMeters}m` : '---'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Compact Stylized Thermal/Optical Mini-Monitor */}
            <div className="w-16 h-16 bg-[#0B0E17] border border-[#1E2638] relative flex items-center justify-center shrink-0 overflow-hidden">
              <svg viewBox="0 0 64 64" className="w-full h-full">
                <line x1="0" y1="32" x2="64" y2="32" stroke="#1E2638" strokeWidth="1" />
                <line x1="32" y1="0" x2="32" y2="64" stroke="#1E2638" strokeWidth="1" />
                <circle cx="32" cy="32" r="22" fill="none" stroke="#1E2638" strokeDasharray="3 2" />
                {nearestNode && (
                  <circle
                    cx={Math.max(10, Math.min(54, 32 + (nearestNode.x - telemetry.x) * 0.45))}
                    cy={Math.max(10, Math.min(54, 32 + (nearestNode.z - telemetry.z) * 0.45))}
                    r={canExtract ? 6 : 3.5}
                    fill={nearestNode.type === 'VENT' ? '#F43F5E' : '#FFD700'}
                  />
                )}
              </svg>
              <span className="absolute bottom-0.5 left-1 text-[8px] text-[#38BDF8]">IR-CAM</span>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between h-16">
              <div>
                <div className="text-[11px] font-bold text-[#F8FAFC] truncate">
                  {nearestNode
                    ? `${nearestNode.code} (${nearestNode.type})`
                    : 'NO TARGET LOCK'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {nearestNode
                    ? `${nearestNode.name} // ${
                        nearestNode.discovered ? 'LOCKED' : 'PING TO SCAN'
                      }`
                    : 'Sweep sector with Sonar'}
                </div>
              </div>

              <button
                type="button"
                disabled={!nearestNode || ! canExtract}
                onClick={() => nearestNode && onExtractSample(nearestNode)}
                data-testid="extract-sample-btn"
                className={`w-full px-2 py-1 text-[10px] font-bold border transition-colors whitespace-nowrap truncate ${
                  nearestNode && canExtract
                    ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981] hover:bg-[#10B981] hover:text-[#05070B] cursor-pointer'
                    : 'bg-[#0B0E17] border-[#1E2638] text-slate-500 cursor-not-allowed'
                }`}
              >
                {nearestNode && canExtract
                  ? `[EXTRACT SAMPLE (+${nearestNode.creditValue} CR)]`
                  : `[APPROACH <120m TO EXTRACT (+450 CR)]`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
