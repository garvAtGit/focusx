'use client';

import { useState } from 'react';
import { ChevronDown, User as UserIcon } from 'lucide-react';

export type LeaderboardEntry = {
  id?: string;
  name: string;
  avatar: string | null;
  minutes: number;
  rank: number;
  isCurrentUser: boolean;
};

interface StudentLeaderboardProps {
  libraryName: string;
  leaderboards: {
    today: LeaderboardEntry[];
    week: LeaderboardEntry[];
    month: LeaderboardEntry[];
  };
}

export function StudentLeaderboard({ libraryName, leaderboards }: StudentLeaderboardProps) {
  const [leaderboardTimeline, setLeaderboardTimeline] = useState<'today' | 'week' | 'month'>('today');
  const currentLeaderboard = leaderboards[leaderboardTimeline] || [];

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
      <div className="flex flex-col gap-5 mb-6 relative z-10">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-medium text-slate-800 tracking-tight">
            Top Scholars
          </h2>
          <div className="flex items-center gap-1 cursor-pointer hover:opacity-80 w-fit">
            <p className="text-[13px] text-slate-500 font-medium">{libraryName}</p>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>
        </div>
        
        {/* Timeline Pills */}
        <div className="flex p-1 bg-slate-50 rounded-xl">
          {(['today', 'week', 'month'] as const).map(t => (
            <button
              key={t}
              onClick={() => setLeaderboardTimeline(t)}
              className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg capitalize transition-colors ${
                leaderboardTimeline === t 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-100' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'today' ? 'Today' : `This ${t}`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        {currentLeaderboard.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">No activity yet.</p>
          </div>
        ) : (
          currentLeaderboard.map((student, i) => {
            const hrs = Math.floor(student.minutes / 60);
            const mins = student.minutes % 60;
            
            const isExtraRow = student.isCurrentUser && student.rank > 5;
            const maxMinutes = currentLeaderboard[0]?.minutes || 1;

            const formatNameWithInitial = (name: string) => {
              const parts = name.trim().split(' ');
              if (parts.length > 1) {
                return `${parts[0]} ${parts[parts.length - 1][0]}.`;
              }
              return name;
            };

            const displayName = student.isCurrentUser 
              ? `${formatNameWithInitial(student.name)} (You)` 
              : formatNameWithInitial(student.name);

            return (
              <div key={`${student.id || i}-${student.rank}`}>
                {isExtraRow && <div className="h-px bg-slate-100 my-4" />}
                
                <div className={`flex items-center gap-3 ${isExtraRow ? 'opacity-90' : ''}`}>
                  <div className={`w-6 text-center font-bold text-sm ${student.rank === 1 ? 'text-amber-500' : student.rank === 2 ? 'text-slate-400' : student.rank === 3 ? 'text-amber-700' : 'text-slate-300'}`}>
                    {student.rank}
                  </div>
                  
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border ${student.isCurrentUser ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-100'}`}>
                    {student.avatar ? (
                      <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                    ) : (
                      student.isCurrentUser 
                        ? <UserIcon className="w-5 h-5 text-blue-500" />
                        : <span className="text-slate-400 font-bold text-sm">{student.name.charAt(0)}</span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-sm truncate ${student.isCurrentUser ? 'text-blue-600' : 'text-slate-900'}`}>
                      {displayName}
                    </h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="h-1.5 bg-slate-100 rounded-full w-full max-w-[100px] overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${student.isCurrentUser ? 'bg-blue-500' : 'bg-blue-300'}`} 
                          style={{ width: `${Math.max(5, (student.minutes / maxMinutes) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`font-bold text-sm ${student.isCurrentUser ? 'text-blue-600' : 'text-slate-900'}`}>
                      {hrs > 0 ? `${hrs}h ` : ''}{mins}m
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
