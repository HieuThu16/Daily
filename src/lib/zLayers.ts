/**
 * Thang z-index dùng chung.
 *
 * Trước đây các trang tự chọn số: 1000, 1200, 9999, 10000, 999999 — nên banner
 * cập nhật PWA đè lên cả hộp thoại đang mở, và thêm lớp mới là phải đoán số to hơn.
 * Sửa thứ tự thì sửa ở đây, đừng viết số trực tiếp trong component nữa.
 */
export const Z = {
  /** Thanh dính, nút nổi trong trang. */
  sticky: 100,
  /** Bản đồ, lớp phủ bên trong một thẻ. */
  overlay: 500,
  /** Nền mờ + hộp thoại (khớp với `.modal-backdrop` trong styles.css). */
  modal: 1000,
  /** Lớp phủ toàn màn hình của reader: phải trên hộp thoại thường. */
  fullscreen: 1500,
  /** Toast — luôn đọc được, kể cả khi có hộp thoại. */
  toast: 2000,
  /** Banner "có bản mới": trên cùng, nhưng không còn là 999999. */
  appUpdate: 2500,
} as const
