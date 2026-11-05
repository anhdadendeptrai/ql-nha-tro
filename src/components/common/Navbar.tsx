import React, { useState } from 'react';
import { Building2, RefreshCw, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SyncService } from '../../db/sync';
import { useToast } from './Toast';

interface NavbarProps {
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSettings }) => {
  const { user, ownerId, logout } = useAuth();
  const { showToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

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
      await logout();
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
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-emerald-600 font-medium truncate max-w-[180px]">
                {user?.email || 'Chủ trọ'}
              </span>
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
            title="Đồng bộ dữ liệu máy chủ"
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
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
