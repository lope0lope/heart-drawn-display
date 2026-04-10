// Shared types and constants used across the app
// Live data comes from Supabase — this file only holds static references

export type ScreenName = 'dashboard' | 'penmap' | 'forecast' | 'feed' | 'upload' | 'croc' | 'analytics' | 'codes';

export const SCREEN_TITLES: Record<ScreenName, string> = {
  dashboard: 'Dashboard',
  penmap: 'Pen Map',
  forecast: 'Forecasting',
  feed: 'Feed Reports',
  upload: 'Data Upload',
  croc: 'Croc Profiles',
  analytics: 'Analytics',
  codes: 'Condition Codes',
};

export const CULL_READINESS = [
  { horizon: 'Now', label: 'Cull immediately', worker: 218, ai: 194, color: 'ct-good' },
  { horizon: 'Next Cycle', label: 'Ready in ~2 months', worker: 341, ai: 378, color: 'ct-info' },
  { horizon: '+2 Cycles', label: 'Ready in ~4 months', worker: 487, ai: 502, color: 'ct-accent' },
  { horizon: '+3 Cycles', label: 'Ready in ~6 months', worker: 624, ai: 589, color: 'ct-text2' },
];
