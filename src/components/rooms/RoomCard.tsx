import React from 'react';
import { Users, Bike, AlertTriangle, CalendarClock, CheckCircle, Clock } from 'lucide-react';
import type { PhongChiTiet } from '../../types';
import { formatVND } from '../../utils/formatters';

interface RoomCardProps {
  room: PhongChiTiet;
  onClick: () => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onClick }) => {
  // Trạng thái phòng: màu sắc đường viền và nhãn
  const statusConfig = {
    trong: {
      label: 'Phòng trống',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      borderClass: 'border-emerald-200 hover:border-emerald-400',
      accentColor: 'bg-emerald-500',
    },
    co_nguoi: {
      label: 'Đang ở',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      borderClass: 'border-blue-200 hover:border-blue-400',
      accentColor: 'bg-blue-500',
    },
    sua_chua: {
      label: 'Sửa chữa',
      badgeClass: 'bg-slate-200 text-slate-700 border-slate-300',
      borderClass: 'border-slate-200 hover:border-slate-400',
      accentColor: 'bg-slate-400',
    },
  }[room.trang_thai];

  // Tính trạng thái thanh toán tháng này
  const hoaDon = room.hoa_don_thang_nay;
  let paymentBadge = null;

  if (room.trang_thai === 'co_nguoi') {
    if (!hoaDon || hoaDon.trang_thai === 'chua_dong') {
      paymentBadge = (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
          <Clock className="w-3 h-3" />
          <span>Chưa đóng {hoaDon ? `(${formatVND(hoaDon.con_no)})` : ''}</span>
        </span>
      );
    } else if (hoaDon.trang_thai === 'dong_thieu') {
      paymentBadge = (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3 h-3" />
          <span>Thiếu {formatVND(hoaDon.con_no)}</span>
        </span>
      );
    } else if (hoaDon.trang_thai === 'da_dong') {
      paymentBadge = (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle className="w-3 h-3" />
          <span>Đã đóng</span>
        </span>
      );
    }
  }

  // Tính trạng thái hợp đồng (vàng nếu < 30 ngày, đỏ nếu quá hạn)
  let contractBadge = null;
  if (room.trang_thai === 'co_nguoi' && room.hop_dong_hien_tai) {
    const days = room.so_ngay_con_han;
    if (days !== undefined) {
      if (days < 0) {
        contractBadge = (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-300">
            <AlertTriangle className="w-3 h-3" />
            <span>Quá hạn {Math.abs(days)} ngày</span>
          </span>
        );
      } else if (days <= 30) {
        contractBadge = (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <CalendarClock className="w-3 h-3" />
            <span>Còn {days} ngày</span>
          </span>
        );
      }
    }
  }

  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-2xl p-4 border-2 shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.98] select-none flex flex-col justify-between min-h-[145px] ${statusConfig.borderClass}`}
      style={{ minHeight: '145px' }}
    >
      {/* Vạch màu trạng thái bên trái */}
      <span
        className={`absolute top-3 left-0 bottom-3 w-1.5 rounded-r-md ${statusConfig.accentColor}`}
      />

      {/* Hàng 1: Số phòng + Nhãn trạng thái */}
      <div>
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight pl-1">
            {room.so_phong}
          </h3>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusConfig.badgeClass}`}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Hàng 2: Giá thuê */}
        <p className="text-xs font-medium text-slate-500 pl-1 mb-2">
          {formatVND(room.gia_thue)} / tháng
        </p>
      </div>

      {/* Hàng 3: Thông tin người ở / Xe / Hạn hợp đồng */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100 pl-1">
        {room.trang_thai === 'co_nguoi' ? (
          <>
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {room.so_nguoi_hien_tai}/{room.so_nguoi_toi_da} người
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Bike className="w-3.5 h-3.5 text-slate-500" />
                <span>{room.so_xe_hien_tai} xe</span>
              </div>
            </div>

            {/* Người đại diện */}
            {room.dai_dien && (
              <p className="text-xs text-slate-700 truncate font-semibold">
                👤 {room.dai_dien.ho_ten}
              </p>
            )}

            {/* Badges hợp đồng & tiền */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              {paymentBadge}
              {contractBadge}
            </div>
          </>
        ) : room.trang_thai === 'trong' ? (
          <div className="text-xs text-emerald-700 font-medium">
            {room.so_ngay_trong ? (
              <span>Đang trống {room.so_ngay_trong} ngày</span>
            ) : (
              <span>Sẵn sàng đón khách</span>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">
            {room.ghi_chu || 'Đang bảo trì/sửa chữa'}
          </div>
        )}
      </div>
    </div>
  );
};
