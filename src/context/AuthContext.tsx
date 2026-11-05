import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { SyncService } from '../db/sync';
import { db } from '../db/dexie';

const DEV_MOCK_OWNER_ID = 'dev-owner-00000000-0000';

interface AuthContextType {
  user: User | null;
  ownerId: string;
  isConfigured: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const configured = isSupabaseConfigured();

  // Xác định cấu hình dev mock auth chỉ chạy trong môi trường phát triển
  let devMockEnabled = false;
  let devEmail = '';
  let devPassword = '';

  if (import.meta.env.DEV) {
    devMockEnabled = import.meta.env.VITE_DEV_MOCK_AUTH === 'true';
    devEmail = import.meta.env.VITE_DEV_EMAIL || '';
    devPassword = import.meta.env.VITE_DEV_PASSWORD || '';
  }

  let isConfigured = configured;
  if (import.meta.env.DEV) {
    if (devMockEnabled) {
      isConfigured = true;
    }
  }

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      setIsLoading(true);

      if (configured) {
        // Kiểm tra phiên đăng nhập hiện tại từ Supabase
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          setUser(data.session.user);
          SyncService.syncFromSupabase(data.session.user.id);
        }

        // Lắng nghe thay đổi trạng thái Auth
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            setUser(session.user);
            SyncService.syncFromSupabase(session.user.id);
          } else {
            setUser(null);
          }
        });

        unsubscribe = () => {
          authListener.subscription.unsubscribe();
        };
      } else {
        // Supabase chưa cấu hình -> Kiểm tra phiên Dev Mock nếu bật
        if (import.meta.env.DEV) {
          if (devMockEnabled && localStorage.getItem('qlpt_mock_session') === 'true') {
            const mockUser = {
              id: DEV_MOCK_OWNER_ID,
              email: devEmail,
              aud: 'authenticated',
              app_metadata: {},
              user_metadata: {},
              created_at: new Date().toISOString(),
            } as unknown as User;
            setUser(mockUser);
          }
        }
      }

      setIsLoading(false);
    };

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [configured, devMockEnabled, devEmail]);

  const login = async (emailInput: string, passwordInput: string) => {
    // 1. Nếu có cấu hình Supabase thật -> Bắt buộc dùng Supabase Auth
    if (configured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailInput,
          password: passwordInput,
        });
        if (error) {
          return {
            success: false,
            error: error.message.includes('Invalid login credentials')
              ? 'Email hoặc mật khẩu không chính xác.'
              : error.message,
          };
        }
        if (data.user) {
          setUser(data.user);
          await SyncService.syncFromSupabase(data.user.id);
        }
        return { success: true };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Đăng nhập không thành công',
        };
      }
    }

    // 2. Nếu ở chế độ dev và bật Mock Auth
    if (import.meta.env.DEV) {
      if (devMockEnabled) {
        if (
          devEmail &&
          devPassword &&
          emailInput.trim().toLowerCase() === devEmail.trim().toLowerCase() &&
          passwordInput === devPassword
        ) {
          const mockUser = {
            id: DEV_MOCK_OWNER_ID,
            email: devEmail,
            aud: 'authenticated',
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          } as unknown as User;

          setUser(mockUser);
          localStorage.setItem('qlpt_mock_session', 'true');
          // Không nạp dữ liệu mẫu - hệ thống mở ra hoàn toàn trống
          return { success: true };
        }
        return {
          success: false,
          error: 'Email hoặc mật khẩu thử nghiệm không chính xác.',
        };
      }
    }

    return {
      success: false,
      error: 'Chưa cấu hình hệ thống: Vui lòng cấu hình Supabase hoặc bật tài khoản kiểm tra dev trong .env',
    };
  };

  const logout = async () => {
    if (configured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Lỗi đăng xuất Supabase:', err);
      }
    }

    setUser(null);
    localStorage.removeItem('qlpt_mock_session');
    localStorage.removeItem('qlpt_last_synced_at');

    // Xóa sạch toàn bộ dữ liệu đệm trong IndexedDB trên thiết bị
    try {
      await Promise.all([
        db.toa_nha.clear(),
        db.phong.clear(),
        db.hop_dong.clear(),
        db.sinh_vien.clear(),
        db.chi_so.clear(),
        db.hoa_don.clear(),
        db.thanh_toan.clear(),
        db.chi_phi.clear(),
        db.cai_dat.clear(),
      ]);
    } catch (err) {
      console.error('Lỗi xóa cache IndexedDB khi đăng xuất:', err);
    }
  };

  const ownerId = user?.id || '';

  return (
    <AuthContext.Provider
      value={{
        user,
        ownerId,
        isConfigured,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider');
  }
  return context;
};
