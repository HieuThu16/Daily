import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Navigation, Battery, BatteryCharging, RefreshCw, 
  MapPin, Heart, ShieldCheck, ShieldOff, Plus, Trash2,
  Clock, Route, ChevronDown, ChevronUp, Map as MapIcon,
  Eye, ExternalLink
} from 'lucide-react';
import { formatDistance } from '../../lib/locationService';
import { useCoupleLocation } from './useCoupleLocation';
import type { Person } from '../../types';
import type { SavedPlace } from '../../types/location';

interface Props {
  partnerPerson?: Person;
}

export function CoupleLocationTab({ partnerPerson }: Props) {
  const {
    hieuLocation,
    kimYLocation,
    savedPlaces,
    timelineLogs,
    distanceKm,
    isSharing,
    toggleSharing,
    refreshLocation,
    saveCurrentLocationAsPlace,
    removePlace,
    loading,
    myUserName,
  } = useCoupleLocation(partnerPerson?.name);

  const [showMap, setShowMap] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [customPlaceName, setCustomPlaceName] = useState('');
  const [showTimeline, setShowTimeline] = useState(true);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState<SavedPlace | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Khởi tạo bản đồ khi showMap = true
  useEffect(() => {
    if (!showMap || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: L.LatLngTuple = [10.7769, 106.7009];
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }

    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [showMap]);

  // Vẽ marker trên bản đồ
  useEffect(() => {
    if (!showMap) return;
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    const createAvatarIcon = (name: string, isMe: boolean, currentPlace?: string) => {
      const bgColor = name === 'Hiếu' ? '#0284c7' : '#f43f5e';
      const initial = name.charAt(0).toUpperCase();

      return L.divIcon({
        className: 'custom-couple-marker',
        html: `
          <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
            <div class="marker-pulse" style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: ${bgColor}; opacity: 0.3; animation: couplePulse 2s infinite ease-out;"></div>
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${bgColor}; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 15px;">
              ${initial}
            </div>
            <div style="position: absolute; bottom: -16px; background: rgba(15, 23, 42, 0.85); color: #ffffff; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
              ${currentPlace ? `${currentPlace}` : name}
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    };

    // 1. Vẽ vòng bán kính 200m của các địa điểm lưu
    for (const p of savedPlaces) {
      if (p.latitude && p.longitude) {
        L.circle([p.latitude, p.longitude], {
          radius: p.radius_meters || 200,
          color: '#8b5cf6',
          fillColor: '#8b5cf6',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '4, 6',
        })
          .bindPopup(`<strong>${p.icon || '📍'} ${p.name}</strong><br/>(${p.user_name ? `Mốc của ${p.user_name}` : 'Mốc chung'})`)
          .addTo(markersLayer);
      }
    }

    // 2. Marker Hiếu (nếu có)
    if (hieuLocation?.latitude && hieuLocation?.longitude) {
      const hieuLatLng: L.LatLngTuple = [hieuLocation.latitude, hieuLocation.longitude];
      bounds.push(hieuLatLng);
      L.marker(hieuLatLng, {
        icon: createAvatarIcon('Hiếu', myUserName === 'Hiếu', hieuLocation.current_place),
      }).addTo(markersLayer);
    }

    // 3. Marker Kim Ý (nếu có)
    if (kimYLocation?.latitude && kimYLocation?.longitude) {
      const kimYLatLng: L.LatLngTuple = [kimYLocation.latitude, kimYLocation.longitude];
      bounds.push(kimYLatLng);
      L.marker(kimYLatLng, {
        icon: createAvatarIcon('Kim Ý', myUserName === 'Kim Ý', kimYLocation.current_place),
      }).addTo(markersLayer);
    }

    // 4. Căn chỉnh khung nhìn
    if (bounds.length === 2) {
      L.polyline(bounds, { color: '#f43f5e', weight: 3, dashArray: '6, 8', opacity: 0.8 }).addTo(markersLayer);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  }, [showMap, hieuLocation, kimYLocation, savedPlaces, myUserName]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshLocation();
    setTimeout(() => setIsRefreshing(false), 1200);
  };

  const handleSavePlace = async (name: string, icon = '🏠') => {
    if (!name.trim()) return;
    await saveCurrentLocationAsPlace(name, icon);
    setShowAddPlaceModal(false);
    setCustomPlaceName('');
  };

  // Xem chi tiết mốc và bay tới mốc trên bản đồ
  const handleViewPlace = (place: SavedPlace) => {
    setSelectedPlaceDetail(place);
    setShowMap(true);
    setTimeout(() => {
      if (mapInstanceRef.current && place.latitude && place.longitude) {
        mapInstanceRef.current.setView([place.latitude, place.longitude], 17);
      }
    }, 200);
  };

  const partnerTargetLocation = myUserName === 'Hiếu' ? kimYLocation : hieuLocation;

  const openGoogleMapsDirections = (lat?: number, lon?: number) => {
    const targetLat = lat ?? partnerTargetLocation?.latitude;
    const targetLon = lon ?? partnerTargetLocation?.longitude;
    if (!targetLat || !targetLon) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLon}`;
    window.open(url, '_blank');
  };

  const formatLastSeen = (iso?: string) => {
    if (!iso) return '';
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (isNaN(diffMin) || diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const hours = Math.floor(diffMin / 60);
    return `${hours} giờ trước`;
  };

  return (
    <div className="couple-location-tab-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        @keyframes couplePulse {
          0% { transform: scale(0.9); opacity: 0.7; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* THANH THAO TÁC TRÊN CÙNG */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)',
            }}
          >
            <Heart size={18} fill="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Vị trí Đôi Lứa
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSharing ? '#10b981' : '#94a3b8', display: 'inline-block' }} />
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {distanceKm !== null ? formatDistance(distanceKm) : (hieuLocation && kimYLocation ? 'Đang xác định…' : 'Chờ kết nối vị trí cả 2…')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            title="Cập nhật vị trí"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text-main)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={13} className={isRefreshing || loading ? 'animate-spin' : ''} />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => setShowAddPlaceModal(true)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.12)',
              color: '#8b5cf6',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Plus size={13} /> Lưu mốc
          </button>

          <button
            type="button"
            onClick={() => toggleSharing(!isSharing)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: 'none',
              background: isSharing ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isSharing ? '#10b981' : '#ef4444',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isSharing ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
            {isSharing ? 'Đang bật' : 'Đã tắt'}
          </button>
        </div>
      </div>

      {/* DANH SÁCH MỐC ĐỊA ĐIỂM (CẢ 2 CÙNG THẤY VÀ CÓ NÚT XEM TRỰC TIẾP) */}
      {savedPlaces.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={13} color="#8b5cf6" /> Các mốc địa điểm đã lưu (nhấn để xem vị trí):
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {savedPlaces.map((p) => (
              <div
                key={p.id}
                onClick={() => handleViewPlace(p)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '10px',
                  background: selectedPlaceDetail?.id === p.id ? 'rgba(139, 92, 246, 0.2)' : 'var(--card-bg)',
                  border: selectedPlaceDetail?.id === p.id ? '1px solid #8b5cf6' : '1px solid var(--border)',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                }}
                title="Nhấn để xem trên bản đồ"
              >
                <span>{p.icon || '📍'}</span>
                <span>{p.name}</span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: p.user_name === 'Hiếu' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    color: p.user_name === 'Hiếu' ? '#0284c7' : '#f43f5e',
                  }}
                >
                  {p.user_name || 'Mốc'}
                </span>
                <Eye size={12} color="#8b5cf6" style={{ marginLeft: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THẺ XEM CHI TIẾT MỐC ĐÃ CHỌN */}
      {selectedPlaceDetail && (
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid #8b5cf6',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>{selectedPlaceDetail.icon || '📍'}</span>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {selectedPlaceDetail.name} ({selectedPlaceDetail.user_name ? `Mốc của ${selectedPlaceDetail.user_name}` : 'Mốc chung'})
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Bán kính phát hiện: {selectedPlaceDetail.radius_meters || 200}m
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => openGoogleMapsDirections(selectedPlaceDetail.latitude, selectedPlaceDetail.longitude)}
              style={{
                padding: '5px 9px',
                borderRadius: '6px',
                border: 'none',
                background: '#10b981',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Navigation size={11} /> Chỉ đường
            </button>

            {selectedPlaceDetail.user_name === myUserName && (
              <button
                type="button"
                onClick={() => {
                  void removePlace(selectedPlaceDetail.id);
                  setSelectedPlaceDetail(null);
                }}
                style={{
                  padding: '5px 9px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <Trash2 size={11} /> Xóa mốc
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedPlaceDetail(null)}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* BẢNG SO SÁNH 2 BÊN: HIẾU vs KIM Ý */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        
        {/* CỘT HIẾU */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            borderRadius: '14px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#0284c7',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                }}
              >
                H
              </div>
              <strong style={{ fontSize: '0.88rem', color: '#0284c7' }}>
                Hiếu {myUserName === 'Hiếu' ? '(Bạn)' : ''}
              </strong>
            </div>

            {hieuLocation && hieuLocation.battery_level !== undefined ? (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: hieuLocation.battery_level <= 20 ? '#ef4444' : '#10b981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                {hieuLocation.is_charging ? <BatteryCharging size={13} /> : <Battery size={13} />}
                {hieuLocation.battery_level}%
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>--</span>
            )}
          </div>

          <div style={{ minHeight: '38px' }}>
            {hieuLocation ? (
              <>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {hieuLocation.current_place ? `🏠 Ở ${hieuLocation.current_place}` : '📍 Vị trí hiện tại'}
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '1px',
                  }}
                  title={hieuLocation.address_name}
                >
                  {hieuLocation.address_name || 'Đang xác định…'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Chưa có dữ liệu vị trí
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
            {hieuLocation ? formatLastSeen(hieuLocation.updated_at) : 'Chưa cập nhật'}
          </div>
        </div>

        {/* CỘT KIM Ý */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: '14px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#f43f5e',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                }}
              >
                Ý
              </div>
              <strong style={{ fontSize: '0.88rem', color: '#f43f5e' }}>
                Kim Ý {myUserName === 'Kim Ý' ? '(Bạn)' : ''}
              </strong>
            </div>

            {kimYLocation && kimYLocation.battery_level !== undefined ? (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: kimYLocation.battery_level <= 20 ? '#ef4444' : '#10b981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                {kimYLocation.is_charging ? <BatteryCharging size={13} /> : <Battery size={13} />}
                {kimYLocation.battery_level}%
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>--</span>
            )}
          </div>

          <div style={{ minHeight: '38px' }}>
            {kimYLocation ? (
              <>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {kimYLocation.current_place ? `🏡 Ở ${kimYLocation.current_place}` : '📍 Vị trí hiện tại'}
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '1px',
                  }}
                  title={kimYLocation.address_name}
                >
                  {kimYLocation.address_name || 'Đang xác định…'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Đang chờ Ý mở app…
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
            {kimYLocation ? formatLastSeen(kimYLocation.updated_at) : 'Chưa cập nhật'}
          </div>
        </div>

      </div>

      {/* THANH NÚT: MỞ BẢN ĐỒ & CHỈ ĐƯỜNG */}
      <div style={{ display: 'grid', gridTemplateColumns: partnerTargetLocation ? '1fr 1fr' : '1fr', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          style={{
            padding: '9px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: showMap ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'var(--card-bg)',
            color: showMap ? '#ffffff' : 'var(--text-main)',
            fontSize: '0.8rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: showMap ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
          }}
        >
          <MapIcon size={14} />
          {showMap ? 'Thu gọn Bản đồ' : '🗺️ Xem trên Bản đồ'}
        </button>

        {partnerTargetLocation && (
          <button
            type="button"
            onClick={() => openGoogleMapsDirections()}
            style={{
              padding: '9px 14px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Navigation size={14} /> Chỉ đường đến {myUserName === 'Hiếu' ? 'Kim Ý' : 'Hiếu'}
          </button>
        )}
      </div>

      {/* BẢN ĐỒ LEAFLET TRỰC TIẾP */}
      {showMap && (
        <div
          style={{
            width: '100%',
            height: '250px',
            borderRadius: '14px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            position: 'relative',
            background: 'var(--bg-secondary, #1e293b)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}
        >
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      )}

      {/* LỊCH TRÌNH VỊ TRÍ & QUÃNG ĐƯỜNG TRONG NGÀY (TIMELINE) */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => setShowTimeline(!showTimeline)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 0,
            color: 'var(--text-main)',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Route size={15} color="#0284c7" /> Lịch trình hành trình trong ngày ({timelineLogs.length})
          </span>
          {showTimeline ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showTimeline && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {timelineLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                Chưa có ghi nhận di chuyển nào trong ngày này.
              </div>
            ) : (
              timelineLogs.map((log) => {
                const isMe = log.user_name === myUserName;
                return (
                  <div
                    key={log.id}
                    style={{
                      background: 'var(--bg-secondary, rgba(255,255,255,0.02))',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '7px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      fontSize: '0.76rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: log.user_name === 'Hiếu' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: log.user_name === 'Hiếu' ? '#0284c7' : '#f43f5e',
                          flexShrink: 0,
                        }}
                      >
                        {log.user_name}
                      </span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.event_type === 'STAY' ? '🏠 ' : '🚗 '}
                        {log.place_name}
                        {log.distance_km && log.distance_km > 0 ? ` (${log.distance_km} km)` : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.72rem', flexShrink: 0 }}>
                      <Clock size={11} />
                      <span>{log.start_time}{log.end_time && log.end_time !== log.start_time ? ` → ${log.end_time}` : ''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* MODAL LƯU VỊ TRÍ HIỆN TẠI LÀM MỐC */}
      {showAddPlaceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowAddPlaceModal(false)}
        >
          <div
            style={{
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '18px',
              width: '100%',
              maxWidth: '320px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
              📍 Lưu vị trí hiện tại làm mốc
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Mốc địa điểm này sẽ hiển thị cho cả 2 cùng thấy và dùng để nhận diện khi rời khỏi / đến nơi (bán kính 200m).
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => void handleSavePlace(myUserName === 'Hiếu' ? 'Trọ' : 'Nhà', '🏠')}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🏠 {myUserName === 'Hiếu' ? 'Trọ' : 'Nhà'}
              </button>

              <button
                type="button"
                onClick={() => void handleSavePlace('Công ty', '🏢')}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🏢 Công ty
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={customPlaceName}
                onChange={(e) => setCustomPlaceName(e.target.value)}
                placeholder="Tên địa điểm khác…"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--input-bg, rgba(0,0,0,0.2))',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                }}
              />
              <button
                type="button"
                onClick={() => void handleSavePlace(customPlaceName, '📍')}
                disabled={!customPlaceName.trim()}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: customPlaceName.trim() ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: customPlaceName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Lưu
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAddPlaceModal(false)}
              style={{
                padding: '6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.76rem',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
