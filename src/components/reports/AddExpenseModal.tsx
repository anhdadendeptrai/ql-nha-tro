import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import type { ChiPhi, ToaNha, LoaiChiPhi } from '../../types';
import { formatVND } from '../../utils/formatters';
import { SyncService } from '../../db/sync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

interface AddExpenseModalProps {
  toas: ToaNha[];
  selectedToaId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  toas,
  selectedToaId,
  onClose,
  onSuccess,
}) => {
  const { ownerId } = useAuth();
  const { showToast } = useToast();

  const [toaId, setToaId] = useState(selectedToaId !== 'all' ? selectedToaId : toas[0]?.id || '');
  const [ngay, setNgay] = useState(new Date().toISOString().split('T')[0]);
  const [loai, setLoai] = useState<LoaiChiPhi>('sua_chua');
  const [soTien, setSoTien] = useState<number>(0);
  const [ghiChu, setGhiChu] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toaId || soTien <= 0) return;

    setIsSubmitting(true);
    const newExpense: ChiPhi = {
      id: `cp-${Date.now()}`,
      owner_id: ownerId,
      toa_id: toaId,
      ngay,
      loai,
      so_tien: soTien,
      ghi_chu: ghiChu.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await SyncService.saveChiPhi(newExpense);
    showToast(`Đã thêm chi phí ${formatVND(soTien)}!`, 'success');
    setIsSubmitting(false);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Thêm chi phí vận hành</h3>
            <p className="text-xs text-slate-500">Ghi nhận chi tiền điện EVN, nước, sửa chữa...</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
          {/* Tòa nhà */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Tòa
            </label>
            <select
              value={toaId}
              onChange={(e) => setToaId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base outline-none focus:border-blue-500"
            >
              {toas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ten}
                </option>
              ))}
            </select>
          </div>

          {/* Ngày chi & Loại chi phí */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Ngày chi
              </label>
              <input
                type="date"
                required
                value={ngay}
                onChange={(e) => setNgay(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Khoản mục chi
              </label>
              <select
                value={loai}
                onChange={(e) => setLoai(e.target.value as LoaiChiPhi)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-base outline-none focus:border-blue-500"
              >
                <option value="sua_chua">Sửa chữa / Bảo trì</option>
                <option value="tien_dien_evn">Tiền điện nộp EVN</option>
                <option value="tien_nuoc">Tiền nước sinh hoạt</option>
                <option value="khac">Chi phí khác</option>
              </select>
            </div>
          </div>

          {/* Số tiền */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Số tiền chi ({formatVND(soTien)}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1000}
              step={10000}
              required
              value={soTien || ''}
              onChange={(e) => setSoTien(Number(e.target.value) || 0)}
              placeholder="0 đ"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-lg font-black font-mono outline-none focus:border-blue-500 text-rose-600"
            />
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Ghi chú nội dung chi
            </label>
            <input
              type="text"
              required
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Ví dụ: Thay bóng đèn tầng 2, Mua xô lau nhà..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || soTien <= 0}
              className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Ghi nhận chi phí</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
