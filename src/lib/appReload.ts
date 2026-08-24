/** Cờ báo đang tự dọn dẹp, để controllerchange trong main.tsx đừng tải lại cắt ngang. */
export const FORCE_RELOAD_FLAG = 'daily_force_reloading';

/**
 * Xoá service worker + toàn bộ cache rồi nạp lại bản mới.
 *
 * `reload` tách ra được để test; mặc định thay luôn URL kèm dấu thời gian
 * cho proxy/CDN khỏi trả bản cũ.
 */
export async function forceReloadLatestVersion(
  reload: () => void = () =>
    window.location.replace(window.location.origin + window.location.pathname + '?_bust=' + Date.now()),
) {
  try {
    sessionStorage.setItem(FORCE_RELOAD_FLAG, '1');
  } catch {}

  let done = false;
  const runOnce = () => {
    if (done) return;
    done = true;
    reload();
  };

  // Bảo hiểm: getRegistrations hay caches.delete có lúc treo (service worker
  // đang cài dở). Treo thì vẫn phải tải lại, không được đứng im.
  const safety = setTimeout(runOnce, 2500);

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (e) {
    console.warn('[forceReload] SW unregister error', e);
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn('[forceReload] cache delete error', e);
  }

  clearTimeout(safety);
  runOnce();
}
