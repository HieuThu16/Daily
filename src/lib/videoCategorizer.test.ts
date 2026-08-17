import { describe, expect, it } from 'vitest'
import { detectVideoCategory, groupVideosByCategory } from './videoCategorizer'

describe('videoCategorizer', () => {
  describe('TV Show Categories', () => {
    it('nhận diện thể loại Học tập & Tri thức', () => {
      const cat1 = detectVideoCategory('Phương pháp học tập thông minh điểm cao', 'tvshow')
      expect(cat1.id).toBe('learning')

      const cat2 = detectVideoCategory('Tóm tắt sách 7 Thói Quen Của Người Thành Đạt', 'tvshow')
      expect(cat2.id).toBe('learning')

      const cat3 = detectVideoCategory('Bí quyết rèn luyện tư duy và ghi nhớ nhanh', 'tvshow')
      expect(cat3.id).toBe('learning')
    })

    it('nhận diện thể loại Tự tin & Bản lĩnh', () => {
      const cat1 = detectVideoCategory('Làm sao để luôn tự tin trước đám đông và mọi người', 'tvshow')
      expect(cat1.id).toBe('confidence')

      const cat2 = detectVideoCategory('Nghị lực sống và vượt qua nghịch cảnh thất bại', 'tvshow')
      expect(cat2.id).toBe('confidence')

      const cat3 = detectVideoCategory('Rèn luyện kỷ luật thép thay đổi cuộc đời', 'tvshow')
      expect(cat3.id).toBe('confidence')
    })

    it('nhận diện thể loại Giao tiếp & Ứng xử', () => {
      const cat1 = detectVideoCategory('Nghệ thuật giao tiếp ứng xử khéo léo để ai cũng quý', 'tvshow')
      expect(cat1.id).toBe('communication')

      const cat2 = detectVideoCategory('Kỹ năng thuyết trình tự tin và thuyết phục người nghe', 'tvshow')
      expect(cat2.id).toBe('communication')

      const cat3 = detectVideoCategory('Cách đàm phán và lắng nghe trong công việc', 'tvshow')
      expect(cat3.id).toBe('communication')
    })

    it('nhận diện thể loại Kinh doanh & Tài chính', () => {
      const cat1 = detectVideoCategory('Bí quyết quản lý tiền bạc và đầu tư tài chính thông minh', 'tvshow')
      expect(cat1.id).toBe('business')

      const cat2 = detectVideoCategory('Khởi nghiệp kinh doanh và làm giàu từ hai bàn tay trắng', 'tvshow')
      expect(cat2.id).toBe('business')
    })

    it('nhận diện thể loại Tâm lý & Cuộc sống', () => {
      const cat = detectVideoCategory('Chữa lành tâm lý và tìm lại bình an trong cuộc sống', 'tvshow')
      expect(cat.id).toBe('psychology')
    })
  })

  describe('Review Phim Categories', () => {
    it('nhận diện Phim Hành Động & Võ Thuật', () => {
      const cat1 = detectVideoCategory('Review Phim Sát Thủ John Wick Hành Động Cực Đỉnh', 'review')
      expect(cat1.id).toBe('action')

      const cat2 = detectVideoCategory('Tóm tắt phim Võ Thuật Kungfu Đỉnh Cao Báo Thù Băng Đảng', 'review')
      expect(cat2.id).toBe('action')
    })

    it('nhận diện Phim Hàn Quốc', () => {
      const cat1 = detectVideoCategory('Review Phim K-Drama Hàn Quốc: Chủ Tịch Giả Nghèo', 'review')
      expect(cat1.id).toBe('korea')

      const cat2 = detectVideoCategory('Tóm tắt phim điện ảnh xứ kim chi Hàn Quốc siêu cuốn', 'review')
      expect(cat2.id).toBe('korea')
    })

    it('nhận diện Phim Mỹ & Hollywood', () => {
      const cat1 = detectVideoCategory('Review Phim Siêu Anh Hùng Marvel Mỹ Avengers', 'review')
      expect(cat1.id).toBe('hollywood')

      const cat2 = detectVideoCategory('Tóm tắt bom tấn Hollywood Mỹ Batman Người Dơi', 'review')
      expect(cat2.id).toBe('hollywood')
    })

    it('nhận diện Phim Kinh Dị & Giật Gân', () => {
      const cat = detectVideoCategory('Review Phim Kinh Dị Ám Ảnh Ngôi Nhà Ma Bí Ẩn', 'review')
      expect(cat.id).toBe('horror')
    })

    it('nhận diện Phim Khoa Học Viễn Tưởng', () => {
      const cat = detectVideoCategory('Review Phim Khoa Học Viễn Tưởng Vũ Trụ và Du Hành Thời Gian', 'review')
      expect(cat.id).toBe('scifi')
    })

    it('nhận diện Phim Anime & Hoạt Hình', () => {
      const cat = detectVideoCategory('Review Phim Hoạt Hình Anime One Piece Vua Hải Tặc', 'review')
      expect(cat.id).toBe('anime')
    })
  })

  describe('groupVideosByCategory', () => {
    it('gom nhóm video chính xác và tính watched count', () => {
      const testVideos = [
        { video_id: 'v1', title: 'Học tập thông minh 1', thumbnail: 'thumb1' },
        { video_id: 'v2', title: 'Học tập thông minh 2', thumbnail: 'thumb2' },
        { video_id: 'v3', title: 'Tự tin trước đám đông', thumbnail: 'thumb3' },
        { video_id: 'v4', title: 'Nghệ thuật giao tiếp ứng xử', thumbnail: 'thumb4' },
      ]

      const watchedSet = new Set(['v1', 'v3'])
      const groups = groupVideosByCategory(testVideos, 'tvshow', watchedSet)

      const learningGroup = groups.find((g) => g.category.id === 'learning')
      expect(learningGroup).toBeDefined()
      expect(learningGroup?.totalCount).toBe(2)
      expect(learningGroup?.watchedCount).toBe(1)
      expect(learningGroup?.cover).toBe('thumb1')

      const confGroup = groups.find((g) => g.category.id === 'confidence')
      expect(confGroup).toBeDefined()
      expect(confGroup?.totalCount).toBe(1)
      expect(confGroup?.watchedCount).toBe(1)
    })
  })
})
