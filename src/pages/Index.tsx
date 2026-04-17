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
  const Screen = SCREENS[screen];

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setScreen('croc');
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar activeScreen={screen} onNavigate={setScreen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={SCREEN_TITLES[screen]} onNavigate={setScreen} onSearch={handleSearch} />
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
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
