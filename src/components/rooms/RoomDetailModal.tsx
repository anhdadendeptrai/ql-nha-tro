import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import {
  X,
  Phone,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  LogOut,
  SlidersHorizontal,
  History,
  CheckCircle2,
  FileText,
  BadgeCheck,
  Eye,
  QrCode,
} from 'lucide-react';
import type { PhongChiTiet, SinhVien, DoBanGiaoItem, Phong } from '../../types';
import { formatVND, formatDate } from '../../utils/formatters';
import { AddStudentModal } from './AddStudentModal';
import { CccdViewerModal } from './CccdViewerModal';
import { CheckoutModal } from './CheckoutModal';
import { EditRoomModal } from './EditRoomModal';
import { InvoiceModal } from '../invoices/InvoiceModal';
import { ContractModal } from '../contracts/ContractModal';
import { SyncService } from '../../db/sync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

interface RoomDetailModalProps {
  room: PhongChiTiet;
  onClose: () => void;
  onRefresh: () => void;
}

export const RoomDetailModal: React.FC<RoomDetailModalProps> = ({
  room,
  onClose,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const { ownerId } = useAuth();
  const toaNha = useLiveQuery(() => db.toa_nha.get(room.toa_id), [room.toa_id]);
  const caiDat = useLiveQuery(() => db.cai_dat.get(ownerId), [ownerId]);
  const [activeTab, setActiveTab] = useState<'students' | 'history'>('students');

  // Modal con
  const [showAddStudent, setShowAddStudent] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<SinhVien | undefined>(undefined);
  const [viewingCccd, setViewingCccd] = useState<{ name: string; front?: string; back?: string } | null>(null);
  const [showCheckout, setShowCheckout] = useState<boolean>(false);
  const [showEditRoom, setShowEditRoom] = useState<boolean>(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [showContractModal, setShowContractModal] = useState<boolean>(false);

  // Đồ bàn giao
  const hopDong = room.hop_dong_hien_tai;
  const [doBanGiaoList, setDoBanGiaoList] = useState<DoBanGiaoItem[]>(hopDong?.do_ban_giao || []);
  const [newDoTen, setNewDoTen] = useState('');
  const [newDoTinhTrang, setNewDoTinhTrang] = useState('');

  // Lưu sinh viên
  const handleSaveStudent = async (sv: SinhVien) => {
    // Nếu sinh viên này được chọn làm đại diện, cập nhật người đại diện trong hợp đồng
    if (sv.la_dai_dien && hopDong) {
      // Hủy cờ đại diện của các sinh viên khác trong cùng hợp đồng
      for (const other of room.sinh_vien_list) {
        if (other.id !== sv.id && other.la_dai_dien) {
          other.la_dai_dien = false;
          await SyncService.saveSinhVien(other);
        }
      }
      hopDong.nguoi_dai_dien_id = sv.id;
      await SyncService.saveHopDong(hopDong);
    }
    await SyncService.saveSinhVien(sv);
    onRefresh();
  };

  // Đặt làm đại diện
  const handleSetRepresentative = async (sv: SinhVien) => {
    if (!hopDong) return;
    for (const member of room.sinh_vien_list) {
      member.la_dai_dien = member.id === sv.id;
      await SyncService.saveSinhVien(member);
    }
    hopDong.nguoi_dai_dien_id = sv.id;
    await SyncService.saveHopDong(hopDong);
    showToast(`Đã chọn ${sv.ho_ten} làm đại diện phòng.`, 'success');
    onRefresh();
  };

  // Xóa / Rời phòng
  const handleRemoveStudent = async (sv: SinhVien) => {
    const confirmRemove = window.confirm(`Xác nhận sinh viên ${sv.ho_ten} đã rời phòng?`);
    if (confirmRemove) {
      await SyncService.removeSinhVien(sv.id);
      showToast(`Đã đánh dấu ${sv.ho_ten} rời phòng.`, 'info');
      onRefresh();
    }
  };

  // Thêm đồ bàn giao
  const handleAddDoBanGiao = async () => {
    if (!newDoTen.trim() || !hopDong) return;
    const newItem: DoBanGiaoItem = {
      id: `dbg-${Date.now()}`,
      ten: newDoTen.trim(),
      so_luong: 1,
      tinh_trang: newDoTinhTrang.trim() || 'Tốt',
    };
    const updated = [...doBanGiaoList, newItem];
    setDoBanGiaoList(updated);
    hopDong.do_ban_giao = updated;
    await SyncService.saveHopDong(hopDong);
    setNewDoTen('');
    setNewDoTinhTrang('');
    showToast('Đã thêm tài sản bàn giao!', 'success');
  };

  // Xóa đồ bàn giao
  const handleDeleteDoBanGiao = async (id: string) => {
    if (!hopDong) return;
    const updated = doBanGiaoList.filter((item) => item.id !== id);
    setDoBanGiaoList(updated);
    hopDong.do_ban_giao = updated;
    await SyncService.saveHopDong(hopDong);
    showToast('Đã xóa món đồ khỏi danh sách', 'info');
  };

  // Trả phòng
  const handleConfirmCheckout = async (ngayTra: string, _tienHoanCoc: number, _ghiChu: string) => {
    await SyncService.checkoutPhong(room.id, ngayTra);
    showToast(`Đã hoàn tất trả phòng ${room.so_phong}! Phòng chuyển về trạng thái Trống.`, 'success');
    onRefresh();
    onClose();
  };

  // Lưu thông tin phòng
  const handleSaveRoom = async (updatedRoom: Phong) => {
    await SyncService.savePhong(updatedRoom);
    showToast('Đã cập nhật thông tin phòng!', 'success');
    onRefresh();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-black text-slate-900">{room.so_phong}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    room.trang_thai === 'trong'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : room.trang_thai === 'co_nguoi'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {room.trang_thai === 'trong'
                    ? 'Phòng trống'
                    : room.trang_thai === 'co_nguoi'
                    ? 'Đang có người'
                    : 'Đang sửa chữa'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {room.toa_ten} • Tầng {room.tang} • Giá thuê: <strong>{formatVND(room.gia_thue)}</strong>/tháng
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="grid grid-cols-2 border-b border-slate-200 bg-white">
            <button
              onClick={() => setActiveTab('students')}
              className={`py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'students'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Sinh viên & Hợp đồng</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Lịch sử tiền & Điện nước</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 overflow-y-auto space-y-6 flex-1">
            {activeTab === 'students' ? (
              <>
                {/* 1. Hợp đồng thuê */}
                {room.trang_thai === 'co_nguoi' && hopDong ? (
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Hợp đồng đang hiệu lực
                      </span>
                      {room.so_ngay_con_han !== undefined && (
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            room.so_ngay_con_han < 0
                              ? 'bg-rose-100 text-rose-700'
                              : room.so_ngay_con_han <= 30
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {room.so_ngay_con_han < 0
                            ? `Quá hạn ${Math.abs(room.so_ngay_con_han)} ngày`
                            : room.so_ngay_con_han <= 30
                            ? `Sắp hết hạn (${room.so_ngay_con_han} ngày)`
                            : `Còn ${room.so_ngay_con_han} ngày`}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs text-slate-700">
                      <div>
                        <span className="text-slate-500 block">Ngày bắt đầu:</span>
                        <strong className="text-slate-900">{formatDate(hopDong.ngay_bat_dau)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Ngày hết hạn:</span>
                        <strong className="text-slate-900">{formatDate(hopDong.ngay_het_han)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Tiền cọc:</span>
                        <strong className="text-blue-700">{formatVND(hopDong.tien_coc)}</strong>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowContractModal(true)}
                      className="w-full mt-2 py-1.5 px-3 rounded-xl border border-blue-300 bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Xem & In hợp đồng thuê phòng (A4 / PDF)</span>
                    </button>
                  </div>
                ) : room.trang_thai === 'trong' ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                    <p className="text-sm font-bold text-emerald-900">Phòng này đang trống!</p>
                    <p className="text-xs text-emerald-700">
                      Chưa có hợp đồng nào đang hiệu lực. Bạn có thể ký hợp đồng mới khi có sinh viên đến thuê.
                    </p>
                  </div>
                ) : null}

                {/* 2. Danh sách Sinh viên */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 uppercase">
                        Thành viên phòng ({room.sinh_vien_list.length}/{room.so_nguoi_toi_da} người)
                      </h3>
                      {room.so_xe_hien_tai > 0 && (
                        <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                          {room.so_xe_hien_tai} xe máy
                        </span>
                      )}
                    </div>
                    {hopDong && (
                      <button
                        onClick={() => {
                          setEditingStudent(undefined);
                          setShowAddStudent(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm sinh viên</span>
                      </button>
                    )}
                  </div>

                  {room.sinh_vien_list.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-500 text-xs space-y-3">
                      <p className="font-semibold text-slate-700">Chưa có sinh viên nào trong phòng này.</p>
                      {hopDong ? (
                        <div>
                          <p className="text-slate-500 mb-2">Bấm "+ Thêm sinh viên" để thêm khách thuê vào phòng.</p>
                          <button
                            onClick={() => {
                              setEditingStudent(undefined);
                              setShowAddStudent(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Thêm sinh viên</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-slate-500">Phòng chưa ký hợp đồng thuê.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {room.sinh_vien_list.map((sv) => (
                        <div
                          key={sv.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            sv.la_dai_dien
                              ? 'border-blue-300 bg-blue-50/30 shadow-xs'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-slate-900 text-sm">{sv.ho_ten}</h4>
                                {sv.la_dai_dien && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white flex items-center gap-1">
                                    <BadgeCheck className="w-3 h-3" />
                                    Đại diện
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {sv.truong || 'Chưa cập nhật trường'}
                              </p>
                            </div>

                            {/* Nút hành động */}
                            <div className="flex items-center gap-1">
                              {/* Xem ảnh CCCD */}
                              <button
                                onClick={() =>
                                  setViewingCccd({
                                    name: sv.ho_ten,
                                    front: sv.anh_cccd_truoc,
                                    back: sv.anh_cccd_sau,
                                  })
                                }
                                className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                                title="Xem ảnh CCCD"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Sửa thông tin */}
                              <button
                                onClick={() => {
                                  setEditingStudent(sv);
                                  setShowAddStudent(true);
                                }}
                                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                                title="Sửa thông tin"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Rời phòng */}
                              <button
                                onClick={() => handleRemoveStudent(sv)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Đánh dấu rời phòng"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Chi tiết liên hệ */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs">
                            <div>
                              <span className="text-slate-400 block">SĐT liên hệ:</span>
                              {sv.sdt ? (
                                <a
                                  href={`tel:${sv.sdt}`}
                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{sv.sdt}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">Chưa có</span>
                              )}
                            </div>
                            <div>
                              <span className="text-slate-400 block">Số CCCD (12 số):</span>
                              <span className="font-mono text-slate-700 font-medium">
                                {sv.cccd || 'Chưa cập nhật'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Biển số xe máy:</span>
                              <span className="font-mono text-slate-800 font-bold uppercase">
                                {sv.bien_so || 'Không có'}
                              </span>
                            </div>
                          </div>

                          {!sv.la_dai_dien && (
                            <button
                              onClick={() => handleSetRepresentative(sv)}
                              className="mt-2 text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer block"
                            >
                              + Đặt làm người đại diện phòng
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Checklist Bàn giao đồ đạc */}
                {hopDong && (
                  <div className="pt-2 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">
                      Tài sản bàn giao ({doBanGiaoList.length} món)
                    </h3>
                    <div className="space-y-1.5 mb-3">
                      {doBanGiaoList.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <strong className="text-slate-800">{item.ten}</strong>
                            <span className="text-slate-500">({item.tinh_trang})</span>
                          </div>
                          <button
                            onClick={() => item.id && handleDeleteDoBanGiao(item.id)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Thêm đồ đạc */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Tên đồ dùng (ví dụ: Quạt trần, Tủ lạnh...)"
                        value={newDoTen}
                        onChange={(e) => setNewDoTen(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Tình trạng (mới 95%)"
                        value={newDoTinhTrang}
                        onChange={(e) => setNewDoTinhTrang(e.target.value)}
                        className="w-28 px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                      />
                      <button
                        onClick={handleAddDoBanGiao}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 cursor-pointer"
                      >
                        Thêm
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Tab 2: Lịch sử tiền & điện nước */
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase">
                  Hóa đơn & Chỉ số tháng hiện tại
                </h3>

                {room.hoa_don_thang_nay ? (
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">
                        {room.hoa_don_thang_nay.thang}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          room.hoa_don_thang_nay.trang_thai === 'da_dong'
                            ? 'bg-emerald-100 text-emerald-800'
                            : room.hoa_don_thang_nay.trang_thai === 'dong_thieu'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {room.hoa_don_thang_nay.trang_thai === 'da_dong'
                          ? 'Đã đóng đủ'
                          : room.hoa_don_thang_nay.trang_thai === 'dong_thieu'
                          ? 'Đóng thiếu'
                          : 'Chưa đóng'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Tiền phòng:</span>{' '}
                        <strong>{formatVND(room.hoa_don_thang_nay.tien_phong)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Tiền điện ({room.hoa_don_thang_nay.so_dien} số):</span>{' '}
                        <strong>{formatVND(room.hoa_don_thang_nay.tien_dien)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Phí dịch vụ ({room.hoa_don_thang_nay.so_nguoi || 1} người):</span>{' '}
                        <strong>
                          {formatVND(
                            room.hoa_don_thang_nay.tien_dich_vu ??
                              ((room.hoa_don_thang_nay.so_nguoi || 1) *
                                (room.hoa_don_thang_nay.phi_dich_vu_dau_nguoi ?? 170000))
                          )}
                        </strong>
                        <span className="text-[10px] text-slate-400 block">Đã gồm nước, rác, wifi, xe</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">Tổng cộng:</span>
                      <strong className="text-blue-700 text-base font-extrabold">
                        {formatVND(room.hoa_don_thang_nay.tong_tien)}
                      </strong>
                    </div>

                    {room.hoa_don_thang_nay.con_no > 0 && (
                      <div className="flex items-center justify-between text-xs text-rose-600 font-semibold">
                        <span>Còn nợ lại:</span>
                        <span>{formatVND(room.hoa_don_thang_nay.con_no)}</span>
                      </div>
                    )}

                    {/* Nút xem hóa đơn VietQR */}
                    <button
                      onClick={() => setShowInvoiceModal(true)}
                      className="w-full mt-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/20"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Xem & Chia sẻ hóa đơn kèm mã VietQR</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl">
                    Chưa phát sinh hóa đơn cho kỳ tháng này. Hãy bấm sang mục "Chốt sổ" để tính tiền.
                  </p>
                )}

                {/* Chỉ số điện công tơ */}
                {room.chi_so_thang_nay && (
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase">
                      Chỉ số điện tháng {room.chi_so_thang_nay.thang}
                    </h4>
                    <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200 text-xs">
                      <span className="text-amber-800 font-bold block mb-1">⚡ Điện (kWh)</span>
                      <div className="flex justify-between">
                        <span>Đầu: {room.chi_so_thang_nay.dien_dau}</span>
                        <span>Cuối: {room.chi_so_thang_nay.dien_cuoi}</span>
                      </div>
                      <span className="text-amber-900 font-extrabold block mt-1">
                        Dùng: {room.chi_so_thang_nay.dien_cuoi - room.chi_so_thang_nay.dien_dau} kWh
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEditRoom(true)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Sửa phòng</span>
              </button>

              {room.trang_thai === 'co_nguoi' && (
                <button
                  onClick={() => setShowCheckout(true)}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Trả phòng</span>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Các Modal con */}
      {showAddStudent && hopDong && (
        <AddStudentModal
          phongId={room.id}
          hopDongId={hopDong.id}
          currentCount={room.sinh_vien_list.length}
          maxCount={room.so_nguoi_toi_da}
          existingStudent={editingStudent}
          onSave={handleSaveStudent}
          onClose={() => {
            setShowAddStudent(false);
            setEditingStudent(undefined);
          }}
        />
      )}

      {viewingCccd && (
        <CccdViewerModal
          studentName={viewingCccd.name}
          frontPath={viewingCccd.front}
          backPath={viewingCccd.back}
          onClose={() => setViewingCccd(null)}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          room={room}
          onConfirmCheckout={handleConfirmCheckout}
          onClose={() => setShowCheckout(false)}
        />
      )}

      {showEditRoom && (
        <EditRoomModal
          room={room}
          onSave={handleSaveRoom}
          onClose={() => setShowEditRoom(false)}
        />
      )}

      {showInvoiceModal && room.hoa_don_thang_nay && toaNha && (
        <InvoiceModal
          hoaDon={room.hoa_don_thang_nay}
          toaNha={toaNha}
          phong={room}
          daiDien={room.dai_dien}
          caiDat={caiDat}
          dienDau={room.chi_so_thang_nay?.dien_dau}
          dienCuoi={room.chi_so_thang_nay?.dien_cuoi}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {showContractModal && toaNha && (
        <ContractModal
          hopDong={room.hop_dong_hien_tai}
          phong={room}
          toaNha={toaNha}
          daiDien={room.dai_dien}
          sinhViens={room.sinh_vien_list}
          caiDat={caiDat}
          onClose={() => setShowContractModal(false)}
        />
      )}
    </>
  );
};
