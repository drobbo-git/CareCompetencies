// =============================================================================
// CareCompetencies — Misc seed helpers
// -----------------------------------------------------------------------------
// Small shared constants used by the seed generators in seed.ts. Kept in a
// separate module so the heavyweight seed.ts doesn't grow further.
// =============================================================================

/** Default seed for the deterministic PRNG used to generate observations/achievements. */
export const SEED_RNG_SEED = 0x5A1A3DB1;

/** Outcome distribution for generated step observations. */
export const OBSERVATION_DISTRIBUTION = {
  Satisfactory: 0.72,
  NotObserved: 0.22,
  Unsatisfactory: 0.06,
} as const;

/** Fraction of an active orientee's assigned competencies that will be marked Achieved. */
export const ACHIEVEMENT_FRACTION = 0.45;

/** Window (days back from today) used to generate observation/achievement timestamps. */
export const HISTORY_WINDOW_DAYS = 120;

/** Default clinical role used when a person record lacks an explicit roleId. */
export const DEFAULT_ROLE_ID = "r-rn";