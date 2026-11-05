import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { getCccdSignedUrl } from '../../services/supabase';

interface CccdViewerModalProps {
  studentName: string;
  frontPath?: string;
  backPath?: string;
  onClose: () => void;
}

export const CccdViewerModal: React.FC<CccdViewerModalProps> = ({
  studentName,
  frontPath,
  backPath,
  onClose,
}) => {
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadUrls = async () => {
      setLoading(true);
      try {
        // Mặt trước
        if (frontPath) {
          if (frontPath.startsWith('data:') || frontPath.startsWith('blob:')) {
            setFrontUrl(frontPath);
          } else {
            const url = await getCccdSignedUrl(frontPath, 60);
            if (isMounted) setFrontUrl(url);
          }
        }

        // Mặt sau
        if (backPath) {
          if (backPath.startsWith('data:') || backPath.startsWith('blob:')) {
            setBackUrl(backPath);
          } else {
            const url = await getCccdSignedUrl(backPath, 60);
            if (isMounted) setBackUrl(url);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadUrls();

    return () => {
      isMounted = false;
    };
  }, [frontPath, backPath]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Ảnh CCCD / Định danh</h3>
            <p className="text-sm text-slate-500">Sinh viên: {studentName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm">Đang tạo liên kết bảo mật có thời hạn 60 giây...</p>
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {/* Mặt trước */}
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Mặt trước CCCD</p>
              {frontUrl ? (
                <img
                  src={frontUrl}
                  alt="Mặt trước CCCD"
                  className="w-full max-h-64 object-contain rounded-2xl border border-slate-200 bg-slate-50 shadow-xs"
                />
              ) : (
                <div className="w-full h-36 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-xs">Chưa có ảnh mặt trước</span>
                </div>
              )}
            </div>

            {/* Mặt sau */}
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Mặt sau CCCD</p>
              {backUrl ? (
                <img
                  src={backUrl}
                  alt="Mặt sau CCCD"
                  className="w-full max-h-64 object-contain rounded-2xl border border-slate-200 bg-slate-50 shadow-xs"
                />
              ) : (
                <div className="w-full h-36 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-xs">Chưa có ảnh mặt sau</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 text-center italic">
              🔒 Ảnh được mã hóa và bảo mật qua Private Storage. Đường dẫn tự hủy sau 60 giây.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-slate-800 text-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
