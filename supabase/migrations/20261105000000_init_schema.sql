-- ====================================================================
-- MIGRATION: KHỞI TẠO CƠ SỞ DỮ LIỆU QUẢN LÝ NHÀ TRỌ SINH VIÊN (PWA)
-- Tối ưu hóa cho PostgreSQL / Supabase, Row Level Security (RLS) toàn diện
-- ====================================================================

-- 1. BẬT TIỆN ÍCH MỞ RỘNG (EXTENSIONS)
create extension if not exists "uuid-ossp";

-- Hàm tự động cập nhật cột updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2. TẠO CÁC BẢNG DỮ LIỆU CHÍNH

-- Bảng 2.1: Tòa nhà / Cơ sở
create table if not exists public.toa_nha (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ten text not null,
  dia_chi text default '',
  don_gia_dien integer not null default 3500, -- VNĐ/kWh
  cach_tinh_nuoc text not null check (cach_tinh_nuoc in ('theo_khoi', 'theo_dau_nguoi')) default 'theo_khoi',
  don_gia_nuoc integer not null default 30000, -- VNĐ/khối hoặc VNĐ/người/tháng
  tien_rac integer not null default 30000, -- VNĐ/phòng/tháng
  tien_mang integer not null default 100000, -- VNĐ/phòng/tháng
  phi_gui_xe integer not null default 100000, -- VNĐ/xe/tháng
  ngay_chot_so smallint not null default 25, -- ngày trong tháng
  han_dong_tien smallint not null default 5, -- ngày trong tháng kế tiếp
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bảng 2.2: Phòng
create table if not exists public.phong (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  toa_id uuid not null references public.toa_nha(id) on delete cascade,
  so_phong text not null, -- ví dụ: "P.101", "P.201"
  tang smallint not null default 1,
  gia_thue integer not null default 3500000, -- VNĐ/tháng
  trang_thai text not null check (trang_thai in ('trong', 'co_nguoi', 'sua_chua')) default 'trong',
  so_nguoi_toi_da smallint not null default 4,
  ghi_chu text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bảng 2.3: Hợp đồng thuê phòng
create table if not exists public.hop_dong (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  phong_id uuid not null references public.phong(id) on delete cascade,
  ngay_bat_dau date not null default current_date,
  ngay_het_han date not null,
  tien_coc integer not null default 0,
  gia_thue_thoa_thuan integer not null default 0,
  do_ban_giao jsonb not null default '[]'::jsonb, -- checklist tài sản bàn giao
  nguoi_dai_dien_id uuid, -- tham chiếu sinh_vien(id)
  dang_hieu_luc boolean not null default true,
  ghi_chu text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bảng 2.4: Sinh viên / Khách thuê
create table if not exists public.sinh_vien (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  hop_dong_id uuid not null references public.hop_dong(id) on delete cascade,
  ho_ten text not null,
  sdt text not null,
  cccd text not null,
  truong text default '',
  bien_so text default '',
  anh_cccd_truoc text default '', -- đường dẫn private Storage: "owner_id/filename.webp"
  anh_cccd_sau text default '',
  la_dai_dien boolean not null default false,
  ngay_vao date not null default current_date,
  dang_o boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Thêm khóa ngoại nguoi_dai_dien_id từ hop_dong tới sinh_vien (sau khi sinh_vien đã tồn tại)
alter table public.hop_dong
  add constraint fk_hop_dong_dai_dien
  foreign key (nguoi_dai_dien_id) references public.sinh_vien(id) on delete set null;

-- Bảng 2.5: Chỉ số điện nước hàng tháng
create table if not exists public.chi_so (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  phong_id uuid not null references public.phong(id) on delete cascade,
  thang text not null, -- định dạng: 'YYYY-MM' (ví dụ '2026-10')
  dien_dau integer not null default 0,
  dien_cuoi integer not null default 0,
  nuoc_dau integer not null default 0,
  nuoc_cuoi integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_chi_so_phong_thang unique (phong_id, thang)
);

-- Bảng 2.6: Hóa đơn phòng theo tháng
create table if not exists public.hoa_don (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  phong_id uuid not null references public.phong(id) on delete cascade,
  thang text not null, -- định dạng: 'YYYY-MM'
  tien_phong integer not null default 0,
  tien_dien integer not null default 0,
  tien_nuoc integer not null default 0,
  tien_rac integer not null default 0,
  tien_mang integer not null default 0,
  tien_xe integer not null default 0,
  phu_phi jsonb not null default '[]'::jsonb, -- [{ten: "Gửi xe thêm", so_tien: 100000}]
  tong_tien integer not null default 0,
  da_dong integer not null default 0,
  con_no integer not null default 0,
  trang_thai text not null check (trang_thai in ('chua_dong', 'dong_thieu', 'da_dong')) default 'chua_dong',
  ghi_chu text default '',
  -- CÁC CỘT CHỤP LẠI (SNAPSHOT) ĐƠN GIÁ TẠI THỜI ĐIỂM CHỐT SỔ
  don_gia_dien integer not null default 0,
  don_gia_nuoc integer not null default 0,
  cach_tinh_nuoc text not null default 'theo_khoi',
  so_dien integer not null default 0,
  so_nuoc integer not null default 0,
  so_nguoi smallint not null default 1,
  so_xe smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_hoa_don_phong_thang unique (phong_id, thang)
);

-- Bảng 2.7: Lịch sử thanh toán từng lần cho hóa đơn
create table if not exists public.thanh_toan (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  hoa_don_id uuid not null references public.hoa_don(id) on delete cascade,
  ngay timestamptz not null default now(),
  so_tien integer not null check (so_tien > 0),
  hinh_thuc text not null check (hinh_thuc in ('tien_mat', 'chuyen_khoan')) default 'chuyen_khoan',
  ghi_chu text default '',
  created_at timestamptz not null default now()
);

-- Bảng 2.8: Chi phí vận hành của tòa nhà
create table if not exists public.chi_phi (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  toa_id uuid not null references public.toa_nha(id) on delete cascade,
  ngay date not null default current_date,
  loai text not null check (loai in ('sua_chua', 'tien_dien_evn', 'tien_nuoc', 'khac')) default 'khac',
  so_tien integer not null check (so_tien > 0),
  ghi_chu text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bảng 2.9: Cấu hình hệ thống của chủ trọ (VietQR, Mẫu tin nhắn, Cảnh báo)
create table if not exists public.cai_dat (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  bank_id text not null default 'MB', -- MB, VCB, TCB, VPB...
  so_tk text not null default '',
  ten_chu_tk text not null default '',
  nguong_canh_bao_dien integer not null default 300, -- kWh
  mau_tin_nhan jsonb not null default '[]'::jsonb,
  mau_hop_dong text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. TẠO INDEXES TỐI ƯU TRUY VẤN
create index if not exists idx_phong_toa_sophong on public.phong(toa_id, so_phong);
create index if not exists idx_chi_so_phong_thang on public.chi_so(phong_id, thang);
create index if not exists idx_hoa_don_phong_thang on public.hoa_don(phong_id, thang);
create index if not exists idx_sinh_vien_bienso_sdt on public.sinh_vien(bien_so, sdt);
create index if not exists idx_sinh_vien_cccd on public.sinh_vien(cccd);
create index if not exists idx_hop_dong_phong_hieuluc on public.hop_dong(phong_id, dang_hieu_luc);
create index if not exists idx_thanh_toan_hoadon on public.thanh_toan(hoa_don_id);
create index if not exists idx_chi_phi_toa_ngay on public.chi_phi(toa_id, ngay);

-- 4. GẮN TRIGGER UPDATED_AT
create trigger trg_toa_nha_updated before update on public.toa_nha for each row execute function public.handle_updated_at();
create trigger trg_phong_updated before update on public.phong for each row execute function public.handle_updated_at();
create trigger trg_hop_dong_updated before update on public.hop_dong for each row execute function public.handle_updated_at();
create trigger trg_sinh_vien_updated before update on public.sinh_vien for each row execute function public.handle_updated_at();
create trigger trg_chi_so_updated before update on public.chi_so for each row execute function public.handle_updated_at();
create trigger trg_hoa_don_updated before update on public.hoa_don for each row execute function public.handle_updated_at();
create trigger trg_chi_phi_updated before update on public.chi_phi for each row execute function public.handle_updated_at();
create trigger trg_cai_dat_updated before update on public.cai_dat for each row execute function public.handle_updated_at();

-- 5. BẬT ROW LEVEL SECURITY (RLS) TRÊN TẤT CẢ CÁC BẢNG
alter table public.toa_nha enable row level security;
alter table public.phong enable row level security;
alter table public.hop_dong enable row level security;
alter table public.sinh_vien enable row level security;
alter table public.chi_so enable row level security;
alter table public.hoa_don enable row level security;
alter table public.thanh_toan enable row level security;
alter table public.chi_phi enable row level security;
alter table public.cai_dat enable row level security;

-- 6. THIẾT LẬP RLS POLICIES CHO NGƯỜI DÙNG ĐĂNG NHẬP (OWNER_ID)
-- 6.1 TOA_NHA
create policy "ToaNha_Owner_Select" on public.toa_nha for select using (auth.uid() = owner_id);
create policy "ToaNha_Owner_Insert" on public.toa_nha for insert with check (auth.uid() = owner_id);
create policy "ToaNha_Owner_Update" on public.toa_nha for update using (auth.uid() = owner_id);
create policy "ToaNha_Owner_Delete" on public.toa_nha for delete using (auth.uid() = owner_id);

-- 6.2 PHONG
create policy "Phong_Owner_Select" on public.phong for select using (auth.uid() = owner_id);
create policy "Phong_Owner_Insert" on public.phong for insert with check (auth.uid() = owner_id);
create policy "Phong_Owner_Update" on public.phong for update using (auth.uid() = owner_id);
create policy "Phong_Owner_Delete" on public.phong for delete using (auth.uid() = owner_id);

-- 6.3 HOP_DONG
create policy "HopDong_Owner_Select" on public.hop_dong for select using (auth.uid() = owner_id);
create policy "HopDong_Owner_Insert" on public.hop_dong for insert with check (auth.uid() = owner_id);
create policy "HopDong_Owner_Update" on public.hop_dong for update using (auth.uid() = owner_id);
create policy "HopDong_Owner_Delete" on public.hop_dong for delete using (auth.uid() = owner_id);

-- 6.4 SINH_VIEN
create policy "SinhVien_Owner_Select" on public.sinh_vien for select using (auth.uid() = owner_id);
create policy "SinhVien_Owner_Insert" on public.sinh_vien for insert with check (auth.uid() = owner_id);
create policy "SinhVien_Owner_Update" on public.sinh_vien for update using (auth.uid() = owner_id);
create policy "SinhVien_Owner_Delete" on public.sinh_vien for delete using (auth.uid() = owner_id);

-- 6.5 CHI_SO
create policy "ChiSo_Owner_Select" on public.chi_so for select using (auth.uid() = owner_id);
create policy "ChiSo_Owner_Insert" on public.chi_so for insert with check (auth.uid() = owner_id);
create policy "ChiSo_Owner_Update" on public.chi_so for update using (auth.uid() = owner_id);
create policy "ChiSo_Owner_Delete" on public.chi_so for delete using (auth.uid() = owner_id);

-- 6.6 HOA_DON
create policy "HoaDon_Owner_Select" on public.hoa_don for select using (auth.uid() = owner_id);
create policy "HoaDon_Owner_Insert" on public.hoa_don for insert with check (auth.uid() = owner_id);
create policy "HoaDon_Owner_Update" on public.hoa_don for update using (auth.uid() = owner_id);
create policy "HoaDon_Owner_Delete" on public.hoa_don for delete using (auth.uid() = owner_id);

-- 6.7 THANH_TOAN
create policy "ThanhToan_Owner_Select" on public.thanh_toan for select using (auth.uid() = owner_id);
create policy "ThanhToan_Owner_Insert" on public.thanh_toan for insert with check (auth.uid() = owner_id);
create policy "ThanhToan_Owner_Update" on public.thanh_toan for update using (auth.uid() = owner_id);
create policy "ThanhToan_Owner_Delete" on public.thanh_toan for delete using (auth.uid() = owner_id);

-- 6.8 CHI_PHI
create policy "ChiPhi_Owner_Select" on public.chi_phi for select using (auth.uid() = owner_id);
create policy "ChiPhi_Owner_Insert" on public.chi_phi for insert with check (auth.uid() = owner_id);
create policy "ChiPhi_Owner_Update" on public.chi_phi for update using (auth.uid() = owner_id);
create policy "ChiPhi_Owner_Delete" on public.chi_phi for delete using (auth.uid() = owner_id);

-- 6.9 CAI_DAT
create policy "CaiDat_Owner_Select" on public.cai_dat for select using (auth.uid() = owner_id);
create policy "CaiDat_Owner_Insert" on public.cai_dat for insert with check (auth.uid() = owner_id);
create policy "CaiDat_Owner_Update" on public.cai_dat for update using (auth.uid() = owner_id);
create policy "CaiDat_Owner_Delete" on public.cai_dat for delete using (auth.uid() = owner_id);

-- 7. THIẾT LẬP STORAGE BUCKET 'cccd' RIÊNG TƯ (PRIVATE)
-- Tạo bucket 'cccd' nếu chưa có
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cccd', 'cccd', false, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false;

-- Storage RLS: Chỉ người dùng đã đăng nhập đọc/ghi ảnh trong thư mục mang chính user_id của họ
create policy "CCCD_Upload_Owner" on storage.objects
  for insert with check (
    bucket_id = 'cccd'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "CCCD_Select_Owner" on storage.objects
  for select using (
    bucket_id = 'cccd'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "CCCD_Update_Owner" on storage.objects
  for update using (
    bucket_id = 'cccd'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "CCCD_Delete_Owner" on storage.objects
  for delete using (
    bucket_id = 'cccd'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
