import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles,
  DoorOpen,
  PieChart,
  Lightbulb,
  FileSpreadsheet,
  Database,
  FileText,
  DollarSign,
} from 'lucide-react';
import { db } from '../../db/dexie';
import type { Phong, HopDong, ToaNha } from '../../types';
import {
  getCurrentMonth,
  getPreviousMonth,
  formatVND,
  formatDate,
  formatMonthYear,
  getDaysPassed,
} from '../../utils/formatters';
import {
  exportTamTruToExcel,
  exportDoanhThuToExcel,
  type SinhVienTamTruRow,
  type DoanhThuExportItem,
} from '../../utils/exportExcel';
import { AddExpenseModal } from './AddExpenseModal';
import { BackupModal } from '../backup/BackupModal';
import { ContractModal } from '../contracts/ContractModal';
import { SyncService } from '../../db/sync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

interface ReportViewProps {
  onGoToRooms?: () => void;
  onOpenSettings?: (initialAddBuilding?: boolean) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  onGoToRooms,
  onOpenSettings,
}) => {
  const { ownerId } = useAuth();
  const { showToast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [selectedToaId, setSelectedToaId] = useState<string>('all');
  
  // Modals state
  const [showAddExpense, setShowAddExpense] = useState<boolean>(false);
  const [showBackup, setShowBackup] = useState<boolean>(false);
  const [showContractSample, setShowContractSample] = useState<boolean>(false);

  // Lấy dữ liệu từ Dexie (chỉ lấy các tòa chưa bị xóa mềm)
  const toaNhas = (useLiveQuery(() => db.toa_nha.toArray(), []) || []).filter((t) => !t.is_deleted);
  const rawPhongs = useLiveQuery(() => db.phong.toArray(), []) || [];
  const rawHopDongs = useLiveQuery(() => db.hop_dong.where({ dang_hieu_luc: 1 as unknown as boolean }).toArray(), []) || [];
  const rawSinhViens = useLiveQuery(() => db.sinh_vien.where({ dang_o: 1 as unknown as boolean }).toArray(), []) || [];
  const rawHoaDons = useLiveQuery(() => db.hoa_don.where({ thang: selectedMonth }).toArray(), [selectedMonth]) || [];
  const rawChiPhis = useLiveQuery(() => db.chi_phi.toArray(), []) || [];
  const rawChiSos = useLiveQuery(() => db.chi_so.where({ thang: selectedMonth }).toArray(), [selectedMonth]) || [];
  const caiDat = useLiveQuery(() => db.cai_dat.get(ownerId), [ownerId]);

  // Lọc chi phí phát sinh trong tháng đã chọn
  const monthChiPhis = useMemo(() => {
    return rawChiPhis.filter((cp) => {
      const matchMonth = cp.ngay && cp.ngay.startsWith(selectedMonth);
      const matchToa = selectedToaId === 'all' || cp.toa_id === selectedToaId;
      return matchMonth && matchToa;
    });
  }, [rawChiPhis, selectedMonth, selectedToaId]);

  // Lọc hóa đơn theo tòa
  const monthHoaDons = useMemo(() => {
    const phongMap = new Map<string, Phong>();
    rawPhongs.forEach((p) => phongMap.set(p.id, p));

    return rawHoaDons.filter((hd) => {
      const phong = phongMap.get(hd.phong_id);
      if (!phong) return false;
      return selectedToaId === 'all' || phong.toa_id === selectedToaId;
    });
  }, [rawHoaDons, rawPhongs, selectedToaId]);

  // Thống kê tài chính & cơ cấu doanh thu theo 4 khoản
  const finance = useMemo(() => {
    let tongCanThu = 0;
    let tongDaThu = 0;
    let tongNo = 0;

    let tongTienPhong = 0;
    let tongTienDien = 0;
    let tongTienDichVu = 0;
    let tongPhuPhi = 0;

    monthHoaDons.forEach((hd) => {
      tongCanThu += hd.tong_tien;
      tongDaThu += hd.da_dong;
      tongNo += hd.con_no;

      tongTienPhong += hd.tien_phong || 0;
      tongTienDien += hd.tien_dien || 0;
      const phiDv =
        hd.tien_dich_vu ?? ((hd.so_nguoi || 1) * (hd.phi_dich_vu_dau_nguoi ?? 170000));
      tongTienDichVu += phiDv;
      const pp = (hd.phu_phi || []).reduce((acc, cur) => acc + (cur.so_tien || 0), 0);
      tongPhuPhi += pp;
    });

    let tongChi = 0;
    let chiDienEvn = 0;
    let chiNuoc = 0;
    let chiSuaChua = 0;
    let chiKhac = 0;

    monthChiPhis.forEach((cp) => {
      tongChi += cp.so_tien;
      if (cp.loai === 'tien_dien_evn') chiDienEvn += cp.so_tien;
      else if (cp.loai === 'tien_nuoc') chiNuoc += cp.so_tien;
      else if (cp.loai === 'sua_chua') chiSuaChua += cp.so_tien;
      else chiKhac += cp.so_tien;
    });

    const loiNhuan = tongDaThu - tongChi;
    const tyLeThu = tongCanThu > 0 ? Math.round((tongDaThu / tongCanThu) * 100) : 0;
    const tyLeChiPhi = tongDaThu > 0 ? Math.round((tongChi / tongDaThu) * 100) : 0;

    return {
      tongCanThu,
      tongDaThu,
      tongNo,
      tongTienPhong,
      tongTienDien,
      tongTienDichVu,
      tongPhuPhi,
      tongChi,
      chiDienEvn,
      chiNuoc,
      chiSuaChua,
      chiKhac,
      loiNhuan,
      tyLeThu,
      tyLeChiPhi,
    };
  }, [monthHoaDons, monthChiPhis]);

  // Danh sách phòng đang trống
  const vacantRooms = useMemo(() => {
    return rawPhongs
      .filter((p) => {
        const matchToa = selectedToaId === 'all' || p.toa_id === selectedToaId;
        return matchToa && p.trang_thai === 'trong';
      })
      .map((p) => ({
        ...p,
        daysVacant: p.ngay_trong_tu ? getDaysPassed(p.ngay_trong_tu) : 0,
      }))
      .sort((a, b) => b.daysVacant - a.daysVacant);
  }, [rawPhongs, selectedToaId]);

  // Danh sách phòng còn nợ tiền
  const debtRooms = useMemo(() => {
    const phongMap = new Map<string, Phong>();
    rawPhongs.forEach((p) => phongMap.set(p.id, p));

    return monthHoaDons
      .filter((hd) => hd.con_no > 0)
      .map((hd) => {
        const p = phongMap.get(hd.phong_id);
        return {
          roomNumber: p?.so_phong || 'Phòng',
          debt: hd.con_no,
        };
      })
      .sort((a, b) => b.debt - a.debt);
  }, [monthHoaDons, rawPhongs]);

  // PHÁT SINH CÂU VĂN TỰ ĐỘNG BẰNG TEMPLATE (KHÔNG DÙNG AI, 0đ)
  const smartInsights = useMemo(() => {
    const insights: { type: 'success' | 'warning' | 'info'; text: string }[] = [];

    // 1. Nhận xét tiến độ thu tiền
    if (finance.tongCanThu > 0) {
      if (finance.tyLeThu >= 90) {
        insights.push({
          type: 'success',
          text: `Tuyệt vời! Kỳ này bạn đã thu đạt ${finance.tyLeThu}% (${formatVND(finance.tongDaThu)}/${formatVND(finance.tongCanThu)}). Dòng tiền rất tốt.`,
        });
      } else {
        const debtRoomsText = debtRooms.slice(0, 3).map((r) => r.roomNumber).join(', ');
        insights.push({
          type: 'warning',
          text: `Đã thu ${finance.tyLeThu}% doanh thu (${formatVND(finance.tongDaThu)}), hiện còn nợ ${formatVND(finance.tongNo)} tại ${debtRooms.length} phòng${debtRoomsText ? ` (${debtRoomsText})` : ''}. Bạn nên gửi tin nhắn nhắc nợ Zalo.`,
        });
      }
    } else {
      insights.push({
        type: 'info',
        text: `Kỳ ${formatMonthYear(selectedMonth)} chưa có hóa đơn nào được chốt. Hãy sang mục "Chốt sổ" để ghi nhận số điện và sinh hóa đơn.`,
      });
    }

    // 2. Nhận xét lợi nhuận & chi phí
    if (finance.tongChi > 0) {
      let maxChiName = 'Sửa chữa';
      let maxChiVal = finance.chiSuaChua;
      if (finance.chiDienEvn > maxChiVal) {
        maxChiName = 'Điện nộp EVN';
        maxChiVal = finance.chiDienEvn;
      }
      if (finance.chiNuoc > maxChiVal) {
        maxChiName = 'Nước sinh hoạt';
        maxChiVal = finance.chiNuoc;
      }

      insights.push({
        type: 'info',
        text: `Chi phí vận hành tháng này chiếm ${finance.tyLeChiPhi}% doanh thu (${formatVND(finance.tongChi)}), trong đó khoản chi lớn nhất là ${maxChiName} (${formatVND(maxChiVal)}). Lợi nhuận ròng thực tế ước đạt ${formatVND(finance.loiNhuan)}.`,
      });
    } else if (finance.tongDaThu > 0) {
      insights.push({
        type: 'info',
        text: `Hiện chưa nhập khoản chi phí vận hành nào trong tháng (tiền nộp điện EVN, nước, sửa chữa...). Bạn có thể bấm "+ Thêm chi phí" để tính lợi nhuận ròng chính xác nhất.`,
      });
    }

    // 3. Nhận xét phòng trống
    if (vacantRooms.length > 0) {
      const longest = vacantRooms[0];
      insights.push({
        type: 'warning',
        text: `Có ${vacantRooms.length} phòng đang để trống, trong đó phòng ${longest.so_phong} đã trống ${longest.daysVacant} ngày. Bạn nên ưu tiên đăng tin tìm người thuê để tránh hụt dòng tiền.`,
      });
    } else if (rawPhongs.length > 0) {
      insights.push({
        type: 'success',
        text: `Tỷ lệ lấp đầy đạt 100%! Toàn bộ các phòng đều đang có sinh viên thuê ở.`,
      });
    }

    // 4. Nhận xét điện năng tiêu thụ cao nhất
    if (rawChiSos.length > 0) {
      const highestDien = [...rawChiSos].sort(
        (a, b) => (b.dien_cuoi - b.dien_dau) - (a.dien_cuoi - a.dien_dau)
      )[0];
      const soDien = highestDien.dien_cuoi - highestDien.dien_dau;
      if (soDien > 0) {
        const p = rawPhongs.find((rm) => rm.id === highestDien.phong_id);
        insights.push({
          type: 'info',
          text: `Phòng ${p?.so_phong || 'này'} tiêu thụ điện cao nhất kỳ với ${soDien} kWh.`,
        });
      }
    }

    return insights;
  }, [finance, debtRooms, vacantRooms, selectedMonth, rawChiSos, rawPhongs]);

  // XUẤT EXCEL DANH SÁCH TẠM TRÚ THEO TÒA
  const handleExportTamTru = () => {
    const toaMap = new Map<string, ToaNha>();
    toaNhas.forEach((t) => toaMap.set(t.id, t));

    const phongMap = new Map<string, Phong>();
    rawPhongs.forEach((p) => phongMap.set(p.id, p));

    const hdMap = new Map<string, HopDong>();
    rawHopDongs.forEach((hd) => hdMap.set(hd.id, hd));

    const items: SinhVienTamTruRow[] = [];

    rawSinhViens.forEach((sv) => {
      if (!sv.dang_o) return;
      const hd = hdMap.get(sv.hop_dong_id);
      if (!hd) return;
      const phong = phongMap.get(hd.phong_id);
      if (!phong) return;
      const toa = toaMap.get(phong.toa_id);
      if (!toa) return;

      if (selectedToaId === 'all' || toa.id === selectedToaId) {
        items.push({
          sinhVien: sv,
          phong,
          toaNha: toa,
        });
      }
    });

    if (items.length === 0) {
      showToast('Không có sinh viên nào đang ở để xuất danh sách tạm trú.', 'info');
      return;
    }

    const toaTen = selectedToaId === 'all' ? 'Tat_Ca_Cac_Toa' : toaMap.get(selectedToaId)?.ten || 'Toa';
    exportTamTruToExcel(items, toaTen);
    showToast(`Đã xuất danh sách tạm trú (${items.length} sinh viên) ra file Excel!`, 'success');
  };

  // XUẤT EXCEL BÁO CÁO DOANH THU (Cột: Tiền phòng, Điện, Phí dịch vụ, Phụ phí, Tổng thu)
  const handleExportDoanhThu = () => {
    const toaMap = new Map<string, ToaNha>();
    toaNhas.forEach((t) => toaMap.set(t.id, t));

    const phongMap = new Map<string, Phong>();
    rawPhongs.forEach((p) => phongMap.set(p.id, p));

    const items: DoanhThuExportItem[] = monthHoaDons.map((hd) => {
      const p = phongMap.get(hd.phong_id);
      const toa = p ? toaMap.get(p.toa_id) : undefined;
      const phiDv =
        hd.tien_dich_vu ?? ((hd.so_nguoi || 1) * (hd.phi_dich_vu_dau_nguoi ?? 170000));
      const pp = (hd.phu_phi || []).reduce((acc, cur) => acc + (cur.so_tien || 0), 0);

      return {
        phong: p?.so_phong || 'Phòng',
        toa: toa?.ten || 'Tòa',
        tienPhong: hd.tien_phong,
        tienDien: hd.tien_dien,
        phiDichVu: phiDv,
        phuPhi: pp,
        tongThu: hd.tong_tien,
        daDong: hd.da_dong,
        conNo: hd.con_no,
        trangThai:
          hd.trang_thai === 'da_dong'
            ? 'Đã đóng đủ'
            : hd.trang_thai === 'dong_thieu'
            ? 'Đóng thiếu'
            : 'Chưa đóng',
      };
    });

    if (items.length === 0) {
      showToast('Chưa có hóa đơn nào trong tháng để xuất Excel doanh thu.', 'info');
      return;
    }

    const toaTen = selectedToaId === 'all' ? 'Tat_Ca_Cac_Toa' : toaMap.get(selectedToaId)?.ten || 'Toa';
    exportDoanhThuToExcel(items, selectedMonth, toaTen);
    showToast(`Đã xuất báo cáo doanh thu (${items.length} phòng) ra file Excel!`, 'success');
  };

  // Xóa chi phí
  const handleDeleteChiPhi = async (id: string, ghiChu: string) => {
    if (window.confirm(`Xác nhận xóa khoản chi "${ghiChu}"?`)) {
      await SyncService.deleteChiPhi(id);
      showToast('Đã xóa khoản chi phí.', 'info');
    }
  };

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

  const sampleRoom = rawPhongs[0] || {
    id: 'sample',
    owner_id: ownerId,
    toa_id: toaNhas[0]?.id || '',
    so_phong: '101',
    tang: 1,
    gia_thue: 3000000,
    trang_thai: 'trong',
    so_nguoi_toi_da: 2,
    ghi_chu: '',
  };

  if (toaNhas.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8 max-w-lg mx-auto my-6 space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <PieChart className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800">Chưa có tòa nào</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Hệ thống chưa có tòa nào. Vui lòng thêm tòa trong mục Cài đặt trước khi xem báo cáo tài chính.
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
      {/* 1. Header chọn Tháng & Tòa */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tab chọn Tòa */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedToaId('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedToaId === 'all'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tất cả các Tòa
            </button>
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
              className="p-1.5 rounded-xl hover:bg-white text-slate-700 cursor-pointer"
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
              className="p-1.5 rounded-xl hover:bg-white text-slate-700 cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Thẻ chỉ số tài chính Báo cáo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          {/* Tổng thu */}
          <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200">
            <span className="text-[11px] font-bold text-blue-800 uppercase block">Tổng doanh thu</span>
            <strong className="text-base sm:text-lg font-black text-blue-800 font-mono">
              {formatVND(finance.tongDaThu)}
            </strong>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Đạt {finance.tyLeThu}% (Nợ: {formatVND(finance.tongNo)})
            </span>
          </div>

          {/* Tổng chi */}
          <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200">
            <span className="text-[11px] font-bold text-rose-800 uppercase block">Chi phí vận hành</span>
            <strong className="text-base sm:text-lg font-black text-rose-700 font-mono">
              {formatVND(finance.tongChi)}
            </strong>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {finance.tyLeChiPhi}% trên doanh thu
            </span>
          </div>

          {/* Lợi nhuận ròng */}
          <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase block">Lợi nhuận ròng</span>
            <strong className="text-base sm:text-lg font-black text-emerald-700 font-mono">
              {formatVND(finance.loiNhuan)}
            </strong>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              (Thu trừ đi chi)
            </span>
          </div>

          {/* Phòng trống */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600 uppercase block">Phòng trống</span>
            <strong className="text-base sm:text-lg font-black text-slate-800 font-mono">
              {vacantRooms.length} phòng
            </strong>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Trên tổng {rawPhongs.length} phòng
            </span>
          </div>
        </div>

        {/* Thanh tác vụ nghiệp vụ nâng cao (Xuất Excel, Hợp đồng, Sao lưu) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          {/* Nút xuất doanh thu Excel (Part 3.8) */}
          <button
            onClick={handleExportDoanhThu}
            className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Xuất Excel doanh thu</span>
          </button>

          {/* Nút xuất tạm trú */}
          <button
            onClick={handleExportTamTru}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Xuất Excel tạm trú công an</span>
          </button>

          {/* Nút xem mẫu hợp đồng */}
          <button
            onClick={() => setShowContractSample(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Mẫu hợp đồng thuê trọ</span>
          </button>

          {/* Nút sao lưu dữ liệu */}
          <button
            onClick={() => setShowBackup(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Database className="w-4 h-4 text-slate-600" />
            <span>Sao lưu dữ liệu</span>
          </button>
        </div>
      </div>

      {/* 2. Cơ cấu doanh thu theo quy tắc mới (Part 3.8) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase">
              Cơ cấu doanh thu kỳ {formatMonthYear(selectedMonth)}
            </h3>
            <p className="text-[11px] text-slate-500">Phân rã theo quy tắc tính tiền mới</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 block">Tiền phòng:</span>
            <strong className="text-sm sm:text-base font-black text-slate-900 font-mono">
              {formatVND(finance.tongTienPhong)}
            </strong>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200">
            <span className="text-[11px] font-bold text-amber-800 block">Tiền điện:</span>
            <strong className="text-sm sm:text-base font-black text-amber-900 font-mono">
              {formatVND(finance.tongTienDien)}
            </strong>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200">
            <span className="text-[11px] font-bold text-blue-800 block">Phí dịch vụ:</span>
            <strong className="text-sm sm:text-base font-black text-blue-900 font-mono">
              {formatVND(finance.tongTienDichVu)}
            </strong>
            <span className="text-[10px] text-blue-600 block">Gồm nước, rác, wifi, xe</span>
          </div>
          <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-200">
            <span className="text-[11px] font-bold text-purple-800 block">Phụ phí:</span>
            <strong className="text-sm sm:text-base font-black text-purple-900 font-mono">
              {formatVND(finance.tongPhuPhi)}
            </strong>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-emerald-800 block">Tổng thu dự kiến:</span>
            <strong className="text-sm sm:text-base font-black text-emerald-800 font-mono">
              {formatVND(finance.tongCanThu)}
            </strong>
          </div>
        </div>
      </div>

      {/* 3. Dashboard Tóm tắt thông minh (Tự sinh bằng Template) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-br from-blue-50/80 via-white to-amber-50/40 border border-blue-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase">
              Tóm tắt tình hình vận hành kỳ {formatMonthYear(selectedMonth)}
            </h3>
            <p className="text-[11px] text-slate-500">Tự động phân tích từ số liệu thực tế</p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {smartInsights.map((insight, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-2xl border text-xs sm:text-sm font-medium leading-relaxed flex items-start gap-2.5 ${
                insight.type === 'success'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : insight.type === 'warning'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : 'bg-white border-blue-100 text-slate-800'
              }`}
            >
              <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
              <span>{insight.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Thanh biểu đồ phân bổ Thu - Chi - Lợi nhuận */}
      {finance.tongDaThu > 0 && (
        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-blue-600" />
            <span>Phân bổ Doanh thu & Chi phí</span>
          </h4>

          {/* Thanh trực quan */}
          <div className="h-6 w-full rounded-xl bg-slate-100 overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${Math.min(100, Math.max(5, 100 - finance.tyLeChiPhi))}%` }}
              className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
              title={`Lợi nhuận ròng: ${formatVND(finance.loiNhuan)}`}
            >
              Lợi nhuận ({100 - finance.tyLeChiPhi}%)
            </div>
            {finance.tyLeChiPhi > 0 && (
              <div
                style={{ width: `${Math.min(100, finance.tyLeChiPhi)}%` }}
                className="bg-rose-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                title={`Chi phí: ${formatVND(finance.tongChi)}`}
              >
                Chi phí ({finance.tyLeChiPhi}%)
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Lợi nhuận ròng ({formatVND(finance.loiNhuan)})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Chi phí vận hành ({formatVND(finance.tongChi)})
            </span>
          </div>
        </div>
      )}

      {/* 5. Quản lý Chi phí vận hành (Bảng chi phí) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase">
              Khoản mục chi phí vận hành ({monthChiPhis.length} khoản)
            </h3>
            <p className="text-xs text-slate-500">
              Tổng chi tháng này: <strong className="text-rose-600">{formatVND(finance.tongChi)}</strong>
            </p>
          </div>

          <button
            onClick={() => setShowAddExpense(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-rose-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm chi phí</span>
          </button>
        </div>

        {monthChiPhis.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-400 text-xs">
            Chưa ghi nhận khoản chi phí vận hành nào trong tháng này.
          </div>
        ) : (
          <div className="space-y-2">
            {monthChiPhis.map((cp) => {
              const loaiLabel = {
                sua_chua: 'Sửa chữa / Bảo trì',
                tien_dien_evn: 'Tiền điện EVN',
                tien_nuoc: 'Tiền nước sinh hoạt',
                khac: 'Chi phí khác',
              }[cp.loai];

              return (
                <div
                  key={cp.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700">
                        {loaiLabel}
                      </span>
                      <strong className="text-slate-900 text-sm">{cp.ghi_chu}</strong>
                    </div>
                    <span className="text-slate-400 block">Ngày chi: {formatDate(cp.ngay)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <strong className="text-sm font-bold text-rose-600 font-mono">
                      {formatVND(cp.so_tien)}
                    </strong>
                    <button
                      onClick={() => handleDeleteChiPhi(cp.id, cp.ghi_chu)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Xóa khoản chi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Danh sách Phòng trống & Số ngày trống */}
      {vacantRooms.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-1.5">
              <DoorOpen className="w-4 h-4 text-emerald-600" />
              <span>Danh sách phòng đang trống ({vacantRooms.length} phòng)</span>
            </h3>
            <span className="text-xs text-slate-500">Cần lấp đầy để tăng doanh thu</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {vacantRooms.map((room) => (
              <div
                key={room.id}
                className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 flex items-center justify-between text-xs"
              >
                <div>
                  <h4 className="text-base font-black text-slate-900">{room.so_phong}</h4>
                  <span className="text-slate-500 font-medium">Giá: {formatVND(room.gia_thue)}</span>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                    Trống {room.daysVacant} ngày
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Thêm chi phí */}
      {showAddExpense && (
        <AddExpenseModal
          toas={toaNhas}
          selectedToaId={selectedToaId}
          onClose={() => setShowAddExpense(false)}
          onSuccess={() => setShowAddExpense(false)}
        />
      )}

      {/* Modal Sao lưu & Khôi phục dữ liệu */}
      {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}

      {/* Modal Mẫu hợp đồng mẫu */}
      {showContractSample && toaNhas[0] && (
        <ContractModal
          phong={sampleRoom}
          toaNha={toaNhas.find((t) => t.id === selectedToaId) || toaNhas[0]}
          caiDat={caiDat}
          onClose={() => setShowContractSample(false)}
        />
      )}
    </div>
  );
};
