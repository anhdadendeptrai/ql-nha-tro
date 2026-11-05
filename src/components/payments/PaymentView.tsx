import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  HandCoins,
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  FileText,
  RotateCcw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { db } from '../../db/dexie';
import type { HoaDon, ToaNha, Phong, SinhVien, HopDong } from '../../types';
import {
  getCurrentMonth,
  getPreviousMonth,
  formatVND,
  formatMonthYear,
} from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { SyncService } from '../../db/sync';
import { ZaloMessageModal } from './ZaloMessageModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { InvoiceModal } from '../invoices/InvoiceModal';

interface PaymentItem {
  hoaDon: HoaDon;
  phong: Phong;
  toaNha: ToaNha;
  daiDien?: SinhVien;
}

interface PaymentViewProps {
  onGoToRooms?: () => void;
  onOpenSettings?: (initialAddBuilding?: boolean) => void;
}

export const PaymentView: React.FC<PaymentViewProps> = ({
  onGoToRooms,
  onOpenSettings,
}) => {
  const { ownerId } = useAuth();
  const { showToast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [selectedToaId, setSelectedToaId] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<'unpaid' | 'paid'>('unpaid');

  // Lấy dữ liệu từ Dexie
  const toaNhas = (useLiveQuery(() => db.toa_nha.toArray(), []) || []).filter((t) => !t.is_deleted);
  const rawPhongs = useLiveQuery(() => db.phong.toArray(), []) || [];
  const rawHopDongs = useLiveQuery(() => db.hop_dong.where({ dang_hieu_luc: 1 as unknown as boolean }).toArray(), []) || [];
  const rawSinhViens = useLiveQuery(() => db.sinh_vien.where({ dang_o: 1 as unknown as boolean }).toArray(), []) || [];
  const rawHoaDons = useLiveQuery(() => db.hoa_don.where({ thang: selectedMonth }).toArray(), [selectedMonth]) || [];
  const caiDat = useLiveQuery(() => db.cai_dat.get(ownerId), [ownerId]);

  // Modals state
  const [zaloTarget, setZaloTarget] = useState<PaymentItem | null>(null);
  const [recordTarget, setRecordTarget] = useState<PaymentItem | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<PaymentItem | null>(null);

  // Undo bar (Hoàn tác 5 giây khi bấm "Đã đóng đủ")
  const [undoState, setUndoState] = useState<{
    hoaDonId: string;
    roomNumber: string;
    previousDaDong: number;
    expiresAt: number;
  } | null>(null);

  // Bộ đếm lùi hoàn tác
  useEffect(() => {
    if (!undoState) return;

    const timer = setInterval(() => {
      const remaining = undoState.expiresAt - Date.now();
      if (remaining <= 0) {
        setUndoState(null);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [undoState]);

  // Ghép dữ liệu chi tiết các hóa đơn trong tháng
  const allPaymentItems: PaymentItem[] = useMemo(() => {
    const toaMap = new Map<string, ToaNha>();
    toaNhas.forEach((t) => toaMap.set(t.id, t));

    const phongMap = new Map<string, Phong>();
    rawPhongs.forEach((p) => phongMap.set(p.id, p));

    const hdMap = new Map<string, HopDong>();
    rawHopDongs.forEach((hd) => hdMap.set(hd.phong_id, hd));

    const svByHd = new Map<string, SinhVien[]>();
    rawSinhViens.forEach((sv) => {
      const list = svByHd.get(sv.hop_dong_id) || [];
      list.push(sv);
      svByHd.set(sv.hop_dong_id, list);
    });

    const list: PaymentItem[] = [];
    rawHoaDons.forEach((hd) => {
      const phong = phongMap.get(hd.phong_id);
      if (!phong) return;
      const toa = toaMap.get(phong.toa_id);
      if (!toa) return;

      const contract = hdMap.get(phong.id);
      const svList = contract ? svByHd.get(contract.id) || [] : [];
      const daiDien = svList.find((s) => s.la_dai_dien) || svList[0];

      list.push({
        hoaDon: hd,
        phong,
        toaNha: toa,
        daiDien,
      });
    });

    return list;
  }, [rawHoaDons, rawPhongs, toaNhas, rawHopDongs, rawSinhViens]);

  // Thống kê tổng thu, đã thu, còn nợ và tỷ lệ
  const stats = useMemo(() => {
    const filteredByToa =
      selectedToaId === 'all'
        ? allPaymentItems
        : allPaymentItems.filter((i) => i.phong.toa_id === selectedToaId);

    let totalBilled = 0;
    let totalCollected = 0;
    let totalDebt = 0;

    filteredByToa.forEach((item) => {
      totalBilled += item.hoaDon.tong_tien;
      totalCollected += item.hoaDon.da_dong;
      totalDebt += item.hoaDon.con_no;
    });

    const rate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    return { totalBilled, totalCollected, totalDebt, rate };
  }, [allPaymentItems, selectedToaId]);

  // Danh sách hiển thị theo bộ lọc và sắp xếp giảm dần theo số nợ
  const displayItems = useMemo(() => {
    return allPaymentItems
      .filter((item) => {
        if (selectedToaId !== 'all' && item.phong.toa_id !== selectedToaId) return false;
        if (activeFilter === 'unpaid') {
          return item.hoaDon.trang_thai !== 'da_dong';
        } else {
          return item.hoaDon.trang_thai === 'da_dong';
        }
      })
      .sort((a, b) => b.hoaDon.con_no - a.hoaDon.con_no);
  }, [allPaymentItems, selectedToaId, activeFilter]);

  // Thao tác 1 chạm: Đã đóng đủ
  const handlePayInFull = async (item: PaymentItem) => {
    const previousDaDong = item.hoaDon.da_dong;
    const fullAmount = item.hoaDon.tong_tien;

    // Optimistic UI: Cập nhật ngay tức thì
    await SyncService.updatePaymentStatus(
      item.hoaDon.id,
      fullAmount,
      'chuyen_khoan',
      'Đã thu đủ 1 chạm'
    );

    // Kích hoạt thanh hoàn tác 5 giây
    setUndoState({
      hoaDonId: item.hoaDon.id,
      roomNumber: item.phong.so_phong,
      previousDaDong,
      expiresAt: Date.now() + 5000,
    });
  };

  // Hoàn tác thao tác thu tiền
  const handleUndo = async () => {
    if (!undoState) return;
    await SyncService.revertPayment(undoState.hoaDonId, undoState.previousDaDong);
    showToast(`Đã hoàn tác trạng thái phòng ${undoState.roomNumber}!`, 'info');
    setUndoState(null);
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

  if (toaNhas.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8 max-w-lg mx-auto my-6 space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <HandCoins className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800">Chưa có tòa nào</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Hệ thống chưa có tòa nào. Vui lòng thêm tòa trong mục Cài đặt trước khi theo dõi thu tiền.
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
      {/* 1. Header chọn tháng & Tòa nhà */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tab chọn tòa */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedToaId('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedToaId === 'all'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tất cả ({allPaymentItems.length})
            </button>
            {toaNhas.map((toa) => {
              const count = allPaymentItems.filter((i) => i.phong.toa_id === toa.id).length;
              return (
                <button
                  key={toa.id}
                  onClick={() => setSelectedToaId(toa.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedToaId === toa.id
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {toa.ten} ({count})
                </button>
              );
            })}
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

        {/* 4 Thẻ chỉ số tài chính */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Cần thu</span>
            <strong className="text-base sm:text-lg font-black text-slate-900 font-mono">
              {formatVND(stats.totalBilled)}
            </strong>
          </div>

          <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase block">Đã thu</span>
            <strong className="text-base sm:text-lg font-black text-emerald-700 font-mono">
              {formatVND(stats.totalCollected)}
            </strong>
          </div>

          <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200">
            <span className="text-[11px] font-bold text-rose-800 uppercase block">Còn nợ</span>
            <strong className="text-base sm:text-lg font-black text-rose-700 font-mono">
              {formatVND(stats.totalDebt)}
            </strong>
          </div>

          <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-blue-800 uppercase block">Tỷ lệ thu</span>
              <strong className="text-base sm:text-lg font-black text-blue-700 font-mono">
                {stats.rate}%
              </strong>
            </div>
            <TrendingUp className="w-6 h-6 text-blue-600 opacity-60" />
          </div>
        </div>
      </div>

      {/* 2. Thanh lọc tab: Chưa nộp vs Đã hoàn thành */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveFilter('unpaid')}
          className={`flex-1 py-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeFilter === 'unpaid'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>
            Chưa đóng / Nợ ({allPaymentItems.filter((i) => i.hoaDon.trang_thai !== 'da_dong').length})
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('paid')}
          className={`flex-1 py-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeFilter === 'paid'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>
            Đã đóng đủ ({allPaymentItems.filter((i) => i.hoaDon.trang_thai === 'da_dong').length})
          </span>
        </button>
      </div>

      {/* 3. Danh sách phòng thu tiền */}
      {allPaymentItems.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8 space-y-2">
          <HandCoins className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h4 className="text-base font-bold text-slate-700">Chưa có hóa đơn nào trong tháng này</h4>
          <p className="text-xs text-slate-500">
            Hãy sang mục "Chốt sổ" để ghi nhận số điện và lập hóa đơn thu tiền cho các phòng.
          </p>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8">
          <HandCoins className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">
            {activeFilter === 'unpaid'
              ? 'Tuyệt vời! Không còn phòng nào nợ tiền kỳ này'
              : 'Chưa có phòng nào hoàn thành nộp tiền'}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {activeFilter === 'unpaid'
              ? 'Tất cả sinh viên đã hoàn thành nghĩa vụ tiền trọ tháng này.'
              : 'Hãy sử dụng nút "Đã đóng đủ" hoặc "Thu tiền" để ghi nhận.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item) => {
            const { hoaDon, phong, toaNha, daiDien } = item;
            const isUnpaid = hoaDon.trang_thai !== 'da_dong';

            return (
              <div
                key={hoaDon.id}
                className={`p-4 rounded-3xl bg-white border-2 shadow-xs space-y-3 transition-all ${
                  isUnpaid ? 'border-slate-200 hover:border-rose-300' : 'border-emerald-200 bg-emerald-50/10'
                }`}
              >
                {/* Hàng 1: Số phòng + Số tiền nợ */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900">{phong.so_phong}</h3>
                      <span className="text-xs text-slate-500 font-medium">
                        {toaNha.ten} • Tầng {phong.tang}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-slate-800">
                        👤 {daiDien?.ho_ten || 'Đại diện phòng'}
                      </span>
                      {daiDien?.sdt && (
                        <a
                          href={`tel:${daiDien.sdt}`}
                          className="text-xs text-blue-600 font-mono font-bold hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{daiDien.sdt}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Số tiền còn nợ:</span>
                    <strong
                      className={`text-lg font-black font-mono block ${
                        isUnpaid ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatVND(hoaDon.con_no)}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      (Tổng: {formatVND(hoaDon.tong_tien)})
                    </span>
                  </div>
                </div>

                {/* Hàng 2: Nút hành động */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Nhắn Zalo */}
                    <button
                      onClick={() => setZaloTarget(item)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                      title="Gửi tin nhắn nhắc nợ Zalo"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                      <span>Nhắn Zalo</span>
                    </button>

                    {/* Xem hóa đơn & QR */}
                    <button
                      onClick={() => setInvoiceTarget(item)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                      title="Xem hóa đơn và quét mã QR"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      <span>Xem hóa đơn</span>
                    </button>
                  </div>

                  {/* Nút thu tiền */}
                  <div className="flex items-center gap-2">
                    {isUnpaid && (
                      <button
                        onClick={() => setRecordTarget(item)}
                        className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                      >
                        Thu một phần
                      </button>
                    )}

                    {isUnpaid ? (
                      <button
                        onClick={() => handlePayInFull(item)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm shadow-emerald-500/25 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Đã đóng đủ</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã thanh toán đủ
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Thanh hoàn tác (Undo Banner 5 giây) */}
      {undoState && (
        <div className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <p className="font-bold">Đã đánh dấu đóng đủ phòng {undoState.roomNumber}!</p>
              <p className="text-slate-400 text-[11px]">Bấm hoàn tác nếu bấm nhầm</p>
            </div>
          </div>

          <button
            onClick={handleUndo}
            className="px-3 py-1.5 rounded-xl bg-white text-slate-900 font-extrabold text-xs flex items-center gap-1 hover:bg-slate-100 cursor-pointer shrink-0 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hoàn tác (5s)</span>
          </button>
        </div>
      )}

      {/* Modals con */}
      {zaloTarget && (
        <ZaloMessageModal
          hoaDon={zaloTarget.hoaDon}
          toaNha={zaloTarget.toaNha}
          phong={zaloTarget.phong}
          daiDien={zaloTarget.daiDien}
          caiDat={caiDat}
          onClose={() => setZaloTarget(null)}
        />
      )}

      {recordTarget && (
        <RecordPaymentModal
          hoaDon={recordTarget.hoaDon}
          phong={recordTarget.phong}
          daiDien={recordTarget.daiDien}
          onClose={() => setRecordTarget(null)}
          onSuccess={() => setRecordTarget(null)}
        />
      )}

      {invoiceTarget && (
        <InvoiceModal
          hoaDon={invoiceTarget.hoaDon}
          toaNha={invoiceTarget.toaNha}
          phong={invoiceTarget.phong}
          daiDien={invoiceTarget.daiDien}
          caiDat={caiDat}
          onClose={() => setInvoiceTarget(null)}
        />
      )}
    </div>
  );
};
