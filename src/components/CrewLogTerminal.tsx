import React from 'react';
import { Terminal } from 'lucide-react';
import { CrewLogEntry } from '../game/types';

interface CrewLogTerminalProps {
  logs: CrewLogEntry[];
}

export const CrewLogTerminal: React.FC<CrewLogTerminalProps> = ({ logs }) => {
  const getCategoryColor = (cat: CrewLogEntry['category']) => {
    switch (cat) {
      case 'SONAR':
        return 'text-[#38BDF8]';
      case 'ECONOMY':
        return 'text-[#10B981]';
      case 'COOP':
        return 'text-[#FFD700]';
      case 'ALERT':
        return 'text-[#F43F5E]';
      default:
        return 'text-[#F8FAFC]';
    }
  };

  return (
    <footer
      aria-label="AUTARX_NET Crew Comms Log"
      className="w-full bg-[#0B0E17] border-t border-[#1E2638] px-3 py-1.5 shrink-0 select-none z-20"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 shrink-0">
          <Terminal className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span className="font-bold text-[#38BDF8] tracking-wider">
            [AUTARX_NET // CREW_LOG]
          </span>
          <span className="text-slate-500 hidden sm:inline">//</span>
        </div>

        <div
          className="flex-1 overflow-x-auto flex items-center gap-4 tabular-nums"
          data-testid="crew-log-ticker"
        >
          {logs.slice(0, 3).map((entry) => (
            <div key={entry.id} className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <span className="text-slate-500">[{entry.timestamp}]</span>
              <span className={`font-bold ${getCategoryColor(entry.category)}`}>
                [{entry.actor}]:
              </span>
              <span className="text-slate-300">{entry.message}</span>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
};
