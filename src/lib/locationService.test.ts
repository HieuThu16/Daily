import { describe, it, expect } from 'vitest';
import { calculateDistanceKm, formatDistance, findMatchingSavedPlace } from './locationService';
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
