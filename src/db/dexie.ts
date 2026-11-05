import Dexie, { type Table } from 'dexie';
import type {
  ToaNha,
  Phong,
  HopDong,
  SinhVien,
  ChiSo,
  HoaDon,
  ThanhToan,
  ChiPhi,
  CaiDat,
} from '../types';

export class QuanLyPhongTroDB extends Dexie {
  toa_nha!: Table<ToaNha, string>;
  phong!: Table<Phong, string>;
  hop_dong!: Table<HopDong, string>;
  sinh_vien!: Table<SinhVien, string>;
  chi_so!: Table<ChiSo, string>;
  hoa_don!: Table<HoaDon, string>;
  thanh_toan!: Table<ThanhToan, string>;
  chi_phi!: Table<ChiPhi, string>;
  cai_dat!: Table<CaiDat, string>;

  constructor() {
    super('QuanLyPhongTroDB');

    this.version(1).stores({
      toa_nha: 'id, owner_id, ten',
      phong: 'id, owner_id, toa_id, so_phong, tang, trang_thai',
      hop_dong: 'id, owner_id, phong_id, dang_hieu_luc',
      sinh_vien: 'id, owner_id, hop_dong_id, ho_ten, sdt, cccd, bien_so, dang_o',
      chi_so: 'id, owner_id, phong_id, thang, [phong_id+thang]',
      hoa_don: 'id, owner_id, phong_id, thang, trang_thai, [phong_id+thang]',
      thanh_toan: 'id, owner_id, hoa_don_id, ngay',
      chi_phi: 'id, owner_id, toa_id, ngay, loai',
      cai_dat: 'owner_id',
    });

    this.version(2).stores({
      toa_nha: 'id, owner_id, ten',
      phong: 'id, owner_id, toa_id, so_phong, tang, trang_thai',
      hop_dong: 'id, owner_id, phong_id, dang_hieu_luc',
      sinh_vien: 'id, owner_id, hop_dong_id, ho_ten, sdt, cccd, bien_so, dang_o',
      chi_so: 'id, owner_id, phong_id, thang, [phong_id+thang]',
      hoa_don: 'id, owner_id, phong_id, thang, trang_thai, [phong_id+thang]',
      thanh_toan: 'id, owner_id, hoa_don_id, ngay',
      chi_phi: 'id, owner_id, toa_id, ngay, loai',
      cai_dat: 'owner_id',
    }).upgrade(async (tx) => {
      // Nâng cấp lên v2: Xóa sạch toàn bộ dữ liệu mẫu cũ trong IndexedDB để bắt đầu dùng thật trống hoàn toàn
      await Promise.all([
        tx.table('toa_nha').clear(),
        tx.table('phong').clear(),
        tx.table('hop_dong').clear(),
        tx.table('sinh_vien').clear(),
        tx.table('chi_so').clear(),
        tx.table('hoa_don').clear(),
        tx.table('thanh_toan').clear(),
        tx.table('chi_phi').clear(),
        tx.table('cai_dat').clear(),
      ]);
    });
  }
}

export const db = new QuanLyPhongTroDB();
