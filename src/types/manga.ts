export interface MangaImage {
  url: string;
  alt?: string;
  index: number;
}

export interface MangaChapter {
  number: number | null;
  name: string;
  title?: string;
  url: string;
  images?: MangaImage[];
  imageCount?: number;
}

export interface BLManga {
  slug: string;
  title: string;
  cover: string | null;
  description: string;
  genres: string[];
  url: string;
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

