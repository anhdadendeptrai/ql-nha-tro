/**
 * Quản lý đồng bộ dữ liệu giữa IndexedDB (Dexie) và Supabase (PostgreSQL)
 * Tuân thủ nguyên tắc: Hiển thị ngay từ Dexie -> Đồng bộ nền từ Supabase
 */

import { db } from './dexie';
import { supabase, isSupabaseConfigured } from '../services/supabase';
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

export class SyncService {
  private static lastSyncKey = 'qlpt_last_synced_at';

  /**
   * Đồng bộ toàn bộ dữ liệu từ Supabase về Dexie
   */
  static async syncFromSupabase(ownerId: string): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured() || !navigator.onLine) {
      return { success: false, message: 'Đang ngoại tuyến hoặc chưa cấu hình Supabase.' };
    }

    try {
      const lastSync = localStorage.getItem(this.lastSyncKey);
      
      // 1. Tải Tòa nhà
      let toaQuery = supabase.from('toa_nha').select('*').eq('owner_id', ownerId);
      if (lastSync) toaQuery = toaQuery.gt('updated_at', lastSync);
      const { data: toas, error: errToa } = await toaQuery;
      if (errToa) throw errToa;
      if (toas && toas.length > 0) await db.toa_nha.bulkPut(toas as ToaNha[]);

      // 2. Tải Phòng
      let phongQuery = supabase.from('phong').select('*').eq('owner_id', ownerId);
      if (lastSync) phongQuery = phongQuery.gt('updated_at', lastSync);
      const { data: phongs, error: errPhong } = await phongQuery;
      if (errPhong) throw errPhong;
      if (phongs && phongs.length > 0) await db.phong.bulkPut(phongs as Phong[]);

      // 3. Tải Hợp đồng
      let hdQuery = supabase.from('hop_dong').select('*').eq('owner_id', ownerId);
      if (lastSync) hdQuery = hdQuery.gt('updated_at', lastSync);
      const { data: hopDongs, error: errHd } = await hdQuery;
      if (errHd) throw errHd;
      if (hopDongs && hopDongs.length > 0) await db.hop_dong.bulkPut(hopDongs as HopDong[]);

      // 4. Tải Sinh viên
      let svQuery = supabase.from('sinh_vien').select('*').eq('owner_id', ownerId);
      if (lastSync) svQuery = svQuery.gt('updated_at', lastSync);
      const { data: sinhViens, error: errSv } = await svQuery;
      if (errSv) throw errSv;
      if (sinhViens && sinhViens.length > 0) await db.sinh_vien.bulkPut(sinhViens as SinhVien[]);

      // 5. Tải Chỉ số
      let csQuery = supabase.from('chi_so').select('*').eq('owner_id', ownerId);
      if (lastSync) csQuery = csQuery.gt('updated_at', lastSync);
      const { data: chiSos, error: errCs } = await csQuery;
      if (errCs) throw errCs;
      if (chiSos && chiSos.length > 0) await db.chi_so.bulkPut(chiSos as ChiSo[]);

      // 6. Tải Hóa đơn
      let hdBillQuery = supabase.from('hoa_don').select('*').eq('owner_id', ownerId);
      if (lastSync) hdBillQuery = hdBillQuery.gt('updated_at', lastSync);
      const { data: hoaDons, error: errHdBills } = await hdBillQuery;
      if (errHdBills) throw errHdBills;
      if (hoaDons && hoaDons.length > 0) await db.hoa_don.bulkPut(hoaDons as HoaDon[]);

      // 7. Tải Thanh toán
      let ttQuery = supabase.from('thanh_toan').select('*').eq('owner_id', ownerId);
      if (lastSync) ttQuery = ttQuery.gt('created_at', lastSync);
      const { data: thanhToans, error: errTt } = await ttQuery;
      if (errTt) throw errTt;
      if (thanhToans && thanhToans.length > 0) await db.thanh_toan.bulkPut(thanhToans as ThanhToan[]);

      // 8. Tải Chi phí
      let cpQuery = supabase.from('chi_phi').select('*').eq('owner_id', ownerId);
      if (lastSync) cpQuery = cpQuery.gt('updated_at', lastSync);
      const { data: chiPhis, error: errCp } = await cpQuery;
      if (errCp) throw errCp;
      if (chiPhis && chiPhis.length > 0) await db.chi_phi.bulkPut(chiPhis as ChiPhi[]);

      // 9. Cài đặt
      const { data: caiDats, error: errCd } = await supabase
        .from('cai_dat')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (!errCd && caiDats) {
        await db.cai_dat.put(caiDats as CaiDat);
      }

      // Lưu mốc thời gian đồng bộ
      localStorage.setItem(this.lastSyncKey, new Date().toISOString());
      return { success: true, message: 'Đồng bộ dữ liệu thành công.' };
    } catch (err: unknown) {
      console.error('Lỗi trong quá trình đồng bộ Supabase:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Không thể kết nối máy chủ.',
      };
    }
  }

  /**
   * Lưu thông tin Tòa (Thêm mới hoặc cập nhật)
   */
  static async saveToaNha(toa: ToaNha): Promise<void> {
    toa.updated_at = new Date().toISOString();
    await db.toa_nha.put(toa);

    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('toa_nha').upsert(toa);
      } catch (err) {
        console.error('Không thể đồng bộ tòa lên Supabase:', err);
      }
    }
  }

  /**
   * Xóa mềm Tòa (is_deleted: true)
   */
  static async deleteToaNha(toaId: string): Promise<void> {
    const toa = await db.toa_nha.get(toaId);
    if (!toa) return;

    toa.is_deleted = true;
    toa.updated_at = new Date().toISOString();
    await db.toa_nha.put(toa);

    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('toa_nha').update({ is_deleted: true, updated_at: toa.updated_at }).eq('id', toaId);
      } catch (err) {
        console.error('Không thể đồng bộ xóa tòa lên Supabase:', err);
      }
    }
  }

  /**
   * Lưu thông tin phòng (Optimistic: Cập nhật Dexie trước -> Đẩy lên Supabase sau)
   */
  static async savePhong(phong: Phong): Promise<void> {
    phong.updated_at = new Date().toISOString();
    await db.phong.put(phong);

    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('phong').upsert(phong);
      } catch (err) {
        console.error('Không thể đồng bộ phòng lên Supabase:', err);
      }
    }
  }

  /**
   * Lưu sinh viên (Thêm mới hoặc sửa thông tin)
   */
  static async saveSinhVien(sv: SinhVien): Promise<void> {
    sv.updated_at = new Date().toISOString();
    await db.sinh_vien.put(sv);

    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('sinh_vien').upsert(sv);
      } catch (err) {
        console.error('Không thể đồng bộ sinh viên lên Supabase:', err);
      }
    }
  }

  /**
   * Đánh dấu sinh viên rời phòng (Soft delete: không xóa cứng dữ liệu)
   */
  static async removeSinhVien(svId: string): Promise<void> {
    const sv = await db.sinh_vien.get(svId);
    if (!sv) return;

    sv.dang_o = false;
    sv.updated_at = new Date().toISOString();
    await db.sinh_vien.put(sv);

    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('sinh_vien').update({ dang_o: false, updated_at: sv.updated_at }).eq('id', svId);
      } catch (err) {
        console.error('Không thể cập nhật trạng thái rời phòng lên server:', err);
      }
    }
  }

  /**
   * Lưu hợp đồng thuê phòng
   */
  static async saveHopDong(hd: HopDong): Promise<void> {
    hd.updated_at = new Date().toISOString();
    await db.hop_dong.put(hd);

    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('hop_dong').upsert(hd);
      } catch (err) {
        console.error('Không thể đồng bộ hợp đồng lên Supabase:', err);
      }
    }
  }

  /**
   * Thủ tục trả phòng: Kết thúc hợp đồng, chuyển trạng thái phòng sang 'trong'
   */
  static async checkoutPhong(phongId: string, ngayTra: string = new Date().toISOString().split('T')[0]): Promise<void> {
    const phong = await db.phong.get(phongId);
    if (!phong) return;

    // 1. Cập nhật phòng
    phong.trang_thai = 'trong';
    phong.ngay_trong_tu = ngayTra;
    phong.updated_at = new Date().toISOString();
    await db.phong.put(phong);

    // 2. Kết thúc hợp đồng đang hiệu lực
    const hopDong = await db.hop_dong.where({ phong_id: phongId, dang_hieu_luc: 1 as unknown as boolean }).first();
    if (hopDong) {
      hopDong.dang_hieu_luc = false;
      hopDong.updated_at = new Date().toISOString();
      await db.hop_dong.put(hopDong);

      // Đánh dấu toàn bộ sinh viên trong hợp đồng này ngừng ở
      const sinhViens = await db.sinh_vien.where({ hop_dong_id: hopDong.id }).toArray();
      for (const sv of sinhViens) {
        sv.dang_o = false;
        sv.updated_at = new Date().toISOString();
        await db.sinh_vien.put(sv);
      }
    }

    // 3. Đẩy lên Supabase nếu có mạng
    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('phong').update({
          trang_thai: 'trong',
          updated_at: phong.updated_at,
        }).eq('id', phongId);

        if (hopDong) {
          await supabase.from('hop_dong').update({
            dang_hieu_luc: false,
            updated_at: hopDong.updated_at,
          }).eq('id', hopDong.id);

          await supabase.from('sinh_vien').update({
            dang_o: false,
            updated_at: new Date().toISOString(),
          }).eq('hop_dong_id', hopDong.id);
        }
      } catch (err) {
        console.error('Lỗi khi đồng bộ thủ tục trả phòng:', err);
      }
    }
  }

  /**
   * Cập nhật nhanh trạng thái thanh toán hóa đơn (Optimistic UI)
   */
  static async updatePaymentStatus(
    hoaDonId: string,
    daDongMoi: number,
    hinhThuc: 'tien_mat' | 'chuyen_khoan' = 'chuyen_khoan',
    ghiChu = ''
  ): Promise<HoaDon | null> {
    const hoaDon = await db.hoa_don.get(hoaDonId);
    if (!hoaDon) return null;

    hoaDon.da_dong = daDongMoi;
    hoaDon.con_no = Math.max(0, hoaDon.tong_tien - daDongMoi);
    if (hoaDon.con_no === 0) {
      hoaDon.trang_thai = 'da_dong';
    } else if (hoaDon.da_dong > 0) {
      hoaDon.trang_thai = 'dong_thieu';
    } else {
      hoaDon.trang_thai = 'chua_dong';
    }
    hoaDon.updated_at = new Date().toISOString();

    // 1. Cập nhật Dexie ngay tức khắc
    await db.hoa_don.put(hoaDon);

    // 2. Thêm bản ghi thanh toán
    const paymentId = `tt-${Date.now()}`;
    const thanhToan: ThanhToan = {
      id: paymentId,
      owner_id: hoaDon.owner_id,
      hoa_don_id: hoaDon.id,
      ngay: new Date().toISOString(),
      so_tien: daDongMoi,
      hinh_thuc: hinhThuc,
      ghi_chu: ghiChu || 'Thu tiền phòng',
      created_at: new Date().toISOString(),
    };
    await db.thanh_toan.put(thanhToan);

    // 3. Đồng bộ Supabase nếu có mạng
    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('hoa_don').update({
          da_dong: hoaDon.da_dong,
          con_no: hoaDon.con_no,
          trang_thai: hoaDon.trang_thai,
          updated_at: hoaDon.updated_at,
        }).eq('id', hoaDon.id);

        await supabase.from('thanh_toan').insert(thanhToan);
      } catch (err) {
        console.error('Lỗi đồng bộ thanh toán lên Supabase:', err);
      }
    }

    return hoaDon;
  }

  /**
   * Hoàn tác thanh toán hóa đơn
   */
  static async revertPayment(hoaDonId: string, previousDaDong: number): Promise<HoaDon | null> {
    const hoaDon = await db.hoa_don.get(hoaDonId);
    if (!hoaDon) return null;

    hoaDon.da_dong = previousDaDong;
    hoaDon.con_no = Math.max(0, hoaDon.tong_tien - previousDaDong);
    if (hoaDon.con_no === 0 && hoaDon.tong_tien > 0) {
      hoaDon.trang_thai = 'da_dong';
    } else if (hoaDon.da_dong > 0) {
      hoaDon.trang_thai = 'dong_thieu';
    } else {
      hoaDon.trang_thai = 'chua_dong';
    }
    hoaDon.updated_at = new Date().toISOString();

    await db.hoa_don.put(hoaDon);

    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('hoa_don').update({
          da_dong: hoaDon.da_dong,
          con_no: hoaDon.con_no,
          trang_thai: hoaDon.trang_thai,
          updated_at: hoaDon.updated_at,
        }).eq('id', hoaDon.id);
      } catch (err) {
        console.error('Lỗi hoàn tác thanh toán lên Supabase:', err);
      }
    }

    return hoaDon;
  }

  /**
   * Lưu chi phí vận hành (Thêm mới / sửa)
   */
  static async saveChiPhi(chiPhi: ChiPhi): Promise<void> {
    chiPhi.updated_at = new Date().toISOString();
    await db.chi_phi.put(chiPhi);

    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('chi_phi').upsert(chiPhi);
      } catch (err) {
        console.error('Lỗi đồng bộ chi phí lên Supabase:', err);
      }
    }
  }

  /**
   * Xóa chi phí vận hành
   */
  static async deleteChiPhi(chiPhiId: string): Promise<void> {
    await db.chi_phi.delete(chiPhiId);

    if (isSupabaseConfigured() && navigator.onLine) {
      try {
        await supabase.from('chi_phi').delete().eq('id', chiPhiId);
      } catch (err) {
        console.error('Lỗi xóa chi phí trên Supabase:', err);
      }
    }
  }
}
