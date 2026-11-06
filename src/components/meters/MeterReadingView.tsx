import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Calculator,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileText,
  Save,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { db } from '../../db/dexie';
import type {
  Phong,
  HopDong,
  SinhVien,
  ChiSo,
  HoaDon,
  PhuPhiItem,
} from '../../types';
import {
  getCurrentMonth,
  getPreviousMonth,
  formatVND,
  formatMonthYear,
} from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { InvoiceModal } from '../invoices/InvoiceModal';
import { SyncService } from '../../db/sync';

interface RoomReadingDraft {
  phongId: string;
  soPhong: string;
  tang: number;
  giaThue: number;
  soNguoi: number;
  soXe: number;
  daiDien?: SinhVien;
  
  // Điện
  dienDau: number;
  dienCuoi: number;
  soDien: number;
  dienWarning?: string;

  // Phí dịch vụ (bao gồm nước, rác, wifi, gửi xe)
  phiDichVuDauNguoi: number;
  tienDichVu: number;

  // Phụ phí
  phuPhi: PhuPhiItem[];

  // Thành tiền tính toán
  tienPhong: number;
  tienDien: number;
  tongTien: number;

  // Trạng thái đã chốt hóa đơn trước đó chưa
  existingHoaDon?: HoaDon;
}

interface MeterReadingViewProps {
  onGoToRooms?: () => void;
  onOpenSettings?: (initialAddBuilding?: boolean) => void;
}

export const MeterReadingView: React.FC<MeterReadingViewProps> = ({
  onGoToRooms,
  onOpenSettings,
}) => {
  const { ownerId } = useAuth();
  const { showToast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [selectedToaId, setSelectedToaId] = useState<string>('');

  // Lấy dữ liệu từ Dexie IndexedDB
  const toaNhas = (useLiveQuery(() => db.toa_nha.toArray(), []) || []).filter((t) => !t.is_deleted);
  const rawPhongs = useLiveQuery(() => db.phong.toArray(), []) || [];
  const rawHopDongs = useLiveQuery(() => db.hop_dong.where({ dang_hieu_luc: 1 as unknown as boolean }).toArray(), []) || [];
  const rawSinhViens = useLiveQuery(() => db.sinh_vien.where({ dang_o: 1 as unknown as boolean }).toArray(), []) || [];
  const rawChiSos = useLiveQuery(() => db.chi_so.toArray(), []) || [];
  const rawHoaDons = useLiveQuery(() => db.hoa_don.where({ thang: selectedMonth }).toArray(), [selectedMonth]) || [];
  const caiDat = useLiveQuery(() => db.cai_dat.get(ownerId), [ownerId]);

  // Chọn tòa mặc định đầu tiên
  useEffect(() => {
    if (toaNhas.length > 0 && (!selectedToaId || !toaNhas.some((t) => t.id === selectedToaId))) {
      setSelectedToaId(toaNhas[0].id);
    }
  }, [toaNhas, selectedToaId]);

  const currentToa = useMemo(() => {
    return toaNhas.find((t) => t.id === selectedToaId) || toaNhas[0];
  }, [toaNhas, selectedToaId]);

  // State các dòng nhập liệu nháp (Drafts)
  const [drafts, setDrafts] = useState<{ [phongId: string]: RoomReadingDraft }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [previewInvoice, setPreviewInvoice] = useState<{
    hoaDon: HoaDon;
    phong: Phong;
    daiDien?: SinhVien;
    dienDau?: number;
    dienCuoi?: number;
  } | null>(null);

  // Danh sách các phòng có người thuộc tòa được chọn
  const activeRooms = useMemo(() => {
    if (!currentToa) return [];
    return rawPhongs
      .filter((p) => p.toa_id === currentToa.id && p.trang_thai === 'co_nguoi')
      .sort((a, b) => a.so_phong.localeCompare(b.so_phong, undefined, { numeric: true }));
  }, [rawPhongs, currentToa]);

  // Khởi tạo các dòng nhập liệu khi đổi tháng hoặc đổi tòa
  useEffect(() => {
    if (!currentToa || activeRooms.length === 0) return;

    const prevMonth = getPreviousMonth(selectedMonth);

    // Map hợp đồng & sinh viên
    const hdMap = new Map<string, HopDong>();
    rawHopDongs.forEach((hd) => hdMap.set(hd.phong_id, hd));

    const svByHd = new Map<string, SinhVien[]>();
    rawSinhViens.forEach((sv) => {
      const list = svByHd.get(sv.hop_dong_id) || [];
      list.push(sv);
      svByHd.set(sv.hop_dong_id, list);
    });

    // Chỉ số tháng trước để lấy số đầu
    const prevCsMap = new Map<string, ChiSo>();
    rawChiSos
      .filter((cs) => cs.thang === prevMonth)
      .forEach((cs) => prevCsMap.set(cs.phong_id, cs));

    // Chỉ số tháng này (nếu đã từng lưu)
    const currCsMap = new Map<string, ChiSo>();
    rawChiSos
      .filter((cs) => cs.thang === selectedMonth)
      .forEach((cs) => currCsMap.set(cs.phong_id, cs));

    // Hóa đơn tháng này (nếu đã chốt)
    const currHdBillMap = new Map<string, HoaDon>();
    rawHoaDons.forEach((hd) => currHdBillMap.set(hd.phong_id, hd));

    const phiDichVuDauNguoi = currentToa.phi_dich_vu_dau_nguoi ?? 170000;
    const donGiaDien = currentToa.don_gia_dien ?? 3500;

    const newDrafts: { [phongId: string]: RoomReadingDraft } = {};

    activeRooms.forEach((p) => {
      const hd = hdMap.get(p.id);
      const svList = hd ? svByHd.get(hd.id) || [] : [];
      const daiDien = svList.find((s) => s.la_dai_dien) || svList[0];
      const defaultSoNguoi = Math.max(1, svList.length);
      const soXe = svList.filter((s) => Boolean(s.bien_so && s.bien_so.trim())).length;

      const prevCs = prevCsMap.get(p.id);
      const currCs = currCsMap.get(p.id);
      const currBill = currHdBillMap.get(p.id);

      // Số người ưu tiên lấy từ hóa đơn đã lưu (nếu có), nếu chưa thì lấy số người thực ở
      const soNguoi = currBill?.so_nguoi !== undefined ? currBill.so_nguoi : defaultSoNguoi;

      // Số đầu tự động lấy từ số cuối tháng trước
      const dienDau = currCs ? currCs.dien_dau : prevCs ? prevCs.dien_cuoi : 0;
      const dienCuoi = currCs ? currCs.dien_cuoi : dienDau;
      const soDien = Math.max(0, dienCuoi - dienDau);

      const tienPhong = hd?.gia_thue_thoa_thuan || p.gia_thue;
      const tienDien = soDien * donGiaDien;
      const tienDichVu = soNguoi * phiDichVuDauNguoi;
      const phuPhi = currBill?.phu_phi || [];
      const phuPhiTong = phuPhi.reduce((acc, cur) => acc + (cur.so_tien || 0), 0);
      const tongTien = tienPhong + tienDien + tienDichVu + phuPhiTong;

      newDrafts[p.id] = {
        phongId: p.id,
        soPhong: p.so_phong,
        tang: p.tang,
        giaThue: tienPhong,
        soNguoi,
        soXe,
        daiDien,
        dienDau,
        dienCuoi,
        soDien,
        phiDichVuDauNguoi,
        tienDichVu,
        phuPhi,
        tienPhong,
        tienDien,
        tongTien,
        existingHoaDon: currBill,
      };
    });

    setDrafts(newDrafts);
  }, [currentToa, selectedMonth, activeRooms, rawHopDongs, rawSinhViens, rawChiSos, rawHoaDons]);

  // Cập nhật số điện cuối
  const handleUpdateDienCuoi = (phongId: string, val: number) => {
    setDrafts((prev) => {
      const draft = prev[phongId];
      if (!draft || !currentToa) return prev;

      const dienCuoi = Math.max(0, val);
      const soDien = Math.max(0, dienCuoi - draft.dienDau);
      const tienDien = soDien * currentToa.don_gia_dien;

      // Kiểm tra cảnh báo
      let warning: string | undefined = undefined;
      if (dienCuoi < draft.dienDau) {
        warning = 'Số cuối nhỏ hơn số đầu!';
      } else {
        const threshold = caiDat?.nguong_canh_bao_dien || 300;
        if (soDien > threshold) {
          warning = `Dùng nhiều điện bất thường (> ${threshold} số)!`;
        }
      }

      const phuPhiTong = draft.phuPhi.reduce((acc, cur) => acc + (cur.so_tien || 0), 0);
      const tongTien = draft.tienPhong + tienDien + draft.tienDichVu + phuPhiTong;

      return {
        ...prev,
        [phongId]: {
          ...draft,
          dienCuoi,
          soDien,
          tienDien,
          tongTien,
          dienWarning: warning,
        },
      };
    });
  };

  // Cập nhật số điện đầu (khi chủ trọ muốn sửa tay)
  const handleUpdateDienDau = (phongId: string, val: number) => {
    setDrafts((prev) => {
      const draft = prev[phongId];
      if (!draft || !currentToa) return prev;

      const dienDau = Math.max(0, val);
      const soDien = Math.max(0, draft.dienCuoi - dienDau);
      const tienDien = soDien * currentToa.don_gia_dien;
      const phuPhiTong = draft.phuPhi.reduce((acc, cur) => acc + (cur.so_tien || 0), 0);
      const tongTien = draft.tienPhong + tienDien + draft.tienDichVu + phuPhiTong;

      return {
        ...prev,
        [phongId]: {
          ...draft,
          dienDau,
          soDien,
          tienDien,
          tongTien,
          dienWarning: draft.dienCuoi < dienDau ? 'Số cuối nhỏ hơn số đầu!' : undefined,
        },
      };
    });
  };

  // Cập nhật số người (tính phí dịch vụ 170.000 đ/người)
  const handleUpdateSoNguoi = (phongId: string, val: number) => {
    setDrafts((prev) => {
      const draft = prev[phongId];
      if (!draft || !currentToa) return prev;

      const soNguoi = Math.max(0, val);
      const phiDichVu = currentToa.phi_dich_vu_dau_nguoi ?? 170000;
      const tienDichVu = soNguoi * phiDichVu;
      const phuPhiTong = draft.phuPhi.reduce((acc, cur) => acc + (cur.so_tien || 0), 0);
      const tongTien = draft.tienPhong + draft.tienDien + tienDichVu + phuPhiTong;

      return {
        ...prev,
        [phongId]: {
          ...draft,
          soNguoi,
          tienDichVu,
          tongTien,
        },
      };
    });
  };

  // Nút tự động điền số điện kỳ trước
  const handleAutoFillPreviousMeters = () => {
    const prevMonth = getPreviousMonth(selectedMonth);
    const prevCsMap = new Map<string, ChiSo>();
    rawChiSos
      .filter((cs) => cs.thang === prevMonth)
      .forEach((cs) => prevCsMap.set(cs.phong_id, cs));

    setDrafts((prev) => {
      const updated = { ...prev };
      let filledCount = 0;
      Object.keys(updated).forEach((pid) => {
        const prevCs = prevCsMap.get(pid);
        if (prevCs) {
          const draft = updated[pid];
          const dienDau = prevCs.dien_cuoi;
          const soDien = Math.max(0, draft.dienCuoi - dienDau);
          const tienDien = soDien * (currentToa?.don_gia_dien ?? 3500);
          const phuPhiTong = draft.phuPhi.reduce((acc, cur) => acc + (cur.so_tien || 0), 0);
          const tongTien = draft.tienPhong + tienDien + draft.tienDichVu + phuPhiTong;

          updated[pid] = {
            ...draft,
            dienDau,
            soDien,
            tienDien,
            tongTien,
            dienWarning: draft.dienCuoi < dienDau ? 'Số cuối nhỏ hơn số đầu!' : undefined,
          };
          filledCount++;
        }
      });
      showToast(`Đã tự động lấy số điện cuối tháng trước cho ${filledCount} phòng.`, 'info');
      return updated;
    });
  };

  // Thêm phụ phí cho phòng
  const handleAddPhuPhi = (phongId: string) => {
    const ten = prompt('Tên phụ phí / giảm trừ (ví dụ: Sửa bóng đèn, Giảm tiền hè):');
    if (!ten || !ten.trim()) return;

    const soTienStr = prompt('Số tiền (nhập số âm nếu là giảm trừ, ví dụ: 50000 hoặc -100000):');
    if (soTienStr === null) return;
    const soTien = parseInt(soTienStr, 10);
    if (isNaN(soTien)) return;

    setDrafts((prev) => {
      const draft = prev[phongId];
      if (!draft) return prev;

      const updatedPhuPhi = [...draft.phuPhi, { id: crypto.randomUUID(), ten: ten.trim(), so_tien: soTien }];
      const phuPhiTong = updatedPhuPhi.reduce((acc, cur) => acc + (cur.so_tien || 0), 0);
      const tongTien = draft.tienPhong + draft.tienDien + draft.tienDichVu + phuPhiTong;

      return {
        ...prev,
        [phongId]: {
          ...draft,
          phuPhi: updatedPhuPhi,
          tongTien,
        },
      };
    });
  };

  // Xóa phụ phí
  const handleRemovePhuPhi = (phongId: string, idx: number) => {
    setDrafts((prev) => {
      const draft = prev[phongId];
      if (!draft) return prev;

      const updatedPhuPhi = draft.phuPhi.filter((_, i) => i !== idx);
      const phuPhiTong = updatedPhuPhi.reduce((acc, cur) => acc + (cur.so_tien || 0), 0);
      const tongTien = draft.tienPhong + draft.tienDien + draft.tienDichVu + phuPhiTong;

      return {
        ...prev,
        [phongId]: {
          ...draft,
          phuPhi: updatedPhuPhi,
          tongTien,
        },
      };
    });
  };

  // Thống kê tổng quan tiến độ chốt sổ
  const stats = useMemo(() => {
    const list = Object.values(drafts);
    const totalRooms = list.length;
    let completedCount = 0;
    let totalDienKwh = 0;
    let totalMoney = 0;

    list.forEach((d) => {
      if (d.dienCuoi > 0 || d.existingHoaDon) {
        completedCount++;
      }
      totalDienKwh += d.soDien;
      totalMoney += d.tongTien;
    });

    return { totalRooms, completedCount, totalDienKwh, totalMoney };
  }, [drafts]);

  // Điều hướng tháng
  const handlePrevMonth = () => setSelectedMonth(getPreviousMonth(selectedMonth));
  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    let nextY = y;
    let nextM = m + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    setSelectedMonth(`${nextY}-${String(nextM).padStart(2, '0')}`);
  };

  // LƯU VÀ TẠO HÓA ĐƠN HÀNG LOẠT
  const handleSaveAndGenerateInvoices = async () => {
    if (!currentToa || activeRooms.length === 0) return;

    setIsSubmitting(true);
    try {
      const chiSoBatch: ChiSo[] = [];
      const hoaDonBatch: HoaDon[] = [];

      for (const draft of Object.values(drafts)) {
        // 1. Bản ghi chỉ số điện
        const existingCs = rawChiSos.find((cs) => cs.phong_id === draft.phongId && cs.thang === selectedMonth);
        const chiSoId = existingCs?.id || crypto.randomUUID();
        const chiSoRecord: ChiSo = {
          id: chiSoId,
          owner_id: ownerId,
          phong_id: draft.phongId,
          thang: selectedMonth,
          dien_dau: draft.dienDau,
          dien_cuoi: draft.dienCuoi,
          created_at: existingCs?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        chiSoBatch.push(chiSoRecord);

        // 2. Bản ghi hóa đơn (snapshot toàn bộ đơn giá tại thời điểm chốt)
        const hoaDonId = draft.existingHoaDon?.id || crypto.randomUUID();
        const daDong = draft.existingHoaDon ? draft.existingHoaDon.da_dong : 0;
        const conNo = Math.max(0, draft.tongTien - daDong);
        const trangThai = conNo === 0 && draft.tongTien > 0 ? 'da_dong' : daDong > 0 ? 'dong_thieu' : 'chua_dong';

        const hoaDonRecord: HoaDon = {
          id: hoaDonId,
          owner_id: ownerId,
          phong_id: draft.phongId,
          thang: selectedMonth,
          tien_phong: draft.tienPhong,
          tien_dien: draft.tienDien,
          phi_dich_vu_dau_nguoi: currentToa.phi_dich_vu_dau_nguoi ?? 170000,
          tien_dich_vu: draft.tienDichVu,
          phu_phi: draft.phuPhi,
          tong_tien: draft.tongTien,
          da_dong: daDong,
          con_no: conNo,
          trang_thai: trangThai,
          ghi_chu: draft.existingHoaDon?.ghi_chu || '',
          
          // Chụp lại đơn giá tại thời điểm chốt sổ
          don_gia_dien: currentToa.don_gia_dien ?? 3500,
          so_dien: draft.soDien,
          so_nguoi: draft.soNguoi,
          so_xe: draft.soXe,
          created_at: draft.existingHoaDon?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        hoaDonBatch.push(hoaDonRecord);
      }

      // Lưu vào Dexie và tự động đẩy lên Supabase hoặc hàng đợi Outbox qua SyncService
      await SyncService.saveChiSoBatch(chiSoBatch);
      await SyncService.saveHoaDonBatch(hoaDonBatch);

      showToast(`Đã lưu chỉ số và sinh hóa đơn ${formatMonthYear(selectedMonth)} thành công!`, 'success');
    } catch {
      showToast('Có lỗi xảy ra khi lưu hóa đơn.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mở modal xem hóa đơn
  const handleOpenPreview = (phongId: string) => {
    const draft = drafts[phongId];
    const phong = rawPhongs.find((p) => p.id === phongId);
    if (!draft || !phong || !currentToa) return;

    const hoaDonToPreview: HoaDon = draft.existingHoaDon || {
      id: `hd-${phongId}-${selectedMonth}`,
      owner_id: ownerId,
      phong_id: phongId,
      thang: selectedMonth,
      tien_phong: draft.tienPhong,
      tien_dien: draft.tienDien,
      phi_dich_vu_dau_nguoi: currentToa.phi_dich_vu_dau_nguoi ?? 170000,
      tien_dich_vu: draft.tienDichVu,
      phu_phi: draft.phuPhi,
      tong_tien: draft.tongTien,
      da_dong: 0,
      con_no: draft.tongTien,
      trang_thai: 'chua_dong',
      ghi_chu: '',
      don_gia_dien: currentToa.don_gia_dien ?? 3500,
      so_dien: draft.soDien,
      so_nguoi: draft.soNguoi,
      so_xe: draft.soXe,
    };

    setPreviewInvoice({
      hoaDon: hoaDonToPreview,
      phong,
      daiDien: draft.daiDien,
      dienDau: draft.dienDau,
      dienCuoi: draft.dienCuoi,
    });
  };

  if (toaNhas.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8 max-w-lg mx-auto my-6 space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <Calculator className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800">Chưa có tòa nào</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Hệ thống chưa có tòa nào. Vui lòng thêm tòa trong mục Cài đặt trước khi chốt số điện và lập hóa đơn.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          {onOpenSettings && (
            <button
              onClick={() => onOpenSettings(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-blue-500/25 inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tòa trong Cài đặt</span>
            </button>
          )}
          {onGoToRooms && (
            <button
              onClick={onGoToRooms}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl cursor-pointer transition-colors"
            >
              Về Sơ đồ phòng
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Header chọn Tòa & Chọn Tháng */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tab chọn Tòa */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {toaNhas.map((toa) => (
              <button
                key={toa.id}
                onClick={() => setSelectedToaId(toa.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedToaId === toa.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {toa.ten}
              </button>
            ))}
          </div>

          {/* Chọn tháng */}
          <div className="flex items-center justify-between sm:justify-end gap-2 bg-slate-100 p-1 rounded-2xl shrink-0">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-white text-slate-700 cursor-pointer transition-colors"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-900">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{formatMonthYear(selectedMonth)}</span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-white text-slate-700 cursor-pointer transition-colors"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thông tin đơn giá tòa (Part 3.3 Banner quy định) */}
        {currentToa && (
          <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
            <div>
              Điện: <strong>{formatVND(currentToa.don_gia_dien ?? 3500)}/kWh</strong> • Phí dịch vụ:{' '}
              <strong>{formatVND(currentToa.phi_dich_vu_dau_nguoi ?? 170000)}/người</strong> (gồm nước, rác, wifi, gửi xe)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoFillPreviousMeters}
                className="px-2.5 py-1 bg-white border border-blue-300 text-blue-800 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center gap-1 cursor-pointer transition-colors"
                title="Lấy số cuối tháng trước điền vào số đầu tháng này"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                <span>Tự động điền số điện kỳ trước</span>
              </button>
              <span className="font-semibold text-blue-700">
                Hạn nộp: Ngày {currentToa.han_dong_tien || 5} hàng tháng
              </span>
            </div>
          </div>
        )}

        {/* Thanh tóm tắt tiến độ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Tiến độ nhập:</span>
            <strong className="text-sm font-bold text-slate-900">
              {stats.completedCount}/{stats.totalRooms} phòng
            </strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Tổng điện tiêu thụ:</span>
            <strong className="text-sm font-bold text-amber-600 font-mono">
              {stats.totalDienKwh} kWh
            </strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Dự kiến thu:</span>
            <strong className="text-sm font-bold text-emerald-700 font-mono">
              {formatVND(stats.totalMoney)}
            </strong>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <button
              onClick={handleSaveAndGenerateInvoices}
              disabled={isSubmitting || stats.totalRooms === 0}
              className="w-full h-full font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu & Sinh hóa đơn'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Danh sách nhập chỉ số & tính tiền */}
      {activeRooms.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8">
          <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">Tòa này hiện không có phòng nào đang ở</h4>
          <p className="text-xs text-slate-500 mt-1">
            Chỉ những phòng ở trạng thái "Đang có người" mới hiển thị trong bảng chốt sổ.
          </p>
        </div>
      ) : (
        <>
          {/* Chế độ Desktop / Tablet: Bảng đúng các cột theo yêu cầu Part 3.3 */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Phòng</th>
                    <th className="py-3 px-3">Điện đầu</th>
                    <th className="py-3 px-3">Điện cuối</th>
                    <th className="py-3 px-3">Dùng (kWh)</th>
                    <th className="py-3 px-3">Số người</th>
                    <th className="py-3 px-3">Phụ phí</th>
                    <th className="py-3 px-4 text-right">Tổng tiền</th>
                    <th className="py-3 px-3 text-center">Hóa đơn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeRooms.map((room) => {
                    const draft = drafts[room.id];
                    if (!draft) return null;

                    if (toaNhas.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8 max-w-lg mx-auto my-6 space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <Calculator className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800">Chưa có tòa nào</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Hệ thống chưa có tòa nào. Vui lòng thêm tòa trong mục Cài đặt trước khi chốt số điện và lập hóa đơn.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          {onOpenSettings && (
            <button
              onClick={() => onOpenSettings(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-blue-500/25 inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tòa trong Cài đặt</span>
            </button>
          )}
          {onGoToRooms && (
            <button
              onClick={onGoToRooms}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl cursor-pointer transition-colors"
            >
              Về Sơ đồ phòng
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
                      <tr
                        key={room.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          draft.dienWarning ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        {/* Phòng */}
                        <td className="py-3 px-4">
                          <strong className="text-sm font-black text-slate-900 block">
                            {room.so_phong}
                          </strong>
                          <span className="text-[11px] text-slate-500 truncate block max-w-[120px]">
                            {draft.daiDien?.ho_ten || 'Đại diện'}
                          </span>
                        </td>

                        {/* Điện đầu */}
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min={0}
                            value={draft.dienDau}
                            onChange={(e) => handleUpdateDienDau(room.id, Number(e.target.value))}
                            className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm text-right focus:bg-white focus:border-blue-500 outline-none"
                            title="Số điện đầu (tự động lấy từ tháng trước)"
                          />
                        </td>

                        {/* Điện cuối */}
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min={0}
                            inputMode="decimal"
                            value={draft.dienCuoi || ''}
                            onChange={(e) => handleUpdateDienCuoi(room.id, Number(e.target.value))}
                            className={`w-24 px-2 py-1.5 border rounded-lg font-mono text-sm font-bold text-right outline-none focus:ring-2 ${
                              draft.dienWarning
                                ? 'border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-200'
                                : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100'
                            }`}
                            placeholder="Số cuối"
                          />
                          {draft.dienWarning && (
                            <span className="text-[10px] text-rose-600 block mt-0.5 leading-tight font-medium">
                              {draft.dienWarning}
                            </span>
                          )}
                        </td>

                        {/* Điện dùng */}
                        <td className="py-3 px-3 font-mono font-bold text-amber-700">
                          {draft.soDien} kWh
                        </td>

                        {/* Số người (Tự điền, cho phép sửa trực tiếp theo phòng) */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={draft.soNguoi}
                              onChange={(e) => handleUpdateSoNguoi(room.id, Number(e.target.value))}
                              className="w-14 px-2 py-1.5 border border-slate-300 bg-white rounded-lg font-mono text-sm font-bold text-center outline-none focus:border-blue-500"
                              title="Số người tính phí dịch vụ"
                            />
                            <span className="text-[11px] text-slate-500 font-medium">
                              ({formatVND(draft.tienDichVu)})
                            </span>
                          </div>
                        </td>

                        {/* Phụ phí */}
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleAddPhuPhi(room.id)}
                            className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{draft.phuPhi.length > 0 ? `${draft.phuPhi.length} khoản` : 'Thêm'}</span>
                          </button>
                        </td>

                        {/* Tổng tiền */}
                        <td className="py-3 px-4 text-right">
                          <strong className="text-sm font-black text-blue-700 font-mono">
                            {formatVND(draft.tongTien)}
                          </strong>
                        </td>

                        {/* Xem hóa đơn */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleOpenPreview(room.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                            title="Xem hóa đơn & Chia sẻ QR"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chế độ Mobile: Thẻ lớn từng phòng, chữ to, vùng bấm lớn */}
          <div className="md:hidden space-y-3">
            {activeRooms.map((room) => {
              const draft = drafts[room.id];
              if (!draft) return null;

              return (
                <div
                  key={room.id}
                  className={`p-4 rounded-3xl bg-white border-2 shadow-xs space-y-3 transition-all ${
                    draft.dienWarning
                      ? 'border-rose-400 bg-rose-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Hàng đầu: Số phòng & Tổng tiền */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-900">{room.so_phong}</h3>
                        <span className="text-xs text-slate-500">Tầng {room.tang}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        👤 {draft.daiDien?.ho_ten || 'Đại diện'} • {draft.soXe} xe
                      </p>
                    </div>

                    <div className="text-right">
                      <strong className="text-base font-black text-blue-700 font-mono block">
                        {formatVND(draft.tongTien)}
                      </strong>
                      <button
                        onClick={() => handleOpenPreview(room.id)}
                        className="text-[11px] text-blue-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Xem hóa đơn</span>
                      </button>
                    </div>
                  </div>

                  {/* Nhập số điện */}
                  <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-900 flex items-center gap-1">
                        ⚡ Số điện (kWh)
                      </span>
                      <span className="font-bold text-amber-800 font-mono">
                        Dùng: {draft.soDien} số ({formatVND(draft.tienDien)})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Số đầu:</label>
                        <input
                          type="number"
                          value={draft.dienDau}
                          onChange={(e) => handleUpdateDienDau(room.id, Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-base font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-700 font-bold block mb-0.5">
                          Số cuối: <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={draft.dienCuoi || ''}
                          onChange={(e) => handleUpdateDienCuoi(room.id, Number(e.target.value))}
                          placeholder="Nhập số cuối"
                          className={`w-full px-3 py-2 border rounded-xl text-base font-mono font-bold outline-none ${
                            draft.dienWarning
                              ? 'border-rose-500 bg-rose-50 text-rose-700'
                              : 'border-slate-300 bg-white focus:border-blue-500'
                          }`}
                        />
                      </div>
                    </div>

                    {draft.dienWarning && (
                      <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{draft.dienWarning}</span>
                      </p>
                    )}
                  </div>

                  {/* Nhập số người tính phí dịch vụ */}
                  <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-blue-950 block">Phí dịch vụ trọn gói:</span>
                      <span className="text-[11px] text-blue-700">Đã gồm nước, rác, wifi, xe</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={draft.soNguoi}
                        onChange={(e) => handleUpdateSoNguoi(room.id, Number(e.target.value))}
                        className="w-14 px-2 py-1.5 bg-white border border-blue-300 rounded-xl text-sm font-bold text-center outline-none"
                      />
                      <span className="text-xs font-bold text-blue-900 font-mono">
                        người = {formatVND(draft.tienDichVu)}
                      </span>
                    </div>
                  </div>

                  {/* Phụ phí / Giảm trừ */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={() => handleAddPhuPhi(room.id)}
                      className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm phụ phí / Giảm trừ ({draft.phuPhi.length})</span>
                    </button>
                  </div>

                  {draft.phuPhi.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {draft.phuPhi.map((pp, idx) => (
                        <div
                          key={pp.id || idx}
                          className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <span>{pp.ten}: <strong>{formatVND(pp.so_tien)}</strong></span>
                          <button
                            onClick={() => handleRemovePhuPhi(room.id, idx)}
                            className="text-slate-400 hover:text-rose-500 p-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Nút lưu cố định dưới đáy mobile */}
      <div className="fixed bottom-16 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 flex items-center justify-between gap-3 max-w-md mx-auto shadow-xl">
        <div className="text-xs">
          <span className="text-slate-500 block">Đã nhập:</span>
          <strong className="text-sm font-bold text-slate-900">
            {stats.completedCount}/{stats.totalRooms} phòng
          </strong>
        </div>

        <button
          onClick={handleSaveAndGenerateInvoices}
          disabled={isSubmitting || stats.totalRooms === 0}
          className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'Đang lưu...' : 'Lưu & Sinh hóa đơn'}</span>
        </button>
      </div>

      {/* Modal xem trước và chia sẻ hóa đơn VietQR */}
      {previewInvoice && currentToa && (
        <InvoiceModal
          hoaDon={previewInvoice.hoaDon}
          toaNha={currentToa}
          phong={previewInvoice.phong}
          daiDien={previewInvoice.daiDien}
          caiDat={caiDat}
          dienDau={previewInvoice.dienDau}
          dienCuoi={previewInvoice.dienCuoi}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </div>
  );
};
