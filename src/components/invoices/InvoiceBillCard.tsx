import { forwardRef } from 'react';
import type { HoaDon, ToaNha, Phong, SinhVien, CaiDat } from '../../types';
import { formatVND, formatDate, formatMonthYear } from '../../utils/formatters';
import { generateVietQrUrl, generateTransferContent } from '../../utils/vietqr';
import { numberToVietnameseWords } from '../../utils/numberToWords';

export interface InvoiceBillCardProps {
  hoaDon: HoaDon;
  toaNha: ToaNha;
  phong: Phong;
  daiDien?: SinhVien;
  caiDat?: CaiDat;
  dienDau?: number;
  dienCuoi?: number;
}

export const InvoiceBillCard = forwardRef<HTMLDivElement, InvoiceBillCardProps>(
  (
    {
      hoaDon,
      toaNha,
      phong,
      daiDien,
      caiDat,
      dienDau,
      dienCuoi,
    },
    ref
  ) => {
    // Thông tin ngân hàng từ cài đặt
    const bankId = caiDat?.bank_id?.trim() || '';
    const soTk = caiDat?.so_tk?.trim() || '';
    const tenChuTk = caiDat?.ten_chu_tk?.trim() || '';
    const hasBankingInfo = Boolean(bankId && soTk && tenChuTk);

    const noiDungChuyenKhoan = generateTransferContent(phong.so_phong, hoaDon.thang);
    const soTienThanhToan = hoaDon.con_no > 0 ? hoaDon.con_no : hoaDon.tong_tien;

    const qrUrl = hasBankingInfo
      ? generateVietQrUrl({
          bankId,
          accountNo: soTk,
          accountName: tenChuTk,
          amount: soTienThanhToan,
          description: noiDungChuyenKhoan,
        })
      : '';

    const phiDichVuDauNguoi =
      hoaDon.phi_dich_vu_dau_nguoi ?? toaNha.phi_dich_vu_dau_nguoi ?? 170000;
    const soNguoi = hoaDon.so_nguoi || 1;
    const tienDichVu = hoaDon.tien_dich_vu ?? soNguoi * phiDichVuDauNguoi;
    const toaTenDisplay = toaNha.ten.startsWith('Tòa') ? toaNha.ten : `Tòa ${toaNha.ten}`;

    return (
      <div
        ref={ref}
        id="invoice-capture-area"
        className="w-full max-w-[600px] mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl text-slate-800 font-sans leading-normal selection:bg-none"
        style={{ minWidth: '340px' }}
      >
        {/* Header hóa đơn */}
        <div className="text-center pb-5 border-b-2 border-dashed border-slate-200">
          <div className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
            Hóa đơn tiền thuê nhà
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase">
            {toaTenDisplay}
          </h2>
          <p className="text-xs text-slate-500 mt-1">{toaNha.dia_chi}</p>

          <div className="mt-3 inline-flex items-center gap-3 px-4 py-1.5 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">
            <span>Kỳ: <strong>{formatMonthYear(hoaDon.thang)}</strong></span>
            <span>•</span>
            <span>Ngày lập: <strong>{formatDate(hoaDon.created_at || new Date().toISOString())}</strong></span>
          </div>
        </div>

        {/* Thông tin phòng & khách thuê */}
        <div className="py-4 grid grid-cols-2 gap-3 text-xs border-b border-slate-100">
          <div>
            <span className="text-slate-500 block">Số phòng:</span>
            <strong className="text-lg font-black text-blue-700">{phong.so_phong}</strong>
          </div>
          <div>
            <span className="text-slate-500 block">Người đại diện:</span>
            <strong className="text-sm font-bold text-slate-900">
              {daiDien?.ho_ten || 'Đại diện phòng'}
            </strong>
            {daiDien?.sdt && (
              <span className="text-slate-500 block font-mono">SĐT: {daiDien.sdt}</span>
            )}
          </div>
        </div>

        {/* Bảng chi tiết các khoản theo quy tắc mới */}
        <div className="py-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-left">
                <th className="pb-2 font-bold uppercase text-[11px]">Khoản thu</th>
                <th className="pb-2 font-bold uppercase text-[11px] text-right">Chi tiết</th>
                <th className="pb-2 font-bold uppercase text-[11px] text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* 1. Tiền phòng */}
              <tr>
                <td className="py-2.5 font-bold text-slate-800">1. Tiền phòng</td>
                <td className="py-2.5 text-right text-slate-500">1 tháng</td>
                <td className="py-2.5 text-right font-extrabold text-slate-900 font-mono">
                  {formatVND(hoaDon.tien_phong)}
                </td>
              </tr>

              {/* 2. Tiền điện */}
              <tr>
                <td className="py-2.5">
                  <span className="font-bold text-slate-800 block">2. Tiền điện</span>
                  <span className="text-[11px] text-slate-500">
                    {dienDau !== undefined && dienCuoi !== undefined
                      ? `${dienDau} ➔ ${dienCuoi} (${hoaDon.so_dien} kWh)`
                      : `${hoaDon.so_dien} kWh`}
                  </span>
                </td>
                <td className="py-2.5 text-right text-slate-500 font-mono">
                  {formatVND(hoaDon.don_gia_dien)}/kWh
                </td>
                <td className="py-2.5 text-right font-extrabold text-slate-900 font-mono">
                  {formatVND(hoaDon.tien_dien)}
                </td>
              </tr>

              {/* 3. Phí dịch vụ (Đã gồm nước, rác, wifi, gửi xe) */}
              <tr>
                <td className="py-2.5">
                  <span className="font-bold text-slate-800 block">3. Phí dịch vụ</span>
                  <span className="text-[11px] text-slate-500 block">
                    Đã gồm nước, rác, wifi, gửi xe
                  </span>
                </td>
                <td className="py-2.5 text-right text-slate-500 font-mono">
                  {soNguoi} người × {formatVND(phiDichVuDauNguoi)}
                </td>
                <td className="py-2.5 text-right font-extrabold text-slate-900 font-mono">
                  {formatVND(tienDichVu)}
                </td>
              </tr>

              {/* 4. Phụ phí / Giảm trừ (nếu có) */}
              {hoaDon.phu_phi && hoaDon.phu_phi.length > 0 &&
                hoaDon.phu_phi.map((pp, idx) => (
                  <tr key={pp.id || idx}>
                    <td className="py-2.5 font-bold text-slate-800">
                      + {pp.ten || 'Phụ phí / Giảm trừ'}
                    </td>
                    <td className="py-2.5 text-right text-slate-500">Phát sinh</td>
                    <td className={`py-2.5 text-right font-extrabold font-mono ${pp.so_tien < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {formatVND(pp.so_tien)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Tổng tiền & Bằng chữ */}
        <div className="py-3.5 px-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-slate-800">TỔNG TIỀN PHẢI ĐÓNG:</span>
            <span className="text-xl sm:text-2xl font-black text-blue-700 font-mono">
              {formatVND(hoaDon.tong_tien)}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1 italic">
            (Bằng chữ: {numberToVietnameseWords(hoaDon.tong_tien)})
          </p>

          {/* Đã đóng & Còn nợ nếu thanh toán một phần */}
          {hoaDon.da_dong > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between text-xs">
              <span className="text-emerald-700 font-medium">Đã thanh toán: {formatVND(hoaDon.da_dong)}</span>
              <span className="text-rose-700 font-bold">Còn nợ lại: {formatVND(hoaDon.con_no)}</span>
            </div>
          )}
        </div>

        {/* Khối quét mã VietQR */}
        {hasBankingInfo ? (
          <div className="mt-5 p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/40 text-center">
            <p className="text-xs font-extrabold text-blue-900 uppercase tracking-wide mb-3">
              Quét mã VietQR để chuyển khoản nhanh
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* Ảnh VietQR */}
              {qrUrl && (
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 shrink-0">
                  <img
                    src={qrUrl}
                    alt="Mã QR VietQR chuyển khoản"
                    className="w-36 h-36 object-contain"
                    onError={(e) => {
                      // Ẩn ảnh nếu lỗi mạng ngoại tuyến
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Thông tin tài khoản dạng chữ */}
              <div className="text-left text-xs space-y-1.5 flex-1">
                <div>
                  <span className="text-slate-500 block">Ngân hàng:</span>
                  <strong className="text-sm font-bold text-slate-900">{bankId}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Số tài khoản:</span>
                  <strong className="text-base font-black text-blue-800 font-mono tracking-wider">
                    {soTk}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Chủ tài khoản:</span>
                  <strong className="font-bold text-slate-900 uppercase">{tenChuTk}</strong>
                </div>
                <div className="pt-1 border-t border-blue-100">
                  <span className="text-slate-500 block">Nội dung chuyển khoản:</span>
                  <strong className="text-sm font-black text-rose-600 font-mono bg-rose-50 px-2 py-0.5 rounded-md inline-block">
                    {noiDungChuyenKhoan}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 p-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 text-center">
            <p className="text-xs font-bold text-amber-800">
              Chưa cài đặt tài khoản nhận tiền
            </p>
            <p className="text-[11px] text-amber-600 mt-1">
              Vui lòng vào Cài đặt hệ thống để cấu hình tài khoản nhận tiền VietQR.
            </p>
          </div>
        )}

        {/* Lời nhắc chân trang */}
        <div className="mt-4 text-center text-[11px] text-slate-400">
          <p>Cảm ơn các bạn! Vui lòng nộp tiền trước ngày {toaNha.han_dong_tien || 5} hàng tháng.</p>
        </div>
      </div>
    );
  }
);
