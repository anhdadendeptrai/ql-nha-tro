import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { Phong, ToaNha, TrangThaiPhong } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatVND } from '../../utils/formatters';

interface AddRoomModalProps {
  toas: ToaNha[];
  selectedToaId: string;
  onSave: (room: Phong) => Promise<void>;
  onClose: () => void;
}

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  toas,
  selectedToaId,
  onSave,
  onClose,
}) => {
  const { ownerId } = useAuth();
  const [toaId, setToaId] = useState(selectedToaId || toas[0]?.id || '');
  const [soPhong, setSoPhong] = useState('P.');
  const [tang, setTang] = useState(1);
  const [giaThue, setGiaThue] = useState(3500000);
  const [soNguoiToiDa, setSoNguoiToiDa] = useState(4);
  const [trangThai, setTrangThai] = useState<TrangThaiPhong>('trong');
  const [ghiChu, setGhiChu] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soPhong.trim() || !toaId) return;

    setIsSubmitting(true);
    const newRoom: Phong = {
      id: `p-${Date.now()}`,
      owner_id: ownerId,
      toa_id: toaId,
      so_phong: soPhong.trim(),
      tang: Number(tang) || 1,
      gia_thue: Number(giaThue) || 0,
      trang_thai: trangThai,
      so_nguoi_toi_da: Number(soNguoiToiDa) || 4,
      ghi_chu: ghiChu.trim(),
      ngay_trong_tu: trangThai === 'trong' ? new Date().toISOString().split('T')[0] : undefined,
    };

    await onSave(newRoom);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Thêm phòng mới</h3>
            <p className="text-xs text-slate-500">Tạo thêm phòng vào danh sách quản lý</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
          {/* Tòa nhà */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Thuộc Tòa
            </label>
            <select
              value={toaId}
              onChange={(e) => setToaId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base bg-white"
            >
              {toas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ten}
                </option>
              ))}
            </select>
          </div>

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
                placeholder="P.103"
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
                Trạng thái ban đầu
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
              placeholder="Mô tả đặc điểm phòng..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-blue-500 outline-none text-base"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo phòng</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
