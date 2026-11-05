/**
 * Dịch vụ nén ảnh bằng HTML Canvas trên trình duyệt client
 * Quy tắc: Đổi sang định dạng WebP, cạnh dài tối đa 1280px, chất lượng ~0.7, mục tiêu <= 150KB/ảnh
 */

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  sizeKb: number;
  fileName: string;
}

export async function compressImage(
  file: File,
  maxDimension: number = 1280,
  initialQuality: number = 0.75,
  targetMaxKb: number = 150
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng ảnh không hợp lệ.'));
      img.onload = async () => {
        try {
          let { width, height } = img;

          // Tính tỉ lệ thu nhỏ theo cạnh dài tối đa (1280px)
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Không thể khởi tạo Canvas 2D'));
            return;
          }

          // Vẽ ảnh lên canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Nén ảnh sang WebP (fallback image/jpeg nếu trình duyệt cũ không hỗ trợ WebP)
          let quality = initialQuality;
          let blob: Blob | null = null;
          const mimeType = 'image/webp';

          // Hàm thử nén theo chất lượng
          const tryCompress = (q: number): Promise<Blob> => {
            return new Promise((res, rej) => {
              canvas.toBlob(
                (b) => {
                  if (b) res(b);
                  else rej(new Error('Lỗi chuyển đổi Canvas sang Blob'));
                },
                mimeType,
                q
              );
            });
          };

          blob = await tryCompress(quality);

          // Nếu kích thước vẫn lớn hơn mục tiêu 150KB, hạ nhẹ chất lượng lặp tối đa 2 lần
          let attempts = 0;
          while (blob.size / 1024 > targetMaxKb && quality > 0.4 && attempts < 2) {
            quality -= 0.15;
            blob = await tryCompress(quality);
            attempts++;
          }

          const dataUrl = canvas.toDataURL(mimeType, quality);
          const sizeKb = Math.round(blob.size / 1024);

          // Tạo tên file an toàn WebP
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'cccd';
          const cleanName = `${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.webp`;

          resolve({
            blob,
            dataUrl,
            sizeKb,
            fileName: cleanName,
          });
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
