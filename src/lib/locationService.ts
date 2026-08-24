import { supabase } from './supabase';
import { localDate } from './date';
import type { 
  PartnerLocation, 
  SavedPlace, 
  LocationTimelineLog, 
  LocationAlertEvent 
} from '../types/location';

const STORAGE_KEY_LOCATION = 'daily_couple_locations_v2';
const STORAGE_KEY_SHARING = 'daily_location_sharing_enabled';
const STORAGE_KEY_SAVED_PLACES = 'daily_saved_places_v2';
const STORAGE_KEY_TIMELINE = 'daily_location_timeline_logs_v2';
const STORAGE_KEY_ALERTS = 'daily_location_alert_events_v2';

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
      if (!shortName.trim()) shortName = 'Đang ở vị trí hiện tại';

      REVERSE_GEOCODE_CACHE.set(cacheKey, shortName);
      return shortName;
    }
  } catch {}

  const fallback = 'Vị trí hiện tại';
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
  const index = current.findIndex((p) => p.id === place.id || (p.user_name === place.user_name && p.name.toLowerCase() === place.name.toLowerCase()));
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

export function findMatchingSavedPlace(lat: number, lon: number, places: SavedPlace[], forUserName?: string): SavedPlace | null {
  let best: { place: SavedPlace; radiusKm: number; distKm: number } | null = null

  for (const p of places) {
    // Ưu tiên mốc của người đó hoặc mốc chung
    if (forUserName && p.user_name && p.user_name !== forUserName) continue;
    const distKm = calculateDistanceKm(lat, lon, p.latitude, p.longitude);
    // Bán kính nhận diện an toàn chống giật GPS: tối thiểu 350m
    const effectiveRadiusMeters = Math.max(p.radius_meters || 200, 350);
    const radiusKm = effectiveRadiusMeters / 1000;
    if (distKm > radiusKm) continue;
    // Mốc nhỏ nằm trong mốc lớn (Nhà nằm trong Tỉnh) -> luôn chọn mốc cụ thể nhất
    if (!best || radiusKm < best.radiusKm || (radiusKm === best.radiusKm && distKm < best.distKm)) {
      best = { place: p, radiusKm, distKm };
    }
  }

  return best?.place || null;
}


/* ==========================================================================
 * 2. LỊCH TRÌNH VỊ TRÍ & QUÃNG ĐƯỜNG TRONG NGÀY (TIMELINE LOGS)
 * ========================================================================== */

/**
 * Lọc bỏ các log rác/ảo do GPS bị giật (Đi từ Trọ đến Trọ, Di chuyển đến Trọ khi đang ở Trọ)
 * và tự động gộp các mốc Ở (STAY) cùng một địa điểm trong ngày thành 1 dòng duy nhất (từ giờ sớm nhất -> giờ muộn nhất).
 */
/** Tên mốc kiểu vùng hành chính rộng ("Ở Tỉnh Cà Mau") — bỏ khi đã có mốc cụ thể cùng giờ. */
function isBroadArea(placeName: string): boolean {
  return /^ở\s+(tỉnh|thành phố|tp\.?|quận|huyện|phường|xã)\s/i.test((placeName || '').trim());
}

function overlaps(a: LocationTimelineLog, b: LocationTimelineLog): boolean {
  const aEnd = a.end_time || a.start_time;
  const bEnd = b.end_time || b.start_time;
  return a.start_time <= bEnd && b.start_time <= aEnd;
}

export function cleanTimelineLogs(logs: LocationTimelineLog[]): LocationTimelineLog[] {
  const cleaned: LocationTimelineLog[] = [];
  const stayMap = new Map<string, LocationTimelineLog>();

  for (const log of logs) {
    // 1. Loại bỏ các log di chuyển ảo (GPS giật trong nhà)
    if (log.event_type === 'MOVE') {
      const lower = (log.place_name || '').toLowerCase().trim();

      // Bỏ các log "Đi từ X đến X" (VD: "Đi từ Trọ đến Trọ", "Đi từ Nhà đến Nhà")
      if (lower.includes('đến') && lower.includes('từ')) {
        const parts = lower.replace('đi từ', '').split('đến');
        if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
          continue;
        }
      }

      // Chặng dở dang "Đi từ X" chưa tới đâu và gần như không đi được mét nào
      if (!lower.includes('đến') && (log.distance_km || 0) < 0.15) {
        continue;
      }

      // Bỏ các log "Di chuyển đến..." khi không có quãng đường hoặc quá ngắn (< 0.15 km)
      if (log.distance_km !== undefined && log.distance_km < 0.15 && (lower.includes('di chuyển đến') || lower.includes('đang di chuyển'))) {
        continue;
      }
    }

    // 2. Gộp các mốc STAY của cùng 1 người tại cùng 1 địa điểm trong ngày
    if (log.event_type === 'STAY') {
      const stayKey = `${log.user_name}::${log.log_date}::${log.place_name}`;
      const existing = stayMap.get(stayKey);
      if (existing) {
        // Cập nhật giờ sớm nhất và muộn nhất
        const startTime = existing.start_time < log.start_time ? existing.start_time : log.start_time;
        const existingEnd = existing.end_time || existing.start_time;
        const currentEnd = log.end_time || log.start_time;
        const endTime = existingEnd > currentEnd ? existingEnd : currentEnd;

        existing.start_time = startTime;
        existing.end_time = endTime;
        continue;
      } else {
        stayMap.set(stayKey, log);
      }
    }

    cleaned.push(log);
  }

  // 3. Một người không thể ở hai nơi cùng lúc: bỏ mốc vùng rộng khi đã có mốc cụ thể trùng giờ
  const kept = cleaned.filter((log) => {
    if (log.event_type !== 'STAY' || !isBroadArea(log.place_name)) return true;
    return !cleaned.some(
      (other) =>
        other !== log &&
        other.event_type === 'STAY' &&
        other.user_name === log.user_name &&
        other.log_date === log.log_date &&
        !isBroadArea(other.place_name) &&
        overlaps(other, log)
    );
  });

  // Sắp xếp theo start_time tăng dần
  return kept.sort((a, b) => a.start_time.localeCompare(b.start_time));
}


export function getLocalTimelineLogs(): LocationTimelineLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMELINE);
    const parsed = raw ? JSON.parse(raw) : [];
    return cleanTimelineLogs(Array.isArray(parsed) ? parsed : []);
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
      const cleanedData = cleanTimelineLogs(data as LocationTimelineLog[]);
      const all = getLocalTimelineLogs().filter((l) => l.log_date !== date);
      const combined = cleanTimelineLogs([...all, ...cleanedData]);
      localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(combined));
      return cleanedData;
    }
  } catch {}

  return localList;
}

export async function logTimelineEvent(log: LocationTimelineLog): Promise<void> {
  // Bỏ qua log di chuyển ảo (VD: Đi từ Trọ đến Trọ)
  if (log.event_type === 'MOVE') {
    const lower = (log.place_name || '').toLowerCase().trim();
    if (lower.includes('đến') && lower.includes('từ')) {
      const parts = lower.replace('đi từ', '').split('đến');
      if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
        return;
      }
    }
  }

  const current = getLocalTimelineLogs();
  const index = current.findIndex((l) => l.id === log.id || (l.user_name === log.user_name && l.log_date === log.log_date && l.place_name === log.place_name && l.event_type === 'STAY'));
  
  if (index >= 0) {
    const existing = current[index];
    const startTime = existing.start_time < log.start_time ? existing.start_time : log.start_time;
    const existingEnd = existing.end_time || existing.start_time;
    const currentEnd = log.end_time || log.start_time;
    const endTime = existingEnd > currentEnd ? existingEnd : currentEnd;

    current[index] = {
      ...existing,
      ...log,
      start_time: startTime,
      end_time: endTime,
    };
  } else {
    current.push(log);
  }

  const cleaned = cleanTimelineLogs(current);
  localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(cleaned.slice(-300)));
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
    console.warn('[logTimelineEvent] Lỗi lưu timeline:', err);
  }
}

/* ==========================================================================
 * 3. ĐỒNG BỘ VỊ TRÍ HIỆN TẠI DUY NHẤT LÊN SUPABASE (PARTNER LOCATIONS)
 * ========================================================================== */

export async function syncLocationToSupabase(location: PartnerLocation): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCATION);
    const map: Record<string, PartnerLocation> = raw ? JSON.parse(raw) : {};
    const key = location.user_name || location.user_id;
    map[key] = location;
    localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('daily_partner_location_updated', { detail: location }));
  } catch {}

  if (!supabase) return;

  try {
    // Upsert chỉ 1 dòng duy nhất cho người này theo user_name hoặc user_id
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
      const remoteMap: Record<string, PartnerLocation> = {};
      for (const row of data as PartnerLocation[]) {
        const key = row.user_name || row.user_id;
        remoteMap[key] = row;
      }
      localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(remoteMap));
      return Object.values(remoteMap);
    }
  } catch {}

  return Object.values(localMap);
}
