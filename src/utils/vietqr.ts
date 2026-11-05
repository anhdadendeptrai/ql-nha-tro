/**
 * Tiện ích tạo link mã QR thanh toán chuẩn VietQR
 * Cú pháp: https://img.vietqr.io/image/<BANK_ID>-<SO_TK>-compact2.png?amount=<SO_TIEN>&addInfo=<NOI_DUNG>&accountName=<TEN>
 */

export interface VietQrParams {
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  description: string;
}

export function generateVietQrUrl({
  bankId,
  accountNo,
  accountName,
  amount,
  description,
}: VietQrParams): string {
  if (!bankId || !accountNo) return '';

  const cleanBank = encodeURIComponent(bankId.trim());
  const cleanAccountNo = encodeURIComponent(accountNo.trim().replace(/\s+/g, ''));
  const cleanAccountName = encodeURIComponent(accountName.trim().toUpperCase());
  const cleanDescription = encodeURIComponent(description.trim());
  const cleanAmount = Math.max(0, Math.round(amount));

  return `https://img.vietqr.io/image/${cleanBank}-${cleanAccountNo}-compact2.png?amount=${cleanAmount}&addInfo=${cleanDescription}&accountName=${cleanAccountName}`;
}

/**
 * Tạo cú pháp nội dung chuyển khoản ngắn gọn chuẩn
 * Ví dụ: "P101 T11" (Phòng 101 Tháng 11)
 */
export function generateTransferContent(roomNumber: string, monthStr: string): string {
  // Lấy số phòng, bỏ dấu chấm nếu có (ví dụ "P.101" -> "P101")
  const cleanRoom = roomNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const month = monthStr.split('-')[1] || monthStr;
  const monthNum = parseInt(month, 10);
  return `${cleanRoom} T${monthNum}`;
}
