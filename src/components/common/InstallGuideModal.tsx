import React, { useState } from 'react';
import { X, Smartphone, Apple, Share, PlusSquare, MoreVertical } from 'lucide-react';

interface InstallGuideModalProps {
  onClose: () => void;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ onClose }) => {
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Hướng dẫn cài đặt PWA</h3>
            <p className="text-xs text-slate-500">Cài ứng dụng để mở toàn màn hình, mượt mà và không giật lag</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab chuyển iOS / Android */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl my-4">
          <button
            onClick={() => setPlatform('ios')}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              platform === 'ios'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Apple className="w-4 h-4" />
            <span>iPhone / iPad (iOS)</span>
          </button>
          <button
            onClick={() => setPlatform('android')}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              platform === 'android'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>Điện thoại Android (Chrome)</span>
          </button>
        </div>

        {/* Nội dung hướng dẫn */}
        {platform === 'ios' ? (
          <div className="space-y-4 py-2 text-sm text-slate-700">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900">
              💡 <strong>Lưu ý:</strong> Vui lòng mở trang web này bằng trình duyệt <strong>Safari</strong> trên iPhone.
            </div>

            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Bấm nút "Chia sẻ" (Share)</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    Biểu tượng hình vuông có mũi tên trỏ lên <Share className="w-3.5 h-3.5 inline text-blue-600" /> ở thanh công cụ dưới đáy màn hình Safari.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Chọn "Thêm vào MH chính" (Add to Home Screen)</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    Cuộn xuống danh sách tác vụ và bấm chọn biểu tượng <PlusSquare className="w-3.5 h-3.5 inline text-slate-700" />.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Bấm "Thêm" ở góc trên bên phải</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Biểu tượng ứng dụng <strong>QL Nhà Trọ</strong> sẽ xuất hiện trên màn hình điện thoại, mở lên chạy độc lập như app native!
                  </p>
                </div>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-sm text-slate-700">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
              💡 <strong>Lưu ý:</strong> Vui lòng mở bằng trình duyệt <strong>Google Chrome</strong> trên Android.
            </div>

            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Bấm nút Menu (3 dấu chấm dọc)</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    Ở góc trên bên phải thanh địa chỉ Chrome <MoreVertical className="w-3.5 h-3.5 inline text-slate-700" />.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Chọn "Cài đặt ứng dụng" (Install App)</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hoặc chọn dòng "Thêm vào màn hình chính" (Add to Home screen).
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Xác nhận "Cài đặt"</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hệ thống sẽ tải và cài đặt biểu tượng <strong>QL Nhà Trọ</strong> trực tiếp ra màn hình chờ của máy.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black font-semibold text-white text-sm cursor-pointer"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
