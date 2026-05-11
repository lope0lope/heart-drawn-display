import { useState, useCallback } from 'react';
import AppSidebar from '@/components/AppSidebar';
import Topbar from '@/components/Topbar';
import { type ScreenName, SCREEN_TITLES } from '@/data/mockData';
import DashboardScreen from './DashboardScreen';
import PenMapScreen from './PenMapScreen';
import ForecastScreen from './ForecastScreen';
import FeedReportsScreen from './FeedReportsScreen';
import DataUploadScreen from './DataUploadScreen';
import CrocProfileScreen from './CrocProfileScreen';
import AnalyticsScreen from './AnalyticsScreen';
import ConditionCodesScreen from './ConditionCodesScreen';

const SCREENS: Record<ScreenName, React.ComponentType<any>> = {
  dashboard: DashboardScreen,
  penmap: PenMapScreen,
  forecast: ForecastScreen,
  feed: FeedReportsScreen,
  upload: DataUploadScreen,
  croc: CrocProfileScreen,
  analytics: AnalyticsScreen,
  codes: ConditionCodesScreen,
};

export default function Index() {
  const [screen, setScreen] = useState<ScreenName>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const Screen = SCREENS[screen];

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setScreen('croc');
  }, []);

  const handleNavigate = useCallback((s: ScreenName) => {
    setScreen(s);
    setMobileNavOpen(false);
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <AppSidebar
        activeScreen={screen}
        onNavigate={handleNavigate}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          title={SCREEN_TITLES[screen]}
          onNavigate={handleNavigate}
          onSearch={handleSearch}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 min-h-0">
          {screen === 'croc' ? (
            <CrocProfileScreen initialSearch={searchQuery} />
          ) : screen === 'penmap' ? (
            <PenMapScreen onOpenCroc={handleSearch} />
          ) : (
            <Screen />
          )}
        </div>
      </div>
    </div>
  );
}
