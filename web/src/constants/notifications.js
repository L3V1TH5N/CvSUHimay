// file path: web/src/constants/notifications.js

import {
  Trophy, CheckCircle, Users, Zap, Megaphone,
  Brain, TrendingUp, UserPlus, BookOpen, ClipboardCheck, XCircle, Bell,
} from 'lucide-react';

export const NOTIFICATION_CONFIG = {
  achievement:                      { icon: Trophy,         color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-500/15'   },
  enrollment:                       { icon: CheckCircle,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-500/15'   },
  enrollment_request:               { icon: Users,          color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-500/15'     },
  level_up:                         { icon: Zap,            color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-500/15'   },
  announcement:                     { icon: Megaphone,      color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/15' },
  quiz:                             { icon: Brain,          color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/15' },
  student_progress:                 { icon: TrendingUp,     color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-500/15'   },
  new_user:                         { icon: UserPlus,       color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-500/15'     },
  course_created:                   { icon: BookOpen,       color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-500/15'   },
  instructor_application_submitted: { icon: ClipboardCheck, color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-500/15'     },
  instructor_application_approved:  { icon: CheckCircle,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-500/15'   },
  instructor_application_rejected:  { icon: XCircle,        color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-500/15'       },
  // Fallback for types that exist in the DB but are not yet registered here.
  // Previously fell back to `achievement` (Trophy) which masked missing frontend registrations.
  default:                          { icon: Bell,           color: 'text-slate-500',  bg: 'bg-slate-50 dark:bg-slate-500/15'   },
};

export function formatTimeAgo(dateStr) {
  // MySQL DATETIME returns 'YYYY-MM-DD HH:MM:SS' — no timezone marker.
  // Without normalization, new Date() treats it as local time in some browsers,
  // causing the diff against Date.now() (UTC ms) to be wrong by the client's UTC offset.
  // If the string already contains 'T' it was already ISO-formatted; leave it alone.
  const iso = typeof dateStr === 'string' && !dateStr.includes('T')
    ? dateStr.replace(' ', 'T') + 'Z'
    : dateStr;
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)     return 'Just now';
  if (secs < 3600)   return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400)  return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
