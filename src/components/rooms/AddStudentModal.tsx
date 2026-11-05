import React, { useState } from 'react';
import { X, Camera, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { SinhVien } from '../../types';
import { compressImage } from '../../services/imageCompression';
import { uploadCccdToStorage, isSupabaseConfigured } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

interface AddStudentModalProps {
  phongId: string;
  hopDongId: string;
  currentCount: number;
  maxCount: number;
  onSave: (sinhVien: SinhVien) => Promise<void>;
  onClose: () => void;
  existingStudent?: SinhVien;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  hopDongId,
  currentCount,
  maxCount,
  onSave,
  onClose,
  existingStudent,
}) => {
  const { ownerId } = useAuth();
  const { showToast } = useToast();

  const [hoTen, setHoTen] = useState(existingStudent?.ho_ten || '');
  const [sdt, setSdt] = useState(existingStudent?.sdt || '');
  const [cccd, setCccd] = useState(existingStudent?.cccd || '');
  const [truong, setTruong] = useState(existingStudent?.truong || '');
  const [bienSo, setBienSo] = useState(existingStudent?.bien_so || '');
  const [laDaiDien, setLaDaiDien] = useState(existingStudent?.la_dai_dien || false);

  // Ảnh CCCD
  const [frontPath, setFrontPath] = useState(existingStudent?.anh_cccd_truoc || '');
  const [backPath, setBackPath] = useState(existingStudent?.anh_cccd_sau || '');
  const [frontPreview, setFrontPreview] = useState<string | null>(existingStudent?.anh_cccd_truoc || null);
  const [backPreview, setBackPreview] = useState<string | null>(existingStudent?.anh_cccd_sau || null);
  const [frontSizeKb, setFrontSizeKb] = useState<number | null>(null);
  const [backSizeKb, setBackSizeKb] = useState<number | null>(null);

  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Xử lý nén và lưu ảnh CCCD mặt trước
  const handleImageFrontChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const res = await compressImage(file, 1280, 0.75, 150);
      setFrontPreview(res.dataUrl);
      setFrontSizeKb(res.sizeKb);

      if (isSupabaseConfigured() && navigator.onLine) {
        const uploadRes = await uploadCccdToStorage(ownerId, `cccd_truoc_${res.fileName}`, res.blob);
        if (uploadRes.path) {
          setFrontPath(uploadRes.path);
        }
      } else {
        // Lưu dataUrl tạm thời khi ngoại tuyến
        setFrontPath(res.dataUrl);
      }
      showToast(`Đã nén ảnh mặt trước: ${res.sizeKb} KB (WebP)`, 'success');
    } catch {
      showToast('Lỗi khi nén ảnh mặt trước.', 'error');
    } finally {
      setIsCompressing(false);
    }
  };

  // Xử lý nén và lưu ảnh CCCD mặt sau
  const handleImageBackChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const res = await compressImage(file, 1280, 0.75, 150);
      setBackPreview(res.dataUrl);
      setBackSizeKb(res.sizeKb);

      if (isSupabaseConfigured() && navigator.onLine) {
        const uploadRes = await uploadCccdToStorage(ownerId, `cccd_sau_${res.fileName}`, res.blob);
        if (uploadRes.path) {
          setBackPath(uploadRes.path);
        }
      } else {
        setBackPath(res.dataUrl);
      }
      showToast(`Đã nén ảnh mặt sau: ${res.sizeKb} KB (WebP)`, 'success');
    } catch {
      showToast('Lỗi khi nén ảnh mặt sau.', 'error');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Kiểm tra dữ liệu
    const cleanHoTen = hoTen.trim();
    const cleanSdt = sdt.replace(/\s+/g, '');
    const cleanCccd = cccd.replace(/\s+/g, '');

    if (!cleanHoTen) {
      setErrorMsg('Vui lòng nhập họ và tên sinh viên.');
      return;
    }

    if (cleanSdt && !/^[0-9]{10}$/.test(cleanSdt)) {
      setErrorMsg('Số điện thoại phải gồm đúng 10 chữ số (ví dụ: 0912345678).');
      return;
    }

    if (cleanCccd && !/^[0-9]{12}$/.test(cleanCccd)) {
      setErrorMsg('Số CCCD phải gồm đúng 12 chữ số theo quy định nhà nước.');
      return;
    }

    if (!existingStudent && currentCount >= maxCount) {
      const confirmExceed = window.confirm(
        `Phòng này có số người tối đa là ${maxCount}, hiện đã có ${currentCount} người. Bạn có chắc chắn muốn thêm thêm không?`
      );
      if (!confirmExceed) return;
    }

    try {
      setIsSubmitting(true);
      const studentData: SinhVien = {
        id: existingStudent?.id || `sv-${Date.now()}`,
        owner_id: ownerId,
        hop_dong_id: hopDongId,
        ho_ten: cleanHoTen,
        sdt: cleanSdt,
        cccd: cleanCccd,
        truong: truong.trim(),
        bien_so: bienSo.trim().toUpperCase(),
        anh_cccd_truoc: frontPath,
        anh_cccd_sau: backPath,
        la_dai_dien: laDaiDien,
        ngay_vao: existingStudent?.ngay_vao || new Date().toISOString().split('T')[0],
        dang_o: true,
      };

      await onSave(studentData);
      showToast(existingStudent ? 'Đã cập nhật sinh viên!' : 'Đã thêm sinh viên vào phòng!', 'success');
      onClose();
    } catch {
      setErrorMsg('Không thể lưu thông tin sinh viên.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {existingStudent ? 'Sửa thông tin sinh viên' : 'Thêm sinh viên vào phòng'}
            </h3>
            <p className="text-xs text-slate-500">
              Số người hiện tại: {currentCount}/{maxCount}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          {/* Họ tên */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Họ và tên sinh viên <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={hoTen}
              onChange={(e) => setHoTen(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn An"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-base"
            />
          </div>

          {/* SĐT & CCCD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Số điện thoại (10 số)
              </label>
              <input
                type="tel"
                inputMode="tel"
                maxLength={10}
                value={sdt}
                onChange={(e) => setSdt(e.target.value)}
                placeholder="0912345678"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-base font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Số CCCD (12 số)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={cccd}
                onChange={(e) => setCccd(e.target.value)}
                placeholder="001202012345"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-base font-mono"
              />
            </div>
          </div>

          {/* Trường & Biển số xe */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Trường đại học / Cao đẳng
              </label>
              <input
                type="text"
                value={truong}
                onChange={(e) => setTruong(e.target.value)}
                placeholder="Ví dụ: ĐH Quốc Gia"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Biển số xe máy
              </label>
              <input
                type="text"
                value={bienSo}
                onChange={(e) => setBienSo(e.target.value)}
                placeholder="Ví dụ: 29A1-12345"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-base font-mono uppercase"
              />
            </div>
          </div>

          {/* Đánh dấu đại diện phòng */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-900">Người đại diện phòng</p>
              <p className="text-xs text-blue-700">Đại diện ký hợp đồng và nhận hóa đơn tháng</p>
            </div>
            <input
              type="checkbox"
              id="isRepresentative"
              checked={laDaiDien}
              onChange={(e) => setLaDaiDien(e.target.checked)}
              className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
            />
          </div>

          {/* Chụp & Nén ảnh CCCD */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 uppercase">
                Ảnh căn cước công dân (CCCD)
              </span>
              <span className="text-[11px] text-blue-600 font-medium">
                ⚡ Tự nén WebP ≤150KB
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Mặt trước */}
              <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                {frontPreview ? (
                  <div className="w-full">
                    <img
                      src={frontPreview}
                      alt="CCCD trước"
                      className="w-full h-24 object-contain rounded-lg mb-1.5"
                    />
                    <span className="text-[11px] text-emerald-700 font-bold block">
                      ✓ Đã lưu {frontSizeKb ? `(${frontSizeKb}KB)` : ''}
                    </span>
                  </div>
                ) : (
                  <div className="py-2 text-slate-500">
                    <Camera className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                    <span className="text-xs font-medium">Mặt trước</span>
                  </div>
                )}
                <label className="mt-2 w-full py-1.5 px-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center gap-1 shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{frontPreview ? 'Chụp lại' : 'Chụp / Tải ảnh'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageFrontChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Mặt sau */}
              <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                {backPreview ? (
                  <div className="w-full">
                    <img
                      src={backPreview}
                      alt="CCCD sau"
                      className="w-full h-24 object-contain rounded-lg mb-1.5"
                    />
                    <span className="text-[11px] text-emerald-700 font-bold block">
                      ✓ Đã lưu {backSizeKb ? `(${backSizeKb}KB)` : ''}
                    </span>
                  </div>
                ) : (
                  <div className="py-2 text-slate-500">
                    <Camera className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                    <span className="text-xs font-medium">Mặt sau</span>
                  </div>
                )}
                <label className="mt-2 w-full py-1.5 px-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center gap-1 shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{backPreview ? 'Chụp lại' : 'Chụp / Tải ảnh'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageBackChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Nút lưu */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isCompressing}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting || isCompressing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>{existingStudent ? 'Lưu cập nhật' : 'Hoàn tất thêm'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
