import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import type { Phong, TrangThaiPhong } from '../../types';
import { formatVND } from '../../utils/formatters';

interface EditRoomModalProps {
  room: Phong;
  onSave: (updated: Phong) => Promise<void>;
  onClose: () => void;
}

export const EditRoomModal: React.FC<EditRoomModalProps> = ({
  room,
  onSave,
  onClose,
}) => {
  const [soPhong, setSoPhong] = useState(room.so_phong);
  const [tang, setTang] = useState(room.tang);
  const [giaThue, setGiaThue] = useState(room.gia_thue);
  const [trangThai, setTrangThai] = useState<TrangThaiPhong>(room.trang_thai);
  const [soNguoiToiDa, setSoNguoiToiDa] = useState(room.so_nguoi_toi_da);
  const [ghiChu, setGhiChu] = useState(room.ghi_chu || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soPhong.trim()) return;

    setIsSubmitting(true);
    await onSave({
      ...room,
      so_phong: soPhong.trim(),
      tang: Number(tang) || 1,
      gia_thue: Number(giaThue) || 0,
      trang_thai: trangThai,
      so_nguoi_toi_da: Number(soNguoiToiDa) || 4,
      ghi_chu: ghiChu.trim(),
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Sửa thông tin phòng</h3>
            <p className="text-xs text-slate-500">Phòng: {room.so_phong}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Số phòng
              </label>
              <input
                type="text"
                required
                value={soPhong}
                onChange={(e) => setSoPhong(e.target.value)}
                placeholder="P.101"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Tầng
              </label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={tang}
                onChange={(e) => setTang(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Giá thuê tháng ({formatVND(giaThue)})
            </label>
            <input
              type="number"
              step={50000}
              required
              value={giaThue}
              onChange={(e) => setGiaThue(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Trạng thái
              </label>
              <select
                value={trangThai}
                onChange={(e) => setTrangThai(e.target.value as TrangThaiPhong)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base bg-white"
              >
                <option value="trong">Phòng trống</option>
                <option value="co_nguoi">Đang có người</option>
                <option value="sua_chua">Đang sửa chữa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Số người tối đa
              </label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={soNguoiToiDa}
                onChange={(e) => setSoNguoiToiDa(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Ghi chú thêm
            </label>
            <textarea
              rows={2}
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Ví dụ: hướng ban công, đồ dùng đặc biệt..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base"
            />
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
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
