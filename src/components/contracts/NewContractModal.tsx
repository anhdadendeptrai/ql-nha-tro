import React, { useState } from 'react';
import { X, FileText, CheckCircle, UserCheck, Plus } from 'lucide-react';
import type { PhongChiTiet, HopDong, SinhVien, DoBanGiaoItem } from '../../types';
import { formatVND } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

interface NewContractModalProps {
  room: PhongChiTiet;
  onSave: (hopDong: HopDong, sinhViens: SinhVien[]) => Promise<void>;
  onClose: () => void;
}

const COMMON_ASSETS = [
  'Điều hòa',
  'Bình nóng lạnh',
  'Giường ngủ',
  'Tủ quần áo',
  'Bàn ghế học',
  'Khóa vân tay',
];

export const NewContractModal: React.FC<NewContractModalProps> = ({
  room,
  onSave,
  onClose,
}) => {
  const { ownerId } = useAuth();
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];
  const [ngayBatDau, setNgayBatDau] = useState<string>(todayStr);

  // Mặc định thời hạn 1 năm
  const defaultEndDate = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const [ngayHetHan, setNgayHetHan] = useState<string>(defaultEndDate);

  const [tienCoc, setTienCoc] = useState<number>(room.gia_thue);
  const [giaThue, setGiaThue] = useState<number>(room.gia_thue);

  // Sinh viên đại diện (Người ký hợp đồng)
  const [tenSv1, setTenSv1] = useState('');
  const [sdtSv1, setSdtSv1] = useState('');
  const [cccdSv1, setCccdSv1] = useState('');
  const [truongSv1, setTruongSv1] = useState('');
  const [bienSoSv1, setBienSoSv1] = useState('');

  // Sinh viên thứ 2 (Người ở cùng - nếu muốn thêm luôn để thành 2/2)
  const [showMember2, setShowMember2] = useState(room.so_nguoi_toi_da >= 2);
  const [tenSv2, setTenSv2] = useState('');
  const [sdtSv2, setSdtSv2] = useState('');
  const [bienSoSv2, setBienSoSv2] = useState('');

  // Đồ bàn giao đã chọn
  const [selectedAssets, setSelectedAssets] = useState<string[]>([
    'Điều hòa',
    'Bình nóng lạnh',
    'Giường ngủ',
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chọn thời hạn nhanh
  const handleQuickDuration = (months: number) => {
    const start = new Date(ngayBatDau || todayStr);
    const end = new Date(start.setMonth(start.getMonth() + months));
    setNgayHetHan(end.toISOString().split('T')[0]);
  };

  const handleToggleAsset = (asset: string) => {
    setSelectedAssets((prev) =>
      prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenSv1.trim()) {
      showToast('Vui lòng nhập họ tên người đại diện ký hợp đồng', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const hopDongId = crypto.randomUUID();
      const sv1Id = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      const doBanGiao: DoBanGiaoItem[] = selectedAssets.map((name) => ({
        id: crypto.randomUUID(),
        ten: name,
        so_luong: 1,
        tinh_trang: 'Hoạt động tốt',
      }));

      const newHopDong: HopDong = {
        id: hopDongId,
        owner_id: ownerId,
        phong_id: room.id,
        ngay_bat_dau: ngayBatDau,
        ngay_het_han: ngayHetHan,
        tien_coc: Number(tienCoc) || 0,
        gia_thue_thoa_thuan: Number(giaThue) || room.gia_thue,
        do_ban_giao: doBanGiao,
        nguoi_dai_dien_id: sv1Id,
        dang_hieu_luc: true,
        ghi_chu: '',
        created_at: nowIso,
        updated_at: nowIso,
      };

      const sinhViensToSave: SinhVien[] = [
        {
          id: sv1Id,
          owner_id: ownerId,
          hop_dong_id: hopDongId,
          ho_ten: tenSv1.trim(),
          sdt: sdtSv1.trim(),
          cccd: cccdSv1.trim(),
          truong: truongSv1.trim(),
          bien_so: bienSoSv1.trim().toUpperCase(),
          la_dai_dien: true,
          ngay_vao: ngayBatDau,
          dang_o: true,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ];

      // Nếu có nhập thông tin người ở cùng (bạn thứ 2)
      if (tenSv2.trim()) {
        const sv2Id = crypto.randomUUID();
        sinhViensToSave.push({
          id: sv2Id,
          owner_id: ownerId,
          hop_dong_id: hopDongId,
          ho_ten: tenSv2.trim(),
          sdt: sdtSv2.trim(),
          cccd: '',
          truong: '',
          bien_so: bienSoSv2.trim().toUpperCase(),
          la_dai_dien: false,
          ngay_vao: ngayBatDau,
          dang_o: true,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      await onSave(newHopDong, sinhViensToSave);
      showToast(
        sinhViensToSave.length > 1
          ? `Đã tạo hợp đồng và thêm đủ ${sinhViensToSave.length}/${room.so_nguoi_toi_da} người vào phòng ${room.so_phong}!`
          : `Đã tạo hợp đồng cho phòng ${room.so_phong}!`,
        'success'
      );
      onClose();
    } catch {
      showToast('Có lỗi xảy ra khi tạo hợp đồng.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Ký hợp đồng cho thuê phòng {room.so_phong}</span>
            </h3>
            <p className="text-xs text-slate-500">
              {room.toa_ten} • Sức chứa tối đa: <strong>{room.so_nguoi_toi_da} người</strong>
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
          {/* 1. Thời hạn & Tiền cọc */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase block">
              1. Thời hạn hợp đồng & Tiền cọc
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày bắt đầu ở:
                </label>
                <input
                  type="date"
                  required
                  value={ngayBatDau}
                  onChange={(e) => setNgayBatDau(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Ngày hết hạn:</label>
                  <div className="flex gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleQuickDuration(6)}
                      className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 cursor-pointer"
                    >
                      6 tháng
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDuration(12)}
                      className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 cursor-pointer"
                    >
                      1 năm
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={ngayHetHan}
                  onChange={(e) => setNgayHetHan(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiền đặt cọc ({formatVND(tienCoc)}):
                </label>
                <input
                  type="number"
                  step={50000}
                  required
                  value={tienCoc}
                  onChange={(e) => setTienCoc(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Giá thuê tháng ({formatVND(giaThue)}):
                </label>
                <input
                  type="number"
                  step={50000}
                  required
                  value={giaThue}
                  onChange={(e) => setGiaThue(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 2. Người đại diện ký hợp đồng */}
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-3">
            <span className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-blue-600" />
              2. Người đại diện phòng (Khách thuê thứ 1)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={tenSv1}
                  onChange={(e) => setTenSv1(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0912345678"
                  value={sdtSv1}
                  onChange={(e) => setSdtSv1(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Biển số xe:</label>
                <input
                  type="text"
                  placeholder="29A1-12345"
                  value={bienSoSv1}
                  onChange={(e) => setBienSoSv1(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono uppercase text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Trường học:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: ĐH Bách Khoa"
                  value={truongSv1}
                  onChange={(e) => setTruongSv1(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Số CCCD:</label>
                <input
                  type="text"
                  placeholder="12 chữ số"
                  value={cccdSv1}
                  onChange={(e) => setCccdSv1(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Người ở cùng thứ 2 (để điền đủ 2/2) */}
          {room.so_nguoi_toi_da >= 2 && (
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase">
                  3. Người ở cùng thứ 2 (Tùy chọn - để đủ 2/{room.so_nguoi_toi_da} người)
                </span>
                {!showMember2 ? (
                  <button
                    type="button"
                    onClick={() => setShowMember2(true)}
                    className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm người thứ 2 ngay</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMember2(false);
                      setTenSv2('');
                      setSdtSv2('');
                    }}
                    className="text-xs text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    Bỏ qua người thứ 2
                  </button>
                )}
              </div>

              {showMember2 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Họ tên người thứ 2:
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Trần Văn Bình"
                      value={tenSv2}
                      onChange={(e) => setTenSv2(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Số điện thoại:
                    </label>
                    <input
                      type="tel"
                      placeholder="0987654321"
                      value={sdtSv2}
                      onChange={(e) => setSdtSv2(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Biển số xe:
                    </label>
                    <input
                      type="text"
                      placeholder="29B1-99999"
                      value={bienSoSv2}
                      onChange={(e) => setBienSoSv2(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono uppercase text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Tài sản bàn giao */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase block">
              4. Trang thiết bị bàn giao phòng:
            </span>
            <div className="flex flex-wrap gap-2">
              {COMMON_ASSETS.map((asset) => {
                const isSelected = selectedAssets.includes(asset);
                return (
                  <button
                    key={asset}
                    type="button"
                    onClick={() => handleToggleAsset(asset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '} {asset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Submit */}
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
              <CheckCircle className="w-4 h-4" />
              <span>
                Ký hợp đồng {tenSv2.trim() ? '(2/2 người)' : '(1/2 người)'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
