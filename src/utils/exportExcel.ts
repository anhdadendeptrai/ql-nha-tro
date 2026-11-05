import * as XLSX from 'xlsx';
import type { SinhVien, Phong, ToaNha } from '../types';
import { formatDate } from './formatters';

export interface SinhVienTamTruRow {
  sinhVien: SinhVien;
  phong: Phong;
  toaNha: ToaNha;
}

export interface DoanhThuExportItem {
  phong: string;
  toa: string;
  tienPhong: number;
  tienDien: number;
  phiDichVu: number;
  phuPhi: number;
  tongThu: number;
  daDong: number;
  conNo: number;
  trangThai: string;
}

/**
 * Xuất danh sách tạm trú ra file Excel (.xlsx) chuẩn cho Công an Phường / Tổ dân phố
 * Cột "Cơ sở/Tòa nhà" đổi thành "Tòa"
 */
export function exportTamTruToExcel(items: SinhVienTamTruRow[], toaTen: string): void {
  const rows = items.map((item, idx) => ({
    STT: idx + 1,
    'Họ và tên': item.sinhVien.ho_ten,
    'Số CCCD (12 số)': item.sinhVien.cccd,
    'Số điện thoại': item.sinhVien.sdt,
    'Phòng ở': item.phong.so_phong,
    'Tòa': item.toaNha.ten,
    'Địa chỉ nhà trọ': item.toaNha.dia_chi,
    'Ngày bắt đầu ở': formatDate(item.sinhVien.ngay_vao),
    'Biển số xe máy': item.sinhVien.bien_so || 'Không có',
    'Trường học': item.sinhVien.truong || 'Chưa cập nhật',
    'Là người đại diện': item.sinhVien.la_dai_dien ? 'Đại diện phòng' : 'Thành viên',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Đặt độ rộng các cột tự động cho đẹp
  worksheet['!cols'] = [
    { wch: 6 }, // STT
    { wch: 24 }, // Họ tên
    { wch: 18 }, // CCCD
    { wch: 14 }, // SĐT
    { wch: 10 }, // Phòng
    { wch: 16 }, // Tòa
    { wch: 35 }, // Địa chỉ
    { wch: 14 }, // Ngày vào
    { wch: 14 }, // Biển số xe
    { wch: 24 }, // Trường
    { wch: 18 }, // Đại diện
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách tạm trú');

  const cleanToa = toaTen.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Danh_Sach_Tam_Tru_${cleanToa}_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}

/**
 * Xuất báo cáo doanh thu ra file Excel (.xlsx) theo quy tắc mới:
 * Chỉ gồm cột: Tiền phòng | Tiền điện | Phí dịch vụ | Phụ phí | Tổng thu
 */
export function exportDoanhThuToExcel(items: DoanhThuExportItem[], thang: string, toaTen: string): void {
  const rows = items.map((item, idx) => ({
    STT: idx + 1,
    'Tòa': item.toa,
    'Phòng': item.phong,
    'Tiền phòng': item.tienPhong,
    'Tiền điện': item.tienDien,
    'Phí dịch vụ': item.phiDichVu,
    'Phụ phí': item.phuPhi,
    'Tổng thu': item.tongThu,
    'Đã đóng': item.daDong,
    'Còn nợ': item.conNo,
    'Trạng thái': item.trangThai,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Doanh thu ${thang}`);

  const cleanToa = toaTen.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Bao_Cao_Doanh_Thu_${cleanToa}_${thang}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
