import React, { useState, Suspense, lazy } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Loader2 } from 'lucide-react';
import { db } from './db/dexie';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { OfflineBanner } from './components/common/OfflineBanner';
import { Navbar } from './components/common/Navbar';
import { BottomNav, type ActiveTab } from './components/common/BottomNav';
import { RoomGrid } from './components/rooms/RoomGrid';
import { AuthModal } from './components/auth/AuthModal';
import { getCurrentMonth } from './utils/formatters';

// Code-splitting (Lazy load) các màn hình phụ và modal để tối ưu tốc độ mở app ban đầu
const MeterReadingView = lazy(() =>
  import('./components/meters/MeterReadingView').then((m) => ({ default: m.MeterReadingView }))
);
const PaymentView = lazy(() =>
  import('./components/payments/PaymentView').then((m) => ({ default: m.PaymentView }))
);
const ReportView = lazy(() =>
  import('./components/reports/ReportView').then((m) => ({ default: m.ReportView }))
);
const SettingsModal = lazy(() =>
  import('./components/settings/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const InstallGuideModal = lazy(() =>
  import('./components/common/InstallGuideModal').then((m) => ({ default: m.InstallGuideModal }))
);

const LoadingFallback = () => (
  <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    <span className="text-xs font-medium">Đang tải...</span>
  </div>
);

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('phong');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [settingsInitialAddBuilding, setSettingsInitialAddBuilding] = useState<boolean>(false);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);

  const handleOpenSettings = (initialAddBuilding = false) => {
    setSettingsInitialAddBuilding(initialAddBuilding);
    setShowSettings(true);
  };

  // Tính số lượng phòng chưa đóng tiền tháng này để hiện badge trên BottomNav
  const currentMonth = getCurrentMonth();
  const unpaidBills = useLiveQuery(
    async () => {
      if (!user) return [];
      return await db.hoa_don.where({ thang: currentMonth }).filter((h) => h.trang_thai !== 'da_dong').toArray();
    },
    [currentMonth, user]
  ) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <span className="text-sm font-medium">Đang tải dữ liệu...</span>
      </div>
    );
  }

  // Chưa đăng nhập: Chỉ render màn hình đăng nhập, tuyệt đối không render dữ liệu
  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
      {/* Banner báo trạng thái ngoại tuyến */}
      <OfflineBanner />

      {/* Thanh tiêu đề đỉnh */}
      <Navbar onOpenSettings={() => handleOpenSettings(false)} />

      {/* Vùng nội dung chính */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === 'phong' && <RoomGrid onOpenSettings={handleOpenSettings} />}
          {activeTab === 'chot_so' && (
            <MeterReadingView
              onGoToRooms={() => setActiveTab('phong')}
              onOpenSettings={handleOpenSettings}
            />
          )}
          {activeTab === 'thu_tien' && (
            <PaymentView
              onGoToRooms={() => setActiveTab('phong')}
              onOpenSettings={handleOpenSettings}
            />
          )}
          {activeTab === 'bao_cao' && (
            <ReportView
              onGoToRooms={() => setActiveTab('phong')}
              onOpenSettings={handleOpenSettings}
            />
          )}
        </Suspense>
      </main>

      {/* Thanh điều hướng chân trang (Mobile Bottom Navigation) */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        unpaidCount={unpaidBills.length}
      />

      {/* Modal Cài đặt */}
      {showSettings && (
        <Suspense fallback={null}>
          <SettingsModal
            onClose={() => {
              setShowSettings(false);
              setSettingsInitialAddBuilding(false);
            }}
            onOpenInstallGuide={() => setShowInstallGuide(true)}
            initialAddBuilding={settingsInitialAddBuilding}
          />
        </Suspense>
      )}

      {/* Modal Hướng dẫn cài đặt PWA */}
      {showInstallGuide && (
        <Suspense fallback={null}>
          <InstallGuideModal onClose={() => setShowInstallGuide(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
