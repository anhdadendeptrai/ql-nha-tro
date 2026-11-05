-- ====================================================================
-- MIGRATION: CẬP NHẬT ĐƠN GIÁ MỚI & QUẢN LÝ TÒA NHÀ
-- Quy tắc: Điện theo số công tơ, Phí dịch vụ 170.000 đ/người (gồm nước, rác, wifi, gửi xe)
-- Cập nhật cấu trúc bảng cho mô hình quản lý theo Tòa nhà
-- ====================================================================

-- 1. CẬP NHẬT BẢNG TOA_NHA
alter table public.toa_nha
  add column if not exists phi_dich_vu_dau_nguoi integer not null default 170000,
  add column if not exists is_deleted boolean not null default false;

-- Cho phép các cột cũ được nullable nếu cần
alter table public.toa_nha
  alter column don_gia_nuoc drop not null,
  alter column cach_tinh_nuoc drop not null,
  alter column tien_rac drop not null,
  alter column tien_mang drop not null,
  alter column phi_gui_xe drop not null;

-- 2. CẬP NHẬT BẢNG HOA_DON
alter table public.hoa_don
  add column if not exists phi_dich_vu_dau_nguoi integer not null default 170000,
  add column if not exists tien_dich_vu integer not null default 0;

-- Tự động tính tiền dịch vụ cho hóa đơn cũ nếu có
update public.hoa_don
set tien_dich_vu = (coalesce(tien_nuoc, 0) + coalesce(tien_rac, 0) + coalesce(tien_mang, 0) + coalesce(tien_xe, 0))
where tien_dich_vu = 0;
