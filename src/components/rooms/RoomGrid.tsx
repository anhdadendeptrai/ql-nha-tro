import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Search,
  Plus,
  AlertTriangle,
  Clock,
  DoorOpen,
  Building,
} from 'lucide-react';
import { db } from '../../db/dexie';
import type { PhongChiTiet, Phong, HopDong, SinhVien, HoaDon, ChiSo } from '../../types';
import { getCurrentMonth, getDaysRemaining, getDaysPassed } from '../../utils/formatters';
import { removeVietnameseTones } from '../../utils/vietnamese';
import { RoomCard } from './RoomCard';
import { RoomDetailModal } from './RoomDetailModal';
import { AddRoomModal } from './AddRoomModal';
import { SyncService } from '../../db/sync';
import { useToast } from '../common/Toast';

type FilterChip = 'all' | 'unpaid' | 'expiring' | 'vacant' | 'occupied';

interface RoomGridProps {
  onOpenSettings?: (initialAddBuilding?: boolean) => void;
}

export const RoomGrid: React.FC<RoomGridProps> = ({ onOpenSettings }) => {
  const { showToast } = useToast();
  const currentMonth = getCurrentMonth();

  // Dữ liệu thời gian thực từ Dexie IndexedDB
  const toaNhas = (useLiveQuery(() => db.toa_nha.toArray(), []) || []).filter((t) => !t.is_deleted);
  const rawPhongs = useLiveQuery(() => db.phong.toArray(), []) || [];
  const rawHopDongs = useLiveQuery(() => db.hop_dong.toArray(), []) || [];
  const rawSinhViens = useLiveQuery(() => db.sinh_vien.toArray(), []) || [];
  const rawHoaDons = useLiveQuery(() => db.hoa_don.where({ thang: currentMonth }).toArray(), [currentMonth]) || [];
  const rawChiSos = useLiveQuery(() => db.chi_so.where({ thang: currentMonth }).toArray(), [currentMonth]) || [];

  // State bộ lọc và tìm kiếm
  const [selectedToaId, setSelectedToaId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [filterChip, setFilterChip] = useState<FilterChip>('all');

  // Modal states
  const [selectedRoom, setSelectedRoom] = useState<PhongChiTiet | null>(null);
  const [showAddRoom, setShowAddRoom] = useState<boolean>(false);

  // Debounce 150ms cho ô tìm kiếm
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Ghép dữ liệu chi tiết cho từng phòng
  const allDetailedRooms: PhongChiTiet[] = useMemo(() => {
    const toaMap = new Map<string, string>();
    toaNhas.forEach((t) => toaMap.set(t.id, t.ten));

    const hdMap = new Map<string, HopDong>();
    rawHopDongs.forEach((hd) => {
      if (hd.dang_hieu_luc) {
        hdMap.set(hd.phong_id, hd);
      }
    });

    const svByHd = new Map<string, SinhVien[]>();
    rawSinhViens.forEach((sv) => {
      if (sv.dang_o) {
        const list = svByHd.get(sv.hop_dong_id) || [];
        list.push(sv);
        svByHd.set(sv.hop_dong_id, list);
      }
    });

    const hdBillMap = new Map<string, HoaDon>();
    rawHoaDons.forEach((hd) => hdBillMap.set(hd.phong_id, hd));

    const csMap = new Map<string, ChiSo>();
    rawChiSos.forEach((cs) => csMap.set(cs.phong_id, cs));

    return rawPhongs.map((p) => {
      const hd = hdMap.get(p.id);
      const svList = hd ? svByHd.get(hd.id) || [] : [];
      const daiDien = svList.find((s) => s.la_dai_dien) || svList[0];
      const bikeCount = svList.filter((s) => Boolean(s.bien_so && s.bien_so.trim())).length;
      const daysRemaining = hd ? getDaysRemaining(hd.ngay_het_han) : undefined;
      const daysVacant = p.trang_thai === 'trong' && p.ngay_trong_tu ? getDaysPassed(p.ngay_trong_tu) : undefined;

      return {
        ...p,
        toa_ten: toaMap.get(p.toa_id) || 'Tòa',
        hop_dong_hien_tai: hd,
        sinh_vien_list: svList,
        dai_dien: daiDien,
        so_nguoi_hien_tai: svList.length,
        so_xe_hien_tai: bikeCount,
        hoa_don_thang_nay: hdBillMap.get(p.id),
        chi_so_thang_nay: csMap.get(p.id),
        so_ngay_con_han: daysRemaining,
        da_het_han: daysRemaining !== undefined ? daysRemaining < 0 : false,
        so_ngay_trong: daysVacant,
      };
    });
  }, [toaNhas, rawPhongs, rawHopDongs, rawSinhViens, rawHoaDons, rawChiSos]);

  // Thống kê cảnh báo trên cùng
  const alertStats = useMemo(() => {
    let unpaid = 0;
    let expiring = 0;
    let vacant = 0;

    allDetailedRooms.forEach((r) => {
      if (r.trang_thai === 'co_nguoi') {
        if (!r.hoa_don_thang_nay || r.hoa_don_thang_nay.trang_thai !== 'da_dong') {
          unpaid++;
        }
        if (r.so_ngay_con_han !== undefined && r.so_ngay_con_han <= 30) {
          expiring++;
        }
      } else if (r.trang_thai === 'trong') {
        vacant++;
      }
    });

    return { unpaid, expiring, vacant };
  }, [allDetailedRooms]);

  // Lọc theo Tòa, Chip lọc và Tìm kiếm tức thì (không dấu)
  const filteredRooms = useMemo(() => {
    const cleanQ = removeVietnameseTones(debouncedQuery);

    return allDetailedRooms.filter((r) => {
      // 1. Lọc theo tòa nhà
      if (selectedToaId !== 'all' && r.toa_id !== selectedToaId) {
        return false;
      }

      // 2. Lọc theo chip
      if (filterChip === 'unpaid') {
        if (r.trang_thai !== 'co_nguoi') return false;
        if (r.hoa_don_thang_nay && r.hoa_don_thang_nay.trang_thai === 'da_dong') return false;
      } else if (filterChip === 'expiring') {
        if (r.trang_thai !== 'co_nguoi') return false;
        if (r.so_ngay_con_han === undefined || r.so_ngay_con_han > 30) return false;
      } else if (filterChip === 'vacant') {
        if (r.trang_thai !== 'trong') return false;
      } else if (filterChip === 'occupied') {
        if (r.trang_thai !== 'co_nguoi') return false;
      }

      // 3. Tìm kiếm tổng hợp (bỏ dấu tiếng Việt)
      if (cleanQ) {
        const matchRoom = removeVietnameseTones(r.so_phong).includes(cleanQ);
        const matchBuilding = removeVietnameseTones(r.toa_ten).includes(cleanQ);
        const matchStudent = r.sinh_vien_list.some((s) => {
          return (
            removeVietnameseTones(s.ho_ten).includes(cleanQ) ||
            s.sdt.includes(cleanQ) ||
            s.cccd.includes(cleanQ) ||
            removeVietnameseTones(s.bien_so).includes(cleanQ) ||
            removeVietnameseTones(s.truong).includes(cleanQ)
          );
        });

        if (!matchRoom && !matchBuilding && !matchStudent) {
          return false;
        }
      }

      return true;
    });
  }, [allDetailedRooms, selectedToaId, filterChip, debouncedQuery]);

  // Gom nhóm phòng theo Tầng (tang)
  const roomsGroupedByFloor = useMemo(() => {
    const groups = new Map<number, PhongChiTiet[]>();
    filteredRooms.forEach((r) => {
      const list = groups.get(r.tang) || [];
      list.push(r);
      groups.set(r.tang, list);
    });

    // Sắp xếp tầng tăng dần (Tầng 1 -> Tầng 2 -> ...)
    const sortedFloors = Array.from(groups.keys()).sort((a, b) => a - b);
    return sortedFloors.map((floor) => ({
      floor,
      rooms: groups.get(floor)!.sort((a, b) => a.so_phong.localeCompare(b.so_phong, undefined, { numeric: true })),
    }));
  }, [filteredRooms]);

  // Thêm phòng mới
  const handleSaveNewRoom = async (newRoom: Phong) => {
    await SyncService.savePhong(newRoom);
    showToast(`Đã thêm phòng ${newRoom.so_phong}!`, 'success');
  };

  if (toaNhas.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8 max-w-lg mx-auto my-6 space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <Building className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800">Chưa có tòa nào</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Hệ thống nhà trọ hiện đang hoàn toàn trống. Bấm <strong>"Thêm tòa"</strong> để bắt đầu thiết lập tòa nhà đầu tiên.
          </p>
        </div>
        <button
          onClick={() => onOpenSettings?.(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-blue-500/25 inline-flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm tòa để bắt đầu</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Thanh tab chuyển Tòa */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-1">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl">
          <button
            onClick={() => setSelectedToaId('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              selectedToaId === 'all'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả các Tòa ({allDetailedRooms.length})
          </button>
          {toaNhas.map((toa) => {
            const countInToa = allDetailedRooms.filter((r) => r.toa_id === toa.id).length;
            const isSelected = selectedToaId === toa.id;

            return (
              <button
                key={toa.id}
                onClick={() => setSelectedToaId(toa.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none ${
                  isSelected
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {toa.ten} ({countInToa})
              </button>
            );
          })}
        </div>

        {/* Nút thêm phòng */}
        <button
          onClick={() => setShowAddRoom(true)}
          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-blue-500/20 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Thêm phòng</span>
        </button>
      </div>

      {/* 2. Dải cảnh báo thông minh trên cùng */}
      <div className="grid grid-cols-3 gap-2">
        {/* Chưa đóng */}
        <button
          onClick={() => setFilterChip(filterChip === 'unpaid' ? 'all' : 'unpaid')}
          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterChip === 'unpaid'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center gap-1.5 text-rose-600 mb-0.5">
            <Clock className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Chưa đóng</span>
          </div>
          <span className="text-xl font-black text-rose-700">{alertStats.unpaid}</span>
          <span className="text-[11px] text-slate-500 block leading-tight">phòng chưa nộp tiền</span>
        </button>

        {/* Sắp hết hạn */}
        <button
          onClick={() => setFilterChip(filterChip === 'expiring' ? 'all' : 'expiring')}
          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterChip === 'expiring'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center gap-1.5 text-amber-600 mb-0.5">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Sắp hết hạn</span>
          </div>
          <span className="text-xl font-black text-amber-700">{alertStats.expiring}</span>
          <span className="text-[11px] text-slate-500 block leading-tight">dưới 30 ngày / quá hạn</span>
        </button>

        {/* Phòng trống */}
        <button
          onClick={() => setFilterChip(filterChip === 'vacant' ? 'all' : 'vacant')}
          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterChip === 'vacant'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200'
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-1.5 text-emerald-600 mb-0.5">
            <DoorOpen className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Phòng trống</span>
          </div>
          <span className="text-xl font-black text-emerald-700">{alertStats.vacant}</span>
          <span className="text-[11px] text-slate-500 block leading-tight">đang chờ đón khách</span>
        </button>
      </div>

      {/* 3. Ô tìm kiếm & Chip lọc nhanh */}
      <div className="space-y-2">
        {/* Input tìm kiếm */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo số phòng, tên sinh viên, SĐT, biển số xe, CCCD..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded-full bg-slate-100"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Chip lọc nhanh */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 pl-1">
            Lọc:
          </span>
          <button
            onClick={() => setFilterChip('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              filterChip === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Tất cả ({allDetailedRooms.length})
          </button>
          <button
            onClick={() => setFilterChip('unpaid')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              filterChip === 'unpaid'
                ? 'bg-rose-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Chưa đóng ({alertStats.unpaid})
          </button>
          <button
            onClick={() => setFilterChip('expiring')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              filterChip === 'expiring'
                ? 'bg-amber-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Sắp hết hạn ({alertStats.expiring})
          </button>
          <button
            onClick={() => setFilterChip('vacant')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              filterChip === 'vacant'
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Phòng trống ({alertStats.vacant})
          </button>
          <button
            onClick={() => setFilterChip('occupied')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              filterChip === 'occupied'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Đang ở ({allDetailedRooms.length - alertStats.vacant})
          </button>
        </div>
      </div>

      {/* 4. Danh sách phòng nhóm theo tầng */}
      {allDetailedRooms.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8 space-y-3">
          <DoorOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-base font-bold text-slate-700">Chưa có phòng nào</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Chưa có phòng nào trong hệ thống. Bấm nút <strong>"Thêm phòng"</strong> để tạo phòng mới.
          </p>
          <button
            onClick={() => setShowAddRoom(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm phòng</span>
          </button>
        </div>
      ) : roomsGroupedByFloor.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8">
          <DoorOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">Không tìm thấy phòng nào</h4>
          <p className="text-xs text-slate-500 mt-1">
            Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc "Tất cả".
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {roomsGroupedByFloor.map(({ floor, rooms }) => (
            <div key={floor} className="space-y-2.5">
              {/* Tiêu đề tầng */}
              <div className="flex items-center gap-2 pl-1">
                <span className="w-2 h-4 rounded-full bg-blue-600 inline-block" />
                <h3 className="text-sm font-extrabold text-slate-800 tracking-wide">
                  TẦNG {floor}
                </h3>
                <span className="text-xs font-medium text-slate-400">
                  ({rooms.length} phòng)
                </span>
              </div>

              {/* Lưới phòng */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onClick={() => setSelectedRoom(room)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Chi tiết phòng */}
      {selectedRoom && (
        <RoomDetailModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onRefresh={() => {
            // Cập nhật lại selectedRoom từ danh sách mới
            const updated = allDetailedRooms.find((r) => r.id === selectedRoom.id);
            if (updated) setSelectedRoom(updated);
          }}
        />
      )}

      {/* Modal Thêm phòng mới */}
      {showAddRoom && (
        <AddRoomModal
          toas={toaNhas}
          selectedToaId={selectedToaId === 'all' ? toaNhas[0]?.id || '' : selectedToaId}
          onSave={handleSaveNewRoom}
          onClose={() => setShowAddRoom(false)}
        />
      )}
    </div>
  );
};
