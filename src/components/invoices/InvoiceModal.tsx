import React, { useRef, useState } from 'react';
import { X, Share2, Download, Copy, Printer, Check, Loader2 } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import type { HoaDon, ToaNha, Phong, SinhVien, CaiDat } from '../../types';
import { InvoiceBillCard } from './InvoiceBillCard';
import { generateTransferContent } from '../../utils/vietqr';
import { useToast } from '../common/Toast';

interface InvoiceModalProps {
  hoaDon: HoaDon;
  toaNha: ToaNha;
  phong: Phong;
  daiDien?: SinhVien;
  caiDat?: CaiDat;
  dienDau?: number;
  dienCuoi?: number;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  hoaDon,
  toaNha,
  phong,
  daiDien,
  caiDat,
  dienDau,
  dienCuoi,
  onClose,
}) => {
  const { showToast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fileName = `HoaDon_${phong.so_phong.replace(/[^a-zA-Z0-9]/g, '')}_${hoaDon.thang}.png`;

  // 1. Chia sẻ ảnh qua Web Share API (Zalo, iMessage, Messenger...)
  const handleShareImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);

    try {
      const blob = await toBlob(cardRef.current, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2, // Độ nét gấp đôi cho màn hình Retina/Mobile
      });

      if (!blob) throw new Error('Không tạo được ảnh hóa đơn');

      const file = new File([blob], fileName, { type: 'image/png' });

      // Kiểm tra thiết bị có hỗ trợ Web Share API với files không
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Hóa đơn ${phong.so_phong} tháng ${hoaDon.thang}`,
          text: `Hóa đơn tiền thuê phòng ${phong.so_phong} tháng ${hoaDon.thang}`,
          files: [file],
        });
        showToast('Đã mở menu chia sẻ thành công!', 'success');
      } else {
        // Fallback: Tự động tải ảnh về máy
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Thiết bị không hỗ trợ chia sẻ trực tiếp. Đã tải ảnh về máy!', 'info');
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        showToast('Không thể tạo hoặc chia sẻ ảnh hóa đơn.', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Tải ảnh trực tiếp về máy
  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);

    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      a.click();
      showToast('Đã tải ảnh hóa đơn về máy!', 'success');
    } catch {
      showToast('Lỗi khi tải ảnh hóa đơn.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Sao chép nhanh cú pháp chuyển khoản
  const handleCopyTransfer = () => {
    const soTk = caiDat?.so_tk?.trim();
    const bankId = caiDat?.bank_id?.trim();

    if (!soTk || !bankId) {
      showToast('Chưa cài đặt tài khoản nhận tiền trong Cài đặt hệ thống.', 'error');
      return;
    }

    const content = generateTransferContent(phong.so_phong, hoaDon.thang);
    const amount = hoaDon.con_no > 0 ? hoaDon.con_no : hoaDon.tong_tien;

    const copyText = `STK: ${soTk} (${bankId}) | Số tiền: ${amount} | ND: ${content}`;
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    showToast('Đã copy thông tin chuyển khoản!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-100 rounded-3xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              Chi tiết Hóa đơn {phong.so_phong}
            </h3>
            <p className="text-xs text-slate-500">
              Kỳ tháng {hoaDon.thang} • {toaNha.ten}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Khung cuộn hiển thị hóa đơn */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1">
          <InvoiceBillCard
            ref={cardRef}
            hoaDon={hoaDon}
            toaNha={toaNha}
            phong={phong}
            daiDien={daiDien}
            caiDat={caiDat}
            dienDau={dienDau}
            dienCuoi={dienCuoi}
          />
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
          {/* Nút copy & in */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyTransfer}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
              title="Sao chép STK và Nội dung chuyển khoản"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã copy' : 'Copy STK'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 hidden sm:flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In</span>
            </button>
          </div>

          {/* Nút chia sẻ ảnh & Tải về */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Tải ảnh</span>
            </button>

            <button
              onClick={handleShareImage}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý ảnh...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Chia sẻ Zalo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
