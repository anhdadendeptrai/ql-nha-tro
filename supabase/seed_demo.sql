-- ====================================================================
-- SEED DATA DÙNG THỬ / TEST HỆ THỐNG QUẢN LÝ NHÀ TRỌ (SUPABASE)
-- File này độc lập, KHÔNG chạy tự động trong migration.
-- Chỉ chạy khi bạn muốn nạp dữ liệu mẫu để thử nghiệm tính năng.
-- ====================================================================

-- HÀM NẠP DỮ LIỆU MẪU THEO QUY TẮC MỚI (TÒA D2 & TÒA D4)
create or replace function public.seed_sample_data(user_id uuid)
returns void as $$
declare
  v_toa1_id uuid := gen_random_uuid();
  v_toa2_id uuid := gen_random_uuid();
  v_p101_id uuid := gen_random_uuid();
  v_p102_id uuid := gen_random_uuid();
  v_p201_id uuid := gen_random_uuid();
  v_p202_id uuid := gen_random_uuid();
  v_p301_id uuid := gen_random_uuid();
  v_p302_id uuid := gen_random_uuid();
  v_p_d4_101_id uuid := gen_random_uuid();
  v_p_d4_102_id uuid := gen_random_uuid();
  v_p_d4_201_id uuid := gen_random_uuid();
  v_p_d4_202_id uuid := gen_random_uuid();
  v_p_d4_301_id uuid := gen_random_uuid();
  v_p_d4_302_id uuid := gen_random_uuid();
  
  v_hd_101 uuid := gen_random_uuid();
  v_hd_201 uuid := gen_random_uuid();
  v_hd_202 uuid := gen_random_uuid();
  v_hd_d4_101 uuid := gen_random_uuid();
  
  v_sv_nam uuid := gen_random_uuid();
  v_sv_linh uuid := gen_random_uuid();
  v_sv_hoang uuid := gen_random_uuid();
  v_sv_dung uuid := gen_random_uuid();
begin
  -- 1. Cài đặt hệ thống
  insert into public.cai_dat (owner_id, bank_id, so_tk, ten_chu_tk, nguong_canh_bao_dien, mau_tin_nhan)
  values (
    user_id,
    'MB',
    '0988889999',
    'NGUYEN VAN CHU TRO',
    300,
    '[
      {"id": "m1", "tieu_de": "Nhắc đóng tiền phòng tháng", "noi_dung": "Chào em {ten}, phòng {phong} ({toa}) tiền trọ tháng {thang} tổng cộng là {so_tien} (gồm tiền phòng, điện và phí dịch vụ; hạn {han_dong}). Em chuyển khoản theo QR hoặc STK {stk} ({ngan_hang}) nhé."},
      {"id": "m2", "tieu_de": "Nhắc nợ lần 2 (khẩn cấp)", "noi_dung": "Chào em {ten}, phòng {phong} hiện đã quá hạn đóng tiền trọ tháng {thang} ({so_tien}). Em vui lòng thanh toán trong hôm nay để tránh bị tạm ngừng dịch vụ."},
      {"id": "m3", "tieu_de": "Cảnh báo tạm cắt dịch vụ", "noi_dung": "Kính gửi đại diện phòng {phong}, tiền phòng tháng {thang} đã quá hạn quy định. Nếu sau 17h hôm nay chưa nhận được tiền chuyển khoản ({so_tien}), ban quản lý sẽ buộc phải tạm dừng cung cấp dịch vụ."},
      {"id": "m4", "tieu_de": "Thông báo lịch dọn vệ sinh", "noi_dung": "Thông báo: Ngày mai sẽ có đội dọn vệ sinh hành lang và khu vực để xe tòa {toa}. Các bạn sinh viên vui lòng xếp gọn xe và không để đồ ngoài lối đi."},
      {"id": "m5", "tieu_de": "Thông báo điều chỉnh đơn giá", "noi_dung": "Thông báo tới các bạn sinh viên phòng {phong} ({toa}): Kể từ kỳ chốt sổ tháng tới, đơn giá điện hoặc phí dịch vụ/người sẽ có sự điều chỉnh theo quy định mới."},
      {"id": "m6", "tieu_de": "Xác nhận đã nhận tiền đủ", "noi_dung": "Chào em {ten}, bác đã nhận đủ {so_tien} tiền phòng {phong} tháng {thang}. Cảm ơn em!"}
    ]'::jsonb
  ) on conflict (owner_id) do nothing;

  -- 2. Tòa nhà (Tòa D2 & Tòa D4)
  insert into public.toa_nha (id, owner_id, ten, dia_chi, don_gia_dien, phi_dich_vu_dau_nguoi, ngay_chot_so, han_dong_tien)
  values
    (v_toa1_id, user_id, 'D2', 'Khu nhà trọ sinh viên D2', 3500, 170000, 25, 5),
    (v_toa2_id, user_id, 'D4', 'Khu nhà trọ sinh viên D4', 3500, 170000, 25, 5);

  -- 3. Phòng tòa D2
  insert into public.phong (id, owner_id, toa_id, so_phong, tang, gia_thue, trang_thai, so_nguoi_toi_da)
  values
    (v_p101_id, user_id, v_toa1_id, 'P.101', 1, 3500000, 'co_nguoi', 3),
    (v_p102_id, user_id, v_toa1_id, 'P.102', 1, 3200000, 'trong', 2),
    (v_p201_id, user_id, v_toa1_id, 'P.201', 2, 3800000, 'co_nguoi', 4),
    (v_p202_id, user_id, v_toa1_id, 'P.202', 2, 3800000, 'co_nguoi', 4),
    (v_p301_id, user_id, v_toa1_id, 'P.301', 3, 4000000, 'trong', 4),
    (v_p302_id, user_id, v_toa1_id, 'P.302', 3, 4000000, 'sua_chua', 4);

  -- Phòng tòa D4
  insert into public.phong (id, owner_id, toa_id, so_phong, tang, gia_thue, trang_thai, so_nguoi_toi_da)
  values
    (v_p_d4_101_id, user_id, v_toa2_id, 'P.101', 1, 2800000, 'co_nguoi', 3),
    (v_p_d4_102_id, user_id, v_toa2_id, 'P.102', 1, 2800000, 'trong', 2),
    (v_p_d4_201_id, user_id, v_toa2_id, 'P.201', 2, 3000000, 'trong', 3),
    (v_p_d4_202_id, user_id, v_toa2_id, 'P.202', 2, 3000000, 'trong', 3),
    (v_p_d4_301_id, user_id, v_toa2_id, 'P.301', 3, 3200000, 'trong', 4),
    (v_p_d4_302_id, user_id, v_toa2_id, 'P.302', 3, 3200000, 'trong', 4);

  -- 4. Hợp đồng
  insert into public.hop_dong (id, owner_id, phong_id, ngay_bat_dau, ngay_het_han, tien_coc, gia_thue_thoa_thuan, do_ban_giao, dang_hieu_luc)
  values
    (v_hd_101, user_id, v_p101_id, current_date - interval '5 months', current_date + interval '20 days', 3500000, 3500000, '[{"ten": "Điều hòa Casper", "so_luong": 1, "tinh_trang": "Tốt"}, {"ten": "Bình nóng lạnh", "so_luong": 1, "tinh_trang": "Tốt"}]'::jsonb, true),
    (v_hd_201, user_id, v_p201_id, current_date - interval '2 months', current_date + interval '10 months', 3800000, 3800000, '[{"ten": "Điều hòa Daikin", "so_luong": 1, "tinh_trang": "Tốt"}]'::jsonb, true),
    (v_hd_202, user_id, v_p202_id, current_date - interval '7 months', current_date - interval '5 days', 3800000, 3800000, '[{"ten": "Điều hòa Funiki", "so_luong": 1, "tinh_trang": "Tốt"}]'::jsonb, true),
    (v_hd_d4_101, user_id, v_p_d4_101_id, current_date - interval '3 months', current_date + interval '9 months', 2800000, 2800000, '[{"ten": "Nóng lạnh", "so_luong": 1, "tinh_trang": "Tốt"}]'::jsonb, true);

  -- 5. Sinh viên
  insert into public.sinh_vien (id, owner_id, hop_dong_id, ho_ten, sdt, cccd, truong, bien_so, la_dai_dien)
  values
    (v_sv_nam, user_id, v_hd_101, 'Nguyễn Tuấn Nam', '0912345678', '001202012345', 'ĐH Quốc Gia Hà Nội', '29V1-56789', true),
    (v_sv_linh, user_id, v_hd_201, 'Trần Thùy Linh', '0987654321', '036203098765', 'ĐH Ngoại Ngữ', '17B2-12345', true),
    (v_sv_hoang, user_id, v_hd_201, 'Lê Huy Hoàng', '0901239876', '024201087654', 'ĐH Sư Phạm', '29S6-43210', false),
    (v_sv_dung, user_id, v_hd_d4_101, 'Phạm Quốc Dũng', '0933221100', '034202054321', 'ĐH FPT Hà Nội', '30M3-99999', true);

  -- Cập nhật người đại diện
  update public.hop_dong set nguoi_dai_dien_id = v_sv_nam where id = v_hd_101;
  update public.hop_dong set nguoi_dai_dien_id = v_sv_linh where id = v_hd_201;
  update public.hop_dong set nguoi_dai_dien_id = v_sv_dung where id = v_hd_d4_101;

  -- 6. Chỉ số điện tháng gần nhất ('2026-10')
  insert into public.chi_so (owner_id, phong_id, thang, dien_dau, dien_cuoi)
  values
    (user_id, v_p101_id, '2026-10', 1200, 1345),
    (user_id, v_p201_id, '2026-10', 2150, 2390),
    (user_id, v_p202_id, '2026-10', 980, 1130),
    (user_id, v_p_d4_101_id, '2026-10', 500, 620);

  -- 7. Hóa đơn theo công thức mới (Điện + Phí dịch vụ 170.000 đ/người)
  insert into public.hoa_don (
    owner_id, phong_id, thang, tien_phong, tien_dien, tien_dich_vu,
    phu_phi, tong_tien, da_dong, con_no, trang_thai,
    don_gia_dien, phi_dich_vu_dau_nguoi, so_dien, so_nguoi
  ) values
    (user_id, v_p101_id, '2026-10', 3500000, 145*3500, 1*170000, '[]'::jsonb, 3500000 + 145*3500 + 1*170000, 4177500, 0, 'da_dong', 3500, 170000, 145, 1),
    (user_id, v_p201_id, '2026-10', 3800000, 240*3500, 2*170000, '[]'::jsonb, 3800000 + 240*3500 + 2*170000, 3000000, 1980000, 'dong_thieu', 3500, 170000, 240, 2),
    (user_id, v_p202_id, '2026-10', 3800000, 150*3500, 1*170000, '[]'::jsonb, 3800000 + 150*3500 + 1*170000, 0, 4495000, 'chua_dong', 3500, 170000, 150, 1),
    (user_id, v_p_d4_101_id, '2026-10', 2800000, 120*3500, 1*170000, '[]'::jsonb, 2800000 + 120*3500 + 1*170000, 0, 3390000, 'chua_dong', 3500, 170000, 120, 1);

end;
$$ language plpgsql;

-- Hướng dẫn chạy:
-- select public.seed_sample_data(auth.uid());
