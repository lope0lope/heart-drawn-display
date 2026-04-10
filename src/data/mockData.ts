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
