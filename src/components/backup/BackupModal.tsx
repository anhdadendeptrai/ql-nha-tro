import React, { useState } from 'react';
import { X, Download, Upload, FileSpreadsheet, Database, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../db/dexie';
import { useToast } from '../common/Toast';
import { isSupabaseConfigured, supabase } from '../../services/supabase';
import type { ToaNha, HoaDon } from '../../types';

interface BackupModalProps {
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ onClose }) => {
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // 1. Sao lưu toàn bộ ra file JSON
  const handleExportJson = async () => {
    try {
      setIsExporting(true);

      const backupData = {
        version: '2.0',
        exported_at: new Date().toISOString(),
        toa_nha: await db.toa_nha.toArray(),
        phong: await db.phong.toArray(),
        hop_dong: await db.hop_dong.toArray(),
        sinh_vien: await db.sinh_vien.toArray(),
        chi_so: await db.chi_so.toArray(),
        hoa_don: await db.hoa_don.toArray(),
        thanh_toan: await db.thanh_toan.toArray(),
        chi_phi: await db.chi_phi.toArray(),
        cai_dat: await db.cai_dat.toArray(),
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const fileName = `Sao_Luu_QL_Phong_Tro_${new Date().toISOString().split('T')[0]}.json`;

      // Thử chia sẻ qua Web Share API nếu trên mobile
      const file = new File([blob], fileName, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Sao lưu dữ liệu Quản lý Nhà trọ',
          files: [file],
        });
        showToast('Đã chia sẻ file sao lưu JSON!', 'success');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Đã tải file sao lưu JSON về máy!', 'success');
      }
    } catch {
      showToast('Lỗi khi sao lưu dữ liệu JSON.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Xuất toàn bộ dữ liệu ra Excel nhiều trang (Multi-sheet XLSX)
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);

      const toas = (await db.toa_nha.toArray()).filter((t) => !t.is_deleted);
      const phongs = await db.phong.toArray();
      const sinhViens = await db.sinh_vien.toArray();
      const hoaDons = await db.hoa_don.toArray();
      const chiPhis = await db.chi_phi.toArray();

      const workbook = XLSX.utils.book_new();

      // Sheet 1: Danh sách Tòa
      const toaRows = toas.map((t) => ({
        'Tên Tòa': t.ten,
        'Địa chỉ': t.dia_chi || '',
        'Giá điện (đ/kWh)': t.don_gia_dien,
        'Phí dịch vụ (đ/người)': t.phi_dich_vu_dau_nguoi ?? 170000,
        'Ghi chú dịch vụ': 'Đã gồm nước, rác, wifi, gửi xe',
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toaRows), 'Tòa');

      // Sheet 2: Danh sách Phòng
      const phongRows = phongs.map((p) => ({
        'Số phòng': p.so_phong,
        'Tầng': p.tang,
        'Giá thuê (đ)': p.gia_thue,
        'Trạng thái': p.trang_thai === 'co_nguoi' ? 'Đang ở' : p.trang_thai === 'trong' ? 'Trống' : 'Sửa chữa',
        'Số người tối đa': p.so_nguoi_toi_da,
        'Ghi chú': p.ghi_chu || '',
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(phongRows), 'Phòng trọ');

      // Sheet 3: Danh sách Sinh viên
      const svRows = sinhViens.map((s, idx) => ({
        'STT': idx + 1,
        'Họ và tên': s.ho_ten,
        'Số CCCD': s.cccd,
        'Số điện thoại': s.sdt,
        'Trường học': s.truong || '',
        'Biển số xe': s.bien_so || '',
        'Người đại diện': s.la_dai_dien ? 'Có' : 'Không',
        'Đang ở': s.dang_o ? 'Đang ở' : 'Đã rời phòng',
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(svRows), 'Sinh viên');

      // Sheet 4: Danh sách Hóa đơn theo quy tắc mới
      const hdRows = hoaDons.map((h) => ({
        'Kỳ tháng': h.thang,
        'Tiền phòng (đ)': h.tien_phong,
        'Số điện (kWh)': h.so_dien,
        'Tiền điện (đ)': h.tien_dien,
        'Số người': h.so_nguoi,
        'Phí dịch vụ (đ)': h.tien_dich_vu ?? ((h.so_nguoi || 1) * (h.phi_dich_vu_dau_nguoi ?? 170000)),
        'Tổng tiền (đ)': h.tong_tien,
        'Đã đóng (đ)': h.da_dong,
        'Còn nợ (đ)': h.con_no,
        'Trạng thái': h.trang_thai === 'da_dong' ? 'Đã đóng' : h.trang_thai === 'dong_thieu' ? 'Đóng thiếu' : 'Chưa đóng',
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(hdRows), 'Hóa đơn');

      // Sheet 5: Chi phí vận hành
      const cpRows = chiPhis.map((c, idx) => ({
        'STT': idx + 1,
        'Ngày chi': c.ngay,
        'Khoản mục': c.loai,
        'Số tiền (đ)': c.so_tien,
        'Nội dung chi': c.ghi_chu,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cpRows), 'Chi phí');

      // Tải file Excel
      const fileName = `Du_Lieu_Tong_Hop_QL_Phong_Tro_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('Đã xuất toàn bộ dữ liệu ra Excel!', 'success');
    } catch {
      showToast('Lỗi khi xuất file Excel tổng hợp.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Khôi phục dữ liệu từ file JSON (Tương thích ngược 100% với file cũ có cột nước/rác/xe)
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Khôi phục dữ liệu sẽ cập nhật toàn bộ cơ sở dữ liệu hiện tại. Bạn có chắc chắn muốn tiếp tục?')) {
      return;
    }

    try {
      setIsImporting(true);
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.toa_nha || !parsed.phong) {
        throw new Error('Định dạng file sao lưu không hợp lệ.');
      }

      // Xử lý tương thích ngược cho Tòa nhà
      const normalizedToas: ToaNha[] = (parsed.toa_nha as ToaNha[]).map((t) => ({
        ...t,
        phi_dich_vu_dau_nguoi: t.phi_dich_vu_dau_nguoi ?? 170000,
        is_deleted: t.is_deleted ?? false,
      }));

      // Xử lý tương thích ngược cho Hóa đơn cũ
      const normalizedHoaDons: HoaDon[] = (parsed.hoa_don as HoaDon[] || []).map((h) => {
        const phiDichVuDauNguoi = h.phi_dich_vu_dau_nguoi ?? 170000;
        const soNguoi = h.so_nguoi || 1;
        const tienDichVu = h.tien_dich_vu ?? (soNguoi * phiDichVuDauNguoi);
        return {
          ...h,
          phi_dich_vu_dau_nguoi: phiDichVuDauNguoi,
          tien_dich_vu: tienDichVu,
        };
      });

      // Nạp dữ liệu vào IndexedDB
      if (normalizedToas.length) await db.toa_nha.bulkPut(normalizedToas);
      if (parsed.phong?.length) await db.phong.bulkPut(parsed.phong);
      if (parsed.hop_dong?.length) await db.hop_dong.bulkPut(parsed.hop_dong);
      if (parsed.sinh_vien?.length) await db.sinh_vien.bulkPut(parsed.sinh_vien);
      if (parsed.chi_so?.length) await db.chi_so.bulkPut(parsed.chi_so);
      if (normalizedHoaDons.length) await db.hoa_don.bulkPut(normalizedHoaDons);
      if (parsed.thanh_toan?.length) await db.thanh_toan.bulkPut(parsed.thanh_toan);
      if (parsed.chi_phi?.length) await db.chi_phi.bulkPut(parsed.chi_phi);
      if (parsed.cai_dat?.length) await db.cai_dat.bulkPut(parsed.cai_dat);

      // Đẩy lên Supabase nếu có kết nối
      if (isSupabaseConfigured() && navigator.onLine) {
        try {
          if (normalizedToas.length) await supabase.from('toa_nha').upsert(normalizedToas);
          if (parsed.phong?.length) await supabase.from('phong').upsert(parsed.phong);
          if (parsed.hop_dong?.length) await supabase.from('hop_dong').upsert(parsed.hop_dong);
          if (parsed.sinh_vien?.length) await supabase.from('sinh_vien').upsert(parsed.sinh_vien);
          if (parsed.chi_so?.length) await supabase.from('chi_so').upsert(parsed.chi_so);
          if (normalizedHoaDons.length) await supabase.from('hoa_don').upsert(normalizedHoaDons);
          if (parsed.chi_phi?.length) await supabase.from('chi_phi').upsert(parsed.chi_phi);
        } catch (err) {
          console.error('Lỗi đồng bộ file khôi phục lên Supabase:', err);
        }
      }

      showToast('Khôi phục toàn bộ dữ liệu thành công!', 'success');
      onClose();
    } catch {
      showToast('File sao lưu bị lỗi hoặc không đúng định dạng.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <span>Sao lưu & Khôi phục dữ liệu</span>
            </h3>
            <p className="text-xs text-slate-500">Bảo vệ an toàn 100% dữ liệu quản lý nhà trọ</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          {/* Khối 1: Sao lưu JSON */}
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-2">
            <div>
              <h4 className="text-sm font-extrabold text-blue-900">Sao lưu toàn bộ (File JSON)</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Đầy đủ dữ liệu: Tòa, phòng, sinh viên, hợp đồng, chỉ số và hóa đơn.
              </p>
            </div>

            <button
              onClick={handleExportJson}
              disabled={isExporting}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-500/20 disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Tải file sao lưu JSON (hoặc chia sẻ Zalo)</span>
            </button>
          </div>

          {/* Khối 2: Xuất toàn bộ ra Excel */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-2">
            <div>
              <h4 className="text-sm font-extrabold text-emerald-900">Xuất báo cáo tổng hợp (Excel)</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                File Excel chứa nhiều sheet: Tòa, Phòng trọ, Sinh viên, Hóa đơn và Chi phí.
              </p>
            </div>

            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-500/20 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất toàn bộ cơ sở dữ liệu ra Excel (.xlsx)</span>
            </button>
          </div>

          {/* Khối 3: Khôi phục dữ liệu */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800">Khôi phục từ file sao lưu</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Chọn file `.json` đã sao lưu trước đó để phục hồi (hỗ trợ cả các file sao lưu cũ).
              </p>
            </div>

            <label className="w-full mt-2 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs">
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <Upload className="w-4 h-4 text-blue-600" />
              )}
              <span>{isImporting ? 'Đang nạp dữ liệu...' : 'Chọn file JSON để khôi phục'}</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportJson}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
