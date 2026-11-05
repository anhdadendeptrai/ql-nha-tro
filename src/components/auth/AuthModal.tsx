import React, { useState } from 'react';
import { Lock, Mail, LogIn, AlertCircle, Loader2, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

interface AuthModalProps {
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { isConfigured, login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      showToast('Đăng nhập thành công!', 'success');
      if (onClose) onClose();
    } else {
      setErrorMsg(result.error || 'Đăng nhập không thành công.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 border border-slate-200">
        <div className="text-center pb-6 border-b border-slate-100">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            Quản Lý Nhà Trọ
          </h2>
          <p className="text-sm text-slate-500 mt-1">Đăng nhập tài khoản chủ trọ</p>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!isConfigured && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Chưa cấu hình hệ thống</span>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              Vui lòng cấu hình <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> trong file <code>.env</code>, hoặc bật <code>VITE_DEV_MOCK_AUTH=true</code> trong môi trường phát triển để đăng nhập kiểm tra.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email đăng nhập
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chutro@example.com"
                className="w-full pl-11 pr-3.5 py-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base"
                disabled={!isConfigured || isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-3.5 py-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base"
                disabled={!isConfigured || isSubmitting}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isConfigured}
            className="w-full mt-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Đăng nhập</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-100">
          Chỉ tài khoản chủ trọ được cấp quyền mới có thể truy cập hệ thống
        </div>
      </div>
    </div>
  );
};
