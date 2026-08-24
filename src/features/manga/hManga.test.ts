import { describe, expect, it, beforeEach } from 'vitest';
import { isUserAuthorizedForH } from '../../lib/hAuth';
import { 
  getHMangaFavorites, toggleHMangaFavorite,
  getHMangaFollows, toggleHMangaFollow,
  saveHMangaProgress, getHMangaProgress
} from './hMangaService';

describe('isUserAuthorizedForH', () => {
  it('cho phép tài khoản truongnguyenminhhieu100 và nguyenkimy', () => {
    expect(isUserAuthorizedForH({ email: 'truongnguyenminhhieu100@gmail.com' })).toBe(true);
    expect(isUserAuthorizedForH({ user_metadata: { email: 'truongnguyenminhhieu100@domain.com' } })).toBe(true);
    expect(isUserAuthorizedForH({ user_metadata: { user_name: 'truongnguyenminhhieu100' } })).toBe(true);
    expect(isUserAuthorizedForH({ email: 'nguyenkimy1302.gr@gmail.com' })).toBe(true);
    expect(isUserAuthorizedForH({ user_metadata: { user_name: 'nguyenkimy' } })).toBe(true);
  });

  it('chặn các tài khoản khác hoặc null', () => {
    expect(isUserAuthorizedForH(null)).toBe(false);
    expect(isUserAuthorizedForH(undefined)).toBe(false);
    expect(isUserAuthorizedForH({ email: 'otheruser@gmail.com' })).toBe(false);
  });
});

describe('hMangaService localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('quản lý danh sách yêu thích', () => {
    expect(getHMangaFavorites()).toEqual([]);
    const added = toggleHMangaFavorite('mot-buoc-len-may');
    expect(added).toBe(true);
    expect(getHMangaFavorites()).toEqual(['mot-buoc-len-may']);
    const removed = toggleHMangaFavorite('mot-buoc-len-may');
    expect(removed).toBe(false);
    expect(getHMangaFavorites()).toEqual([]);
  });

  it('quản lý theo dõi truyện', () => {
    expect(getHMangaFollows()).toEqual([]);
    const added = toggleHMangaFollow('mot-buoc-len-may');
    expect(added).toBe(true);
    expect(getHMangaFollows()).toEqual(['mot-buoc-len-may']);
  });

  it('lưu và đọc tiến độ đọc truyện', () => {
    expect(getHMangaProgress('mot-buoc-len-may')).toBeUndefined();
    saveHMangaProgress('mot-buoc-len-may', {
      chapterNumber: 5,
      chapterName: 'Chapter 5'
    });
    const progress = getHMangaProgress('mot-buoc-len-may');
    expect(progress).toBeDefined();
    expect(progress?.chapterNumber).toBe(5);
    expect(progress?.chapterName).toBe('Chapter 5');
  });
});

describe('HPinGate session lock and unlock', () => {
  it('quản lý trạng thái mở khóa trong sessionStorage', async () => {
    const { isHUnlocked, unlockH, lockH } = await import('./HPinGate');
    sessionStorage.clear();
    expect(isHUnlocked()).toBe(false);
    unlockH();
    expect(isHUnlocked()).toBe(true);
    lockH();
    expect(isHUnlocked()).toBe(false);
  });
});

