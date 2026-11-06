import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/dexie';
import { SyncService } from '../db/sync';
import * as supabaseModule from '../services/supabase';
import type { ToaNha } from '../types';

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
    // Giả lập lỗi RLS hoặc ràng buộc khóa ngoại từ Supabase
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

    // Hàm phải ném ra lỗi
    await expect(SyncService.saveToaNha(newToa)).rejects.toThrow(
      /Lỗi lưu Tòa lên máy chủ/
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
    // Chuyển sang chế độ ngoại tuyến
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
    // Giả sử có 2 bản ghi đang chờ trong outbox
    await db.outbox.put({
      id: crypto.randomUUID(),
      table_name: 'phong',
      action: 'upsert',
      record_id: crypto.randomUUID(),
      payload: { so_phong: 'P.101' },
      created_at: new Date().toISOString(),
      retry_count: 0,
    });

    // Giả lập hàm logout được triển khai trong AuthContext
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

    // Kết quả phải là thất bại và trả về cảnh báo tiếng Việt
    expect(logoutResult.success).toBe(false);
    expect(logoutResult.error).toContain('Còn 1 thay đổi chưa lưu lên máy chủ');

    // Kiểm tra hàng đợi outbox vẫn nguyên vẹn
    const count = await db.outbox.count();
    expect(count).toBe(1);
  });
});
