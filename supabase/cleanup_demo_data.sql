-- ====================================================================
-- CHÚ Ý: CHỈ CHẠY KHI CHẮC CHẮN MUỐN XÓA HẾT DỮ LIỆU
-- Script này xóa toàn bộ dữ liệu mẫu / dữ liệu nhập thử trên Supabase.
-- TUYỆT ĐỐI KHÔNG XÓA tài khoản trong auth.users.
-- TUYỆT ĐỐI KHÔNG XÓA cấu trúc bảng, index, trigger hay RLS policies.
-- Thứ tự xóa tuân thủ nghiêm ngặt theo ràng buộc khóa ngoại (Foreign Keys).
-- ====================================================================

begin;

-- 1. Xóa lịch sử thanh toán (phụ thuộc hoa_don)
delete from public.thanh_toan;

-- 2. Xóa hóa đơn tiền nhà (phụ thuộc phong)
delete from public.hoa_don;

-- 3. Xóa chỉ số điện nước (phụ thuộc phong)
delete from public.chi_so;

-- 4. Xóa sinh viên khách thuê (phụ thuộc hop_dong)
-- Tạm thời ngắt ràng buộc nguoi_dai_dien_id trong hop_dong để tránh vòng lặp khóa ngoại
update public.hop_dong set nguoi_dai_dien_id = null;
delete from public.sinh_vien;

-- 5. Xóa hợp đồng thuê phòng (phụ thuộc phong)
delete from public.hop_dong;

-- 6. Xóa chi phí vận hành (phụ thuộc toa_nha)
delete from public.chi_phi;

-- 7. Xóa danh sách phòng (phụ thuộc toa_nha)
delete from public.phong;

-- 8. Xóa danh sách tòa nhà
delete from public.toa_nha;

-- 9. Làm sạch bảng cài đặt hệ thống (VietQR, mẫu tin nhắn)
delete from public.cai_dat;

commit;

-- Thông báo hoàn tất
-- Toàn bộ bảng đã được dọn sạch về trạng thái 0 dòng dữ liệu.
