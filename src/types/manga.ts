export interface MangaImage {
  url: string;
  alt?: string;
  index?: number;
}

export type ChapterImage = string | MangaImage;

export interface MangaChapter {
  number: number | null;
  name: string;
  title?: string;
  url: string;
  images?: ChapterImage[];
  imageCount?: number;
  /** Id chương trên MangaDex, dùng để lấy ảnh khi đọc. */
  chapterId?: string;
}

export interface BLManga {
  slug: string;
  title: string;
  cover: string | null;
  description: string;
  genres: string[];
  url: string;
  author?: string;
  artist?: string;
  status?: string;
  type?: string;
  source?: 'dualeo' | 'teamsany' | 'nettruyen' | string;
  sourceName?: string;
  chapters: MangaChapter[];
  totalChapters: number;
  updatedAt?: string;
  isHot?: boolean;
  hotRank?: number | null;
  topDayRank?: number | null;
  topWeekRank?: number | null;
  topMonthRank?: number | null;
}

export interface HotMangaItem {
  rank: number;
  slug: string;
  title: string;
  cover: string | null;
  url: string;
  views?: string;
  latestChapter?: string;
}

export interface HotMangaData {
  updatedAt: string;
  hot: HotMangaItem[];
  top_day: HotMangaItem[];
  top_week: HotMangaItem[];
  top_month: HotMangaItem[];
}

export interface ReadingProgress {
  slug: string;
  chapterNumber: number;
  chapterName: string;
  readAt: string;
  totalImages?: number;
}

export interface NgontinhManga {
  slug: string;
  /** Id MangaDex, chỉ có với truyện nguồn mangadex. */
  id?: string;
  source?: string;
  title: string;
  cover: string | null;
  description: string;
  genres: string[];
  url: string;
  author?: string;
  status?: string;
  views?: string;
  chapters: MangaChapter[];
  totalChapters: number;
  updatedAt?: string;
  latestChapter?: string;
  isHot?: boolean;
  hotRank?: number | null;
  topDayRank?: number | null;
  topWeekRank?: number | null;
  topMonthRank?: number | null;
}

