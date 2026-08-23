import { supabase } from './supabase';
import { localDate } from './date';
import type { 
  PartnerLocation, 
  SavedPlace, 
  LocationTimelineLog, 
  LocationAlertEvent 
} from '../types/location';

const STORAGE_KEY_LOCATION = 'daily_couple_locations';
const STORAGE_KEY_SHARING = 'daily_location_sharing_enabled';
const STORAGE_KEY_SAVED_PLACES = 'daily_saved_places';
const STORAGE_KEY_TIMELINE = 'daily_location_timeline_logs';
const STORAGE_KEY_ALERTS = 'daily_location_alert_events';

const REVERSE_GEOCODE_CACHE = new Map<string, string>();

/**
 * Tính khoảng cách giữa 2 tọa độ GPS theo công thức Haversine (km)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 1000) / 1000;
}

export function formatDistance(km: number): string {
  if (km < 0.05) return 'Đang ở cạnh nhau (< 50m)';
  if (km < 1) return `Cách nhau ${Math.round(km * 1000)}m`;
  return `Cách nhau ${km.toFixed(1)} km`;
}

export function getCurrentTimeString(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Đọc trạng thái Bật/Tắt chia sẻ vị trí của người dùng
 */
export function isLocationSharingEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY_SHARING);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setLocationSharingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_SHARING, String(enabled));
    window.dispatchEvent(new CustomEvent('daily_location_sharing_toggled', { detail: enabled }));
  } catch {}
}

/**
 * Đọc pin thiết bị an toàn
 */
export async function getDeviceBattery(): Promise<{ batteryLevel?: number; isCharging?: boolean }> {
  try {
    if ('getBattery' in navigator) {
      const battery = await (navigator as any).getBattery();
      return {
        batteryLevel: Math.round(battery.level * 100),
        isCharging: battery.charging,
      };
    }
  } catch {}
  return {};
}

/**
 * Dịch tọa độ sang tên địa chỉ ngắn gọn (Reverse Geocoding OpenStreetMap Nominatim)
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (REVERSE_GEOCODE_CACHE.has(cacheKey)) {
    return REVERSE_GEOCODE_CACHE.get(cacheKey)!;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'vi,en' } }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const road = addr.road || addr.suburb || addr.neighbourhood || addr.quarter || '';
      const district = addr.city_district || addr.district || addr.suburb || '';
      const city = addr.city || addr.state || 'TP.HCM';

      let shortName = road ? `${road}, ${district || city}` : `${district || city}`;
      if (shortName.length > 40) shortName = shortName.slice(0, 40) + '…';
      if (!shortName.trim()) shortName = 'Đang di chuyển';

      REVERSE_GEOCODE_CACHE.set(cacheKey, shortName);
      return shortName;
    }
  } catch {}

  const fallback = 'Đang di chuyển';
  REVERSE_GEOCODE_CACHE.set(cacheKey, fallback);
  return fallback;
}

/* ==========================================================================
 * 1. QUẢN LÝ ĐỊA ĐIỂM QUEN THUỘC (TRỌ / NHÀ / CÔNG TY...)
 * ========================================================================== */

export function getLocalSavedPlaces(): SavedPlace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_PLACES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchSavedPlaces(): Promise<SavedPlace[]> {
  const localList = getLocalSavedPlaces();
  if (!supabase) return localList;

  try {
    const { data, error } = await supabase
      .from('partner_places')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      localStorage.setItem(STORAGE_KEY_SAVED_PLACES, JSON.stringify(data));
      return data as SavedPlace[];
    }
  } catch {}

  return localList;
}

export async function savePlace(place: SavedPlace): Promise<void> {
  const current = getLocalSavedPlaces();
  const index = current.findIndex((p) => p.id === place.id || (p.user_id === place.user_id && p.name.toLowerCase() === place.name.toLowerCase()));
  if (index >= 0) {
    current[index] = place;
  } else {
    current.push(place);
  }
  localStorage.setItem(STORAGE_KEY_SAVED_PLACES, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('daily_saved_places_updated', { detail: current }));

  if (!supabase) return;

  try {
    await supabase.from('partner_places').upsert({
      id: place.id,
      user_id: place.user_id,
      user_name: place.user_name || null,
      name: place.name,
      icon: place.icon || '📍',
      latitude: place.latitude,
      longitude: place.longitude,
      radius_meters: place.radius_meters || 200,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[savePlace] Lỗi lưu địa điểm:', err);
  }
}

export async function deletePlace(placeId: string): Promise<void> {
  const current = getLocalSavedPlaces().filter((p) => p.id !== placeId);
  localStorage.setItem(STORAGE_KEY_SAVED_PLACES, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('daily_saved_places_updated', { detail: current }));

  if (supabase) {
    try {
      await supabase.from('partner_places').delete().eq('id', placeId);
    } catch {}
  }
}

/**
 * Kiểm tra xem vị trí hiện tại có nằm trong bán kính 200m của địa điểm quen thuộc nào không
 */
export function findMatchingSavedPlace(lat: number, lon: number, places: SavedPlace[]): SavedPlace | null {
  for (const p of places) {
    const distKm = calculateDistanceKm(lat, lon, p.latitude, p.longitude);
    const radiusKm = (p.radius_meters || 200) / 1000;
    if (distKm <= radiusKm) {
      return p;
    }
  }
  return null;
}

/* ==========================================================================
 * 2. LỊCH TRÌNH VỊ TRÍ & QUÃNG ĐƯỜNG TRONG NGÀY (TIMELINE LOGS)
 * ========================================================================== */

export function getLocalTimelineLogs(): LocationTimelineLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMELINE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchLocationTimeline(date: string = localDate()): Promise<LocationTimelineLog[]> {
  const localList = getLocalTimelineLogs().filter((l) => l.log_date === date);
  if (!supabase) return localList;

  try {
    const { data, error } = await supabase
      .from('partner_location_logs')
      .select('*')
      .eq('log_date', date)
      .order('start_time', { ascending: true });

    if (!error && data && data.length > 0) {
      const all = getLocalTimelineLogs().filter((l) => l.log_date !== date);
      const combined = [...all, ...(data as LocationTimelineLog[])];
      localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(combined));
      return data as LocationTimelineLog[];
    }
  } catch {}

  return localList;
}

export async function logTimelineEvent(log: LocationTimelineLog): Promise<void> {
  const current = getLocalTimelineLogs();
  const index = current.findIndex((l) => l.id === log.id);
  if (index >= 0) {
    current[index] = log;
  } else {
    current.push(log);
  }
  localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(current.slice(-500)));
  window.dispatchEvent(new CustomEvent('daily_location_timeline_updated', { detail: log }));

  if (!supabase) return;

  try {
    await supabase.from('partner_location_logs').upsert({
      id: log.id,
      user_id: log.user_id,
      user_name: log.user_name,
      place_name: log.place_name,
      event_type: log.event_type,
      latitude: log.latitude,
      longitude: log.longitude,
      log_date: log.log_date,
      start_time: log.start_time,
      end_time: log.end_time || null,
      duration_minutes: log.duration_minutes || null,
      distance_km: log.distance_km || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[logTimelineEvent] Lỗi lưu log hành trình:', err);
  }
}

/* ==========================================================================
 * 3. THÔNG BÁO & CẢNH BÁO RỜI KHỎI / ĐẾN NƠI (GEOFENCE ALERTS)
 * ========================================================================== */

export function getLocalAlertEvents(): LocationAlertEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALERTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function broadcastLocationAlert(alert: LocationAlertEvent): Promise<void> {
  const current = getLocalAlertEvents();
  current.unshift(alert);
  localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(current.slice(0, 50)));

  // Bắn event trên client để UI nhận và hiển thị thông báo tức thì
  window.dispatchEvent(new CustomEvent('daily_location_alert', { detail: alert }));

  // Gửi Web Notification nếu trình duyệt hỗ trợ và người dùng đã cho phép
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`📍 Vị trí: ${alert.user_name}`, {
        body: alert.message,
        icon: '/pwa-192x192.png',
      });
    } catch {}
  }

  if (supabase) {
    try {
      await supabase.from('partner_alerts').insert({
        id: alert.id,
        user_id: alert.user_id,
        user_name: alert.user_name,
        message: alert.message,
        type: alert.type,
        place_name: alert.place_name || null,
        created_at: alert.created_at,
      });
    } catch {}
  }
}

/* ==========================================================================
 * 4. ĐỒNG BỘ VỊ TRÍ HIỆN TẠI (PARTNER LOCATIONS)
 * ========================================================================== */

export async function syncLocationToSupabase(location: PartnerLocation): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCATION);
    const map: Record<string, PartnerLocation> = raw ? JSON.parse(raw) : {};
    map[location.user_id] = location;
    localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('daily_partner_location_updated', { detail: location }));
  } catch {}

  if (!supabase) return;

  try {
    await supabase.from('partner_locations').upsert({
      user_id: location.user_id,
      user_name: location.user_name || null,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || null,
      address_name: location.address_name || null,
      current_place: location.current_place || null,
      battery_level: location.battery_level || null,
      is_charging: location.is_charging ?? false,
      speed: location.speed || null,
      is_sharing: location.is_sharing ?? true,
      updated_at: location.updated_at,
    }, { onConflict: 'user_id' });
  } catch (err) {
    console.warn('[syncLocationToSupabase] Lỗi đồng bộ tọa độ:', err);
  }
}

export async function fetchCoupleLocations(): Promise<PartnerLocation[]> {
  const localMap: Record<string, PartnerLocation> = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOCATION);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();

  if (!supabase) return Object.values(localMap);

  try {
    const { data, error } = await supabase
      .from('partner_locations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && data && data.length > 0) {
      for (const row of data as PartnerLocation[]) {
        localMap[row.user_id] = row;
      }
      localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(localMap));
      return data as PartnerLocation[];
    }
  } catch {}

  return Object.values(localMap);
}
