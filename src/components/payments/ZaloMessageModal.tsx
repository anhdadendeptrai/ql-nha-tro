import React, { useState } from 'react';
import { X, Copy, Check, MessageSquare, Edit3, Save } from 'lucide-react';
import type { HoaDon, ToaNha, Phong, SinhVien, CaiDat, MauTinNhanItem } from '../../types';
import { formatVND, formatMonthYear } from '../../utils/formatters';
import { generateTransferContent } from '../../utils/vietqr';
import { SyncService } from '../../db/sync';
import { useToast } from '../common/Toast';

interface ZaloMessageModalProps {
  hoaDon: HoaDon;
  toaNha: ToaNha;
  phong: Phong;
  daiDien?: SinhVien;
  caiDat?: CaiDat;
  onClose: () => void;
}

const DEFAULT_TEMPLATES: MauTinNhanItem[] = [
  {
    id: 'm1',
    tieu_de: '1. Nhắc đóng tiền phòng (Lần 1 - Thân thiện)',
    noi_dung:
      'Chào em {ten}, bác gửi thông báo tiền phòng {phong} ({toa}) kỳ {thang} tổng cộng là {so_tien} (gồm tiền phòng, điện và phí dịch vụ 170k/người đã gồm nước, rác, wifi, xe; hạn đóng ngày {han_dong}). Em chuyển khoản qua STK {stk} ({ngan_hang}) - {chu_tk} với nội dung "{noi_dung_ck}" nha. Cảm ơn em!',
  },
  {
    id: 'm2',
    tieu_de: '2. Nhắc nợ lần 2 (Đã quá hạn)',
    noi_dung:
      'Chào em {ten}, tiền trọ phòng {phong} ({toa}) kỳ {thang} hiện đang còn thiếu {so_tien} và đã quá hạn quy định ({han_dong}). Em vui lòng thu xếp thanh toán sớm trong hôm nay để bác kịp chốt sổ nhé. Cảm ơn em!',
  },
  {
    id: 'm3',
    tieu_de: '3. Cảnh báo tạm ngừng cung cấp dịch vụ',
    noi_dung:
      'Kính gửi đại diện phòng {phong} ({toa}), tiền phòng {thang} ({so_tien}) đã quá hạn nhiều ngày dù đã nhắc nhở. Nếu trước 17h hôm nay chưa nhận được chuyển khoản, ban quản lý sẽ buộc phải tạm ngừng cung cấp dịch vụ điện phòng {phong} theo đúng nội quy thuê trọ.',
  },
  {
    id: 'm4',
    tieu_de: '4. Thông báo lịch vệ sinh chung',
    noi_dung:
      'Thông báo tới các bạn sinh viên phòng {phong} ({toa}): Ngày mai sẽ có đội phun thuốc muỗi và xịt rửa khử khuẩn toàn bộ hành lang, khu để xe. Các bạn vui lòng đóng kín cửa phòng và xếp xe máy gọn gàng nhé.',
  },
  {
    id: 'm5',
    tieu_de: '5. Thông báo điều chỉnh đơn giá điện',
    noi_dung:
      'Thông báo gửi phòng {phong} ({toa}): Kể từ kỳ chốt sổ tháng tới, đơn giá điện sẽ được điều chỉnh theo biểu giá điện mới. Phí dịch vụ 170.000 đ/người giữ nguyên. Mọi thắc mắc các em có thể liên hệ trực tiếp ban quản lý Tòa {toa}.',
  },
  {
    id: 'm6',
    tieu_de: '6. Xác nhận đã nhận tiền đủ',
    noi_dung:
      'Chào em {ten}, bác đã nhận được số tiền {so_tien} thanh toán tiền phòng {phong} ({toa}) kỳ {thang}. Phòng em đã hoàn thành nghĩa vụ tiền trọ tháng này. Cảm ơn em!',
  },
];

export const ZaloMessageModal: React.FC<ZaloMessageModalProps> = ({
  hoaDon,
  toaNha,
  phong,
  daiDien,
  caiDat,
  onClose,
}) => {
  const { showToast } = useToast();

  const templates: MauTinNhanItem[] =
    caiDat?.mau_tin_nhan && caiDat.mau_tin_nhan.length > 0
      ? caiDat.mau_tin_nhan
      : DEFAULT_TEMPLATES;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'm1');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Điền các biến số thực tế vào mẫu tin nhắn
  const renderMessageContent = (templateStr: string): string => {
    const ten = daiDien?.ho_ten || 'em';
    const soPhong = phong.so_phong;
    const thang = formatMonthYear(hoaDon.thang);
    const soTien = formatVND(hoaDon.con_no > 0 ? hoaDon.con_no : hoaDon.tong_tien);
    const hanDong = `${toaNha.han_dong_tien || 5}/${hoaDon.thang.split('-')[1]}`;
    const toa = toaNha.ten;
    const stk = caiDat?.so_tk || '[Chưa cài đặt STK]';
    const nganHang = caiDat?.bank_id || '[Ngân hàng]';
    const chuTk = caiDat?.ten_chu_tk || '[Tên chủ tài khoản]';
    const noiDungCk = generateTransferContent(phong.so_phong, hoaDon.thang);

    return templateStr
      .replace(/\{ten\}/g, ten)
      .replace(/\{phong\}/g, soPhong)
      .replace(/\{thang\}/g, thang)
      .replace(/\{so_tien\}/g, soTien)
      .replace(/\{han_dong\}/g, hanDong)
      .replace(/\{toa\}/g, toa)
      .replace(/\{stk\}/g, stk)
      .replace(/\{ngan_hang\}/g, nganHang)
      .replace(/\{chu_tk\}/g, chuTk)
      .replace(/\{noi_dung_ck\}/g, noiDungCk);
  };

  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];
  const finalMessage = isEditing
    ? customText
    : renderMessageContent(currentTemplate?.noi_dung || '');

  const handleCopy = () => {
    navigator.clipboard.writeText(finalMessage);
    setCopied(true);
    showToast('Đã sao chép tin nhắn Zalo!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleStartEditing = () => {
    setCustomText(finalMessage);
    setIsEditing(true);
  };

  const handleSaveCustomTemplate = async () => {
    if (!caiDat) return;
    const updated = templates.map((t) =>
      t.id === selectedTemplateId ? { ...t, noi_dung: customText } : t
    );
    await SyncService.saveCaiDat({ ...caiDat, mau_tin_nhan: updated });
    setIsEditing(false);
    showToast('Đã lưu mẫu tin nhắn mới!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span>Mẫu tin nhắn gửi Zalo / SMS</span>
            </h3>
            <p className="text-xs text-slate-500">
              Gửi phòng: {phong.so_phong} • Khách: {daiDien?.ho_ten || 'Sinh viên'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Danh sách các mẫu tin nhắn */}
        <div className="py-3">
          <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
            Chọn mẫu tin nhắn:
          </label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  setSelectedTemplateId(tpl.id);
                  setIsEditing(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  selectedTemplateId === tpl.id
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tpl.tieu_de}
              </button>
            ))}
          </div>
        </div>

        {/* Nội dung tin nhắn đã điền sẵn */}
        <div className="py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase">Nội dung tin nhắn:</span>
            {!isEditing ? (
              <button
                onClick={handleStartEditing}
                className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Sửa nội dung</span>
              </button>
            ) : (
              <button
                onClick={handleSaveCustomTemplate}
                className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu mẫu</span>
              </button>
            )}
          </div>

          {isEditing ? (
            <textarea
              rows={6}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full p-3.5 rounded-2xl border-2 border-blue-400 bg-white text-sm text-slate-800 outline-none leading-relaxed"
            />
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap select-all">
              {finalMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
          >
            Đóng
          </button>

          <button
            onClick={handleCopy}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/25 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Sao chép để gửi Zalo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
