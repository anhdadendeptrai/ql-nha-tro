/**
 * Chuyển đổi số tiền thành chữ Tiếng Việt chuẩn
 * Ví dụ: 4580000 -> "Bốn triệu năm trăm tám mươi nghìn đồng"
 */

const UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readThreeDigits(threeDigits: number, showZeroHundred: boolean): string {
  let res = '';
  const hundred = Math.floor(threeDigits / 100);
  const ten = Math.floor((threeDigits % 100) / 10);
  const unit = threeDigits % 10;

  if (hundred === 0 && ten === 0 && unit === 0) return '';

  if (hundred > 0 || showZeroHundred) {
    res += `${DIGITS[hundred]} trăm `;
    if (ten === 0 && unit > 0) {
      res += 'lẻ ';
    }
  }

  if (ten > 0) {
    if (ten === 1) {
      res += 'mười ';
    } else {
      res += `${DIGITS[ten]} mươi `;
    }
  }

  if (unit > 0) {
    if (ten > 0 && unit === 1) {
      res += ten > 1 ? 'mốt ' : 'một ';
    } else if (ten > 0 && unit === 5) {
      res += 'lăm ';
    } else {
      res += `${DIGITS[unit]} `;
    }
  }

  return res.trim();
}

export function numberToVietnameseWords(amount: number): string {
  if (!amount || amount === 0) return 'Không đồng';
  let num = Math.abs(Math.round(amount));

  const groups: number[] = [];
  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  let words = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const groupVal = groups[i];
    if (groupVal > 0) {
      const showHundred = i < groups.length - 1;
      const groupStr = readThreeDigits(groupVal, showHundred);
      words += `${groupStr} ${UNITS[i]} `;
    }
  }

  words = words.trim().replace(/\s+/g, ' ');
  if (!words) return 'Không đồng';

  // Viết hoa chữ cái đầu và thêm đuôi "đồng"
  const formatted = words.charAt(0).toUpperCase() + words.slice(1) + ' đồng';
  return formatted;
}
