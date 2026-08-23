import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Navigation, Battery, BatteryCharging, RefreshCw, 
  MapPin, Heart, ShieldCheck, ShieldOff, Plus, Trash2,
  Clock, Route, ChevronDown, ChevronUp, Map as MapIcon,
  Sparkles
} from 'lucide-react';
import { formatDistance } from '../../lib/locationService';
import { useCoupleLocation } from './useCoupleLocation';
import type { Person } from '../../types';

interface Props {
  partnerPerson?: Person;
}

export function CoupleLocationTab({ partnerPerson }: Props) {
  const {
    myLocation,
    partnerLocation,
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
    partnerUserName,
  } = useCoupleLocation(partnerPerson?.name);

  const [showMap, setShowMap] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [customPlaceName, setCustomPlaceName] = useState('');
  const [showTimeline, setShowTimeline] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Khởi tạo bản đồ khi mở showMap
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

    // Resize map sau khi mount container
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

  // Vẽ marker lên bản đồ khi có tọa độ
  useEffect(() => {
    if (!showMap) return;
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    const createAvatarIcon = (name: string, isMe: boolean, currentPlace?: string) => {
      const bgColor = isMe ? '#0284c7' : '#f43f5e';
      const initial = name ? name.charAt(0).toUpperCase() : (isMe ? 'H' : 'Ý');

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
          fillOpacity: 0.1,
          weight: 1.5,
          dashArray: '4, 6',
        })
          .bindPopup(`<strong>${p.icon || '📍'} ${p.name}</strong> (${p.user_name || 'Địa điểm'})`)
          .addTo(markersLayer);
      }
    }

    // 2. Marker Tôi
    if (myLocation?.latitude && myLocation?.longitude) {
      const myLatLng: L.LatLngTuple = [myLocation.latitude, myLocation.longitude];
      bounds.push(myLatLng);
      L.marker(myLatLng, {
        icon: createAvatarIcon(myUserName, true, myLocation.current_place),
      }).addTo(markersLayer);
    }

    // 3. Marker Đối phương
    if (partnerLocation?.latitude && partnerLocation?.longitude) {
      const partnerLatLng: L.LatLngTuple = [partnerLocation.latitude, partnerLocation.longitude];
      bounds.push(partnerLatLng);
      L.marker(partnerLatLng, {
        icon: createAvatarIcon(partnerLocation.user_name || partnerUserName, false, partnerLocation.current_place),
      }).addTo(markersLayer);
    }

    // 4. Nối 2 điểm
    if (bounds.length === 2) {
      L.polyline(bounds, { color: '#f43f5e', weight: 3, dashArray: '6, 8', opacity: 0.8 }).addTo(markersLayer);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  }, [showMap, myLocation, partnerLocation, savedPlaces, myUserName, partnerUserName]);

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

  const openGoogleMapsDirections = () => {
    if (!partnerLocation) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${partnerLocation.latitude},${partnerLocation.longitude}`;
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

  // Xác định thông tin của Hiếu và Kim Ý
  const hieuInfo = myUserName === 'Hiếu' ? myLocation : partnerLocation;
  const kimYInfo = myUserName === 'Kim Ý' ? myLocation : partnerLocation;

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
              {distanceKm !== null ? formatDistance(distanceKm) : 'Đang tìm vị trí đối phương…'}
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

      {/* DANH SÁCH MỐC ĐỊA ĐIỂM (CHIPS GỌN) */}
      {savedPlaces.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {savedPlaces.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                borderRadius: '8px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{p.icon || '📍'}</span>
              <span>{p.name}</span>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>({p.user_name || 'Mốc'})</span>
              <button
                type="button"
                onClick={() => void removePlace(p.id)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, marginLeft: '2px', display: 'flex', alignItems: 'center' }}
                title="Xóa mốc"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* BẢNG SO SÁNH 2 BÊN: HIẾU vs KIM Ý (VỊ TRÍ & PIN) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}
      >
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
              <strong style={{ fontSize: '0.88rem', color: '#0284c7' }}>Hiếu</strong>
            </div>

            {hieuInfo?.battery_level !== undefined && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: hieuInfo.battery_level <= 20 ? '#ef4444' : '#10b981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                {hieuInfo.is_charging ? <BatteryCharging size={13} /> : <Battery size={13} />}
                {hieuInfo.battery_level}%
              </span>
            )}
          </div>

          <div style={{ minHeight: '38px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {hieuInfo?.current_place ? `🏠 ${hieuInfo.current_place}` : '📍 Đang ở'}
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
              title={hieuInfo?.address_name}
            >
              {hieuInfo?.address_name || 'Chưa có tọa độ'}
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
            {formatLastSeen(hieuInfo?.updated_at)}
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
              <strong style={{ fontSize: '0.88rem', color: '#f43f5e' }}>Kim Ý</strong>
            </div>

            {kimYInfo?.battery_level !== undefined && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: kimYInfo.battery_level <= 20 ? '#ef4444' : '#10b981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                {kimYInfo.is_charging ? <BatteryCharging size={13} /> : <Battery size={13} />}
                {kimYInfo.battery_level}%
              </span>
            )}
          </div>

          <div style={{ minHeight: '38px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {kimYInfo?.current_place ? `🏡 ${kimYInfo.current_place}` : '📍 Đang ở'}
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
              title={kimYInfo?.address_name}
            >
              {kimYInfo?.address_name || 'Chưa có tọa độ'}
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
            {formatLastSeen(kimYInfo?.updated_at)}
          </div>
        </div>
      </div>

      {/* THANH NÚT: MỞ BẢN ĐỒ & CHỈ ĐƯỜNG */}
      <div style={{ display: 'grid', gridTemplateColumns: partnerLocation ? '1fr 1fr' : '1fr', gap: '8px' }}>
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

        {partnerLocation && (
          <button
            type="button"
            onClick={openGoogleMapsDirections}
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
            <Navigation size={14} /> Chỉ đường đến người ấy
          </button>
        )}
      </div>

      {/* BẢN ĐỒ LEAFLET TRỰC TIẾP (HIỆN KHI BẤM NÚT) */}
      {showMap && (
        <div
          style={{
            width: '100%',
            height: '240px',
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
                          background: isMe ? 'rgba(2, 132, 199, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: isMe ? '#0284c7' : '#f43f5e',
                          flexShrink: 0,
                        }}
                      >
                        {log.user_name}
                      </span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.place_name}
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

      {/* MODAL LƯU VỊ TRÍ LÀM MỐC */}
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
              Khi rời khỏi hoặc đến mốc này (bán kính 200m), app sẽ tự động ghi nhận và thông báo cho người ấy.
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
