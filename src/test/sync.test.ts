import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/dexie';
import { SyncService } from '../db/sync';
import * as supabaseModule from '../services/supabase';
import type { ToaNha, HopDong, SinhVien } from '../types';

describe('SyncService Unit Tests', () => {
  const mockOwnerId = 'e8b7d9b0-1234-4567-89ab-cdef01234567';

  beforeEach(async () => {
    // Xóa sạch dữ liệu trong db test
    await Promise.all([
      db.toa_nha.clear(),
      db.phong.clear(),
      db.hop_dong.clear(),
      db.sinh_vien.clear(),
      db.chi_so.clear(),
      db.hoa_don.clear(),
      db.thanh_toan.clear(),
      db.chi_phi.clear(),
      db.cai_dat.clear(),
      db.outbox.clear(),
    ]);

    // Giả lập Supabase đã được cấu hình
    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    // Giả lập trực tuyến (online)
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TÌNH HUỐNG 1: Ghi thành công lên cả Dexie và Supabase
  it('1. Ghi thành công: lưu vào Dexie và gọi upsert lên Supabase', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.spyOn(supabaseModule.supabase, 'from').mockReturnValue({
      upsert: upsertSpy,
    } as any);

    const toaId = crypto.randomUUID();
    const newToa: ToaNha = {
      id: toaId,
      owner_id: mockOwnerId,
      ten: 'Tòa A1',
      dia_chi: '123 Cầu Giấy',
      don_gia_dien: 3500,
      phi_dich_vu_dau_nguoi: 170000,
      ngay_chot_so: 25,
      han_dong_tien: 5,
      is_deleted: false,
    };

    await SyncService.saveToaNha(newToa);

    // Kiểm tra Dexie đã lưu
    const savedInDexie = await db.toa_nha.get(toaId);
    expect(savedInDexie).toBeDefined();
    expect(savedInDexie?.ten).toBe('Tòa A1');

    // Kiểm tra Supabase upsert được gọi đúng tham số
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: toaId,
        owner_id: mockOwnerId,
        ten: 'Tòa A1',
      })
    );

    // Kiểm tra outbox không bị đọng việc
    const outboxCount = await db.outbox.count();
    expect(outboxCount).toBe(0);
  });

  // TÌNH HUỐNG 2: Ghi lỗi CSDL (phải hoàn tác Dexie và báo lỗi)
  it('2. Ghi lỗi: hoàn tác (rollback) Dexie khi Supabase từ chối bản ghi', async () => {
    const dbError = {
      message: 'new row violates row-level security policy for table "toa_nha"',
      code: '42501',
    };
    const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: dbError });
    vi.spyOn(supabaseModule.supabase, 'from').mockReturnValue({
      upsert: upsertSpy,
    } as any);

    const toaId = crypto.randomUUID();
    const newToa: ToaNha = {
      id: toaId,
      owner_id: mockOwnerId,
      ten: 'Tòa Lỗi',
      dia_chi: 'Hà Nội',
      don_gia_dien: 3500,
      phi_dich_vu_dau_nguoi: 170000,
      ngay_chot_so: 25,
      han_dong_tien: 5,
      is_deleted: false,
    };

    // Hàm phải ném ra lỗi mã 42501 theo đúng format
    await expect(SyncService.saveToaNha(newToa)).rejects.toThrow(
      'Không có quyền ghi dữ liệu'
    );

    // Kiểm tra Dexie: bản ghi đã bị HOÀN TÁC (xóa bỏ)
    const savedInDexie = await db.toa_nha.get(toaId);
    expect(savedInDexie).toBeUndefined();

    // Outbox không chứa bản ghi bị từ chối do vi phạm nghiệp vụ
    const outboxCount = await db.outbox.count();
    expect(outboxCount).toBe(0);
  });

  // TÌNH HUỐNG 3: Ngoại tuyến (Offline -> lưu Dexie và đưa vào Outbox)
  it('3. Ngoại tuyến: khi mất mạng, lưu Dexie và đưa thao tác vào Outbox', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    const toaId = crypto.randomUUID();
    const newToa: ToaNha = {
      id: toaId,
      owner_id: mockOwnerId,
      ten: 'Tòa Ngoại Tuyến',
      dia_chi: '',
      don_gia_dien: 3500,
      phi_dich_vu_dau_nguoi: 170000,
      ngay_chot_so: 25,
      han_dong_tien: 5,
      is_deleted: false,
    };

    await SyncService.saveToaNha(newToa);

    // Dexie vẫn lưu bình thường (Optimistic)
    const savedInDexie = await db.toa_nha.get(toaId);
    expect(savedInDexie?.ten).toBe('Tòa Ngoại Tuyến');

    // Hàng đợi outbox phải có 1 bản ghi chờ
    const outboxItems = await db.outbox.toArray();
    expect(outboxItems.length).toBe(1);
    expect(outboxItems[0].table_name).toBe('toa_nha');
    expect(outboxItems[0].action).toBe('upsert');
    expect(outboxItems[0].record_id).toBe(toaId);
  });

  // TÌNH HUỐNG 4: Chặn đăng xuất khi Outbox còn dữ liệu chưa đồng bộ
  it('4. Chặn đăng xuất: từ chối xóa cache và chặn đăng xuất khi Outbox còn việc', async () => {
    await db.outbox.put({
      id: crypto.randomUUID(),
      table_name: 'phong',
      action: 'upsert',
      record_id: crypto.randomUUID(),
      payload: { so_phong: 'P.101' },
      created_at: new Date().toISOString(),
      retry_count: 0,
    });

    const checkCanLogout = async (): Promise<{ success: boolean; error?: string }> => {
      const pendingCount = await db.outbox.count();
      if (pendingCount > 0) {
        return {
          success: false,
          error: `Còn ${pendingCount} thay đổi chưa lưu lên máy chủ, vui lòng chờ hoặc kết nối mạng để hoàn tất đồng bộ!`,
        };
      }
      return { success: true };
    };

    const logoutResult = await checkCanLogout();
    expect(logoutResult.success).toBe(false);
    expect(logoutResult.error).toContain('Còn 1 thay đổi chưa lưu lên máy chủ');

    const count = await db.outbox.count();
    expect(count).toBe(1);
  });

  // TÌNH HUỐNG 5: Ký hợp đồng mới có 2 sinh viên - Kiểm tra đúng 3 bước tuần tự
  it('5. Ký hợp đồng mới có 2 sinh viên: gọi đúng thứ tự (a) hop_dong với null rep -> (b) sinh_vien -> (c) update hop_dong rep', async () => {
    const callLog: string[] = [];

    const mockFrom = vi.fn((table: string) => {
      if (table === 'hop_dong') {
        return {
          upsert: vi.fn(async (payload: any) => {
            callLog.push(`hop_dong:upsert:rep=${payload.nguoi_dai_dien_id}`);
            return { data: null, error: null };
          }),
          update: vi.fn((updateData: any) => {
            callLog.push(`hop_dong:update:rep=${updateData.nguoi_dai_dien_id}`);
            return {
              eq: vi.fn(async () => {
                callLog.push('hop_dong:update:eq');
                return { data: null, error: null };
              }),
            };
          }),
        };
      }
      if (table === 'sinh_vien') {
        return {
          upsert: vi.fn(async (payload: any) => {
            callLog.push(`sinh_vien:upsert:count=${Array.isArray(payload) ? payload.length : 1}`);
            return { data: null, error: null };
          }),
        };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    vi.spyOn(supabaseModule.supabase, 'from').mockImplementation(mockFrom as any);

    const phongId = crypto.randomUUID();
    const hopDongId = crypto.randomUUID();
    const sv1Id = crypto.randomUUID();
    const sv2Id = crypto.randomUUID();

    const hopDong: HopDong = {
      id: hopDongId,
      owner_id: mockOwnerId,
      phong_id: phongId,
      ngay_bat_dau: '2026-11-01',
      ngay_het_han: '2027-11-01',
      tien_coc: 3500000,
      gia_thue_thoa_thuan: 3500000,
      do_ban_giao: [],
      nguoi_dai_dien_id: sv1Id, // Có người đại diện là sv1
      dang_hieu_luc: true,
      ghi_chu: '',
    };

    const sinhViens: SinhVien[] = [
      {
        id: sv1Id,
        owner_id: mockOwnerId,
        hop_dong_id: hopDongId,
        ho_ten: 'Nguyễn Văn Đại Diện',
        sdt: '0901234567',
        cccd: '001200000001',
        truong: 'ĐHQG',
        bien_so: '29A-12345',
        la_dai_dien: true,
        ngay_vao: '2026-11-01',
        dang_o: true,
      },
      {
        id: sv2Id,
        owner_id: mockOwnerId,
        hop_dong_id: hopDongId,
        ho_ten: 'Trần Văn Bạn Cùng Phòng',
        sdt: '0909999999',
        cccd: '001200000002',
        truong: 'ĐHQG',
        bien_so: '29B-99999',
        la_dai_dien: false,
        ngay_vao: '2026-11-01',
        dang_o: true,
      },
    ];

    await SyncService.saveHopDongWithStudents(hopDong, sinhViens);

    // 1. Kiểm tra Dexie lưu đầy đủ ngay (optimistic)
    const savedHd = await db.hop_dong.get(hopDongId);
    expect(savedHd?.nguoi_dai_dien_id).toBe(sv1Id);
    const savedSvCount = await db.sinh_vien.where({ hop_dong_id: hopDongId }).count();
    expect(savedSvCount).toBe(2);

    // 2. Kiểm tra đúng thứ tự gọi Supabase:
    // (a) hop_dong với nguoi_dai_dien_id = null
    // (b) sinh_vien với đủ 2 sinh viên
    // (c) update hop_dong.nguoi_dai_dien_id = sv1Id
    expect(callLog).toEqual([
      'hop_dong:upsert:rep=null',
      'sinh_vien:upsert:count=2',
      `hop_dong:update:rep=${sv1Id}`,
      'hop_dong:update:eq',
    ]);

    // Outbox phải được xóa sạch sau khi hoàn tất cả 3 bước
    const pendingOutbox = await db.outbox.count();
    expect(pendingOutbox).toBe(0);
  });

  // TÌNH HUỐNG 6: Lỗi ở bước 2 (upsert sinh viên) -> giữ nguyên nhóm ở step 2 trong Outbox
  it('6. Lỗi ở bước 2: giữ nguyên nhóm trong outbox ở step 2, không lặp lại bước 1', async () => {
    let hopDongUpsertCount = 0;

    const mockFrom = vi.fn((table: string) => {
      if (table === 'hop_dong') {
        return {
          upsert: vi.fn(async () => {
            hopDongUpsertCount++;
            return { data: null, error: null }; // Bước 1 thành công
          }),
        };
      }
      if (table === 'sinh_vien') {
        return {
          upsert: vi.fn(async () => {
            // Bước 2 gặp lỗi mạng
            const networkError = new Error('Failed to fetch');
            return { data: null, error: networkError };
          }),
        };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    vi.spyOn(supabaseModule.supabase, 'from').mockImplementation(mockFrom as any);

    const hopDongId = crypto.randomUUID();
    const sv1Id = crypto.randomUUID();

    const hopDong: HopDong = {
      id: hopDongId,
      owner_id: mockOwnerId,
      phong_id: crypto.randomUUID(),
      ngay_bat_dau: '2026-11-01',
      ngay_het_han: '2027-11-01',
      tien_coc: 3000000,
      gia_thue_thoa_thuan: 3000000,
      do_ban_giao: [],
      nguoi_dai_dien_id: sv1Id,
      dang_hieu_luc: true,
      ghi_chu: '',
    };

    const sinhViens: SinhVien[] = [
      {
        id: sv1Id,
        owner_id: mockOwnerId,
        hop_dong_id: hopDongId,
        ho_ten: 'Nguyễn Văn A',
        sdt: '0912345678',
        cccd: '001200000003',
        truong: '',
        bien_so: '',
        la_dai_dien: true,
        ngay_vao: '2026-11-01',
        dang_o: true,
      },
    ];

    // Gọi lưu
    await SyncService.saveHopDongWithStudents(hopDong, sinhViens);

    // Kiểm tra outbox: nhóm vẫn được GIỮ LẠI và đang ở step 2
    const outboxItems = await db.outbox.toArray();
    expect(outboxItems.length).toBe(1);
    expect(outboxItems[0].table_name).toBe('hop_dong_group');
    expect(outboxItems[0].payload.step).toBe(2);

    // Bước 1 đã chạy 1 lần
    expect(hopDongUpsertCount).toBe(1);

    // Thử chạy processOutbox khi mạng phục hồi ở bước 2 và 3
    const resumeCallLog: string[] = [];
    vi.spyOn(supabaseModule.supabase, 'from').mockImplementation((table: string) => {
      if (table === 'hop_dong') {
        return {
          upsert: vi.fn(async () => {
            resumeCallLog.push('hop_dong:upsert'); // Không được chạy lại bước 1!
            return { data: null, error: null };
          }),
          update: vi.fn((updateData: any) => {
            resumeCallLog.push(`hop_dong:update:rep=${updateData.nguoi_dai_dien_id}`);
            return {
              eq: vi.fn(async () => {
                resumeCallLog.push('hop_dong:update:eq');
                return { data: null, error: null };
              }),
            };
          }),
        };
      }
      if (table === 'sinh_vien') {
        return {
          upsert: vi.fn(async () => {
            resumeCallLog.push('sinh_vien:upsert');
            return { data: null, error: null };
          }),
        };
      }
      return {} as any;
    });

    const processResult = await SyncService.processOutbox();
    expect(processResult.processed).toBe(1);

    // Kiểm tra log khi phục hồi: KHÔNG lặp lại bước 1 (hop_dong:upsert), chạy thẳng bước 2 và 3
    expect(resumeCallLog).not.toContain('hop_dong:upsert');
    expect(resumeCallLog).toEqual([
      'sinh_vien:upsert',
      `hop_dong:update:rep=${sv1Id}`,
      'hop_dong:update:eq',
    ]);

    // Outbox sau khi phục hồi đã được xóa hoàn tất
    const finalOutboxCount = await db.outbox.count();
    expect(finalOutboxCount).toBe(0);
  });

  // TÌNH HUỐNG 7: Kiểm tra định dạng mã lỗi tiếng Việt
  it('7. Thông báo lỗi tiếng Việt đúng theo mã: 23503, 23505, 42501', () => {
    expect(SyncService.formatSupabaseError({ code: '23503', message: 'foreign key error' })).toBe(
      'Dữ liệu liên quan chưa được lưu lên máy chủ'
    );
    expect(SyncService.formatSupabaseError({ code: '23505', message: 'duplicate key error' })).toBe(
      'Dữ liệu bị trùng'
    );
    expect(SyncService.formatSupabaseError({ code: '42501', message: 'permission denied' })).toBe(
      'Không có quyền ghi dữ liệu'
    );
    expect(SyncService.formatSupabaseError({ code: '40001', message: 'serialization failure' })).toBe(
      'Lỗi máy chủ (40001): serialization failure'
    );
  });
});
