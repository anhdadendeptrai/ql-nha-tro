import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50 animate-pulse">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        <strong>Đang ngoại tuyến:</strong> Dữ liệu được hiển thị từ bộ nhớ máy. Tạm dừng ghi lên server để tránh xung đột.
      </span>
    </div>
  );
};
