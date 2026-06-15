// file path: web/src/pages/dashboards/components/GamifiedProfile.jsx

import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";

// ── MOCK GAMIFICATION DATA ──────────────────────────────────────────
const MOCK_GAMIFICATION = {
  level: 12,
  xp: 850,
  xpToNextLevel: 1000,
  streak: 7,
  activeCourses: 3,
  averageScore: 85,
};

const GamifiedProfile = ({ user, sidebarOpen, fullyOpen, onMouseEnter, onMouseLeave }) => {
  const navigate = useNavigate();
  const stats = MOCK_GAMIFICATION;
  const xpPercentage = (stats.xp / stats.xpToNextLevel) * 100;

  const handleClick = () => {
    navigate("/student/dashboard/profile");
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="w-full group relative overflow-hidden
        transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        hover:scale-[1.01] active:scale-[0.99]"
    >
      <div className={`
        bg-gradient-to-br from-[#04510e]/5 to-[#076b15]/5 dark:from-[#04510e]/10 dark:to-[#076b15]/10
        hover:from-[#04510e]/8 hover:to-[#076b15]/8 dark:hover:from-[#04510e]/15 dark:hover:to-[#076b15]/15
        border border-[#04510e]/10 dark:border-[#04510e]/20
        rounded-lg transition-all duration-200
        ${sidebarOpen ? 'p-3' : 'p-2'}
      `}>
        
        {/* Collapsed State - Avatar + Level Badge */}
        {!sidebarOpen && (
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#04510e] to-[#076b15] flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm select-none">
                  {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
                </span>
              </div>
              {/* Level badge overlay */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center text-[9px] font-black text-amber-900 dark:text-amber-950 shadow-sm border border-white dark:border-zinc-900">
                {stats.level}
              </div>
            </div>
          </div>
        )}

        {/* Expanded State - Full Profile */}
        {sidebarOpen && (
          <div className="space-y-2">
            {/* Avatar + Name + Level */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#04510e] to-[#076b15] flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-base select-none">
                    {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
                {/* Level badge */}
                <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center text-[10px] font-black text-amber-900 dark:text-amber-950 shadow-sm border-2 border-white dark:border-zinc-900">
                  {stats.level}
                </div>
              </div>
              
              <div className={`flex-1 min-w-0 transition-opacity duration-150 ${fullyOpen ? 'opacity-100' : 'opacity-0'}`}>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-zinc-100 truncate leading-tight">
                  {user?.full_name || 'User'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-500">
                    Level {stats.level}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-zinc-500">•</span>
                  <span className="text-[11px] text-gray-500 dark:text-zinc-400 capitalize">
                    {user?.role || 'Student'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className={`flex items-center justify-between gap-2 transition-opacity duration-150 ${fullyOpen ? 'opacity-100' : 'opacity-0'}`}>
              {/* Streak */}
              <div className="flex items-center gap-1 bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">
                <span className="text-xs">🔥</span>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-zinc-300">{stats.streak}</span>
              </div>
              
              {/* Active Courses */}
              <div className="flex items-center gap-1 bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">
                <span className="text-xs">⭐</span>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-zinc-300">{stats.activeCourses}</span>
              </div>
              
              {/* Average Score */}
              <div className="flex items-center gap-1 bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">
                <span className="text-xs">📊</span>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-zinc-300">{stats.averageScore}%</span>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className={`transition-opacity duration-150 ${fullyOpen ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">
                  {stats.xp}/{stats.xpToNextLevel} XP
                </span>
                <Zap className="w-3 h-3 text-amber-500" />
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${xpPercentage}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </button>
  );
};

export default GamifiedProfile;