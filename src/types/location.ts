export interface PartnerLocation {
  user_id: string;
  user_name?: 'Hiếu' | 'Kim Ý' | string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address_name?: string;
  current_place?: string; // Tên địa điểm quen thuộc (VD: 'Trọ', 'Nhà', 'Công ty')
  battery_level?: number;
  is_charging?: boolean;
  speed?: number | null;
  updated_at: string;
  is_sharing?: boolean;
}

export interface SavedPlace {
  id: string;
  user_id: string;
  user_name?: 'Hiếu' | 'Kim Ý' | string;
  name: string; // VD: 'Trọ', 'Nhà', 'Công ty'
  icon?: string; // VD: '🏠', '🏢', '🏫', '📍'
  latitude: number;
  longitude: number;
  radius_meters: number; // Mặc định 200m
  created_at: string;
  updated_at: string;
}

export interface LocationTimelineLog {
  id: string;
  user_id: string;
  user_name: 'Hiếu' | 'Kim Ý' | string;
  place_name: string; // VD: 'Ở Nhà', 'Ở Công ty', 'Đang di chuyển'
  event_type: 'STAY' | 'DEPARTURE' | 'ARRIVAL' | 'MOVE';
  latitude: number;
  longitude: number;
  log_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time?: string; // HH:mm
  duration_minutes?: number;
  distance_km?: number;
  created_at: string;
}

export interface LocationAlertEvent {
  id: string;
  user_id: string;
  user_name: string;
  message: string;
  type: 'DEPARTURE' | 'ARRIVAL' | 'DISTANCE_ALERT';
  place_name?: string;
  created_at: string;
}

export interface PlaceGeocodeResult {
  displayName: string;
  shortName: string;
  road?: string;
  suburb?: string;
  city?: string;
}
