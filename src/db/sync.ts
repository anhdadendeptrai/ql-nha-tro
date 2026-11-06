/**
 * Quản lý đồng bộ dữ liệu giữa IndexedDB (Dexie) và Supabase (PostgreSQL)
 * Tuân thủ nguyên tắc:
 * 1. Supabase là NGUỒN DỮ LIỆU THẬT (Single Source of Truth), IndexedDB là bản đệm (Cache)
 * 2. Optimistic UI: Ghi Dexie trước -> Đẩy Supabase sau. Nếu lỗi CSDL thì rollback Dexie và báo lỗi rõ ràng.
 * 3. Ngoại tuyến (Offline): Hàng đợi Outbox lưu lại thay đổi, tự động đẩy lên Supabase khi có mạng.
 * 4. Tất cả khóa chính phải là chuẩn UUID (crypto.randomUUID()) để tương thích kiểu UUID PostgreSQL.
 * 5. Ký hợp đồng mới & Sinh viên:
 *    - (a) upsert hop_dong với nguoi_dai_dien_id = null
 *    - (b) upsert các sinh_vien thuộc hợp đồng
 *    - (c) update hop_dong.nguoi_dai_dien_id = id đại diện
 * 6. Thứ tự toàn cục khi đẩy outbox:
 *    toa_nha -> phong -> hop_dong -> sinh_vien -> update nguoi_dai_dien_id -> hoa_don -> thanh_toan -> chi_so -> chi_phi -> cai_dat
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
  OutboxItem,
  OutboxTable,
} from '../types';

type SyncListener = () => void;

export class SyncService {
  private static lastSyncKey = 'qlpt_last_synced_at';
  private static listeners: Set<SyncListener> = new Set();
  private static isProcessingOutbox = false;

  static subscribe(fn: SyncListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private static notifyListeners(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Lỗi sync listener:', e);
      }
    });
  }

  /**
   * Chuyển đổi mã lỗi Supabase/PostgreSQL sang thông báo tiếng Việt thân thiện theo quy định:
   * - 23503: "Dữ liệu liên quan chưa được lưu lên máy chủ"
   * - 23505: "Dữ liệu bị trùng"
   * - 42501: "Không có quyền ghi dữ liệu"
   * - các mã khác thì kèm mã lỗi.
   */
  static formatSupabaseError(error: unknown): string {
    if (!error) return 'Lỗi không xác định';
    const errObj = error as { code?: string; message?: string };
    const code = errObj.code ? String(errObj.code) : '';
    if (code === '23503') {
      return 'Dữ liệu liên quan chưa được lưu lên máy chủ';
    }
    if (code === '23505') {
      return 'Dữ liệu bị trùng';
    }
    if (code === '42501') {
      return 'Không có quyền ghi dữ liệu';
    }
    if (code) {
      return `Lỗi máy chủ (${code}): ${errObj.message || 'Lỗi cơ sở dữ liệu'}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error) || 'Không thể kết nối máy chủ';
  }

  /**
   * Kiểm tra lỗi có phải do mất mạng / ngoại tuyến không
   */
  static isNetworkError(err: unknown): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
    if (!err) return false;
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('fetch failed') ||
      msg.includes('load failed') ||
      msg.includes('connection refused') ||
      msg.includes('timeout') ||
      msg.includes('offline')
    );
  }

  /**
   * Tính toán độ ưu tiên toàn cục khi đẩy dữ liệu:
   * toa_nha (10) -> phong (20) -> hop_dong (30) -> sinh_vien (40) -> update nguoi_dai_dien_id (50)
   * -> hoa_don (60) -> thanh_toan (70) -> chi_so (80) -> chi_phi (90) -> cai_dat (100)
   */
  static getTablePriority(item: OutboxItem): number {
    if (item.table_name === 'toa_nha') return 10;
    if (item.table_name === 'phong') return 20;
    if (item.table_name === 'hop_dong') return 30;
    if (item.table_name === 'hop_dong_group') {
      const step = item.payload?.step || 1;
      if (step === 1) return 30;
      if (step === 2) return 40;
      return 50; // step 3: update nguoi_dai_dien_id
    }
    if (item.table_name === 'sinh_vien') return 40;
    if (item.table_name === 'hoa_don') return 60;
    if (item.table_name === 'thanh_toan') return 70;
    if (item.table_name === 'chi_so') return 80;
    if (item.table_name === 'chi_phi') return 90;
    if (item.table_name === 'cai_dat') return 100;
    return 999;
  }

  /**
   * Lọc payload chỉ gồm các cột hợp lệ trong migration CSDL Supabase
   */
  static sanitizePayload(tableName: OutboxTable, data: Record<string, unknown>): Record<string, unknown> {
    const allowedColumns: Partial<Record<OutboxTable, string[]>> = {
      toa_nha: [
        'id', 'owner_id', 'ten', 'dia_chi', 'don_gia_dien', 'phi_dich_vu_dau_nguoi',
        'ngay_chot_so', 'han_dong_tien', 'is_deleted', 'cach_tinh_nuoc', 'don_gia_nuoc',
        'tien_rac', 'tien_mang', 'phi_gui_xe', 'created_at', 'updated_at'
      ],
      phong: [
        'id', 'owner_id', 'toa_id', 'so_phong', 'tang', 'gia_thue', 'trang_thai',
        'so_nguoi_toi_da', 'ghi_chu', 'ngay_trong_tu', 'is_deleted', 'created_at', 'updated_at'
      ],
      hop_dong: [
        'id', 'owner_id', 'phong_id', 'ngay_bat_dau', 'ngay_het_han', 'tien_coc',
        'gia_thue_thoa_thuan', 'do_ban_giao', 'nguoi_dai_dien_id', 'dang_hieu_luc',
        'ghi_chu', 'created_at', 'updated_at'
      ],
      sinh_vien: [
        'id', 'owner_id', 'hop_dong_id', 'ho_ten', 'sdt', 'cccd', 'truong', 'bien_so',
        'anh_cccd_truoc', 'anh_cccd_sau', 'la_dai_dien', 'ngay_vao', 'dang_o',
        'created_at', 'updated_at'
      ],
      chi_so: [
        'id', 'owner_id', 'phong_id', 'thang', 'dien_dau', 'dien_cuoi', 'nuoc_dau',
        'nuoc_cuoi', 'created_at', 'updated_at'
      ],
      hoa_don: [
        'id', 'owner_id', 'phong_id', 'thang', 'tien_phong', 'tien_dien', 'tien_nuoc',
        'tien_rac', 'tien_mang', 'tien_xe', 'tien_dich_vu', 'phi_dich_vu_dau_nguoi',
        'phu_phi', 'tong_tien', 'da_dong', 'con_no', 'trang_thai', 'ghi_chu',
        'don_gia_dien', 'don_gia_nuoc', 'cach_tinh_nuoc', 'so_dien', 'so_nuoc',
        'so_nguoi', 'so_xe', 'created_at', 'updated_at'
      ],
      thanh_toan: [
        'id', 'owner_id', 'hoa_don_id', 'ngay', 'so_tien', 'hinh_thuc', 'ghi_chu', 'created_at'
      ],
      chi_phi: [
        'id', 'owner_id', 'toa_id', 'ngay', 'loai', 'so_tien', 'ghi_chu', 'created_at', 'updated_at'
      ],
      cai_dat: [
        'owner_id', 'bank_id', 'so_tk', 'ten_chu_tk', 'nguong_canh_bao_dien',
        'mau_tin_nhan', 'mau_hop_dong', 'created_at', 'updated_at'
      ],
    };

    const allowed = allowedColumns[tableName];
    if (!allowed) return { ...data };

    const sanitized: Record<string, unknown> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sanitized[key] = data[key];
      }
    }
    return sanitized;
  }

  /**
   * Thêm một thao tác vào hàng đợi Outbox khi ngoại tuyến hoặc lỗi mạng tạm thời
   */
  static async addToOutbox(
    tableName: OutboxTable,
    action: 'upsert' | 'delete',
    recordId: string,
    payload: unknown
  ): Promise<void> {
    const item: OutboxItem = {
      id: crypto.randomUUID(),
      table_name: tableName,
      action,
      record_id: recordId,
      payload,
      created_at: new Date().toISOString(),
      retry_count: 0,
    };
    await db.outbox.put(item);
    this.notifyListeners();
  }

  /**
   * Hoàn tác dữ liệu Dexie khi tạo nhóm hợp đồng + sinh viên bị lỗi vĩnh viễn
   */
  static async rollbackContractGroup(hopDong: HopDong, sinhViens: SinhVien[]): Promise<void> {
    try {
      await db.hop_dong.delete(hopDong.id);
      for (const sv of sinhViens) {
        await db.sinh_vien.delete(sv.id);
      }
      const phong = await db.phong.get(hopDong.phong_id);
      if (phong) {
        phong.trang_thai = 'trong';
        await db.phong.put(phong);
      }
    } catch (err) {
      console.error('Lỗi rollback contract group:', err);
    }
  }

  /**
   * Xử lý nhóm hợp đồng gồm 3 bước tuần tự:
   * (a) upsert hop_dong với nguoi_dai_dien_id = null
   * (b) upsert các sinh_vien của hợp đồng đó
   * (c) update hop_dong.nguoi_dai_dien_id = id sinh viên đại diện
   */
  static async processContractGroupItem(
    item: OutboxItem
  ): Promise<'done' | 'step_advanced' | 'network_break'> {
    const payload = item.payload as {
      hopDong: HopDong;
      sinhViens: SinhVien[];
      step: 1 | 2 | 3;
    };

    const { hopDong, sinhViens } = payload;
    let currentStep = payload.step || 1;

    // BƯỚC 1: (a) upsert hop_dong với nguoi_dai_dien_id = null
    if (currentStep === 1) {
      const hdPayload = this.sanitizePayload('hop_dong', {
        ...hopDong,
        nguoi_dai_dien_id: null,
      });
      const { error: errStep1 } = await supabase.from('hop_dong').upsert(hdPayload);
      if (errStep1) {
        if (this.isNetworkError(errStep1)) return 'network_break';
        await this.rollbackContractGroup(hopDong, sinhViens);
        await db.outbox.delete(item.id);
        throw new Error(this.formatSupabaseError(errStep1));
      }
      currentStep = 2;
      payload.step = 2;
      await db.outbox.update(item.id, { payload: { ...payload, step: 2 } });
    }

    // BƯỚC 2: (b) upsert các sinh_vien của hợp đồng đó
    if (currentStep === 2) {
      if (sinhViens && sinhViens.length > 0) {
        const svPayloads = sinhViens.map((sv) =>
          this.sanitizePayload('sinh_vien', sv as unknown as Record<string, unknown>)
        );
        const { error: errStep2 } = await supabase.from('sinh_vien').upsert(svPayloads);
        if (errStep2) {
          if (this.isNetworkError(errStep2)) return 'network_break';
          await this.rollbackContractGroup(hopDong, sinhViens);
          await db.outbox.delete(item.id);
          throw new Error(this.formatSupabaseError(errStep2));
        }
      }
      currentStep = 3;
      payload.step = 3;
      await db.outbox.update(item.id, { payload: { ...payload, step: 3 } });
    }

    // BƯỚC 3: (c) update hop_dong.nguoi_dai_dien_id = id sinh viên đại diện
    if (currentStep === 3) {
      const repId = hopDong.nguoi_dai_dien_id || sinhViens.find((s) => s.la_dai_dien)?.id;
      if (repId) {
        const { error: errStep3 } = await supabase
          .from('hop_dong')
          .update({
            nguoi_dai_dien_id: repId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', hopDong.id);
        if (errStep3) {
          if (this.isNetworkError(errStep3)) return 'network_break';
          await this.rollbackContractGroup(hopDong, sinhViens);
          await db.outbox.delete(item.id);
          throw new Error(this.formatSupabaseError(errStep3));
        }
      }
      return 'done';
    }

    return 'done';
  }

  /**
   * Lưu Hợp đồng kèm Sinh viên theo đúng 3 bước tuần tự:
   * Dexie: lưu đầy đủ ngay (optimistic)
   * Supabase:
   * (a) upsert hop_dong với nguoi_dai_dien_id = null
   * (b) upsert các sinh_vien của hợp đồng đó
   * (c) update hop_dong.nguoi_dai_dien_id = id sinh viên đại diện
   */
  static async saveHopDongWithStudents(hopDong: HopDong, sinhViens: SinhVien[]): Promise<void> {
    const nowIso = new Date().toISOString();
    hopDong.updated_at = nowIso;
    for (const sv of sinhViens) {
      sv.updated_at = nowIso;
    }

    // 1. Lưu ngay vào Dexie (Optimistic UI)
    await db.hop_dong.put(hopDong);
    if (sinhViens.length > 0) {
      await db.sinh_vien.bulkPut(sinhViens);
    }

    if (!isSupabaseConfigured()) return;

    // 2. Tạo bản ghi outbox nhóm
    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      table_name: 'hop_dong_group',
      action: 'upsert',
      record_id: hopDong.id,
      payload: {
        hopDong,
        sinhViens,
        step: 1,
      },
      created_at: nowIso,
      retry_count: 0,
    };

    // Đưa vào outbox
    await db.outbox.put(outboxItem);
    this.notifyListeners();

    // Nếu ngoại tuyến, dừng lại chờ có mạng
    if (!navigator.onLine) {
      return;
    }

    // Nếu có mạng, thực thi tuần tự
    try {
      const result = await this.processContractGroupItem(outboxItem);
      if (result === 'done') {
        await db.outbox.delete(outboxItem.id);
      }
    } catch (err) {
      throw err;
    } finally {
      this.notifyListeners();
    }
  }

  /**
   * Xử lý gửi toàn bộ hàng đợi outbox lên Supabase khi có mạng
   * Tuân thủ thứ tự toàn cục:
   * toa_nha -> phong -> hop_dong -> sinh_vien -> update nguoi_dai_dien_id -> hoa_don -> thanh_toan -> chi_so -> chi_phi -> cai_dat
   * Không đẩy song song các bảng có phụ thuộc.
   */
  static async processOutbox(): Promise<{ processed: number; remaining: number }> {
    if (!isSupabaseConfigured() || !navigator.onLine || this.isProcessingOutbox) {
      const remaining = await db.outbox.count();
      return { processed: 0, remaining };
    }

    this.isProcessingOutbox = true;
    let processed = 0;

    try {
      const rawItems = await db.outbox.toArray();
      // Sắp xếp theo thứ tự ưu tiên toàn cục và thời gian tạo
      const sortedItems = rawItems.sort((a, b) => {
        const pA = SyncService.getTablePriority(a);
        const pB = SyncService.getTablePriority(b);
        if (pA !== pB) return pA - pB;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      for (const item of sortedItems) {
        if (!navigator.onLine) break;

        try {
          if (item.table_name === 'hop_dong_group') {
            const groupResult = await this.processContractGroupItem(item);
            if (groupResult === 'done') {
              await db.outbox.delete(item.id);
              processed++;
            } else if (groupResult === 'network_break') {
              break;
            }
            continue;
          }

          if (item.action === 'upsert') {
            const sanitized = this.sanitizePayload(item.table_name, item.payload as Record<string, unknown>);
            const { error } = await supabase.from(item.table_name).upsert(sanitized);
            if (error) {
              if (this.isNetworkError(error)) break;
              console.error(`Lỗi đẩy outbox (${item.table_name}):`, error);
              await db.outbox.update(item.id, {
                retry_count: (item.retry_count || 0) + 1,
                last_error: this.formatSupabaseError(error),
              });
              continue;
            }
          } else if (item.action === 'delete') {
            const { error } = await supabase.from(item.table_name).delete().eq('id', item.record_id);
            if (error) {
              if (this.isNetworkError(error)) break;
              console.error(`Lỗi xóa outbox (${item.table_name}):`, error);
              await db.outbox.update(item.id, {
                retry_count: (item.retry_count || 0) + 1,
                last_error: this.formatSupabaseError(error),
              });
              continue;
            }
          }

          await db.outbox.delete(item.id);
          processed++;
        } catch (itemErr) {
          if (this.isNetworkError(itemErr)) break;
          console.error('Lỗi khi gửi bản ghi outbox:', itemErr);
          await db.outbox.update(item.id, {
            retry_count: (item.retry_count || 0) + 1,
            last_error: this.formatSupabaseError(itemErr),
          });
        }
      }
    } finally {
      this.isProcessingOutbox = false;
      this.notifyListeners();
    }

    const remaining = await db.outbox.count();
    return { processed, remaining };
  }

  /**
   * Helper: Tải toàn bộ dữ liệu của một bảng từ Supabase có phân trang (tránh giới hạn 1000 dòng)
   */
  private static async fetchAllFromSupabase<T>(
    tableName: string,
    ownerId: string,
    lastSync: string | null
  ): Promise<T[]> {
    const pageSize = 1000;
    let from = 0;
    let allRows: T[] = [];
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from(tableName)
        .select('*')
        .eq('owner_id', ownerId)
        .order(tableName === 'thanh_toan' ? 'created_at' : 'updated_at', { ascending: true })
        .range(from, from + pageSize - 1);

      if (lastSync) {
        const timeColumn = tableName === 'thanh_toan' ? 'created_at' : 'updated_at';
        query = query.gt(timeColumn, lastSync);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        allRows = allRows.concat(data as T[]);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    return allRows;
  }

  /**
   * Tải toàn bộ dữ liệu từ Supabase về Dexie (Hỗ trợ phân trang và delta sync)
   * Tự động gán sinh viên có la_dai_dien = true nếu nguoi_dai_dien_id null
   */
  static async syncFromSupabase(ownerId: string): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured()) {
      return { success: true, message: 'Chế độ phát triển Dev Mock.' };
    }

    if (!navigator.onLine) {
      return { success: false, message: 'Đang ngoại tuyến, hiển thị dữ liệu lưu đệm trên máy.' };
    }

    try {
      const lastSync = localStorage.getItem(this.lastSyncKey);

      // 1. Tòa nhà
      const toas = await this.fetchAllFromSupabase<ToaNha>('toa_nha', ownerId, lastSync);
      if (toas.length > 0) await db.toa_nha.bulkPut(toas);

      // 2. Phòng
      const phongs = await this.fetchAllFromSupabase<Phong>('phong', ownerId, lastSync);
      if (phongs.length > 0) await db.phong.bulkPut(phongs);

      // 3. Hợp đồng
      const hopDongs = await this.fetchAllFromSupabase<HopDong>('hop_dong', ownerId, lastSync);

      // 4. Sinh viên
      const sinhViens = await this.fetchAllFromSupabase<SinhVien>('sinh_vien', ownerId, lastSync);
      if (sinhViens.length > 0) await db.sinh_vien.bulkPut(sinhViens);

      // Khi đọc từ Supabase về: nếu nguoi_dai_dien_id null thì tự gán sinh viên có la_dai_dien = true của hợp đồng đó
      const repByHd = new Map<string, string>();
      const allActiveSv = await db.sinh_vien.where({ dang_o: 1 as unknown as boolean }).toArray();
      for (const sv of [...allActiveSv, ...sinhViens]) {
        if (sv.la_dai_dien && sv.hop_dong_id) {
          repByHd.set(sv.hop_dong_id, sv.id);
        }
      }

      for (const hd of hopDongs) {
        if (!hd.nguoi_dai_dien_id && repByHd.has(hd.id)) {
          hd.nguoi_dai_dien_id = repByHd.get(hd.id);
        }
      }
      if (hopDongs.length > 0) await db.hop_dong.bulkPut(hopDongs);

      // Cập nhật các hợp đồng đã có sẵn trong Dexie nếu nguoi_dai_dien_id còn null
      const existingHds = await db.hop_dong.toArray();
      for (const hd of existingHds) {
        if (!hd.nguoi_dai_dien_id && repByHd.has(hd.id)) {
          hd.nguoi_dai_dien_id = repByHd.get(hd.id);
          await db.hop_dong.put(hd);
        }
      }

      // 5. Chỉ số
      const chiSos = await this.fetchAllFromSupabase<ChiSo>('chi_so', ownerId, lastSync);
      if (chiSos.length > 0) await db.chi_so.bulkPut(chiSos);

      // 6. Hóa đơn
      const hoaDons = await this.fetchAllFromSupabase<HoaDon>('hoa_don', ownerId, lastSync);
      if (hoaDons.length > 0) await db.hoa_don.bulkPut(hoaDons);

      // 7. Thanh toán
      const thanhToans = await this.fetchAllFromSupabase<ThanhToan>('thanh_toan', ownerId, lastSync);
      if (thanhToans.length > 0) await db.thanh_toan.bulkPut(thanhToans);

      // 8. Chi phí
      const chiPhis = await this.fetchAllFromSupabase<ChiPhi>('chi_phi', ownerId, lastSync);
      if (chiPhis.length > 0) await db.chi_phi.bulkPut(chiPhis);

      // 9. Cài đặt hệ thống
      const { data: cd, error: errCd } = await supabase
        .from('cai_dat')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (!errCd && cd) {
        await db.cai_dat.put(cd as CaiDat);
      }

      // Xử lý nốt hàng đợi outbox (nếu có)
      await this.processOutbox();

      // Lưu mốc thời gian đồng bộ thành công
      localStorage.setItem(this.lastSyncKey, new Date().toISOString());
      this.notifyListeners();
      return { success: true, message: 'Đồng bộ dữ liệu thành công.' };
    } catch (err: unknown) {
      console.error('Lỗi khi tải dữ liệu từ Supabase:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Không thể kết nối máy chủ Supabase.',
      };
    }
  }

  // =========================================================================
  // CÁC THAO TÁC GHI DỮ LIỆU ĐƠN LẺ
  // =========================================================================

  /**
   * Lưu Tòa nhà
   */
  static async saveToaNha(toa: ToaNha): Promise<void> {
    const previous = await db.toa_nha.get(toa.id);
    toa.updated_at = new Date().toISOString();
    await db.toa_nha.put(toa);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('toa_nha', 'upsert', toa.id, toa);
      return;
    }

    try {
      const payload = this.sanitizePayload('toa_nha', toa as unknown as Record<string, unknown>);
      const { error } = await supabase.from('toa_nha').upsert(payload);
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('toa_nha', 'upsert', toa.id, toa);
        } else {
          if (previous) await db.toa_nha.put(previous);
          else await db.toa_nha.delete(toa.id);
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('toa_nha', 'upsert', toa.id, toa);
      } else {
        if (previous) await db.toa_nha.put(previous);
        else await db.toa_nha.delete(toa.id);
        throw err;
      }
    }
  }

  /**
   * Xóa mềm Tòa nhà
   */
  static async deleteToaNha(toaId: string): Promise<void> {
    const previous = await db.toa_nha.get(toaId);
    if (!previous) return;

    const updatedToa = { ...previous, is_deleted: true, updated_at: new Date().toISOString() };
    await db.toa_nha.put(updatedToa);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('toa_nha', 'upsert', toaId, updatedToa);
      return;
    }

    try {
      const { error } = await supabase
        .from('toa_nha')
        .update({ is_deleted: true, updated_at: updatedToa.updated_at })
        .eq('id', toaId);
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('toa_nha', 'upsert', toaId, updatedToa);
        } else {
          await db.toa_nha.put(previous);
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('toa_nha', 'upsert', toaId, updatedToa);
      } else {
        await db.toa_nha.put(previous);
        throw err;
      }
    }
  }

  /**
   * Lưu Phòng
   */
  static async savePhong(phong: Phong): Promise<void> {
    const previous = await db.phong.get(phong.id);
    phong.updated_at = new Date().toISOString();
    await db.phong.put(phong);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('phong', 'upsert', phong.id, phong);
      return;
    }

    try {
      const payload = this.sanitizePayload('phong', phong as unknown as Record<string, unknown>);
      const { error } = await supabase.from('phong').upsert(payload);
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('phong', 'upsert', phong.id, phong);
        } else {
          if (previous) await db.phong.put(previous);
          else await db.phong.delete(phong.id);
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('phong', 'upsert', phong.id, phong);
      } else {
        if (previous) await db.phong.put(previous);
        else await db.phong.delete(phong.id);
        throw err;
      }
    }
  }

  /**
   * Lưu Sinh viên lẻ
   */
  static async saveSinhVien(sv: SinhVien): Promise<void> {
    const previous = await db.sinh_vien.get(sv.id);
    sv.updated_at = new Date().toISOString();
    await db.sinh_vien.put(sv);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('sinh_vien', 'upsert', sv.id, sv);
      return;
    }

    try {
      const payload = this.sanitizePayload('sinh_vien', sv as unknown as Record<string, unknown>);
      const { error } = await supabase.from('sinh_vien').upsert(payload);
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('sinh_vien', 'upsert', sv.id, sv);
        } else {
          if (previous) await db.sinh_vien.put(previous);
          else await db.sinh_vien.delete(sv.id);
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('sinh_vien', 'upsert', sv.id, sv);
      } else {
        if (previous) await db.sinh_vien.put(previous);
        else await db.sinh_vien.delete(sv.id);
        throw err;
      }
    }
  }

  /**
   * Đánh dấu sinh viên rời phòng
   */
  static async removeSinhVien(svId: string): Promise<void> {
    const previous = await db.sinh_vien.get(svId);
    if (!previous) return;

    const updated = { ...previous, dang_o: false, updated_at: new Date().toISOString() };
    await db.sinh_vien.put(updated);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('sinh_vien', 'upsert', svId, updated);
      return;
    }

    try {
      const { error } = await supabase
        .from('sinh_vien')
        .update({ dang_o: false, updated_at: updated.updated_at })
        .eq('id', svId);
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('sinh_vien', 'upsert', svId, updated);
        } else {
          await db.sinh_vien.put(previous);
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('sinh_vien', 'upsert', svId, updated);
      } else {
        await db.sinh_vien.put(previous);
        throw err;
      }
    }
  }

  /**
   * Cập nhật thông tin Hợp đồng đơn lẻ (ví dụ: cập nhật đồ bàn giao, ghi chú)
   */
  static async saveHopDong(hd: HopDong): Promise<void> {
    const previous = await db.hop_dong.get(hd.id);
    hd.updated_at = new Date().toISOString();
    await db.hop_dong.put(hd);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('hop_dong', 'upsert', hd.id, hd);
      return;
    }

    try {
      const payload = this.sanitizePayload('hop_dong', hd as unknown as Record<string, unknown>);
      const { error } = await supabase.from('hop_dong').upsert(payload);
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('hop_dong', 'upsert', hd.id, hd);
        } else {
          if (previous) await db.hop_dong.put(previous);
          else await db.hop_dong.delete(hd.id);
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('hop_dong', 'upsert', hd.id, hd);
      } else {
        if (previous) await db.hop_dong.put(previous);
        else await db.hop_dong.delete(hd.id);
        throw err;
      }
    }
  }

  /**
   * Thủ tục trả phòng: Kết thúc hợp đồng, chuyển trạng thái phòng sang 'trong'
   */
  static async checkoutPhong(phongId: string, ngayTra: string = new Date().toISOString().split('T')[0]): Promise<void> {
    const phong = await db.phong.get(phongId);
    if (!phong) return;

    phong.trang_thai = 'trong';
    phong.ngay_trong_tu = ngayTra;
    phong.updated_at = new Date().toISOString();
    await db.phong.put(phong);

    const hopDong = await db.hop_dong.where({ phong_id: phongId, dang_hieu_luc: 1 as unknown as boolean }).first();
    if (hopDong) {
      hopDong.dang_hieu_luc = false;
      hopDong.updated_at = new Date().toISOString();
      await db.hop_dong.put(hopDong);

      const sinhViens = await db.sinh_vien.where({ hop_dong_id: hopDong.id }).toArray();
      for (const sv of sinhViens) {
        sv.dang_o = false;
        sv.updated_at = new Date().toISOString();
        await db.sinh_vien.put(sv);
      }
    }

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('phong', 'upsert', phongId, phong);
      if (hopDong) {
        await this.addToOutbox('hop_dong', 'upsert', hopDong.id, hopDong);
      }
      return;
    }

    try {
      await supabase.from('phong').update({
        trang_thai: 'trong',
        ngay_trong_tu: ngayTra,
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

  /**
   * Lưu hàng loạt Chỉ số điện nước (Meter Readings)
   */
  static async saveChiSoBatch(chiSos: ChiSo[]): Promise<void> {
    await db.chi_so.bulkPut(chiSos);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      for (const cs of chiSos) {
        await this.addToOutbox('chi_so', 'upsert', cs.id, cs);
      }
      return;
    }

    try {
      const sanitized = chiSos.map((cs) => this.sanitizePayload('chi_so', cs as unknown as Record<string, unknown>));
      const { error } = await supabase.from('chi_so').upsert(sanitized);
      if (error) {
        if (this.isNetworkError(error)) {
          for (const cs of chiSos) await this.addToOutbox('chi_so', 'upsert', cs.id, cs);
        } else {
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        for (const cs of chiSos) await this.addToOutbox('chi_so', 'upsert', cs.id, cs);
      } else {
        throw err;
      }
    }
  }

  /**
   * Lưu hàng loạt Hóa đơn (Invoices)
   */
  static async saveHoaDonBatch(hoaDons: HoaDon[]): Promise<void> {
    await db.hoa_don.bulkPut(hoaDons);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      for (const hd of hoaDons) {
        await this.addToOutbox('hoa_don', 'upsert', hd.id, hd);
      }
      return;
    }

    try {
      const sanitized = hoaDons.map((hd) => this.sanitizePayload('hoa_don', hd as unknown as Record<string, unknown>));
      const { error } = await supabase.from('hoa_don').upsert(sanitized);
      if (error) {
        if (this.isNetworkError(error)) {
          for (const hd of hoaDons) await this.addToOutbox('hoa_don', 'upsert', hd.id, hd);
        } else {
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        for (const hd of hoaDons) await this.addToOutbox('hoa_don', 'upsert', hd.id, hd);
      } else {
        throw err;
      }
    }
  }

  /**
   * Cập nhật thanh toán hóa đơn
   */
  static async updatePaymentStatus(
    hoaDonId: string,
    daDongMoi: number,
    hinhThuc: 'tien_mat' | 'chuyen_khoan' = 'chuyen_khoan',
    ghiChu = ''
  ): Promise<HoaDon | null> {
    const hoaDon = await db.hoa_don.get(hoaDonId);
    if (!hoaDon) return null;

    const previousDaDong = hoaDon.da_dong;
    const previousTrangThai = hoaDon.trang_thai;

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

    // 1. Cập nhật Dexie
    await db.hoa_don.put(hoaDon);

    // 2. Thêm bản ghi thanh toán dùng UUID
    const paymentId = crypto.randomUUID();
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

    if (!isSupabaseConfigured()) return hoaDon;

    if (!navigator.onLine) {
      await this.addToOutbox('hoa_don', 'upsert', hoaDon.id, hoaDon);
      await this.addToOutbox('thanh_toan', 'upsert', paymentId, thanhToan);
      return hoaDon;
    }

    try {
      const sanitizedHd = this.sanitizePayload('hoa_don', hoaDon as unknown as Record<string, unknown>);
      const { error: errHd } = await supabase.from('hoa_don').upsert(sanitizedHd);
      if (errHd) throw errHd;

      const sanitizedTt = this.sanitizePayload('thanh_toan', thanhToan as unknown as Record<string, unknown>);
      const { error: errTt } = await supabase.from('thanh_toan').insert(sanitizedTt);
      if (errTt) throw errTt;
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('hoa_don', 'upsert', hoaDon.id, hoaDon);
        await this.addToOutbox('thanh_toan', 'upsert', paymentId, thanhToan);
      } else {
        hoaDon.da_dong = previousDaDong;
        hoaDon.con_no = Math.max(0, hoaDon.tong_tien - previousDaDong);
        hoaDon.trang_thai = previousTrangThai;
        await db.hoa_don.put(hoaDon);
        await db.thanh_toan.delete(paymentId);
        throw new Error(this.formatSupabaseError(err));
      }
    }

    return hoaDon;
  }

  /**
   * Hoàn tác thanh toán
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

    if (!isSupabaseConfigured()) return hoaDon;

    if (!navigator.onLine) {
      await this.addToOutbox('hoa_don', 'upsert', hoaDon.id, hoaDon);
      return hoaDon;
    }

    try {
      const sanitized = this.sanitizePayload('hoa_don', hoaDon as unknown as Record<string, unknown>);
      const { error } = await supabase.from('hoa_don').upsert(sanitized);
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('hoa_don', 'upsert', hoaDon.id, hoaDon);
        } else {
          throw error;
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('hoa_don', 'upsert', hoaDon.id, hoaDon);
      } else {
        console.error('Lỗi hoàn tác thanh toán:', err);
      }
    }

    return hoaDon;
  }

  /**
   * Lưu chi phí vận hành
   */
  static async saveChiPhi(chiPhi: ChiPhi): Promise<void> {
    const previous = await db.chi_phi.get(chiPhi.id);
    chiPhi.updated_at = new Date().toISOString();
    await db.chi_phi.put(chiPhi);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('chi_phi', 'upsert', chiPhi.id, chiPhi);
      return;
    }

    try {
      const payload = this.sanitizePayload('chi_phi', chiPhi as unknown as Record<string, unknown>);
      const { error } = await supabase.from('chi_phi').upsert(payload);
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('chi_phi', 'upsert', chiPhi.id, chiPhi);
        } else {
          if (previous) await db.chi_phi.put(previous);
          else await db.chi_phi.delete(chiPhi.id);
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('chi_phi', 'upsert', chiPhi.id, chiPhi);
      } else {
        if (previous) await db.chi_phi.put(previous);
        else await db.chi_phi.delete(chiPhi.id);
        throw err;
      }
    }
  }

  /**
   * Xóa chi phí vận hành
   */
  static async deleteChiPhi(chiPhiId: string): Promise<void> {
    const previous = await db.chi_phi.get(chiPhiId);
    await db.chi_phi.delete(chiPhiId);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('chi_phi', 'delete', chiPhiId, {});
      return;
    }

    try {
      const { error } = await supabase.from('chi_phi').delete().eq('id', chiPhiId);
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('chi_phi', 'delete', chiPhiId, {});
        } else {
          if (previous) await db.chi_phi.put(previous);
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('chi_phi', 'delete', chiPhiId, {});
      } else {
        if (previous) await db.chi_phi.put(previous);
        throw err;
      }
    }
  }

  /**
   * Lưu cấu hình cài đặt hệ thống (VietQR, Mẫu tin nhắn...)
   */
  static async saveCaiDat(caiDat: CaiDat): Promise<void> {
    const previous = await db.cai_dat.get(caiDat.owner_id);
    caiDat.updated_at = new Date().toISOString();
    await db.cai_dat.put(caiDat);

    if (!isSupabaseConfigured()) return;

    if (!navigator.onLine) {
      await this.addToOutbox('cai_dat', 'upsert', caiDat.owner_id, caiDat);
      return;
    }

    try {
      const payload = this.sanitizePayload('cai_dat', caiDat as unknown as Record<string, unknown>);
      const { error } = await supabase.from('cai_dat').upsert(payload, { onConflict: 'owner_id' });
      if (error) {
        if (this.isNetworkError(error)) {
          await this.addToOutbox('cai_dat', 'upsert', caiDat.owner_id, caiDat);
        } else {
          if (previous) await db.cai_dat.put(previous);
          else await db.cai_dat.delete(caiDat.owner_id);
          throw new Error(this.formatSupabaseError(error));
        }
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        await this.addToOutbox('cai_dat', 'upsert', caiDat.owner_id, caiDat);
      } else {
        if (previous) await db.cai_dat.put(previous);
        else await db.cai_dat.delete(caiDat.owner_id);
        throw err;
      }
    }
  }
}

// Tự động xử lý outbox khi có kết nối mạng trở lại
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    SyncService.processOutbox();
  });
}
