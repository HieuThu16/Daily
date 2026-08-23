import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { localDate } from '../../lib/date';
import type { 
  PartnerLocation, 
  SavedPlace, 
  LocationTimelineLog, 
  LocationAlertEvent 
} from '../../types/location';
import {
  calculateDistanceKm,
  fetchCoupleLocations,
  fetchSavedPlaces,
  fetchLocationTimeline,
  findMatchingSavedPlace,
  getDeviceBattery,
  getCurrentTimeString,
  isLocationSharingEnabled,
  logTimelineEvent,
  reverseGeocode,
  savePlace,
  deletePlace,
  setLocationSharingEnabled,
  syncLocationToSupabase,
} from '../../lib/locationService';

export function useCoupleLocation(partnerPersonName?: string, selectedDate: string = localDate()) {
  const [locations, setLocations] = useState<PartnerLocation[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [timelineLogs, setTimelineLogs] = useState<LocationTimelineLog[]>([]);
  const [isSharing, setIsSharing] = useState<boolean>(() => isLocationSharingEnabled());
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  const watchIdRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const lastKnownPlaceRef = useRef<SavedPlace | null>(null);
  const activeStayLogIdRef = useRef<string | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);

  const isKimY = useCallback((s?: string) => {
    const str = (s || '').toLowerCase();
    return str.includes('kimy') || str.includes('nguyenkimy') || str.includes('ý');
  }, []);

  const myUserName = isKimY(currentUserEmail) ? 'Kim Ý' : 'Hiếu';
  const partnerUserName = isKimY(currentUserEmail) ? 'Hiếu' : 'Kim Ý';

  // Lấy thông tin user hiện tại
  useEffect(() => {
    if (supabase?.auth) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setCurrentUserId(data.user.id);
          if (data.user.email) setCurrentUserEmail(data.user.email.toLowerCase());
        }
      }).catch(() => null);
    }
  }, []);

  // Tải dữ liệu vị trí, địa điểm đã lưu & timeline
  const reloadAllData = useCallback(async () => {
    try {
      const [locList, places, logs] = await Promise.all([
        fetchCoupleLocations(),
        fetchSavedPlaces(),
        fetchLocationTimeline(selectedDate),
      ]);
      setLocations(locList);
      setSavedPlaces(places);
      setTimelineLogs(logs);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Xử lý logic Geofence & Lịch trình hành trình: chỉ ghi nhận chặng mới khi DI CHUYỂN
  const processGeofenceAndTimeline = useCallback(
    async (lat: number, lon: number, addressName: string, time: string, today: string) => {
      const matchingPlace = findMatchingSavedPlace(lat, lon, savedPlaces, myUserName);
      const lastPlace = lastKnownPlaceRef.current;
      const uid = currentUserId || `user_${myUserName}`;

      // Kiểm tra khoảng cách so với tọa độ trước đó
      const prevCoords = lastCoordsRef.current;
      const movedDistanceKm = prevCoords ? calculateDistanceKm(prevCoords.lat, prevCoords.lon, lat, lon) : 0;
      lastCoordsRef.current = { lat, lon };

      // 1. Nếu đang ở một địa điểm quen thuộc (Trọ / Nhà / Công ty...)
      if (matchingPlace) {
        const stayLogId = `stay_${myUserName}_${matchingPlace.id}_${today}`;
        activeStayLogIdRef.current = stayLogId;

        // Chỉ cập nhật giờ kết thúc của mốc hiện tại nếu vẫn ở cùng 1 nơi
        const stayLog: LocationTimelineLog = {
          id: stayLogId,
          user_id: uid,
          user_name: myUserName,
          place_name: `Ở ${matchingPlace.name}`,
          event_type: 'STAY',
          latitude: matchingPlace.latitude,
          longitude: matchingPlace.longitude,
          log_date: today,
          start_time: time,
          end_time: time,
          created_at: new Date().toISOString(),
        };
        void logTimelineEvent(stayLog);
      } 
      // 2. Chỉ khi di chuyển ra xa (> 200m) và không ở mốc nào thì mới ghi nhận đang di chuyển
      else if (movedDistanceKm > 0.2) {
        const moveLogId = `move_${myUserName}_${today}_${time.slice(0, 4)}0`;
        const moveLog: LocationTimelineLog = {
          id: moveLogId,
          user_id: uid,
          user_name: myUserName,
          place_name: addressName || 'Đang di chuyển',
          event_type: 'MOVE',
          latitude: lat,
          longitude: lon,
          log_date: today,
          start_time: time,
          end_time: time,
          created_at: new Date().toISOString(),
        };
        void logTimelineEvent(moveLog);
      }

      lastKnownPlaceRef.current = matchingPlace;
      return matchingPlace ? matchingPlace.name : undefined;
    },
    [currentUserId, myUserName, savedPlaces]
  );

  // Cập nhật vị trí hiện tại của thiết bị
  const updateCurrentPosition = useCallback(
    async (pos: GeolocationPosition) => {
      if (!isLocationSharingEnabled()) return;

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;
      const speed = pos.coords.speed;
      const nowIso = new Date().toISOString();
      const today = localDate();
      const time = getCurrentTimeString();

      const uid = currentUserId || `user_${myUserName}`;
      const battery = await getDeviceBattery();
      const addressName = await reverseGeocode(lat, lon);
      const currentPlaceName = await processGeofenceAndTimeline(lat, lon, addressName, time, today);

      const myLoc: PartnerLocation = {
        user_id: uid,
        user_name: myUserName,
        latitude: lat,
        longitude: lon,
        accuracy,
        address_name: addressName,
        current_place: currentPlaceName,
        battery_level: battery.batteryLevel,
        is_charging: battery.isCharging,
        speed,
        is_sharing: true,
        updated_at: nowIso,
      };

      lastSyncTimeRef.current = Date.now();
      await syncLocationToSupabase(myLoc);
      void reloadAllData();
    },
    [currentUserId, myUserName, processGeofenceAndTimeline, reloadAllData]
  );

  // Kích hoạt lấy tọa độ tức thì
  const requestCurrentLocation = useCallback(() => {
    if (!('geolocation' in navigator) || !isSharing) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => void updateCurrentPosition(pos),
      (err) => console.warn('[Geolocation getCurrentPosition error]', err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, [isSharing, updateCurrentPosition]);

  // Bắt đầu theo dõi vị trí
  useEffect(() => {
    if (!isSharing || !('geolocation' in navigator)) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    requestCurrentLocation();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - lastSyncTimeRef.current > 12000) {
          void updateCurrentPosition(pos);
        }
      },
      (err) => console.warn('[Geolocation watchPosition error]', err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestCurrentLocation();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [isSharing, requestCurrentLocation, updateCurrentPosition]);

  // Lắng nghe Realtime Supabase và Local CustomEvents
  useEffect(() => {
    void reloadAllData();

    const handleLocalUpdate = () => void reloadAllData();
    window.addEventListener('daily_partner_location_updated', handleLocalUpdate);
    window.addEventListener('daily_saved_places_updated', handleLocalUpdate);
    window.addEventListener('daily_location_timeline_updated', handleLocalUpdate);

    if (supabase) {
      const sb = supabase;
      const channel = sb
        .channel('partner-locations-full-realtime-v2')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_locations' }, () => {
          void reloadAllData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_places' }, () => {
          void reloadAllData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_location_logs' }, () => {
          void reloadAllData();
        })
        .subscribe();

      return () => {
        void sb.removeChannel(channel);
        window.removeEventListener('daily_partner_location_updated', handleLocalUpdate);
        window.removeEventListener('daily_saved_places_updated', handleLocalUpdate);
        window.removeEventListener('daily_location_timeline_updated', handleLocalUpdate);
      };
    }

    return () => {
      window.removeEventListener('daily_partner_location_updated', handleLocalUpdate);
      window.removeEventListener('daily_saved_places_updated', handleLocalUpdate);
      window.removeEventListener('daily_location_timeline_updated', handleLocalUpdate);
    };
  }, [reloadAllData]);

  // Bật / Tắt chia sẻ
  const toggleSharing = (enabled: boolean) => {
    setIsSharing(enabled);
    setLocationSharingEnabled(enabled);
    if (enabled) {
      setTimeout(() => requestCurrentLocation(), 100);
    }
  };

  // Lưu vị trí hiện tại làm mốc (Trọ, Nhà, Công ty...)
  const saveCurrentLocationAsPlace = async (placeName: string, icon = '🏠') => {
    const loc = myUserName === 'Hiếu' ? hieuLocation : kimYLocation;
    if (!loc) return;
    const newPlace: SavedPlace = {
      id: `place_${myUserName}_${Date.now()}`,
      user_id: currentUserId || `user_${myUserName}`,
      user_name: myUserName,
      name: placeName.trim(),
      icon,
      latitude: loc.latitude,
      longitude: loc.longitude,
      radius_meters: 200,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await savePlace(newPlace);
    void reloadAllData();
  };

  const removePlace = async (placeId: string) => {
    await deletePlace(placeId);
    void reloadAllData();
  };

  // Phân loại vị trí CHÍNH XÁC 100% THEO TÊN NGƯỜI DÙNG - KHÔNG LẤY NHẦM CỦA NHAU
  const hieuLocation = locations.find((l) => l.user_name === 'Hiếu') || null;
  const kimYLocation = locations.find((l) => l.user_name === 'Kim Ý') || null;

  const myLocation = myUserName === 'Hiếu' ? hieuLocation : kimYLocation;
  const partnerLocation = myUserName === 'Hiếu' ? kimYLocation : hieuLocation;

  const distanceKm =
    hieuLocation && kimYLocation
      ? calculateDistanceKm(
          hieuLocation.latitude,
          hieuLocation.longitude,
          kimYLocation.latitude,
          kimYLocation.longitude
        )
      : null;

  return {
    locations,
    savedPlaces,
    timelineLogs,
    hieuLocation,
    kimYLocation,
    myLocation,
    partnerLocation,
    distanceKm,
    isSharing,
    toggleSharing,
    refreshLocation: requestCurrentLocation,
    saveCurrentLocationAsPlace,
    removePlace,
    loading,
    myUserName,
    partnerUserName,
  };
}
