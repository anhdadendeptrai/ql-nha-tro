import React, { useRef } from 'react';
import { X, Printer, Download, FileText } from 'lucide-react';
import type { HopDong, Phong, ToaNha, SinhVien, CaiDat } from '../../types';
import { formatVND, formatDate } from '../../utils/formatters';
import { numberToVietnameseWords } from '../../utils/numberToWords';
import { useToast } from '../common/Toast';

interface ContractModalProps {
  hopDong?: HopDong;
  phong: Phong;
  toaNha: ToaNha;
  daiDien?: SinhVien;
  sinhViens?: SinhVien[];
  caiDat?: CaiDat;
  onClose: () => void;
}

export const ContractModal: React.FC<ContractModalProps> = ({
  hopDong,
  phong,
  toaNha,
  daiDien,
  sinhViens = [],
  caiDat,
  onClose,
}) => {
  const { showToast } = useToast();
  const printAreaRef = useRef<HTMLDivElement>(null);

  const tenChuTro = caiDat?.ten_chu_tk || '................................';
  const soTkChuTro = caiDat?.so_tk || '........................';
  const nganHangChuTro = caiDat?.bank_id ? `(${caiDat.bank_id})` : '';

  const giaThue = hopDong?.gia_thue_thoa_thuan || phong.gia_thue;
  const tienCoc = hopDong?.tien_coc || giaThue;
  const ngayBatDau = hopDong?.ngay_bat_dau || new Date().toISOString().split('T')[0];
  const ngayHetHan = hopDong?.ngay_het_han || new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const toaTenDisplay = toaNha.ten.startsWith('Tòa') ? toaNha.ten : `Tòa ${toaNha.ten}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDoc = () => {
    if (!printAreaRef.current) return;
    const textContent = printAreaRef.current.innerText;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hop_Dong_Thue_Phong_${phong.so_phong.replace(/[^a-zA-Z0-9]/g, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải văn bản hợp đồng về máy!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-100 rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex items-center justify-between print:hidden">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Hợp đồng thuê phòng trọ</span>
            </h3>
            <p className="text-xs text-slate-500">
              Phòng: {phong.so_phong} • {toaTenDisplay}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Khung nội dung hợp đồng (chuẩn định dạng A4 in ấn) */}
        <div className="p-3 sm:p-8 overflow-y-auto flex-1">
          <div
            ref={printAreaRef}
            className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-md font-serif text-slate-900 text-sm leading-relaxed max-w-2xl mx-auto"
          >
            {/* Quốc hiệu tiêu ngữ */}
            <div className="text-center pb-4 border-b border-slate-200">
              <h4 className="font-bold uppercase text-xs tracking-wider">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </h4>
              <p className="text-xs font-semibold underline underline-offset-4 mt-0.5">
                Độc lập - Tự do - Hạnh phúc
              </p>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-5 text-slate-900">
                HỢP ĐỒNG THUÊ PHÒNG TRỌ
              </h2>
              <p className="text-xs text-slate-500 italic mt-1">
                (Số: HD-{phong.so_phong.replace(/[^a-zA-Z0-9]/g, '')}/{toaNha.ten.replace(/[^a-zA-Z0-9]/g, '')})
              </p>
            </div>

            {/* Căn cứ pháp lý */}
            <div className="py-3 text-xs italic text-slate-600 space-y-0.5">
              <p>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 của nước CHXHCN Việt Nam;</p>
              <p>- Căn cứ Luật Nhà ở số 27/2023/QH15 và các văn bản hướng dẫn hiện hành;</p>
              <p>- Căn cứ nhu cầu và sự thỏa thuận tự nguyện của hai bên tham gia ký kết;</p>
            </div>

            {/* Thông tin 2 bên */}
            <div className="space-y-4 py-2 text-xs sm:text-sm">
              {/* BÊN A */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="font-bold uppercase text-blue-900 mb-1">
                  BÊN CHO THUÊ (BÊN A):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700">
                  <p>Họ và tên: <strong className="text-slate-900">{tenChuTro}</strong></p>
                  <p>Số tài khoản nhận tiền: <strong className="font-mono">{soTkChuTro} {nganHangChuTro}</strong></p>
                  <p className="sm:col-span-2">Địa chỉ nhà trọ: <strong>{toaNha.dia_chi}</strong></p>
                </div>
              </div>

              {/* BÊN B */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="font-bold uppercase text-blue-900 mb-1">
                  BÊN THUÊ (BÊN B - ĐẠI DIỆN SINH VIÊN):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700">
                  <p>Họ và tên: <strong className="text-slate-900">{daiDien?.ho_ten || '...................................................'}</strong></p>
                  <p>Số CCCD: <strong className="font-mono">{daiDien?.cccd || '........................................'}</strong></p>
                  <p>Số điện thoại: <strong className="font-mono">{daiDien?.sdt || '........................................'}</strong></p>
                  <p>Trường học: <strong>{daiDien?.truong || '........................................'}</strong></p>
                  {daiDien?.bien_so && (
                    <p>Biển số xe máy: <strong className="font-mono uppercase">{daiDien.bien_so}</strong></p>
                  )}
                  {sinhViens.length > 1 && (
                    <p className="sm:col-span-2 text-slate-600">
                      Các bạn cùng phòng: {sinhViens.filter((s) => s.id !== daiDien?.id).map((s) => `${s.ho_ten} (${s.sdt})`).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* CÁC ĐIỀU KHOẢN HỢP ĐỒNG */}
              <div className="space-y-3 pt-2">
                <div>
                  <h5 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG
                  </h5>
                  <p className="text-xs text-slate-700 mt-1">
                    Bên A đồng ý cho Bên B thuê phòng số <strong>{phong.so_phong}</strong>, thuộc Tầng {phong.tang}, <strong>{toaTenDisplay}</strong> tại địa chỉ {toaNha.dia_chi}. Diện tích và thiết bị sinh hoạt khép kín, dùng vào mục đích để ở của sinh viên.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 2: THỜI HẠN THUÊ VÀ GIÁ TIỀN
                  </h5>
                  <div className="text-xs text-slate-700 space-y-1 mt-1">
                    <p>
                      - Thời hạn thuê: Từ ngày <strong>{formatDate(ngayBatDau)}</strong> đến ngày <strong>{formatDate(ngayHetHan)}</strong>.
                    </p>
                    <p>
                      - Giá tiền thuê phòng: <strong>{formatVND(giaThue)} / tháng</strong> (Bằng chữ: {numberToVietnameseWords(giaThue)}).
                    </p>
                    <p>
                      - Tiền đặt cọc giữ phòng và đảm bảo tài sản: <strong>{formatVND(tienCoc)}</strong> (Bằng chữ: {numberToVietnameseWords(tienCoc)}). Số tiền này sẽ được Bên A hoàn trả đầy đủ cho Bên B khi kết thúc hợp đồng sau khi đối chiếu tài sản và trừ các khoản nợ (nếu có).
                    </p>
                    <p>
                      - Thời gian thanh toán: Tiền phòng và dịch vụ tháng được chốt vào ngày {toaNha.ngay_chot_so || 25} và thanh toán trước ngày <strong>{toaNha.han_dong_tien || 5}</strong> hàng tháng.
                    </p>
                  </div>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 3: ĐƠN GIÁ CÁC DỊCH VỤ SINH HOẠT
                  </h5>
                  <div className="text-xs text-slate-700 space-y-1 mt-1">
                    <p>- Tiền điện: <strong>{formatVND(toaNha.don_gia_dien)}/kWh</strong> (theo chỉ số công tơ riêng của từng phòng).</p>
                    <p>
                      - Phí dịch vụ trọn gói: <strong>{formatVND(toaNha.phi_dich_vu_dau_nguoi ?? 170000)}/người/tháng</strong> (khoản phí này đã bao gồm toàn bộ nước sinh hoạt, rác vệ sinh môi trường, mạng Internet wifi tốc độ cao và chỗ gửi xe máy).
                    </p>
                  </div>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 4: NỘI QUY VÀ AN TOÀN PHÒNG CHÁY CHỮA CHÁY (PCCC)
                  </h5>
                  <div className="text-xs text-slate-700 space-y-1 mt-1">
                    <p>1. <strong>An toàn PCCC:</strong> Nghiêm cấm đun nấu bằng bếp than, củi. Tắt hoàn toàn bình nóng lạnh, điều hòa, bếp điện khi rời khỏi phòng. Không để vật cản lối thoát hiểm.</p>
                    <p>2. <strong>An ninh trật tự:</strong> Không tụ tập đánh bạc, sử dụng chất gây nghiện, chất cháy nổ. Không làm ồn sau 23h đêm gây ảnh hưởng phòng khác.</p>
                    <p>3. <strong>Tài sản:</strong> Bên B có trách nhiệm giữ gìn tài sản chung và riêng trong phòng. Nếu làm hư hỏng, mất mát thì phải sửa chữa hoặc bồi thường theo thời giá.</p>
                  </div>
                </div>

                {hopDong?.do_ban_giao && hopDong.do_ban_giao.length > 0 && (
                  <div>
                    <h5 className="font-bold text-slate-900 uppercase text-xs">
                      ĐIỀU 5: TÀI SẢN BÀN GIAO BAN ĐẦU
                    </h5>
                    <div className="text-xs text-slate-700 mt-1 grid grid-cols-2 gap-1">
                      {hopDong.do_ban_giao.map((item, idx) => (
                        <p key={item.id || idx}>
                          • {item.ten}: <strong>{item.tinh_trang}</strong>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h5 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 6: HIỆU LỰC HỢP ĐỒNG
                  </h5>
                  <p className="text-xs text-slate-700 mt-1">
                    Hợp đồng có hiệu lực kể từ ngày ký. Bên nào muốn chấm dứt hợp đồng trước hạn phải thông báo trước cho bên kia ít nhất 30 ngày. Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để thực hiện.
                  </p>
                </div>
              </div>

              {/* Chữ ký 2 bên */}
              <div className="pt-8 grid grid-cols-2 text-center text-xs">
                <div>
                  <p className="font-bold uppercase text-slate-900">ĐẠI DIỆN BÊN B</p>
                  <p className="text-[11px] text-slate-500 italic">(Ký và ghi rõ họ tên)</p>
                  <div className="h-16 flex items-end justify-center font-bold text-slate-800">
                    {daiDien?.ho_ten || ''}
                  </div>
                </div>

                <div>
                  <p className="font-bold uppercase text-slate-900">ĐẠI DIỆN BÊN A</p>
                  <p className="text-[11px] text-slate-500 italic">(Ký và ghi rõ họ tên)</p>
                  <div className="h-16 flex items-end justify-center font-bold text-slate-800">
                    {tenChuTro}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadDoc}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải file văn bản</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/25 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In hợp đồng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
