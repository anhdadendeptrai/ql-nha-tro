# QUẢN LÝ NHÀ TRỌ SINH VIÊN (PWA)

Hệ thống PWA quản lý nhà trọ sinh viên tiện lợi, giao diện 100% bằng **Tiếng Việt**, chạy mượt mà trên cả iPhone (iOS Safari) và Android (Chrome).

> **Chi phí vận hành: 0 đồng**  
> Dùng gói miễn phí vĩnh viễn của **Supabase** (PostgreSQL Database + Auth + Storage) và **Cloudflare Pages** (Hosting không giới hạn băng thông).

---

## 🌟 TÍNH NĂNG CHÍNH

### 1. Kiến trúc Bắt buộc Đăng nhập & Offline-First
- **Đăng nhập bắt buộc**: Chưa đăng nhập thì chỉ hiển thị màn hình đăng nhập, tuyệt đối không render dữ liệu ra phía sau.
- **Không mở đăng ký tự do**: Chỉ chủ trọ được cấp tài khoản sẵn trên Supabase mới có quyền truy cập.
- **Chế độ kiểm tra nội bộ (Dev Mock Auth)**: Trong môi trường phát triển cục bộ (`npm run dev`), hỗ trợ đăng nhập kiểm tra bằng tài khoản dev cấu hình trong file `.env`. Toàn bộ cơ chế này tự động bị loại bỏ triệt để trong bản build production (`dist`).
- **IndexedDB (Dexie)**: Tự động lưu trữ đệm trong bộ nhớ máy. Mở app hiển thị ngay lập tức, không phụ thuộc tốc độ mạng.
- **Đăng xuất an toàn**: Nút Đăng xuất ở thanh tiêu đề và màn hình Cài đặt tự động xóa sạch toàn bộ dữ liệu đệm trên thiết bị.

### 2. Sơ đồ phòng theo Tòa
- **Quản lý theo Tòa**: Hỗ trợ chuyển tab nhanh giữa các Tòa (ví dụ: Tòa A, Tòa B, D1, D3...). Chủ trọ có thể thêm, sửa, xóa mềm Tòa tùy ý trong Cài đặt mà không giới hạn số lượng.
- **Phân nhóm theo Tầng**: Tầng 1, Tầng 2, Tầng 3...
- **Màu trạng thái phòng**:
  - 🟢 **Trống** (hiện số ngày phòng đang trống).
  - 🔵 **Có người** (số người "2/4", số xe máy quản lý chỗ để xe).
  - ⚪ **Sửa chữa**.
- **Cảnh báo thông minh**:
  - 🔴 Tiền phòng: Chưa đóng (kèm số nợ), Đóng thiếu, Đã đóng đủ.
  - 🟡 Hạn hợp đồng: Nền vàng nếu còn $< 30$ ngày, Nền đỏ nếu quá hạn.
  - Dải 3 cảnh báo nhanh trên cùng: *Chưa đóng*, *Sắp hết hạn*, *Phòng trống*.
- **Tìm kiếm tổng hợp tức thì**: Số phòng, tên SV, SĐT, CCCD, biển số xe, trường học; tự động loại bỏ dấu tiếng Việt, phản hồi dưới 150ms.

### 3. Quy tắc tính tiền mới
Áp dụng thống nhất cho mọi Tòa:
- ⚡ **Tiền điện**: $(\text{Điện cuối} - \text{Điện đầu}) \times \text{Đơn giá điện (đ/kWh)}$. Đây là khoản duy nhất đo bằng công tơ.
- 🏢 **Phí dịch vụ**: $\text{Số người} \times 170.000\text{ đ/tháng}$. Khoản này **ĐÃ BAO GỒM** nước sinh hoạt, rác vệ sinh môi trường, mạng Internet wifi và chỗ để xe máy. Mức phí này điều chỉnh được cho từng tòa trong Cài đặt.
- 💵 **Tổng tiền**: $\text{Tiền phòng} + \text{Tiền điện} + \text{Phí dịch vụ} + \text{Phụ phí / Giảm trừ (nếu có)}$.
- Thẻ phòng vẫn hiển thị số lượng xe máy để chủ trọ quản lý sức chứa nhà xe nhưng **không** tính tiền xe riêng vào hóa đơn.

### 4. Chốt sổ tháng & Hóa đơn VietQR
- **Tự động điền số điện kỳ trước**: Tự động lấy số cuối tháng trước làm số đầu tháng này, có nút "Tự động điền số điện kỳ trước" hỗ trợ chốt nhanh.
- **Bảng chốt sổ tối giản**: Chỉ gồm cột *Phòng | Điện đầu | Điện cuối | Dùng (kWh) | Số người | Phụ phí | Tổng tiền | Hóa đơn*.
- Cột "Số người" tự điền theo số sinh viên đang ở, cho phép sửa trực tiếp theo từng phòng trong tháng đó (ở nửa tháng hoặc có người chuyển đi/đến).
- **Cảnh báo số điện**: Cảnh báo tức thì nếu số cuối < số đầu hoặc dùng điện vượt ngưỡng bất thường (mặc định 300 kWh).
- **Hóa đơn & Ảnh hóa đơn chia sẻ**:
  - Bảng kê 4 mục rõ ràng: Tiền phòng, Tiền điện, Phí dịch vụ (chú thích rõ "Đã gồm nước, rác, wifi, gửi xe"), Phụ phí.
  - Tự động dịch số tiền thành chữ Tiếng Việt.
  - Mã **VietQR** tự động điền sẵn STK, tên chủ tài khoản, số tiền và nội dung chuyển khoản.
  - Hỗ trợ **Chia sẻ ảnh Zalo** qua Web Share API hoặc tải file PNG sắc nét về máy.

### 5. Thu tiền & Báo cáo tài chính
- **Thu tiền 1 chạm**: Nút "Đã đóng đủ" cập nhật tức thì kèm **Thanh hoàn tác trong 5 giây (Undo)**.
- **Thu tiền một phần**: Ghi nhận số tiền đóng đợt này, số còn lại chuyển thành nợ.
- **6 Mẫu tin nhắn Zalo**: Cập nhật theo công thức tính tiền mới, tự điền tên SV, số phòng, số tiền nợ, hạn nộp và STK.
- **Báo cáo & Dashboard thông minh**:
  - Thống kê: Doanh thu, Chi phí vận hành, Lợi nhuận ròng, Tỷ lệ lấp đầy.
  - **Cơ cấu doanh thu**: Bóc tách chính xác Tiền phòng, Tiền điện, Phí dịch vụ, Phụ phí và Tổng thu.
  - Tự sinh câu văn nhận xét thông minh bằng template (0đ, không phụ thuộc AI trả phí).
  - Quản lý chi phí vận hành (EVN, nước, sửa chữa...).

### 6. Nghiệp vụ nâng cao
- **Xuất Excel tạm trú (.xlsx)**: Chuẩn theo mẫu nộp Công an Phường, cột Tòa hiển thị tên Tòa tương ứng.
- **Xuất Excel báo cáo doanh thu (.xlsx)**: Phân rã 5 cột: Tiền phòng, Tiền điện, Phí dịch vụ, Phụ phí, Tổng thu.
- **Hợp đồng thuê trọ**: Cập nhật điều khoản điện theo công tơ và phí dịch vụ 170.000 đ/người/tháng đã gồm nước, rác, wifi, xe; hỗ trợ in ấn A4 / xuất file văn bản.
- **Sao lưu & Khôi phục toàn diện**: Xuất/nhập file JSON hoặc file Excel nhiều sheet, tương thích 100% với cả các file sao lưu định dạng cũ.

---

## 🚀 HƯỚNG DẪN CHẠY TRÊN MÁY TÍNH CÁ NHÂN (DEV)

```bash
# 1. Cài đặt các thư viện
npm install

# 2. Tạo file cấu hình môi trường kiểm tra
# Tạo file .env với nội dung:
VITE_DEV_MOCK_AUTH=true
VITE_DEV_EMAIL=chutro@test.local
VITE_DEV_PASSWORD=Tro@12345

# 3. Khởi chạy server phát triển
npm run dev
```

Mở trình duyệt truy cập: **`http://localhost:5173`**.
- Nhập Email: `chutro@test.local`
- Nhập Mật khẩu: `Tro@12345`
- Bấm **"Đăng nhập"** -> Hệ thống xác thực cục bộ và mở ra giao diện hoàn toàn trống (0 tòa, 0 phòng, 0 sinh viên). Bạn có thể bấm "Thêm tòa" để bắt đầu nhập dữ liệu thực tế và lưu trữ trong IndexedDB.

---

## 🗄️ HƯỚNG DẪN KẾT NỐI SUPABASE (MIỄN PHÍ 100%)

Khi bạn muốn đưa vào vận hành thực tế cho nhà trọ của mình:

### Bước 1: Tạo Project trên Supabase
1. Truy cập [https://supabase.com](https://supabase.com) và đăng ký tài khoản miễn phí.
2. Bấm **"New Project"**, đặt tên (ví dụ: `QL-Phong-Tro`), nhập mật khẩu Database và chọn Region là `Singapore` (để tốc độ về Việt Nam nhanh nhất).

### Bước 2: Chạy các file SQL Migration (Khởi tạo hệ thống trống)
1. Trong giao diện Supabase, bấm vào menu **SQL Editor** ở thanh bên trái.
2. Mở file `supabase/migrations/20261105000000_init_schema.sql`, copy toàn bộ nội dung dán vào và bấm **Run**.
3. Tiếp tục mở file `supabase/migrations/20261105000001_update_pricing_and_buildings.sql`, dán vào và bấm **Run** để hoàn tất cấu trúc bảng và quy tắc tính tiền mới.
*(Lưu ý: Toàn bộ migration thuần túy khởi tạo bảng, RLS, storage bucket, KHÔNG chứa dòng dữ liệu mẫu nào).*

- **Nếu bạn muốn dọn sạch dữ liệu cũ đã thử nghiệm trên Supabase**: Chạy file `supabase/cleanup_demo_data.sql` trong SQL Editor. Script này xóa sạch theo đúng thứ tự khóa ngoại, giữ nguyên tài khoản đăng nhập `auth.users`.
- **Nếu bạn muốn nạp dữ liệu thử nghiệm**: Chạy file `supabase/seed_demo.sql` rồi gọi `SELECT public.seed_sample_data(auth.uid());`.

### Bước 3: Tạo tài khoản Chủ trọ & Tắt đăng ký tự do
1. Vào **Authentication** -> **Users** -> bấm nút **Add user** -> chọn **Create user**.
2. Nhập Email và Mật khẩu của chủ trọ.
3. Tích chọn ô **"Auto Confirm User"** (để tài khoản có hiệu lực ngay mà không cần xác thực email). Bấm **Create user**.
4. Vào **Authentication** -> **Providers** -> mục **Email** -> bỏ tích ô **"Allow new users to sign up"** và bấm **Save** (để người lạ không thể tự ý đăng ký tài khoản vào hệ thống).

### Bước 4: Xóa ảnh CCCD mẫu trong Storage (Nếu có)
1. Vào mục **Storage** ở menu bên trái của Supabase Dashboard.
2. Nhấp vào bucket riêng tư **`cccd`**.
3. Nếu có file hoặc thư mục ảnh CCCD cũ thử nghiệm, chọn tất cả rồi bấm **Delete** để làm sạch hoàn toàn bucket.

### Bước 5: Cấu hình biến môi trường
1. Trên Supabase, vào **Project Settings** -> **API**.
2. Copy `Project URL` và `anon public key`.
3. Điền vào file `.env`:
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_DEV_MOCK_AUTH=false
```
Khi `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` được điền, app sẽ tự động kết nối Supabase Auth thật và vô hiệu hóa tài khoản thử nghiệm.

---

## ☁️ DEPLOY LÊN CLOUDFLARE PAGES (MIỄN PHÍ VĨNH VIỄN)

1. Đẩy mã nguồn lên GitHub (hoặc GitLab).
2. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/) -> vào mục **Workers & Pages** -> **Create application** -> tab **Pages** -> **Connect to Git**.
3. Chọn repository của bạn:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Ở mục **Environment variables**, thêm 2 biến:
   - `VITE_SUPABASE_URL`: (URL Supabase của bạn)
   - `VITE_SUPABASE_ANON_KEY`: (Anon key Supabase của bạn)
   *(Lưu ý: Không thêm `VITE_DEV_MOCK_AUTH` khi deploy)*.
5. Bấm **Save and Deploy**. Bạn sẽ nhận được một địa chỉ web HTTPS miễn phí (ví dụ: `https://ql-phong-tro.pages.dev`).

---

## 📱 CÀI ĐẶT APP LÊN ĐIỆN THOẠI (PWA)

### Trên iPhone / iPad (iOS Safari)
1. Mở link web app bằng trình duyệt **Safari**.
2. Bấm vào nút **Chia sẻ** (biểu tượng hình vuông có mũi tên lên).
3. Chọn **"Thêm vào Màn hình chính"** (Add to Home Screen).
4. Biểu tượng ứng dụng xuất hiện trên màn hình chính của iPhone, mở lên chạy toàn màn hình không có thanh địa chỉ duyệt web.

### Trên điện thoại Android (Google Chrome)
1. Mở link web app bằng **Google Chrome**.
2. Bấm vào biểu tượng **3 dấu chấm dọc** ở góc trên bên phải.
3. Chọn **"Cài đặt ứng dụng"** (hoặc "Thêm vào màn hình chính").
4. Bấm xác nhận **"Cài đặt"**.
