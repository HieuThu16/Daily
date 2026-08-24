import { describe, it, expect } from 'vitest';
import { calculateDistanceKm, formatDistance, findMatchingSavedPlace, cleanTimelineLogs } from './locationService';
import type { SavedPlace } from '../types/location';

describe('locationService', () => {
  it('tính khoảng cách 0km khi cùng tọa độ', () => {
    const d = calculateDistanceKm(10.7769, 106.7009, 10.7769, 106.7009);
    expect(d).toBe(0);
  });

  it('tính khoảng cách giữa 2 tọa độ cách nhau', () => {
    // Quận 1 (10.7769, 106.7009) -> Landmark 81 (10.7950, 106.7219) ~ 3.1 km
    const d = calculateDistanceKm(10.7769, 106.7009, 10.7950, 106.7219);
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(5);
  });

  it('format khoảng cách thân thiện', () => {
    expect(formatDistance(0.02)).toBe('Đang ở cạnh nhau (< 50m)');
    expect(formatDistance(0.5)).toBe('Cách nhau 500m');
    expect(formatDistance(3.42)).toBe('Cách nhau 3.4 km');
  });

  it('nhận diện địa điểm khi trong bán kính 200m và phát hiện khi đi xa > 200m', () => {
    const places: SavedPlace[] = [
      {
        id: 'place-1',
        user_id: 'user-hieu',
        name: 'Trọ',
        icon: '🏠',
        latitude: 10.8000,
        longitude: 106.7000,
        radius_meters: 200,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'place-2',
        user_id: 'user-y',
        name: 'Nhà',
        icon: '🏡',
        latitude: 10.7500,
        longitude: 106.6500,
        radius_meters: 200,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Tại Trọ (~50m)
    const matched = findMatchingSavedPlace(10.8003, 106.7003, places);
    expect(matched).not.toBeNull();
    expect(matched?.name).toBe('Trọ');

    // Đi xa 500m khỏi Trọ
    const out = findMatchingSavedPlace(10.8050, 106.7050, places);
    expect(out).toBeNull();
  });
});

describe('findMatchingSavedPlace - mốc lồng nhau', () => {
  const places: any[] = [
    { id: 'tinh', place_name: 'Tỉnh Cà Mau', latitude: 9.18, longitude: 105.15, radius_meters: 30000 },
    { id: 'nha', place_name: 'Nhà', latitude: 9.181, longitude: 105.151, radius_meters: 200 },
  ];

  it('chọn mốc cụ thể nhất chứ không phải mốc liệt kê trước', () => {
    expect(findMatchingSavedPlace(9.1811, 105.1511, places)?.id).toBe('nha');
  });

  it('ra ngoài mốc nhỏ thì mới rơi về mốc vùng rộng', () => {
    expect(findMatchingSavedPlace(9.30, 105.25, places)?.id).toBe('tinh');
  });
});

describe('cleanTimelineLogs - dọn lịch trình rối', () => {
  const base = { user_id: 'u1', user_name: 'Hiếu', log_date: '2026-08-24', latitude: 0, longitude: 0 };

  it('bỏ mốc vùng rộng khi trùng giờ với mốc cụ thể của cùng người', () => {
    const out = cleanTimelineLogs([
      { ...base, id: '1', place_name: 'Ở Nhà', event_type: 'STAY', start_time: '10:20', end_time: '10:41' },
      { ...base, id: '2', place_name: 'Ở Tỉnh Cà Mau', event_type: 'STAY', start_time: '10:20', end_time: '10:41' },
    ] as any);
    expect(out.map((l) => l.place_name)).toEqual(['Ở Nhà']);
  });

  it('giữ mốc vùng rộng nếu không có mốc cụ thể nào trùng giờ', () => {
    const out = cleanTimelineLogs([
      { ...base, id: '1', place_name: 'Ở Tỉnh Cà Mau', event_type: 'STAY', start_time: '10:20', end_time: '10:41' },
    ] as any);
    expect(out).toHaveLength(1);
  });

  it('bỏ chặng "Đi từ X" dở dang không đi được mét nào', () => {
    const out = cleanTimelineLogs([
      { ...base, id: '1', place_name: 'Đi từ Nhà', event_type: 'MOVE', start_time: '10:22', end_time: '10:22', distance_km: 0 },
      { ...base, id: '2', place_name: 'Đi từ Nhà đến Trọ', event_type: 'MOVE', start_time: '10:30', end_time: '11:00', distance_km: 8 },
    ] as any);
    expect(out.map((l) => l.place_name)).toEqual(['Đi từ Nhà đến Trọ']);
  });

  it('mốc của hai người khác nhau không xoá lẫn nhau', () => {
    const out = cleanTimelineLogs([
      { ...base, id: '1', place_name: 'Ở Nhà', event_type: 'STAY', start_time: '10:20', end_time: '10:41' },
      { ...base, id: '2', user_name: 'Kim Ý', place_name: 'Ở Tỉnh Cà Mau', event_type: 'STAY', start_time: '10:20', end_time: '10:41' },
    ] as any);
    expect(out).toHaveLength(2);
  });
});
