-- ====================================================================
-- MIGRATION: BỔ SUNG CỘT BẢNG PHONG ĐỂ ĐỒNG BỘ TOÀN DIỆN VỚI FRONTEND
-- ====================================================================

-- 1. Bổ sung các cột cho bảng phong
alter table public.phong
  add column if not exists ngay_trong_tu date,
  add column if not exists is_deleted boolean not null default false;

-- 2. Đảm bảo RLS cho phép SELECT, INSERT, UPDATE, DELETE cho chủ sở hữu
create policy if not exists "Chủ trọ có toàn quyền trên outbox"
  on public.cai_dat for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
