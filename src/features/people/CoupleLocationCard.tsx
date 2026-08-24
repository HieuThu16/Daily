import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Navigation, Battery, BatteryCharging, RefreshCw, 
  Heart, ShieldCheck, ShieldOff, Plus, Trash2,
  Clock, Route, ChevronDown, ChevronUp
} from 'lucide-react';
import { formatDistance } from '../../lib/locationService';
import { useCoupleLocation } from './useCoupleLocation';
import type { Person } from '../../types';
import { Z } from '../../lib/zLayers'

interface Props {
  partnerPerson?: Person;
  selectedDate?: string;
}

export function CoupleLocationCard({ partnerPerson, selectedDate }: Props) {
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
  } = useCoupleLocation(partnerPerson?.name, selectedDate);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [customPlaceName, setCustomPlaceName] = useState('');
  const [showTimeline, setShowTimeline] = useState(true);

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: L.LatLngTuple = [10.7769, 106.7009]; // TP.HCM
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

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Vẽ Marker và Vòng bán kính 200m của các địa điểm lưu
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    // Helper tạo HTML icon marker cá tính
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

    // 1. Vẽ vòng tròn bán kính 200m của các địa điểm quen thuộc
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
          .bindPopup(`<strong>${p.icon || '📍'} ${p.name}</strong> (${p.user_name || 'Địa điểm quen thuộc'})`)
          .addTo(markersLayer);
      }
    }

    // 2. Marker của Tôi
    if (myLocation && myLocation.latitude && myLocation.longitude) {
      const myLatLng: L.LatLngTuple = [myLocation.latitude, myLocation.longitude];
      bounds.push(myLatLng);
      L.marker(myLatLng, {
        icon: createAvatarIcon(myUserName, true, myLocation.current_place),
      })
        .bindPopup(`<strong>${myUserName} (Bạn)</strong><br/>${myLocation.current_place ? `Ở ${myLocation.current_place}` : myLocation.address_name || 'Vị trí hiện tại'}`)
        .addTo(markersLayer);
    }

    // 3. Marker của Đối phương
    if (partnerLocation && partnerLocation.latitude && partnerLocation.longitude) {
      const partnerLatLng: L.LatLngTuple = [partnerLocation.latitude, partnerLocation.longitude];
      bounds.push(partnerLatLng);
      L.marker(partnerLatLng, {
        icon: createAvatarIcon(partnerLocation.user_name || partnerUserName, false, partnerLocation.current_place),
      })
        .bindPopup(`<strong>${partnerLocation.user_name || partnerUserName}</strong><br/>${partnerLocation.current_place ? `Ở ${partnerLocation.current_place}` : partnerLocation.address_name || 'Vị trí hiện tại'}`)
        .addTo(markersLayer);
    }

    // 4. Đường nét đứt nối giữa 2 người
    if (bounds.length === 2) {
      L.polyline(bounds, {
        color: '#f43f5e',
        weight: 3,
        dashArray: '6, 8',
        opacity: 0.8,
      }).addTo(markersLayer);

      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  }, [myLocation, partnerLocation, savedPlaces, myUserName, partnerUserName]);

  const handleRefresh = async () => {
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

  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      }}
      className="couple-location-card"
    >
      <style>{`
        @keyframes couplePulse {
          0% { transform: scale(0.9); opacity: 0.7; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* HEADER: Tiêu đề + Nút trạng thái + Nút Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)',
            }}
          >
            <Heart size={16} fill="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Vị trí Đôi lứa
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSharing ? '#10b981' : '#94a3b8', display: 'inline-block' }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {distanceKm !== null ? formatDistance(distanceKm) : 'Đang tìm vị trí đối phương…'}
            </div>
          </div>
        </div>

        {/* NÚT THAO TÁC */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            title="Cập nhật vị trí"
            style={{
              padding: '5px 9px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
              color: 'var(--text-main)',
              fontSize: '0.75rem',
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
              padding: '5px 9px',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.12)',
              color: '#8b5cf6',
              fontSize: '0.75rem',
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
              padding: '5px 9px',
              borderRadius: '8px',
              border: 'none',
              background: isSharing ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isSharing ? '#10b981' : '#ef4444',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isSharing ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
            {isSharing ? 'Bật' : 'Tắt'}
          </button>
        </div>
      </div>

      {/* DANH SÁCH MỐC ĐỊA ĐIỂM (TRỌ / NHÀ / CÔNG TY) */}
      {savedPlaces.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {savedPlaces.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{p.icon || '📍'}</span>
              <span>{p.name}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({p.user_name || 'Mốc'})</span>
              <button
                type="button"
                onClick={() => void removePlace(p.id)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, marginLeft: '2px', display: 'flex', alignItems: 'center' }}
                title="Xóa mốc"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* BẢN ĐỒ LEAFLET MINI */}
      <div
        style={{
          width: '100%',
          height: '200px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          position: 'relative',
          background: 'var(--bg-secondary, #1e293b)',
        }}
      >
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Nút chỉ đường nhanh trực tiếp trên bản đồ */}
        {partnerLocation && (
          <button
            type="button"
            onClick={openGoogleMapsDirections}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: Z.overlay,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
            }}
          >
            <Navigation size={12} /> Chỉ đường
          </button>
        )}
      </div>

      {/* THÔNG TIN CHI TIẾT ĐỐI PHƯƠNG */}
      {partnerLocation ? (
        <div
          style={{
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            borderRadius: '12px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#f43f5e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.9rem',
                flexShrink: 0,
              }}
            >
              {partnerLocation.user_name ? partnerLocation.user_name.charAt(0).toUpperCase() : 'Ý'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {partnerLocation.user_name || partnerUserName}
                {partnerLocation.current_place && (
                  <span style={{ fontSize: '0.72rem', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                    Ở {partnerLocation.current_place}
                  </span>
                )}
                {partnerLocation.battery_level !== undefined && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: partnerLocation.battery_level <= 20 ? '#ef4444' : '#10b981',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    {partnerLocation.is_charging ? <BatteryCharging size={12} /> : <Battery size={12} />}
                    {partnerLocation.battery_level}%
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '220px',
                }}
                title={partnerLocation.address_name}
              >
                📍 {partnerLocation.address_name || 'Đang xác định địa chỉ…'}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {formatLastSeen(partnerLocation.updated_at)}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          {isSharing ? 'Đang chờ đối phương mở app để đồng bộ vị trí…' : 'Bật chia sẻ vị trí để bắt đầu kết nối đôi lứa'}
        </div>
      )}

      {/* LỊCH TRÌNH VỊ TRÍ & QUÃNG ĐƯỜNG TRONG NGÀY (TIMELINE) */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
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
            padding: '4px 0',
            color: 'var(--text-main)',
            fontSize: '0.8rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Route size={14} color="#0284c7" /> Lịch trình hành trình trong ngày ({timelineLogs.length})
          </span>
          {showTimeline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showTimeline && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {timelineLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
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
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      fontSize: '0.74rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.68rem',
                          padding: '1px 5px',
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.7rem', flexShrink: 0 }}>
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

      {/* MODAL LƯU VỊ TRÍ HIỆN TẠI LÀM MỐC (QUICK SELECT) */}
      {showAddPlaceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: Z.modal,
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

            {/* CÁC GỢI Ý NHANH: TRỌ / NHÀ / CÔNG TY */}
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

            {/* TÙY CHỌN TỰ NHẬP */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={customPlaceName}
                onChange={(e) => setCustomPlaceName(e.target.value)}
                placeholder="Tên địa điểm khác (VD: Trường, Quán quen…)"
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
