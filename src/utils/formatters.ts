// Các hàm định dạng tiền tệ, ngày tháng theo chuẩn Việt Nam

/**
 * Định dạng tiền tệ VNĐ: ví dụ 3500000 -> "3.500.000 đ"
 * Sử dụng số nguyên (đồng), tránh lỗi số thực
 */
export function formatVND(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0 đ';
  }
  const integerVal = Math.round(amount);
  return `${new Intl.NumberFormat('vi-VN').format(integerVal)} đ`;
}

/**
 * Định dạng ngày dd/mm/yyyy theo múi giờ Việt Nam
 */
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '--/--/----';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return '--/--/----';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '--/--/----';
  }
}

/**
 * Chuyển 'YYYY-MM' thành 'Tháng MM/YYYY'
 */
export function formatMonthYear(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [y, m] = monthStr.split('-');
  return `Tháng ${parseInt(m, 10)}/${y}`;
}

/**
 * Lấy chuỗi tháng hiện tại theo dạng 'YYYY-MM'
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Lấy tháng trước của một chuỗi 'YYYY-MM'
 */
export function getPreviousMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  let prevYear = y;
  let prevMonth = m - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

/**
 * Tính số ngày giữa 2 mốc thời gian (dương nếu targetDate ở tương lai)
 */
export function getDaysRemaining(targetDateStr: string): number {
  if (!targetDateStr) return 999;
  const target = new Date(targetDateStr);
  const now = new Date();
  // Chuẩn hóa về đầu ngày
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Tính số ngày đã trôi qua kể từ ngày quá khứ
 */
export function getDaysPassed(pastDateStr: string): number {
  if (!pastDateStr) return 0;
  const past = new Date(pastDateStr);
  const now = new Date();
  past.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - past.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}
