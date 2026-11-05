import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Building,
  QrCode,
  AlertCircle,
  Smartphone,
  Database,
  Plus,
  Trash2,
  LogOut,
} from 'lucide-react';
import { db } from '../../db/dexie';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { SyncService } from '../../db/sync';
import { BackupModal } from '../backup/BackupModal';
import type { CaiDat, ToaNha } from '../../types';

interface SettingsModalProps {
  onClose: () => void;
  onOpenInstallGuide: () => void;
  initialAddBuilding?: boolean;
}

const POPULAR_BANKS = [
  { id: 'MB', name: 'MB Bank (Quân Đội)' },
  { id: 'VCB', name: 'Vietcombank' },
  { id: 'TCB', name: 'Techcombank' },
  { id: 'ICB', name: 'VietinBank' },
  { id: 'BIDV', name: 'BIDV' },
  { id: 'VPB', name: 'VPBank' },
  { id: 'ACB', name: 'ACB' },
  { id: 'TPB', name: 'TPBank' },
  { id: 'VIB', name: 'VIB' },
  { id: 'STB', name: 'Sacombank' },
  { id: 'VBA', name: 'Agribank' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  onOpenInstallGuide,
  initialAddBuilding = false,
}) => {
  const { ownerId, logout } = useAuth();
  const { showToast } = useToast();

  const [bankId, setBankId] = useState('');
  const [soTk, setSoTk] = useState('');
  const [tenChuTk, setTenChuTk] = useState('');
  const [nguongDien, setNguongDien] = useState(300);

  const [toas, setToas] = useState<ToaNha[]>([]);
  const [newToaName, setNewToaName] = useState('');
  const [showAddBuilding, setShowAddBuilding] = useState(initialAddBuilding);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBackup, setShowBackup] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const cd = await db.cai_dat.get(ownerId);
      if (cd) {
        setBankId(cd.bank_id || '');
        setSoTk(cd.so_tk || '');
        setTenChuTk(cd.ten_chu_tk || '');
        setNguongDien(cd.nguong_canh_bao_dien || 300);
      }

      const rawToas = await db.toa_nha.toArray();
      // Lọc các tòa chưa bị xóa mềm
      setToas(rawToas.filter((t) => !t.is_deleted));
    };

    loadSettings();
  }, [ownerId]);

  const handleAddToa = async () => {
    const trimmed = newToaName.trim();
    if (!trimmed) {
      showToast('Vui lòng nhập tên Tòa (ví dụ: D1, D3, D5...)', 'error');
      return;
    }

    const newToa: ToaNha = {
      id: `toa-${Date.now()}`,
      owner_id: ownerId,
      ten: trimmed,
      dia_chi: '',
      don_gia_dien: 3500,
      phi_dich_vu_dau_nguoi: 170000,
      ngay_chot_so: 25,
      han_dong_tien: 5,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await SyncService.saveToaNha(newToa);
    setToas((prev) => [...prev, newToa]);
    setNewToaName('');
    setShowAddBuilding(false);
    showToast(`Đã thêm Tòa ${trimmed} thành công!`, 'success');
  };

  const handleDeleteToa = async (toaId: string, toaTen: string) => {
    if (
      window.confirm(
        `Bạn có chắc chắn muốn xóa Tòa "${toaTen}"? Các phòng và dữ liệu cũ của tòa này vẫn được lưu an toàn.`
      )
    ) {
      await SyncService.deleteToaNha(toaId);
      setToas((prev) => prev.filter((t) => t.id !== toaId));
      showToast(`Đã xóa Tòa ${toaTen}.`, 'info');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const existing = (await db.cai_dat.get(ownerId)) || {
        owner_id: ownerId,
        mau_tin_nhan: [],
      };

      const updatedCaiDat: CaiDat = {
        ...existing,
        owner_id: ownerId,
        bank_id: bankId,
        so_tk: soTk.trim(),
        ten_chu_tk: tenChuTk.trim().toUpperCase(),
        nguong_canh_bao_dien: Number(nguongDien) || 300,
        updated_at: new Date().toISOString(),
      };

      await db.cai_dat.put(updatedCaiDat);

      // Lưu đơn giá và thông tin các tòa
      for (const toa of toas) {
        await SyncService.saveToaNha(toa);
      }

      showToast('Đã lưu cấu hình cài đặt và VietQR!', 'success');
      onClose();
    } catch {
      showToast('Lỗi khi lưu cài đặt.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (
      window.confirm(
        'Bạn có chắc chắn muốn đăng xuất? Toàn bộ dữ liệu đệm trên máy này sẽ bị xóa để đảm bảo an toàn.'
      )
    ) {
      await logout();
      showToast('Đã đăng xuất và xóa dữ liệu đệm an toàn.', 'info');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Cài đặt hệ thống</h3>
            <p className="text-xs text-slate-500">Quản lý Tòa, đơn giá dịch vụ và tài khoản VietQR</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="py-4 space-y-5">
          {/* 1. Cài đặt VietQR */}
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-3">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase">
              <QrCode className="w-4 h-4 text-blue-600" />
              <span>Tài khoản nhận tiền VietQR (Tự sinh mã QR trên hóa đơn)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngân hàng thụ hưởng
                </label>
                <select
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-base outline-none focus:border-blue-500"
                >
                  <option value="">-- Chọn ngân hàng thụ hưởng --</option>
                  {POPULAR_BANKS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số tài khoản
                </label>
                <input
                  type="text"
                  value={soTk}
                  onChange={(e) => setSoTk(e.target.value)}
                  placeholder="Ví dụ: 1903..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base font-mono outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên chủ tài khoản (Viết hoa không dấu)
              </label>
              <input
                type="text"
                value={tenChuTk}
                onChange={(e) => setTenChuTk(e.target.value.toUpperCase())}
                placeholder="Ví dụ: NGUYEN VAN A"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base font-mono uppercase outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 2. Ngưỡng cảnh báo điện */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Ngưỡng cảnh báo số điện bất thường</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">
                Bật cảnh báo đỏ khi số điện tháng vượt quá:
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={50}
                  max={2000}
                  value={nguongDien}
                  onChange={(e) => setNguongDien(Number(e.target.value))}
                  className="w-20 px-2 py-1 text-right border border-slate-300 rounded-lg text-sm font-mono"
                />
                <span className="text-xs text-slate-500">kWh</span>
              </div>
            </div>
          </div>

          {/* 3. Danh sách Tòa & Đơn giá dịch vụ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase">
                <Building className="w-4 h-4 text-slate-600" />
                <span>Danh sách Tòa & Đơn giá</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBuilding(true)}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Tòa</span>
              </button>
            </div>

            {/* Modal / Form nhỏ thêm tòa */}
            {showAddBuilding && (
              <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/60 space-y-2.5">
                <div className="text-xs font-bold text-blue-900">Nhập tên Tòa mới:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newToaName}
                    onChange={(e) => setNewToaName(e.target.value)}
                    placeholder="Ví dụ: D1, D3, D5..."
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddToa}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer"
                  >
                    Thêm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBuilding(false);
                      setNewToaName('');
                    }}
                    className="px-2.5 py-1.5 border border-slate-200 bg-white text-slate-600 rounded-xl text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {toas.map((toa, idx) => (
              <div
                key={toa.id}
                className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 text-xs uppercase">Tên Tòa:</span>
                    <input
                      type="text"
                      value={toa.ten}
                      onChange={(e) => {
                        const copy = [...toas];
                        copy[idx].ten = e.target.value;
                        setToas(copy);
                      }}
                      className="px-2.5 py-1 font-bold text-slate-900 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>
                  {toas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteToa(toa.id, toa.ten)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      title="Xóa Tòa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Đúng 2 ô đơn giá: Giá điện & Phí dịch vụ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">
                      Giá điện (đ/kWh):
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={toa.don_gia_dien}
                      onChange={(e) => {
                        const copy = [...toas];
                        copy[idx].don_gia_dien = Number(e.target.value);
                        setToas(copy);
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-sm focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">
                      Phí dịch vụ (đ/người/tháng):
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={toa.phi_dich_vu_dau_nguoi ?? 170000}
                      onChange={(e) => {
                        const copy = [...toas];
                        copy[idx].phi_dich_vu_dau_nguoi = Number(e.target.value);
                        setToas(copy);
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-sm focus:border-blue-500 outline-none"
                    />
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Đã gồm nước, rác, wifi, gửi xe
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 4. Hướng dẫn & Sao lưu & Đăng xuất */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInstallGuide();
              }}
              className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span>Xem hướng dẫn cài đặt app lên iPhone (iOS) & Android</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBackup(true)}
              className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Database className="w-4 h-4 text-slate-600" />
              <span>Sao lưu & Khôi phục dữ liệu (JSON / Excel)</span>
            </button>

            {/* Nút Đăng xuất rõ ràng (Part 1.5) */}
            <button
              type="button"
              onClick={handleLogout}
              className="py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>Đăng xuất tài khoản (Xóa dữ liệu đệm trên máy)</span>
            </button>
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </form>
      </div>

      {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}
    </div>
  );
};
