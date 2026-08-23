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
  getLocalTimelineLogs,
  cleanTimelineLogs,
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
  const lastDeparturePlaceRef = useRef<SavedPlace | null>(null);
  const activeMoveLogRef = useRef<LocationTimelineLog | null>(null);
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
      setTimelineLogs(cleanTimelineLogs(logs));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Xử lý logic Geofence & Lịch trình hành trình: Gom chặng Ở (STAY) & chặng Di chuyển (MOVE: Từ A -> B)
  const processGeofenceAndTimeline = useCallback(
    async (lat: number, lon: number, addressName: string, time: string, today: string) => {
      const matchingPlace = findMatchingSavedPlace(lat, lon, savedPlaces, myUserName);
      const uid = currentUserId || `user_${myUserName}`;

      // Tính khoảng cách di chuyển so với tọa độ trước
      const prevCoords = lastCoordsRef.current;
      const movedDistanceKm = prevCoords ? calculateDistanceKm(prevCoords.lat, prevCoords.lon, lat, lon) : 0;
      lastCoordsRef.current = { lat, lon };

      // 1. NẾU ĐANG Ở ĐỊA ĐIỂM QUEN THUỘC (Trọ / Nhà / Công ty...)
      if (matchingPlace) {
        // Nếu trước đó đang có chặng di chuyển dở:
        if (activeMoveLogRef.current) {
          const move = activeMoveLogRef.current;
          const originName = lastDeparturePlaceRef.current?.name;

          // NẾU ORIGIN VÀ DESTINATION LÀ CÙNG 1 ĐỊA ĐIỂM (VD: Đi từ Trọ đến Trọ do giật GPS):
          if (originName === matchingPlace.name || !originName || (move.distance_km || 0) < 0.25) {
            // Hủy bỏ hoàn toàn chặng di chuyển ảo này
            activeMoveLogRef.current = null;
          } else {
            // Chốt chặng di chuyển thực sự giữa 2 nơi khác nhau
            const finalMoveName = `Đi từ ${originName} đến ${matchingPlace.name}`;
            const finalMoveLog: LocationTimelineLog = {
              ...move,
              place_name: finalMoveName,
              end_time: time,
              latitude: lat,
              longitude: lon,
            };
            void logTimelineEvent(finalMoveLog);
            activeMoveLogRef.current = null;
          }
        }

        // Tìm mốc STAY đã có của địa điểm này trong ngày để duy trì mốc thời gian "Từ ... đến ..."
        const localLogs = getLocalTimelineLogs();
        const existingStay = localLogs.find(
          (l) => l.user_name === myUserName && l.log_date === today && l.event_type === 'STAY' && l.place_name === `Ở ${matchingPlace.name}`
        ) || timelineLogs.find(
          (l) => l.user_name === myUserName && l.log_date === today && l.event_type === 'STAY' && l.place_name === `Ở ${matchingPlace.name}`
        );

        const stayLogId = existingStay ? existingStay.id : `stay_${myUserName}_${matchingPlace.id}_${today}`;
        const startTime = existingStay ? existingStay.start_time : time;

        const stayLog: LocationTimelineLog = {
          id: stayLogId,
          user_id: uid,
          user_name: myUserName,
          place_name: `Ở ${matchingPlace.name}`,
          event_type: 'STAY',
          latitude: matchingPlace.latitude,
          longitude: matchingPlace.longitude,
          log_date: today,
          start_time: startTime,
          end_time: time,
          created_at: existingStay?.created_at || new Date().toISOString(),
        };

        void logTimelineEvent(stayLog);
        lastKnownPlaceRef.current = matchingPlace;
      } 
      // 2. NẾU KHÔNG Ở MỐC NÀO (Đang trên đường di chuyển)
      else {
        // Kiểm tra chống giật GPS: nếu vẫn < 400m so với mốc quen thuộc cũ thì vẫn coi là đang ở mốc đó
        if (lastKnownPlaceRef.current) {
          const distToLastPlace = calculateDistanceKm(lat, lon, lastKnownPlaceRef.current.latitude, lastKnownPlaceRef.current.longitude);
          if (distToLastPlace < 0.4) {
            const oldPlace = lastKnownPlaceRef.current;
            const existingStay = getLocalTimelineLogs().find(
              (l) => l.user_name === myUserName && l.log_date === today && l.event_type === 'STAY' && l.place_name === `Ở ${oldPlace.name}`
            );
            if (existingStay) {
              existingStay.end_time = time;
              void logTimelineEvent(existingStay);
              return oldPlace.name;
            }
          }

          // Đã thực sự đi ra xa khỏi mốc cũ (> 400m)
          lastDeparturePlaceRef.current = lastKnownPlaceRef.current;
          lastKnownPlaceRef.current = null;
        }

        const originName = lastDeparturePlaceRef.current?.name;
        const tripTitle = originName ? `Đi từ ${originName}` : (addressName || 'Đang di chuyển');

        // Chỉ tạo chặng di chuyển khi đã đi một khoảng cách đáng kể (> 0.2km)
        if (!activeMoveLogRef.current) {
          if (movedDistanceKm > 0.1) {
            const moveLogId = `trip_${myUserName}_${today}_${Date.now()}`;
            const newMoveLog: LocationTimelineLog = {
              id: moveLogId,
              user_id: uid,
              user_name: myUserName,
              place_name: tripTitle,
              event_type: 'MOVE',
              latitude: lat,
              longitude: lon,
              log_date: today,
              start_time: time,
              end_time: time,
              distance_km: movedDistanceKm > 0.05 ? Math.round(movedDistanceKm * 10) / 10 : 0,
              created_at: new Date().toISOString(),
            };
            activeMoveLogRef.current = newMoveLog;
            void logTimelineEvent(newMoveLog);
          }
        } else {
          // Cập nhật giờ đến và cộng dồn quãng đường của chặng di chuyển
          const currentMove = activeMoveLogRef.current;
          const totalDist = (currentMove.distance_km || 0) + (movedDistanceKm > 0.05 ? movedDistanceKm : 0);
          const updatedMoveLog: LocationTimelineLog = {
            ...currentMove,
            place_name: originName ? `Đi từ ${originName}` : (addressName || 'Đang di chuyển'),
            end_time: time,
            latitude: lat,
            longitude: lon,
            distance_km: Math.round(totalDist * 10) / 10,
          };
          activeMoveLogRef.current = updatedMoveLog;
          void logTimelineEvent(updatedMoveLog);
        }
      }

      return matchingPlace ? matchingPlace.name : undefined;
    },
    [currentUserId, myUserName, savedPlaces, timelineLogs]
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
