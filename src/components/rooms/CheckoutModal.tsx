import React, { useState } from 'react';
import { X, CheckSquare, Square, AlertCircle, ArrowRightCircle } from 'lucide-react';
import type { PhongChiTiet, DoBanGiaoItem } from '../../types';
import { formatVND } from '../../utils/formatters';

interface CheckoutModalProps {
  room: PhongChiTiet;
  onConfirmCheckout: (ngayTra: string, tienHoanCoc: number, ghiChu: string) => Promise<void>;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  room,
  onConfirmCheckout,
  onClose,
}) => {
  const hopDong = room.hop_dong_hien_tai;
  const initialItems: DoBanGiaoItem[] = hopDong?.do_ban_giao || [];

  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({});
  const [ngayTra, setNgayTra] = useState<string>(new Date().toISOString().split('T')[0]);
  const [phiKhauTru, setPhiKhauTru] = useState<number>(0);
  const [lyDoKhauTru, setLyDoKhauTru] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const tienCocBanDau = hopDong?.tien_coc || 0;
  const tienConNoThang = room.hoa_don_thang_nay?.con_no || 0;
  const tienHoanTra = Math.max(0, tienCocBanDau - tienConNoThang - phiKhauTru);

  const toggleCheck = (id: string) => {
    setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirm = async () => {
    if (window.confirm(`Xác nhận hoàn tất thủ tục trả phòng ${room.so_phong}?`)) {
      setIsSubmitting(true);
      const note = phiKhauTru > 0 ? `Khấu trừ: ${lyDoKhauTru} (${formatVND(phiKhauTru)})` : 'Bàn giao đầy đủ';
      await onConfirmCheckout(ngayTra, tienHoanTra, note);
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Thủ tục trả phòng & Hoàn cọc</h3>
            <p className="text-xs text-slate-500">Phòng: {room.so_phong} - {room.toa_ten}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          {/* Ngày trả phòng */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Ngày kết thúc / Trả phòng
            </label>
            <input
              type="date"
              value={ngayTra}
              onChange={(e) => setNgayTra(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base"
            />
          </div>

          {/* Đối chiếu đồ bàn giao */}
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase mb-2">
              Đối chiếu tài sản bàn giao ({initialItems.length} món)
            </p>
            {initialItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                Hợp đồng này không lưu danh mục tài sản bàn giao riêng.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {initialItems.map((item, idx) => {
                  const key = item.id || `item-${idx}`;
                  const isChecked = !!checklist[key];

                  return (
                    <div
                      key={key}
                      onClick={() => toggleCheck(key)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="text-sm font-medium">{item.ten}</span>
                      </div>
                      <span className="text-xs text-slate-500">{item.tinh_trang || 'Đầy đủ'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tính hoàn tiền cọc */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Tính toán hoàn tiền cọc</h4>

            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Tiền cọc ban đầu:</span>
              <span className="font-semibold text-slate-900">{formatVND(tienCocBanDau)}</span>
            </div>

            {tienConNoThang > 0 && (
              <div className="flex justify-between text-sm text-rose-600">
                <span>Trừ tiền trọ / điện nước còn nợ:</span>
                <span className="font-semibold">- {formatVND(tienConNoThang)}</span>
              </div>
            )}

            {/* Khấu trừ hỏng hóc nếu có */}
            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Khấu trừ hư hỏng (nếu có):</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={phiKhauTru || ''}
                  onChange={(e) => setPhiKhauTru(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0 đ"
                  className="w-32 px-2.5 py-1 text-right rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>

              {phiKhauTru > 0 && (
                <input
                  type="text"
                  value={lyDoKhauTru}
                  onChange={(e) => setLyDoKhauTru(e.target.value)}
                  placeholder="Lý do khấu trừ (ví dụ: làm hỏng khóa, bẩn tường...)"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              )}
            </div>

            {/* Tổng hoàn cọc */}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-base">
              <span className="font-bold text-slate-800">Thực tế hoàn trả khách:</span>
              <span className="font-extrabold text-emerald-600 text-lg">
                {formatVND(tienHoanTra)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Sau khi xác nhận, hợp đồng sẽ kết thúc, sinh viên được đánh dấu đã rời phòng và phòng chuyển về trạng thái <strong>Phòng trống</strong>.
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-500/25 flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowRightCircle className="w-4 h-4" />
            <span>Xác nhận kết thúc & Trả phòng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
