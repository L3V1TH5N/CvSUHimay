-- File Path: backend/migration_tour_completed.sql
-- Tier 1 migration: add tour_completed column to users.
-- Run this in the same deploy window as the updated onboarding.js route.
--
-- Migration decision (per PROMPTv6 §8):
--   Existing onboarded students → tour_completed = 1 (Option A: treat as "seen the app").
--   Future students will have tour_completed set to 1 only after the tour endpoint is called.
--   The "Show dashboard tour" button in Settings can reset this to 0 at any time.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tour_completed TINYINT(1) NOT NULL DEFAULT 0;

-- Backfill: any student who already completed onboarding before this migration
-- is treated as having completed the tour so they are not forced through it again.
UPDATE users
  SET tour_completed = 1
  WHERE onboarding_completed = TRUE
    AND tour_completed = 0;