// file path: web/src/pages/dashboards/instructor/GamificationSettings.jsx

import { useState } from "react";
import { Award } from "lucide-react";

const GamificationSettings = () => {
  const [enabled, setEnabled] = useState(true);
  const [xpBase, setXpBase] = useState(100);
  const [xpAlpha, setXpAlpha] = useState(1.5);
  const [dailyCap, setDailyCap] = useState(500);
  const [leaderboardScope, setLeaderboardScope] = useState('cohort');

  const sampleXP = (level) => Math.round(xpBase * Math.pow(level, xpAlpha));

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm">
      <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 font-outfit">Gamification</h2>
        <p className="text-sm ink-muted mt-1">Control XP, badges, leaderboards and anti-gaming safeguards for your course.</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium ink">Enable Gamification</p>
                <p className="text-xs ink-muted mt-1">Toggle gamification features for this course.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 dark:bg-zinc-700 peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-zinc-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#04510e]" />
              </label>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <p className="text-sm font-medium ink">Leaderboard Scope</p>
            <p className="text-xs ink-muted mt-1">Choose which students appear on leaderboards.</p>
            <div className="mt-3 space-y-2">
              <label className={`w-full p-3 border rounded-lg flex items-center gap-3 cursor-pointer ${leaderboardScope==='global'?'bg-gray-50 dark:bg-zinc-800':''}`}>
                <input type="radio" name="lb-scope" checked={leaderboardScope==='global'} onChange={() => setLeaderboardScope('global')} className="sr-only" />
                <span className="text-sm ink">Global</span>
                <span className="text-xs ink-muted ml-auto">All courses</span>
              </label>
              <label className={`w-full p-3 border rounded-lg flex items-center gap-3 cursor-pointer ${leaderboardScope==='cohort'?'bg-gray-50 dark:bg-zinc-800':''}`}>
                <input type="radio" name="lb-scope" checked={leaderboardScope==='cohort'} onChange={() => setLeaderboardScope('cohort')} className="sr-only" />
                <span className="text-sm ink">Cohort</span>
                <span className="text-xs ink-muted ml-auto">Only this cohort</span>
              </label>
              <label className={`w-full p-3 border rounded-lg flex items-center gap-3 cursor-pointer ${leaderboardScope==='anonymous'?'bg-gray-50 dark:bg-zinc-800':''}`}>
                <input type="radio" name="lb-scope" checked={leaderboardScope==='anonymous'} onChange={() => setLeaderboardScope('anonymous')} className="sr-only" />
                <span className="text-sm ink">Anonymous</span>
                <span className="text-xs ink-muted ml-auto">Hide names</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold ink">XP Formula</h3>
          <p className="text-xs ink-muted mt-1">Configurable level curve: <span className="font-medium">XP_required(L) = base · L^alpha</span></p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 border rounded-lg">
              <label className="text-xs ink-muted">Base XP</label>
              <input type="number" value={xpBase} onChange={(e) => setXpBase(Number(e.target.value))} className="w-full mt-2 px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800" />
            </div>
            <div className="p-3 border rounded-lg">
              <label className="text-xs ink-muted">Alpha (curve)</label>
              <input type="number" step="0.1" value={xpAlpha} onChange={(e) => setXpAlpha(Number(e.target.value))} className="w-full mt-2 px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800" />
            </div>
            <div className="p-3 border rounded-lg">
              <label className="text-xs ink-muted">Daily XP Cap</label>
              <input type="number" value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} className="w-full mt-2 px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800" />
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-700 dark:text-zinc-300">
            <div>Sample XP requirements:</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg">Level 1: {sampleXP(1)} XP</div>
              <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg">Level 5: {sampleXP(5)} XP</div>
              <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg">Level 10: {sampleXP(10)} XP</div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold ink">Badges</h3>
          <p className="text-xs ink-muted mt-1">Define badges and rarity. (UI placeholder)</p>
          <div className="mt-3 space-y-2">
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium ink">Module Mastery</div>
                <div className="text-xs ink-muted">Awarded for 90%+ on a module</div>
              </div>
              <button className="px-3 py-1 bg-[#04510e] text-white rounded-md text-sm">Edit</button>
            </div>
          </div>
          <div className="mt-3">
            <button className="px-4 py-2 bg-white dark:bg-zinc-800 border rounded-lg">Add Badge</button>
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end">
          <button className="px-5 py-2.5 bg-[#04510e] text-white rounded-lg">Save Gamification Settings</button>
        </div>
      </div>
    </div>
  );
};

export default GamificationSettings;
