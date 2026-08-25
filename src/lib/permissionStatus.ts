/**
 * Trạng thái quyền của trình duyệt cho thông báo và vị trí.
 *
 * Chỉ nhìn cờ bật/tắt trong app là chưa đủ: người dùng có thể đã CHẶN quyền ở
 * trình duyệt, lúc đó gạt công tắc bao nhiêu lần cũng vô ích mà app lại im lặng
 * không giải thích. Tách phần mô tả ra hàm thuần để test được mà không cần
 * trình duyệt thật.
 */

/** Quyền trình duyệt cấp: chưa hỏi / đã cho / đã chặn / máy không hỗ trợ. */
export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported'

export type FeatureStatus = {
  /** App có đang bật tính năng này không (cờ của mình). */
  enabled: boolean
  /** Trình duyệt có cho phép không. */
  permission: PermissionState
  /** Câu ngắn hiện dưới tên mục. */
  label: string
  /** 'on' xanh, 'off' xám, 'blocked' đỏ — để tô màu. */
  tone: 'on' | 'off' | 'blocked'
  /** Gạt được công tắc không; đã bị chặn thì gạt vô ích. */
  actionable: boolean
}

/** Đọc quyền thông báo hiện tại. */
export function readNotificationPermission(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported'
  const p = Notification.permission
  return p === 'granted' || p === 'denied' ? p : 'prompt'
}

/** Đọc quyền vị trí; trình duyệt cũ không có Permissions API thì chịu, trả 'prompt'. */
export async function readLocationPermission(): Promise<PermissionState> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'unsupported'
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (!status) return 'prompt'
    return status.state === 'granted' || status.state === 'denied' ? status.state : 'prompt'
  } catch {
    // Safari cũ ném khi hỏi geolocation — coi như chưa hỏi.
    return 'prompt'
  }
}

/** Mô tả trạng thái thông báo thành câu tiếng Việt. */
export function describeNotification(enabled: boolean, permission: PermissionState): FeatureStatus {
  if (permission === 'unsupported') {
    return { enabled: false, permission, label: 'Máy này không hỗ trợ thông báo đẩy', tone: 'off', actionable: false }
  }
  if (permission === 'denied') {
    return {
      enabled: false,
      permission,
      label: 'Đã bị chặn — mở cài đặt trình duyệt để cho phép lại',
      tone: 'blocked',
      actionable: false,
    }
  }
  if (enabled) {
    return { enabled, permission, label: 'Đang bật — nhận được cả khi tắt app', tone: 'on', actionable: true }
  }
  return { enabled, permission, label: 'Chưa bật — gạt sang để nhận thông báo', tone: 'off', actionable: true }
}

/** Mô tả trạng thái chia sẻ vị trí. */
export function describeLocation(enabled: boolean, permission: PermissionState): FeatureStatus {
  if (permission === 'unsupported') {
    return { enabled: false, permission, label: 'Máy này không có định vị', tone: 'off', actionable: false }
  }
  if (permission === 'denied') {
    return {
      enabled: false,
      permission,
      label: 'Đã bị chặn — mở cài đặt trình duyệt để cho phép lại',
      tone: 'blocked',
      actionable: false,
    }
  }
  if (!enabled) {
    return { enabled, permission, label: 'Đang tắt — người kia không thấy vị trí của bạn', tone: 'off', actionable: true }
  }
  // Bật trong app nhưng chưa hỏi quyền bao giờ: vẫn chưa thật sự gửi được vị trí.
  if (permission === 'prompt') {
    return { enabled, permission, label: 'Đã bật, nhưng chưa cấp quyền định vị', tone: 'off', actionable: true }
  }
  return { enabled, permission, label: 'Đang chia sẻ vị trí', tone: 'on', actionable: true }
}
