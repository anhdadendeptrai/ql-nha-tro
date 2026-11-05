// Định nghĩa kiểu dữ liệu cho toàn bộ hệ thống PWA Quản lý Nhà trọ

export type CachTinhNuoc = 'theo_khoi' | 'theo_dau_nguoi';
export type TrangThaiPhong = 'trong' | 'co_nguoi' | 'sua_chua';
export type TrangThaiHoaDon = 'chua_dong' | 'dong_thieu' | 'da_dong';
export type HinhThucThanhToan = 'tien_mat' | 'chuyen_khoan';
export type LoaiChiPhi = 'sua_chua' | 'tien_dien_evn' | 'tien_nuoc' | 'khac';
export type VaiTroNguoiDung = 'chu_tro' | 'quan_ly';

export interface DoBanGiaoItem {
  id?: string;
  ten: string;
  so_luong: number;
  tinh_trang: string;
}

export interface PhuPhiItem {
  id?: string;
  ten: string;
  so_tien: number;
}

export interface MauTinNhanItem {
  id: string;
  tieu_de: string;
  noi_dung: string;
}

export interface ToaNha {
  id: string;
  owner_id: string;
  ten: string; // Tên tòa ngắn gọn (ví dụ: "Tòa A", "Tòa B", "D1"...)
  dia_chi: string;
  don_gia_dien: number; // VNĐ/kWh (mặc định 3500)
  phi_dich_vu_dau_nguoi: number; // VNĐ/người/tháng (mặc định 170000 - đã gồm nước, rác, wifi, gửi xe)
  ngay_chot_so: number;
  han_dong_tien: number;
  is_deleted?: boolean; // Xóa mềm tòa
  created_at?: string;
  updated_at?: string;

  // Các trường cũ để tương thích ngược dữ liệu
  cach_tinh_nuoc?: CachTinhNuoc;
  don_gia_nuoc?: number;
  tien_rac?: number;
  tien_mang?: number;
  phi_gui_xe?: number;
}

export interface Phong {
  id: string;
  owner_id: string;
  toa_id: string;
  so_phong: string;
  tang: number;
  gia_thue: number;
  trang_thai: TrangThaiPhong;
  so_nguoi_toi_da: number;
  ghi_chu: string;
  ngay_trong_tu?: string; // ngày bắt đầu trống
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HopDong {
  id: string;
  owner_id: string;
  phong_id: string;
  ngay_bat_dau: string;
  ngay_het_han: string;
  tien_coc: number;
  gia_thue_thoa_thuan: number;
  do_ban_giao: DoBanGiaoItem[];
  nguoi_dai_dien_id?: string | null;
  dang_hieu_luc: boolean;
  ghi_chu: string;
  created_at?: string;
  updated_at?: string;
}

export interface SinhVien {
  id: string;
  owner_id: string;
  hop_dong_id: string;
  ho_ten: string;
  sdt: string;
  cccd: string;
  truong: string;
  bien_so: string;
  anh_cccd_truoc?: string; // đường dẫn trong private bucket 'cccd'
  anh_cccd_sau?: string;
  la_dai_dien: boolean;
  ngay_vao: string;
  dang_o: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ChiSo {
  id: string;
  owner_id: string;
  phong_id: string;
  thang: string; // YYYY-MM
  dien_dau: number;
  dien_cuoi: number;
  created_at?: string;
  updated_at?: string;

  // Trường cũ để tương thích ngược
  nuoc_dau?: number;
  nuoc_cuoi?: number;
}

export interface HoaDon {
  id: string;
  owner_id: string;
  phong_id: string;
  thang: string; // YYYY-MM
  tien_phong: number;
  tien_dien: number;
  tien_dich_vu: number; // Đã bao gồm nước, rác, wifi, gửi xe = phi_dich_vu_dau_nguoi * so_nguoi
  phu_phi: PhuPhiItem[];
  tong_tien: number;
  da_dong: number;
  con_no: number;
  trang_thai: TrangThaiHoaDon;
  ghi_chu: string;
  
  // Snapshots đơn giá tại thời điểm chốt hóa đơn
  don_gia_dien: number;
  phi_dich_vu_dau_nguoi: number;
  so_dien: number;
  so_nguoi: number;

  // Các trường cũ để tương thích ngược khi xem hóa đơn quá khứ
  tien_nuoc?: number;
  tien_rac?: number;
  tien_mang?: number;
  tien_xe?: number;
  don_gia_nuoc?: number;
  cach_tinh_nuoc?: CachTinhNuoc;
  so_nuoc?: number;
  so_xe?: number;
  
  created_at?: string;
  updated_at?: string;
}

export interface ThanhToan {
  id: string;
  owner_id: string;
  hoa_don_id: string;
  ngay: string;
  so_tien: number;
  hinh_thuc: HinhThucThanhToan;
  ghi_chu: string;
  created_at?: string;
}

export interface ChiPhi {
  id: string;
  owner_id: string;
  toa_id: string;
  ngay: string;
  loai: LoaiChiPhi;
  so_tien: number;
  ghi_chu: string;
  created_at?: string;
  updated_at?: string;
}

export interface CaiDat {
  owner_id: string;
  bank_id: string;
  so_tk: string;
  ten_chu_tk: string;
  nguong_canh_bao_dien: number;
  mau_tin_nhan: MauTinNhanItem[];
  mau_hop_dong?: string;
  created_at?: string;
  updated_at?: string;
}

// Kiểu dữ liệu Phòng kèm thông tin chi tiết đầy đủ hiển thị lên UI
export interface PhongChiTiet extends Phong {
  toa_ten: string;
  hop_dong_hien_tai?: HopDong;
  sinh_vien_list: SinhVien[];
  dai_dien?: SinhVien;
  so_nguoi_hien_tai: number;
  so_xe_hien_tai: number;
  hoa_don_thang_nay?: HoaDon;
  chi_so_thang_nay?: ChiSo;
  so_ngay_con_han?: number; // Số ngày còn lại đến khi hết hạn hợp đồng
  da_het_han?: boolean;
  so_ngay_trong?: number; // Số ngày phòng bị bỏ trống
}
