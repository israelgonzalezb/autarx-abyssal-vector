import React from 'react';
import { Compass, MapPin, Navigation, Send, Radar } from 'lucide-react';
import {
  AbyssalNode,
  InfrastructureCounts,
  ScoutDrone,
  SubmersibleTelemetry,
  Waypoint,
} from '../game/types';
import { getSeafloorDepthMeters } from '../game/rules';

interface BathymetricTacticalMapProps {
  telemetry: SubmersibleTelemetry;
  nodes: AbyssalNode[];
  scoutDrones: ScoutDrone[];
  infrastructure: InfrastructureCounts;
  waypoint: Waypoint;
  sonarRadius: number;
  onSetWaypoint: (x: number, z: number) => void;
  onToggleAutopilot: () => void;
  onDispatchScoutDrone: () => void;
  expanded?: boolean;
}

export const BathymetricTacticalMap: React.FC<BathymetricTacticalMapProps> = ({
  telemetry,
  nodes,
  scoutDrones,
  infrastructure,
  waypoint,
  sonarRadius,
  onSetWaypoint,
  onToggleAutopilot,
  onDispatchScoutDrone,
  expanded = false,
}) => {
  // Map coordinate space: -110 to +110 mapped to SVG 0..300
  const worldToSvg = (val: number) => ((val + 110) / 220) * 300;
  const svgToWorld = (svgVal: number) => (svgVal / 300) * 220 - 110;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const relX = ((e.clientX - rect.left) / rect.width) * 300;
    const relY = ((e.clientY - rect.top) / rect.height) * 300;
    const wx = Math.round(svgToWorld(relX));
    const wz = Math.round(svgToWorld(relY));
    onSetWaypoint(wx, wz);
  };

  const subSvgX = worldToSvg(telemetry.x);
  const subSvgY = worldToSvg(telemetry.z);
  const wpSvgX = worldToSvg(waypoint.x);
  const wpSvgY = worldToSvg(waypoint.z);
  const sonarSvgRadius = (sonarRadius / 220) * 300;

  const headingDirX = -Math.sin(telemetry.headingRad) * 18;
  const headingDirY = -Math.cos(telemetry.headingRad) * 18;

  return (
    <section
      aria-label="Bathymetric Tactical Map"
      className="bg-[#0B0E17] border border-[#1E2638] flex flex-col h-full overflow-hidden select-none"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1E2638] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#38BDF8]">
          <Compass className="w-3.5 h-3.5 text-[#FFD700]" />
          <span>BATHYMETRIC TACTICAL MAP // SECTOR 09</span>
        </div>
        <span className="text-[10px] text-slate-400 tabular-nums">
          NODES: {nodes.filter((n) => n.discovered).length}/{nodes.length} LOCKED
        </span>
      </div>

      {/* Interactive 2D Bathymetric Contour SVG */}
      <div className="relative flex-1 min-h-[210px] bg-[#05070B] flex items-center justify-center p-2 overflow-hidden">
        <svg
          viewBox="0 0 300 300"
          onClick={handleSvgClick}
          data-testid="bathymetric-map-svg"
          className={`w-full h-full ${
            expanded ? 'max-h-[540px]' : 'max-h-[300px]'
          } border border-[#1E2638] bg-[#05070B] cursor-crosshair`}
        >
          {/* Grid Lines */}
          {[50, 100, 150, 200, 250].map((pos) => (
            <React.Fragment key={pos}>
              <line x1={pos} y1="0" x2={pos} y2="300" stroke="#1E2638" strokeWidth="0.6" />
              <line x1="0" y1={pos} x2="300" y2={pos} stroke="#1E2638" strokeWidth="0.6" />
            </React.Fragment>
          ))}

          {/* Bathymetric Elevation Contour Rings (Mariana Hadal Trough) */}
          <ellipse
            cx="150"
            cy="150"
            rx="132"
            ry="88"
            transform="rotate(10 150 150)"
            fill="none"
            stroke="#1E2638"
            strokeWidth="1.2"
            strokeDasharray="4 2"
          />
          <ellipse
            cx="150"
            cy="150"
            rx="105"
            ry="62"
            transform="rotate(10 150 150)"
            fill="rgba(56, 189, 248, 0.03)"
            stroke="#38BDF8"
            strokeOpacity="0.28"
            strokeWidth="1"
          />
          <ellipse
            cx="150"
            cy="150"
            rx="76"
            ry="36"
            transform="rotate(10 150 150)"
            fill="rgba(56, 189, 248, 0.06)"
            stroke="#38BDF8"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
          <text x="16" y="22" fill="#38BDF8" fontSize="8" opacity="0.7">
            HADAL TROUGH AXIS (-6,200m)
          </text>

          {/* Surface Solar Barges Indicator Strip */}
          {Array.from({ length: Math.min(infrastructure.solarBarges, 8) }).map((_, i) => {
            const bx = worldToSvg((i - 3.5) * 20);
            const bz = worldToSvg((i % 2 === 0 ? -1 : 1) * 20);
            return (
              <rect
                key={`barge-${i}`}
                x={bx - 3}
                y={bz - 3}
                width="6"
                height="6"
                fill="none"
                stroke="#FFD700"
                strokeWidth="1"
                opacity="0.65"
              />
            );
          })}

          {/* Autonomous Scout Drones & Vector Paths */}
          {scoutDrones.map((drone) => {
            const dx = worldToSvg(drone.x);
            const dy = worldToSvg(drone.z);
            const tx = worldToSvg(drone.targetX);
            const ty = worldToSvg(drone.targetZ);
            return (
              <g key={drone.id}>
                <line
                  x1={dx}
                  y1={dy}
                  x2={tx}
                  y2={ty}
                  stroke="#10B981"
                  strokeWidth="0.9"
                  strokeDasharray="2 2"
                  opacity="0.7"
                />
                <polygon
                  points={`${dx},${dy - 4} ${dx - 3.5},${dy + 3} ${dx + 3.5},${dy + 3}`}
                  fill="#10B981"
                />
                <text x={dx + 5} y={dy + 2} fill="#10B981" fontSize="7">
                  {drone.callsign}
                </text>
              </g>
            );
          })}

          {/* Mineral Nodes & Hydrothermal Vents */}
          {nodes.map((node) => {
            const nx = worldToSvg(node.x);
            const ny = worldToSvg(node.z);
            const color = node.type === 'VENT' ? '#F43F5E' : '#FFD700';
            return (
              <g key={node.id}>
                <circle
                  cx={nx}
                  cy={ny}
                  r={node.discovered ? 5 : 3}
                  fill={node.discovered ? color : 'none'}
                  stroke={color}
                  strokeWidth="1.3"
                  opacity={node.discovered ? 1 : 0.45}
                />
                {node.discovered && (
                  <text x={nx + 7} y={ny + 3} fill={color} fontSize="7.5" fontWeight="bold">
                    {node.code}
                  </text>
                )}
              </g>
            );
          })}

          {/* Target Navigation Waypoint (WP-ALPHA) */}
          {waypoint.active && (
            <g>
              <line
                x1={subSvgX}
                y1={subSvgY}
                x2={wpSvgX}
                y2={wpSvgY}
                stroke="#38BDF8"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle
                cx={wpSvgX}
                cy={wpSvgY}
                r="7"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="1.5"
              />
              <line x1={wpSvgX - 10} y1={wpSvgY} x2={wpSvgX + 10} y2={wpSvgY} stroke="#38BDF8" strokeWidth="1" />
              <line x1={wpSvgX} y1={wpSvgY - 10} x2={wpSvgX} y2={wpSvgY + 10} stroke="#38BDF8" strokeWidth="1" />
              <text x={wpSvgX + 9} y={wpSvgY - 5} fill="#38BDF8" fontSize="8" fontWeight="bold">
                {waypoint.label}
              </text>
            </g>
          )}

          {/* DSV-AUTARX-01 Submersible Position, Sonar Ring & Heading Vector */}
          <circle
            cx={subSvgX}
            cy={subSvgY}
            r={sonarSvgRadius}
            fill="rgba(56, 189, 248, 0.05)"
            stroke="#38BDF8"
            strokeWidth="0.8"
            strokeDasharray="3 3"
          />
          <line
            x1={subSvgX}
            y1={subSvgY}
            x2={subSvgX + headingDirX}
            y2={subSvgY + headingDirY}
            stroke="#FFD700"
            strokeWidth="2"
          />
          <circle cx={subSvgX} cy={subSvgY} r="5" fill="#FFD700" stroke="#05070B" strokeWidth="1.5" />
          <text x={subSvgX + 8} y={subSvgY + 12} fill="#FFD700" fontSize="8" fontWeight="bold">
            DSV-01
          </text>
        </svg>
      </div>

      {/* Waypoint & Autonomous Drone Vectoring Controls */}
      <div className="p-2.5 border-t border-[#1E2638] bg-[#05070B] space-y-2 shrink-0">
        <div className="flex items-center justify-between text-[11px] tabular-nums">
          <span className="text-slate-400 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
            BEACON <strong className="text-[#F8FAFC]">{waypoint.label}</strong>:
          </span>
          <span className="text-[#38BDF8] font-bold" data-testid="waypoint-coords">
            X:{waypoint.x.toFixed(0)} // Z:{waypoint.z.toFixed(0)} ({getSeafloorDepthMeters(waypoint.x, waypoint.z)}m)
          </span>
        </div>

        {/* Preset Quick Sector Beacons for deterministic single-click navigation */}
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          {nodes.slice(0, 3).map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSetWaypoint(node.x, node.z)}
              className="px-1.5 py-1 bg-[#0B0E17] border border-[#1E2638] hover:border-[#38BDF8] text-slate-300 hover:text-[#38BDF8] truncate cursor-pointer"
            >
              SET {node.code}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <button
            type="button"
            onClick={onToggleAutopilot}
            aria-pressed={telemetry.autopilotEnabled}
            data-testid="toggle-autopilot-btn"
            className={`px-2 py-1.5 border font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              telemetry.autopilotEnabled
                ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                : 'bg-[#0B0E17] border-[#1E2638] text-[#F8FAFC] hover:border-[#38BDF8]'
            }`}
          >
            <Navigation className="w-3 h-3 shrink-0" />
            <span className="truncate">[AUTOPILOT TO WAYPOINT]</span>
          </button>

          <button
            type="button"
            onClick={onDispatchScoutDrone}
            data-testid="dispatch-scout-btn"
            className="px-2 py-1.5 bg-[#38BDF8]/15 border border-[#38BDF8] text-[#38BDF8] hover:bg-[#38BDF8] hover:text-[#05070B] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <Send className="w-3 h-3 shrink-0" />
            <span className="truncate">[DISPATCH AUTONOMOUS SCOUT DRONE]</span>
          </button>
        </div>

        {expanded && (
          <div className="pt-2 border-t border-[#1E2638] grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
            {nodes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSetWaypoint(n.x, n.z)}
                className="p-2 bg-[#0B0E17] border border-[#1E2638] hover:border-[#FFD700] text-left cursor-pointer"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className={n.type === 'VENT' ? 'text-[#F43F5E]' : 'text-[#FFD700]'}>
                    {n.code}
                  </span>
                  <Radar className="w-3 h-3 text-[#38BDF8]" />
                </div>
                <div className="text-slate-400 truncate mt-0.5">{n.name}</div>
                <div className="text-slate-500 tabular-nums mt-0.5">
                  X:{n.x} Z:{n.z} // {n.depthMeters}m
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
