import { describe, expect, it } from 'vitest'
import { answerLines, categoryStats, cleanLessonText, filterKnowledge, lessonRows, normalizeCategory, parseLessonText } from './knowledge'
import type { KnowledgeItem } from '../../types'

const items: KnowledgeItem[] = [
  { id: '1', question: 'Closure là gì?', answer: 'Hàm nhớ scope ngoài', category: 'JavaScript' },
  { id: '2', question: 'Index giúp gì?', answer: 'Tăng tốc truy vấn', category: 'Database' },
]

describe('normalizeCategory', () => {
  it('gộp khoảng trắng và giữ nội dung', () => {
    expect(normalizeCategory('  Lập   trình ')).toBe('Lập trình')
  })
  it('rỗng thì về Chung', () => {
    expect(normalizeCategory('   ')).toBe('Chung')
  })
})

describe('categoryStats', () => {
  it('đếm số thẻ mỗi thể loại và sắp theo tên', () => {
    const more = [...items, { id: '3', question: 'Q', answer: 'A', category: 'Database' }]
    expect(categoryStats(more)).toEqual([
      { name: 'Database', count: 2 },
      { name: 'JavaScript', count: 1 },
    ])
  })
  it('danh sách rỗng thì không có thể loại nào', () => {
    expect(categoryStats([])).toEqual([])
  })
})

describe('filterKnowledge', () => {
  it('không lọc gì thì trả hết', () => {
    expect(filterKnowledge(items, null, '')).toHaveLength(2)
  })
  it('lọc theo thể loại', () => {
    expect(filterKnowledge(items, 'Database', '').map((i) => i.id)).toEqual(['2'])
  })
  it('tìm trong cả câu hỏi và câu trả lời, bỏ qua hoa thường', () => {
    expect(filterKnowledge(items, null, 'TRUY VẤN').map((i) => i.id)).toEqual(['2'])
    expect(filterKnowledge(items, null, 'closure').map((i) => i.id)).toEqual(['1'])
  })
  it('thể loại và từ khoá cùng lúc', () => {
    expect(filterKnowledge(items, 'JavaScript', 'index')).toHaveLength(0)
  })
})

describe('answerLines', () => {
  it('tách nhiều câu trả lời theo dòng, bỏ dòng trống', () => {
    expect(answerLines('A' + String.fromCharCode(10) + '  ' + String.fromCharCode(10) + ' B ')).toEqual(['A', 'B'])
  })
})

describe('lessonRows', () => {
  it('gộp danh sách câu trả lời thành một thẻ, bỏ câu hỏi rỗng', () => {
    expect(
      lessonRows([{ question: ' Hỏi 1 ', answers: ['Đáp 1', ' ', 'Đáp 2'] }, { question: '  ', answers: ['x'] }], 'Lịch sử'),
    ).toEqual([{ question: 'Hỏi 1', answer: 'Đáp 1' + String.fromCharCode(10) + 'Đáp 2', category: 'Lịch sử' }])
  })

  it('không có thể loại thì mặc định Chung', () => {
    expect(lessonRows([{ question: 'a', answers: [] }], '')).toEqual([{ question: 'a', answer: '', category: 'Chung' }])
  })

  it('gắn source_video_id nếu có truyền', () => {
    expect(lessonRows([{ question: 'Bài học 1', answers: ['Ý 1'] }], 'Kinh doanh', 'dQw4w9WgXcQ')).toEqual([
      { question: 'Bài học 1', answer: 'Ý 1', category: 'Kinh doanh', source_video_id: 'dQw4w9WgXcQ' },
    ])
  })
})

describe('cleanLessonText', () => {
  it('loại bỏ trích dẫn dạng ngoặc vuông [1, 2], [2-4]', () => {
    expect(cleanLessonText('phải duy trì sự hiện diện [1, 2].')).toBe('phải duy trì sự hiện diện.')
    expect(cleanLessonText('vượt qua các môn học trở nên dễ dàng hơn [2-4].')).toBe(
      'vượt qua các môn học trở nên dễ dàng hơn.',
    )
  })

  it('loại bỏ số footnote sao chép từ mobile NotebookLM (ví dụ: 1 2 . 1 2 hoặc . 3 4)', () => {
    expect(cleanLessonText('phải duy trì sự hiện diện 1 2 . 1 2')).toBe('phải duy trì sự hiện diện.')
    expect(cleanLessonText('dễ dàng hơn. 3 4')).toBe('dễ dàng hơn.')
    expect(cleanLessonText('tài liệu ôn thi. 5')).toBe('tài liệu ôn thi.')
  })

  it('loại bỏ in đậm markdown và chuẩn hoá khoảng trắng', () => {
    expect(cleanLessonText('**Xây dựng thói quen tốt:** Dù không hiểu bài')).toBe(
      'Xây dựng thói quen tốt: Dù không hiểu bài',
    )
  })
})

describe('parseLessonText', () => {
  const bommanMarkdown = `Dựa trên những chia sẻ của Bomman về hành trình 6 năm tại Đại học Bách Khoa, video mang lại nhiều bài học thực tế về học tập, sự nghiệp và thái độ sống như sau:

### 1. Sự kiên trì và kỷ luật từ những việc nhỏ nhất
Bomman chia sẻ rằng ngay cả khi rơi vào tình trạng trượt môn hàng loạt và mất phương hướng, điều quan trọng nhất là **không được bỏ cuộc và phải duy trì sự hiện diện** [1, 2]. 
*   **Xây dựng thói quen tốt:** Dù không hiểu bài, việc "loi choi" đi học đầy đủ giúp tạo thành một thói quen tốt, giúp tinh thần đi lên và việc vượt qua các môn học trở nên dễ dàng hơn [2-4].
*   **Sức mạnh của cộng đồng:** Việc đến trường giúp mở rộng các mối quan hệ, từ đó tìm được những nhóm bạn hỗ trợ nhau làm bài tập lớn và chia sẻ tài liệu ôn thi [2, 4, 5].

### 2. Ý nghĩa thực sự của giáo dục đại học
Bomman nhấn mạnh rằng kiến thức hàn lâm có thể không được sử dụng hết sau khi ra trường, nhưng môi trường đại học dạy cho sinh viên **nền tảng và bài học làm người** [6, 7].
*   Đại học dạy cách **tư duy, cấu trúc cuộc sống** và khả năng chịu áp lực [6, 7].
*   Những người thầy khó tính, khắt khe đôi khi lại là những người mong muốn sinh viên tiến bộ nhất và thường có xu hướng hỗ trợ điểm số cho những sinh viên nỗ lực vào phút cuối [8-11].

### 3. Đừng chọn ngành chỉ dựa trên "ánh hào quang" ảo mộng
Nhiều sinh viên chọn ngành do ảnh hưởng của phim ảnh mà không hiểu bản chất công việc [12-14]. 
*   Bomman thừa nhận mình chọn ngành Công nghệ thông tin vì xem phim thấy hacker "ngầu", nhưng thực tế ông rất ghét lập trình và gặp khó khăn với môn Toán [12-14].
*   **Bài học:** Cần tìm hiểu kỹ năng lực và sở thích thực sự của bản thân thay vì chạy theo những hình mẫu chuyên nghiệp trên màn ảnh [12, 15].

### 4. Bằng cấp là nền tảng, nhưng thực lực mới quyết định sự nghiệp
Bomman cho rằng bằng cấp là một tấm vé thông hành an toàn, nhưng khi đi làm, **năng lực thực tế và thái độ** mới là yếu tố then chốt [16, 17].
*   Nhà tuyển dụng sẽ đánh giá bạn qua kỹ năng cơ bản khi phỏng vấn và qua tính cách, chất lượng công việc trong quá trình thử việc [16].
*   Đừng quá lo lắng về bằng cấp vì đa số các công ty đều sẽ đào tạo lại nhân viên để phù hợp với công việc thực tế [17].

### 5. Tầm quan trọng của ngoại ngữ (Tiếng Anh)
Đây là điều mà Bomman cảm thấy hối tiếc nhất trong hành trình của mình [18].
*   Dù đã vượt qua môn tiếng Anh ở trường bằng những cách không chính thống, ông nhận ra rằng việc thiếu ngoại ngữ là một rào cản lớn khi ra nước ngoài hoặc muốn phát triển sự nghiệp sâu hơn [18, 19].
*   **Lời khuyên:** Hãy dành thời gian học tiếng Anh sớm để không bị "khóa miệng" và mất đi những cơ hội giao lưu, làm việc quốc tế [18, 20, 21].

### 6. Cách tạo ra niềm hứng khởi trong học tập và công việc
*   Để không cảm thấy chán nản, bạn cần phải **học cách làm tốt nó trước** [22, 23]. Khi bạn làm được bài hoặc giỏi một lĩnh vực nào đó, bạn sẽ thấy nó hay và có động lực hơn [23].
*   Làm công việc mình thực sự yêu thích sẽ giúp bạn duy trì sự bền bỉ lâu dài hơn là cố ép mình vào những thứ mình không thích [24-26].`

  it('phân tích đúng định dạng ghi chú markdown / NotebookLM đầy đủ 6 bài học', () => {
    const result = parseLessonText(bommanMarkdown)
    expect(result.entries).toHaveLength(6)

    expect(result.entries[0].question).toBe('1. Sự kiên trì và kỷ luật từ những việc nhỏ nhất')
    expect(result.entries[0].answers).toHaveLength(3)
    expect(result.entries[0].answers[0]).toBe(
      'Bomman chia sẻ rằng ngay cả khi rơi vào tình trạng trượt môn hàng loạt và mất phương hướng, điều quan trọng nhất là không được bỏ cuộc và phải duy trì sự hiện diện.',
    )
    expect(result.entries[0].answers[1]).toContain('Xây dựng thói quen tốt: Dù không hiểu bài')
    expect(result.entries[0].answers[1]).not.toContain('[2-4]')
    expect(result.entries[0].answers[2]).toContain('Sức mạnh của cộng đồng:')

    expect(result.entries[5].question).toBe('6. Cách tạo ra niềm hứng khởi trong học tập và công việc')
    expect(result.entries[5].answers).toHaveLength(2)
  })

  it('hỗ trợ tuỳ chọn stripQuestionNumbers để bỏ số thứ tự câu hỏi', () => {
    const result = parseLessonText(bommanMarkdown, { stripQuestionNumbers: true })
    expect(result.entries[0].question).toBe('Sự kiên trì và kỷ luật từ những việc nhỏ nhất')
  })

  it('phân tích định dạng sao chép thuần từ mobile (không có dấu #)', () => {
    const mobileRaw = `1. Sự kiên trì và kỷ luật từ những việc nhỏ nhất

Bomman chia sẻ rằng ngay cả khi rơi vào tình trạng trượt môn hàng loạt và mất phương hướng, điều quan trọng nhất là không được bỏ cuộc và phải duy trì sự hiện diện 1 2 . 1 2

• Xây dựng thói quen tốt: Dù không hiểu bài, việc "loi choi" đi học đầy đủ giúp tạo thành một thói quen tốt, giúp tinh thần đi lên và việc vượt qua các môn học trở nên dễ dàng hơn. 3 4
• Sức mạnh của cộng đồng: Việc đến trường giúp mở rộng các mối quan hệ, từ đó tìm được những nhóm bạn hỗ trợ nhau làm bài tập lớn và chia sẻ tài liệu ôn thi. 5

2. Ý nghĩa thực sự của giáo dục đại học

Bomman nhấn mạnh rằng kiến thức hàn lâm có thể không được sử dụng hết`

    const res = parseLessonText(mobileRaw)
    expect(res.entries.length).toBe(2)
    expect(res.entries[0].question).toBe('1. Sự kiên trì và kỷ luật từ những việc nhỏ nhất')
    expect(res.entries[0].answers).toHaveLength(3)
    expect(res.entries[0].answers[0]).toBe(
      'Bomman chia sẻ rằng ngay cả khi rơi vào tình trạng trượt môn hàng loạt và mất phương hướng, điều quan trọng nhất là không được bỏ cuộc và phải duy trì sự hiện diện.',
    )
    expect(res.entries[0].answers[1]).not.toContain('3 4')
    expect(res.entries[0].answers[2]).not.toContain(' 5')
  })

  it('phân tích văn bản tự do bất kỳ không có heading thành câu hỏi và các ý gạch đầu dòng', () => {
    const freeText = `Phương pháp Pomodoro
Tập trung làm việc 25 phút không ngắt quãng
Nghỉ ngắn 5 phút để tái tạo năng lượng
Sau 4 chu kỳ thì nghỉ dài 15 đến 30 phút`
    const res = parseLessonText(freeText)
    expect(res.entries).toHaveLength(1)
    expect(res.entries[0].question).toBe('Phương pháp Pomodoro')
    expect(res.entries[0].answers).toHaveLength(3)
    expect(res.entries[0].answers[0]).toBe('Tập trung làm việc 25 phút không ngắt quãng')
  })
})
