import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { localDate } from '../../lib/date';
import type { 
  PartnerLocation, 
  SavedPlace, 
  LocationTimelineLog, 
} from '../../types/location';
import { notifyPartner } from '../../lib/push';
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

/** Nhớ lần cảnh báo vị trí gần nhất để không báo trùng sau mỗi lần mở lại app. */
const ALERT_KEY = 'daily_location_last_alert';

/**
 * Nhận diện hai tài khoản của app theo email.
 * ponytail: hai hằng số cứng vì app chỉ có hai người dùng; thêm người thứ ba thì
 * chuyển sang cột `display_name` trong bảng người dùng chứ đừng nối thêm chuỗi ở đây.
 */
const KIM_Y_EMAIL_HINTS = ['kimy', 'nguyenkimy'];
const HIEU_EMAIL_HINTS = ['hieu', 'duyphuongvo'];

export function useCoupleLocation(_partnerPersonName?: string, selectedDate: string = localDate()) {
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

  /*
   * `timelineLogs` và `savedPlaces` đổi sau mỗi lần cập nhật vị trí. Nếu đọc thẳng
   * state trong callback thì callback đổi identity → effect watchPosition bị dựng lại
   * → clearWatch + watchPosition + lấy toạ độ lại → lại cập nhật → lặp vô tận.
   * Đọc qua ref: giá trị vẫn mới, mà callback thì đứng yên.
   */
  const timelineLogsRef = useRef<LocationTimelineLog[]>([]);
  const savedPlacesRef = useRef<SavedPlace[]>([]);

  /*
   * App này chỉ có hai tài khoản. Trước đây hàm còn dò `includes('ý')` trên email —
   * email không mang được dấu tiếng Việt nên nhánh đó chết, và tài khoản lạ nào
   * đăng nhập cũng bị coi là "Hiếu" rồi ghi đè vị trí của Hiếu.
   * Giờ nhận diện bằng danh sách rõ ràng, và không khớp thì KHÔNG chia sẻ vị trí.
   */
  const isKimY = useCallback(
    (email?: string) => KIM_Y_EMAIL_HINTS.some((hint) => (email || '').toLowerCase().includes(hint)),
    []
  );
  const isHieu = useCallback(
    (email?: string) => HIEU_EMAIL_HINTS.some((hint) => (email || '').toLowerCase().includes(hint)),
    []
  );

  const knownUser = isKimY(currentUserEmail) || isHieu(currentUserEmail);
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
      const cleanedLogs = cleanTimelineLogs(logs);
      savedPlacesRef.current = places;
      timelineLogsRef.current = cleanedLogs;
      setLocations(locList);
      setSavedPlaces(places);
      setTimelineLogs(cleanedLogs);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  /** Chỉ báo khi thật sự đổi mốc, không báo lại cùng một sự kiện sau mỗi lần refresh. */
  const notifyPlaceChange = useCallback(
    (kind: 'ARRIVE' | 'LEAVE', placeName: string, time: string) => {
      const key = `${kind}:${placeName}`;
      try {
        if (localStorage.getItem(ALERT_KEY) === key) return;
        localStorage.setItem(ALERT_KEY, key);
      } catch {
        return;
      }
      const title =
        kind === 'ARRIVE' ? `${myUserName} đã tới ${placeName}` : `${myUserName} đang rời khỏi ${placeName}`;
      void notifyPartner(title, `lúc ${time}`, '/people', `loc-${kind}-${placeName}`);
    },
    [myUserName]
  );

  // Xử lý logic Geofence & Lịch trình hành trình: Gom chặng Ở (STAY) & chặng Di chuyển (MOVE: Từ A -> B)
  const processGeofenceAndTimeline = useCallback(
    async (lat: number, lon: number, addressName: string, time: string, today: string) => {
      const matchingPlace = findMatchingSavedPlace(lat, lon, savedPlacesRef.current, myUserName);
      const uid = currentUserId || `user_${myUserName}`;

      // Tính khoảng cách di chuyển so với tọa độ trước
      const prevCoords = lastCoordsRef.current;
      const movedDistanceKm = prevCoords ? calculateDistanceKm(prevCoords.lat, prevCoords.lon, lat, lon) : 0;
      lastCoordsRef.current = { lat, lon };

      /** Tìm mốc Ở đã có trong ngày để giữ nguyên giờ bắt đầu, chỉ nới giờ kết thúc. */
      const upsertStay = (logId: string, placeLabel: string, plat: number, plon: number) => {
        const isSame = (l: LocationTimelineLog) =>
          l.user_name === myUserName && l.log_date === today && l.event_type === 'STAY' && l.place_name === placeLabel;
        const existing = getLocalTimelineLogs().find(isSame) || timelineLogsRef.current.find(isSame);
        const stayLog: LocationTimelineLog = {
          id: existing ? existing.id : logId,
          user_id: uid,
          user_name: myUserName,
          place_name: placeLabel,
          event_type: 'STAY',
          latitude: plat,
          longitude: plon,
          log_date: today,
          start_time: existing ? existing.start_time : time,
          end_time: time,
          created_at: existing?.created_at || new Date().toISOString(),
        };
        void logTimelineEvent(stayLog);
      };

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

        if (lastKnownPlaceRef.current?.name !== matchingPlace.name) {
          notifyPlaceChange('ARRIVE', matchingPlace.name, time);
        }

        upsertStay(
          `stay_${myUserName}_${matchingPlace.id}_${today}`,
          `Ở ${matchingPlace.name}`,
          matchingPlace.latitude,
          matchingPlace.longitude
        );
        lastKnownPlaceRef.current = matchingPlace;
        lastDeparturePlaceRef.current = null;
        return matchingPlace.name;
      }

      // 2. NẾU KHÔNG Ở MỐC NÀO (Đang trên đường, hoặc đang ở một nơi chưa lưu mốc)
      if (lastKnownPlaceRef.current) {
        // Chống giật GPS: vẫn < 400m so với mốc quen thuộc cũ thì coi như chưa rời đi
        const oldPlace = lastKnownPlaceRef.current;
        const distToLastPlace = calculateDistanceKm(lat, lon, oldPlace.latitude, oldPlace.longitude);
        if (distToLastPlace < 0.4) {
          upsertStay(`stay_${myUserName}_${oldPlace.id}_${today}`, `Ở ${oldPlace.name}`, oldPlace.latitude, oldPlace.longitude);
          return oldPlace.name;
        }

        // Đã thực sự đi ra xa khỏi mốc cũ (> 400m)
        notifyPlaceChange('LEAVE', oldPlace.name, time);
        lastDeparturePlaceRef.current = oldPlace;
        lastKnownPlaceRef.current = null;
      }

      const originName = lastDeparturePlaceRef.current?.name;

      /*
       * Không biết đi ra từ mốc nào (thường là mở app lại khi đã ở chỗ khác):
       * ghi thẳng một mốc Ở theo địa chỉ hiện tại. Trước đây chỗ này đòi phải
       * đo được quãng đường > 0.1km mới ghi, mà lần lấy toạ độ đầu tiên thì
       * chưa có toạ độ trước để so — nên lịch trình đứng im ở mốc cũ.
       */
      if (!originName) {
        const label = `Ở ${addressName}`;
        const slug = addressName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
        upsertStay(`stay_${myUserName}_${today}_${slug}`, label, lat, lon);
        return addressName;
      }

      // Đang trên đường giữa hai nơi: mở chặng di chuyển và cộng dồn quãng đường
      if (!activeMoveLogRef.current) {
        activeMoveLogRef.current = {
          id: `trip_${myUserName}_${today}_${Date.now()}`,
          user_id: uid,
          user_name: myUserName,
          place_name: `Đi từ ${originName}`,
          event_type: 'MOVE',
          latitude: lat,
          longitude: lon,
          log_date: today,
          start_time: time,
          end_time: time,
          distance_km: movedDistanceKm > 0.05 ? Math.round(movedDistanceKm * 10) / 10 : 0,
          created_at: new Date().toISOString(),
        };
      } else {
        const currentMove = activeMoveLogRef.current;
        const totalDist = (currentMove.distance_km || 0) + (movedDistanceKm > 0.05 ? movedDistanceKm : 0);
        activeMoveLogRef.current = {
          ...currentMove,
          end_time: time,
          latitude: lat,
          longitude: lon,
          distance_km: Math.round(totalDist * 10) / 10,
        };
      }
      void logTimelineEvent(activeMoveLogRef.current);

      return undefined;
    },
    [currentUserId, myUserName, notifyPlaceChange]
  );

  /*
   * Tải lại trang là mất hết ref, không còn nhớ hôm nay đã ở mốc nào. Dựng lại
   * "đi ra từ đâu" theo mốc Ở cuối cùng trong ngày để chặng di chuyển tiếp theo
   * có tên đúng ("Đi từ Trọ") thay vì chỉ là một địa chỉ trống không.
   */
  useEffect(() => {
    if (lastDeparturePlaceRef.current || lastKnownPlaceRef.current) return;
    if (savedPlaces.length === 0 || timelineLogs.length === 0) return;
    const today = localDate();
    const lastStay = [...timelineLogs]
      .filter((l) => l.user_name === myUserName && l.log_date === today && l.event_type === 'STAY')
      .sort((a, b) => (a.end_time || a.start_time).localeCompare(b.end_time || b.start_time))
      .pop();
    if (!lastStay) return;
    const place = savedPlaces.find((p) => `Ở ${p.name}` === lastStay.place_name);
    if (place) lastDeparturePlaceRef.current = place;
  }, [myUserName, savedPlaces, timelineLogs]);

  // Cập nhật vị trí hiện tại của thiết bị
  const updateCurrentPosition = useCallback(
    async (pos: GeolocationPosition, force = false) => {
      if (!isLocationSharingEnabled()) return;
      // Chưa biết mình là ai thì im lặng, chứ ghi bừa là đè lên vị trí người khác.
      if (!knownUser) return;

      /*
       * Hai callback watchPosition có thể cùng lọt qua cửa 12 giây rồi cùng gọi
       * reverseGeocode + đồng bộ. Đóng cửa NGAY, trước mọi await.
       * `force` dành cho nút làm mới và lúc quay lại tab — người dùng bấm là phải chạy.
       */
      if (!force && Date.now() - lastSyncTimeRef.current < 12_000) return;
      lastSyncTimeRef.current = Date.now();

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

      await syncLocationToSupabase(myLoc);
      void reloadAllData();
    },
    [currentUserId, knownUser, myUserName, processGeofenceAndTimeline, reloadAllData]
  );

  // Kích hoạt lấy tọa độ tức thì
  const requestCurrentLocation = useCallback(() => {
    if (!('geolocation' in navigator) || !isSharing) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => void updateCurrentPosition(pos, true),
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
      (pos) => void updateCurrentPosition(pos),
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
