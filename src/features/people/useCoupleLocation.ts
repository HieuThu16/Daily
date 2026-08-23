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
  broadcastLocationAlert,
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

  const isHieu = useCallback((s?: string) => {
    const str = (s || '').toLowerCase();
    return str.includes('hieu') || str.includes('truongnguyenminhhieu');
  }, []);

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

  // Xử lý logic Geofence & Lịch trình hành trình khi tọa độ thay đổi
  const processGeofenceAndTimeline = useCallback(
    async (lat: number, lon: number, addressName: string, time: string, today: string) => {
      const matchingPlace = findMatchingSavedPlace(lat, lon, savedPlaces);
      const lastPlace = lastKnownPlaceRef.current;
      const uid = currentUserId || 'current_user';

      // 1. Phát hiện RỜI KHỎI (DEPARTURE) khi di chuyển ra xa > 200m so với địa điểm trước đó
      if (lastPlace && (!matchingPlace || matchingPlace.id !== lastPlace.id)) {
        const departureMsg = `${myUserName} đã rời khỏi ${lastPlace.name} lúc ${time}`;
        const alertEvent: LocationAlertEvent = {
          id: `alert_dep_${Date.now()}`,
          user_id: uid,
          user_name: myUserName,
          message: departureMsg,
          type: 'DEPARTURE',
          place_name: lastPlace.name,
          created_at: new Date().toISOString(),
        };
        void broadcastLocationAlert(alertEvent);

        // Đóng session ở địa điểm trước đó
        if (activeStayLogIdRef.current) {
          const prevLog: LocationTimelineLog = {
            id: activeStayLogIdRef.current,
            user_id: uid,
            user_name: myUserName,
            place_name: `Ở ${lastPlace.name}`,
            event_type: 'STAY',
            latitude: lastPlace.latitude,
            longitude: lastPlace.longitude,
            log_date: today,
            start_time: time,
            end_time: time,
            created_at: new Date().toISOString(),
          };
          void logTimelineEvent(prevLog);
          activeStayLogIdRef.current = null;
        }
      }

      // 2. Phát hiện ĐẾN NƠI (ARRIVAL) khi bước vào bán kính 200m của địa điểm mới
      if (matchingPlace && (!lastPlace || lastPlace.id !== matchingPlace.id)) {
        const arrivalMsg = `${myUserName} vừa đến ${matchingPlace.name} lúc ${time}`;
        const alertEvent: LocationAlertEvent = {
          id: `alert_arr_${Date.now()}`,
          user_id: uid,
          user_name: myUserName,
          message: arrivalMsg,
          type: 'ARRIVAL',
          place_name: matchingPlace.name,
          created_at: new Date().toISOString(),
        };
        void broadcastLocationAlert(alertEvent);

        // Mở session mới tại địa điểm vừa đến
        const stayLogId = `stay_${uid}_${matchingPlace.id}_${today}`;
        activeStayLogIdRef.current = stayLogId;
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
      } else if (!matchingPlace) {
        // Đang di chuyển trên đường
        const moveLogId = `move_${uid}_${today}_${time.slice(0, 3)}0`;
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
      } else if (matchingPlace && activeStayLogIdRef.current) {
        // Cập nhật giờ kết thúc cho địa điểm đang ở (VD: 9h -> 10h)
        const updatedLog: LocationTimelineLog = {
          id: activeStayLogIdRef.current,
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
        void logTimelineEvent(updatedLog);
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

      const uid = currentUserId || 'current_user';
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

  // Bắt đầu theo dõi vị trí liên tục
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
        // Cập nhật khi có thay đổi tọa độ
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
        .channel('partner-locations-full-realtime')
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
    if (!myLocation) return;
    const newPlace: SavedPlace = {
      id: `place_${currentUserId || 'me'}_${Date.now()}`,
      user_id: currentUserId || 'current_user',
      user_name: myUserName,
      name: placeName.trim(),
      icon,
      latitude: myLocation.latitude,
      longitude: myLocation.longitude,
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

  // Phân loại vị trí
  const myLocation = locations.find((l) => {
    if (currentUserId && l.user_id === currentUserId) return true;
    if (l.user_name && isKimY(currentUserEmail) && isKimY(l.user_name)) return true;
    if (l.user_name && isHieu(currentUserEmail) && isHieu(l.user_name)) return true;
    return false;
  }) || (locations.length > 0 && isSharing ? locations[0] : null);

  const partnerLocation = locations.find((l) => {
    if (currentUserId && l.user_id === currentUserId) return false;
    if (myLocation && l.user_id === myLocation.user_id) return false;
    if (partnerPersonName && l.user_name?.toLowerCase().includes(partnerPersonName.toLowerCase())) return true;
    if (isKimY(currentUserEmail) && isHieu(l.user_name)) return true;
    if (isHieu(currentUserEmail) && isKimY(l.user_name)) return true;
    return true;
  }) || null;

  const distanceKm =
    myLocation && partnerLocation
      ? calculateDistanceKm(
          myLocation.latitude,
          myLocation.longitude,
          partnerLocation.latitude,
          partnerLocation.longitude
        )
      : null;

  return {
    locations,
    savedPlaces,
    timelineLogs,
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
