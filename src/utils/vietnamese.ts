/**
 * Tiện ích xử lý chuỗi tiếng Việt: Bỏ dấu và chuẩn hóa tìm kiếm
 */

export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  let result = str.toLowerCase();
  
  result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  result = result.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  result = result.replace(/đ/g, 'd');
  
  // Xóa các ký tự dấu tổ hợp Unicode
  result = result.replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '');
  result = result.replace(/[\u02C6\u0306\u031B]/g, '');
  
  return result.trim();
}

/**
 * Kiểm tra xem chuỗi văn bản nguồn có chứa từ khóa tìm kiếm hay không (không phân biệt dấu và hoa thường)
 */
export function matchSearch(source: string | null | undefined, query: string): boolean {
  if (!query) return true;
  if (!source) return false;
  const cleanSource = removeVietnameseTones(source);
  const cleanQuery = removeVietnameseTones(query);
  return cleanSource.includes(cleanQuery);
}
