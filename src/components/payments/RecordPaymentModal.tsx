import React, { useState } from 'react';
import { X, CheckCircle, CreditCard, Banknote } from 'lucide-react';
import type { HoaDon, Phong, SinhVien, HinhThucThanhToan } from '../../types';
import { formatVND } from '../../utils/formatters';
import { SyncService } from '../../db/sync';
import { useToast } from '../common/Toast';

interface RecordPaymentModalProps {
  hoaDon: HoaDon;
  phong: Phong;
  daiDien?: SinhVien;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  hoaDon,
  phong,
  daiDien,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [soTienDong, setSoTienDong] = useState<number>(hoaDon.con_no > 0 ? hoaDon.con_no : hoaDon.tong_tien);
  const [hinhThuc, setHinhThuc] = useState<HinhThucThanhToan>('chuyen_khoan');
  const [ghiChu, setGhiChu] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const conNoSauKhiDong = Math.max(0, hoaDon.tong_tien - (hoaDon.da_dong + soTienDong));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (soTienDong <= 0) return;

    setIsSubmitting(true);
    const tongDaDongMoi = hoaDon.da_dong + soTienDong;

    await SyncService.updatePaymentStatus(hoaDon.id, tongDaDongMoi, hinhThuc, ghiChu);
    showToast(`Đã thu ${formatVND(soTienDong)} cho phòng ${phong.so_phong}!`, 'success');
    setIsSubmitting(false);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Thu tiền phòng {phong.so_phong}</h3>
            <p className="text-xs text-slate-500">
              Khách thuê: {daiDien?.ho_ten || 'Sinh viên'} • Kỳ: {hoaDon.thang}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          {/* Thông tin hóa đơn */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Tổng hóa đơn:</span>
              <strong className="text-slate-900">{formatVND(hoaDon.tong_tien)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Đã nộp trước đó:</span>
              <span className="text-emerald-700 font-semibold">{formatVND(hoaDon.da_dong)}</span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-slate-200 font-bold">
              <span className="text-slate-700">Hiện còn nợ:</span>
              <span className="text-rose-600">{formatVND(hoaDon.con_no)}</span>
            </div>
          </div>

          {/* Nhập số tiền thu lần này */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Số tiền thu đợt này ({formatVND(soTienDong)})
            </label>
            <input
              type="number"
              min={1000}
              step={10000}
              required
              value={soTienDong || ''}
              onChange={(e) => setSoTienDong(Number(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 text-lg font-black font-mono outline-none text-blue-700"
            />
          </div>

          {/* Hình thức thanh toán */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Hình thức nhận tiền
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHinhThuc('chuyen_khoan')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  hinhThuc === 'chuyen_khoan'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Chuyển khoản</span>
              </button>

              <button
                type="button"
                onClick={() => setHinhThuc('tien_mat')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  hinhThuc === 'tien_mat'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Tiền mặt</span>
              </button>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Ghi chú thu tiền
            </label>
            <input
              type="text"
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Ví dụ: Đóng trước một phần, hẹn tuần sau..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-blue-500"
            />
          </div>

          {/* Còn nợ sau khi thu */}
          <div className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-100 font-semibold">
            <span>Còn nợ lại sau đợt này:</span>
            <span className={conNoSauKhiDong > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
              {conNoSauKhiDong === 0 ? '✓ Đã hết nợ' : formatVND(conNoSauKhiDong)}
            </span>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || soTienDong <= 0}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Xác nhận đã thu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
