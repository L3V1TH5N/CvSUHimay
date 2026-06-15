// file path: web/src/constants/achievements.js
// Single source of truth for achievement-related visual constants. Names,
// descriptions, and rarity come from the backend (GET /api/achievements);
// only the per-ID icon and rarity styling live here.
//
// Fix 7: ACHIEVEMENT_NAMES removed — it was an unused duplicate of the `name`
// field returned by the backend on every achievement fetch. Maintaining a
// parallel client-side map risks drift when backend names change.

import {
  Brain, Skull, CheckCircle, Star, Sparkles,
  BookOpen, Footprints, Rabbit,
  FlaskConical, Trophy, Gauge, Flame,
  Sunrise, Moon,
} from "lucide-react";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Maps achievement ID (1–23) → lucide-react icon component
export const ACHIEVEMENT_ICONS = {
  // Quiz
  1:  Brain,         // Built Different
  2:  Skull,         // In Batman We Trust
  3:  CheckCircle,   // The Standard
  4:  Star,          // Prodigy
  5:  Sparkles,      // Savant
  22: Star,          // Ace
  23: Star,          // Elite

  // Learning
  6:  BookOpen,      // Knowledge Seeker I
  7:  BookOpen,      // II
  8:  BookOpen,      // III
  9:  BookOpen,      // IV
  10: BookOpen,      // V
  11: Footprints,    // First Steps
  12: Rabbit,        // Quick Learner

  // Simulation
  13: FlaskConical,  // Lab Rat
  14: Trophy,        // Simulation Expert
  15: Gauge,         // Speed Demon
  16: Flame,         // On a Streak I
  17: Flame,         // II
  18: Flame,         // III
  19: Flame,         // IV
  20: Sunrise,       // Early Bird
  21: Moon,          // Night Owl
};

// Default fallback icon when ID is not in the map
export { Trophy as ACHIEVEMENT_ICON_FALLBACK };

export const RARITY = {
  common: {
    icon:          "text-gray-500 dark:text-zinc-400",
    bg:            "bg-gray-100 dark:bg-zinc-800",
    badge:         "bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700",
    dot:           "bg-gray-400 dark:bg-zinc-500",
    topBar:        "bg-gray-200 dark:bg-zinc-700",
    topBarH:       "h-[3px]",
    cardBorder:    "border border-gray-200 dark:border-zinc-700",
    cardBg:        "bg-white dark:bg-zinc-900",
    cardClass:     "",
    iconWrapClass: "",
  },
  uncommon: {
    icon:          "text-[#04510e] dark:text-green-400",
    bg:            "bg-[#04510e]/8 dark:bg-[#04510e]/20",
    badge:         "bg-[#04510e]/8 dark:bg-[#04510e]/20 text-[#04510e] dark:text-green-400 border-[#04510e]/25",
    dot:           "bg-[#04510e]",
    topBar:        "bg-[#04510e]",
    topBarH:       "h-[3px]",
    cardBorder:    "border border-[#04510e]/25 dark:border-[#04510e]/35",
    cardBg:        "bg-white dark:bg-zinc-900",
    cardClass:     "",
    iconWrapClass: "",
  },
  rare: {
    icon:          "text-teal-600 dark:text-teal-400",
    bg:            "bg-teal-50 dark:bg-teal-500/15",
    badge:         "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/30",
    dot:           "bg-teal-500",
    topBar:        "bg-teal-500",
    topBarH:       "h-[3px]",
    cardBorder:    "border border-teal-200 dark:border-teal-500/30",
    cardBg:        "bg-white dark:bg-zinc-900",
    cardClass:     "",
    iconWrapClass: "",
  },
  epic: {
    icon:          "text-violet-600 dark:text-violet-400",
    bg:            "bg-violet-50 dark:bg-violet-500/15",
    badge:         "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/30",
    dot:           "bg-violet-500",
    topBar:        "bg-violet-500",
    topBarH:       "h-[4px]",
    cardBorder:    "border-2 border-violet-300 dark:border-violet-500/55",
    cardBg:        "bg-violet-50/35 dark:bg-violet-950/20",
    cardClass:     "epic-card",
    iconWrapClass: "shadow-[0_0_14px_rgba(139,92,246,0.38)] dark:shadow-[0_0_18px_rgba(139,92,246,0.58)]",
  },
  legendary: {
    icon:          "text-amber-600 dark:text-amber-400",
    bg:            "bg-amber-50 dark:bg-amber-500/15",
    badge:         "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40",
    dot:           "bg-amber-500",
    topBar:        "bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300",
    topBarH:       "h-[5px]",
    cardBorder:    "border-2 border-amber-400/65 dark:border-amber-400/55",
    cardBg:        "bg-amber-50/50 dark:bg-amber-950/20",
    cardClass:     "legendary-card",
    iconWrapClass: "shadow-[0_0_18px_rgba(245,158,11,0.48)] dark:shadow-[0_0_22px_rgba(245,158,11,0.65)]",
  },
};
