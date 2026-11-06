import React, { useState, useEffect } from 'react';
import { Building2, RefreshCw, LogOut, Settings as SettingsIcon, CloudCheck, CloudUpload, CloudOff } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../context/AuthContext';
import { SyncService } from '../../db/sync';
import { db } from '../../db/dexie';
import { useToast } from './Toast';

interface NavbarProps {
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSettings }) => {
  const { user, ownerId, logout } = useAuth();
  const { showToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const outboxCount = useLiveQuery(() => db.outbox.count(), []) ?? 0;

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

  const handleSync = async () => {
    if (!ownerId) return;
    setIsSyncing(true);
    const res = await SyncService.syncFromSupabase(ownerId);
    setIsSyncing(false);
    if (res.success) {
      showToast('Đồng bộ dữ liệu Supabase thành công!', 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất? Dữ liệu lưu đệm trên máy sẽ được xóa để đảm bảo an toàn.')) {
      const res = await logout();
      if (!res.success) {
        alert(res.error || 'Không thể đăng xuất vì còn dữ liệu chưa lưu!');
        return;
      }
      showToast('Đã đăng xuất an toàn.', 'info');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs pt-safe">
      <div className="max-w-7xl mx-auto px-4 h-15 flex items-center justify-between">
        {/* Logo & Tên ứng dụng */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-tight">
              QL Nhà Trọ Sinh Viên
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="text-slate-600 font-medium truncate max-w-[130px] sm:max-w-[180px]">
                {user?.email || 'Chủ trọ'}
              </span>

              {/* Huy hiệu trạng thái đồng bộ */}
              {!isOnline ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                  <CloudOff className="w-3 h-3 text-slate-500" />
                  Ngoại tuyến {outboxCount > 0 ? `(${outboxCount})` : ''}
                </span>
              ) : isSyncing ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                  Đang đồng bộ...
                </span>
              ) : outboxCount > 0 ? (
                <span
                  onClick={() => SyncService.processOutbox()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold cursor-pointer hover:bg-amber-100 border border-amber-200"
                  title="Bấm để thử đồng bộ ngay"
                >
                  <CloudUpload className="w-3 h-3 text-amber-600 animate-bounce" />
                  {outboxCount} chưa lưu lên máy chủ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                  <CloudCheck className="w-3 h-3 text-emerald-600" />
                  Đã đồng bộ
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-1.5">
          {/* Nút đồng bộ */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`p-2.5 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer ${
              isSyncing ? 'animate-spin text-blue-600' : ''
            }`}
            title="Đồng bộ lại từ máy chủ"
            aria-label="Đồng bộ dữ liệu"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Cài đặt */}
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cài đặt hệ thống & VietQR"
            aria-label="Cài đặt"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>

          {/* Đăng xuất */}
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Đăng xuất an toàn"
            aria-label="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
