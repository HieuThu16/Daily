export interface SubtitleCue {
  id: string
  start: number // Giây bắt đầu
  end: number // Giây kết thúc
  text: string
  translation?: string
  vi?: string // Bản dịch tiếng Việt
  pinyin?: string // Pinyin cho tiếng Trung
}

export interface VideoCategoryItem {
  id: string
  label: string
  icon?: string
}

export interface VideoLesson {
  id: string
  videoId: string
  title: string
  titleVi: string
  lang: 'en' | 'zh'
  language?: 'en' | 'zh'
  category: string
  duration: string
  level: 'Cơ bản' | 'Trung cấp' | 'Nâng cao'
  channel: string
  isOfficial?: boolean
  cues: SubtitleCue[]
}

export const VIDEO_CATEGORIES: VideoCategoryItem[] = [
  { id: 'ALL', label: 'Tất cả', icon: '🌟' },
  { id: '🎤 Thuyết trình & TED', label: 'Thuyết trình & TED', icon: '🎤' },
  { id: '🎬 Phim ảnh & Sitcom', label: 'Phim ảnh & Sitcom', icon: '🎬' },
  { id: '🗣️ Giao tiếp đời sống', label: 'Giao tiếp đời sống', icon: '🗣️' },
  { id: '💼 Công việc & Phỏng vấn', label: 'Công việc & Phỏng vấn', icon: '💼' },
  { id: '✈️ Du lịch & Khách sạn', label: 'Du lịch & Khách sạn', icon: '✈️' },
  { id: '🍜 Ăn uống & Mua sắm', label: 'Ăn uống & Mua sắm', icon: '🍜' },
  { id: '📚 Luyện thi HSK', label: 'Luyện thi HSK', icon: '📚' },
  { id: '🏮 Văn hóa & Đời sống', label: 'Văn hóa & Đời sống', icon: '🏮' },
]

export const VIDEO_LESSONS_DATABASE: VideoLesson[] = [
  {
    "id": "vid-8KkKuTCFvzI",
    "videoId": "8KkKuTCFvzI",
    "title": "What Makes a Good Life? Lessons from the Longest Study on Happiness",
    "titleVi": "Điều gì tạo nên một cuộc đời tốt đẹp? Bài học từ nghiên cứu dài nhất về hạnh phúc",
    "lang": "en",
    "language": "en",
    "category": "🎤 Thuyết trình & TED",
    "duration": "12:45",
    "level": "Trung cấp",
    "channel": "TED",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.2,
        "text": "What keeps us healthy and happy as we go through life?",
        "vi": "Điều gì giữ cho chúng ta khỏe mạnh và hạnh phúc trong suốt cuộc đời?",
        "translation": "Điều gì giữ cho chúng ta khỏe mạnh và hạnh phúc trong suốt cuộc đời?"
      },
      {
        "id": "c2",
        "start": 5.5,
        "end": 12.8,
        "text": "If you were going to invest now in your future best self, where would you put your time and your energy?",
        "vi": "Nếu bạn chuẩn bị đầu tư cho bản thân tốt nhất trong tương lai, bạn sẽ dành thời gian và năng lượng vào đâu?",
        "translation": "Nếu bạn chuẩn bị đầu tư cho bản thân tốt nhất trong tương lai, bạn sẽ dành thời gian và năng lượng vào đâu?"
      },
      {
        "id": "c3",
        "start": 13.2,
        "end": 20,
        "text": "There was a recent survey of millennials asking them what their most important life goals were,",
        "vi": "Có một khảo sát gần đây hỏi thế hệ Millennials về mục tiêu quan trọng nhất trong cuộc sống của họ,",
        "translation": "Có một khảo sát gần đây hỏi thế hệ Millennials về mục tiêu quan trọng nhất trong cuộc sống của họ,"
      },
      {
        "id": "c4",
        "start": 20.4,
        "end": 27.1,
        "text": "and over 80 percent said that a major life goal for them was to get rich.",
        "vi": "và hơn 80% cho biết mục tiêu lớn của họ là trở nên giàu có.",
        "translation": "và hơn 80% cho biết mục tiêu lớn của họ là trở nên giàu có."
      },
      {
        "id": "c5",
        "start": 27.5,
        "end": 34.8,
        "text": "And another 50 percent of those same young adults said that another major life goal was to become famous.",
        "vi": "Và 50% khác trong số những người trẻ đó nói rằng mục tiêu lớn tiếp theo là trở nên nổi tiếng.",
        "translation": "Và 50% khác trong số những người trẻ đó nói rằng mục tiêu lớn tiếp theo là trở nên nổi tiếng."
      },
      {
        "id": "c6",
        "start": 35.2,
        "end": 41.8,
        "text": "And we're constantly told to lean in to work, to push harder and achieve more.",
        "vi": "Và chúng ta liên tục được dạy phải cống hiến hết mình cho công việc, nỗ lực hơn để đạt nhiều thành tựu hơn.",
        "translation": "Và chúng ta liên tục được dạy phải cống hiến hết mình cho công việc, nỗ lực hơn để đạt nhiều thành tựu hơn."
      },
      {
        "id": "c7",
        "start": 42.2,
        "end": 49.5,
        "text": "We're given the impression that these are the things that we need to go after in order to have a good life.",
        "vi": "Chúng ta bị ấn tượng rằng đây là những điều cần theo đuổi để có một cuộc sống tốt đẹp.",
        "translation": "Chúng ta bị ấn tượng rằng đây là những điều cần theo đuổi để có một cuộc sống tốt đẹp."
      },
      {
        "id": "c8",
        "start": 50,
        "end": 57.8,
        "text": "Pictures of entire lives, of the choices that people make and how those choices work out for them, are almost impossible to get.",
        "vi": "Bức tranh toàn cảnh về cuộc đời, những lựa chọn và kết quả của chúng gần như là điều bất khả thi để thu thập.",
        "translation": "Bức tranh toàn cảnh về cuộc đời, những lựa chọn và kết quả của chúng gần như là điều bất khả thi để thu thập."
      },
      {
        "id": "c9",
        "start": 58.2,
        "end": 66,
        "text": "Most of what we know about human life we know from asking people to remember the past.",
        "vi": "Hầu hết những gì chúng ta biết về đời người chỉ đến từ việc yêu cầu họ hồi tưởng lại quá khứ.",
        "translation": "Hầu hết những gì chúng ta biết về đời người chỉ đến từ việc yêu cầu họ hồi tưởng lại quá khứ."
      },
      {
        "id": "c10",
        "start": 66.5,
        "end": 74,
        "text": "And as we know, hindsight is anything but twenty-twenty. We forget vast amounts of what happens to us in life.",
        "vi": "Và như ta biết, trí nhớ hồi tưởng không bao giờ hoàn hảo. Ta quên đi phần lớn những gì đã xảy ra.",
        "translation": "Và như ta biết, trí nhớ hồi tưởng không bao giờ hoàn hảo. Ta quên đi phần lớn những gì đã xảy ra."
      },
      {
        "id": "c11",
        "start": 74.5,
        "end": 82.5,
        "text": "So what if we could watch entire lives as they unfold through time?",
        "vi": "Vậy điều gì sẽ xảy ra nếu chúng ta có thể quan sát trọn vẹn cuộc đời con người khi nó diễn ra theo thời gian?",
        "translation": "Vậy điều gì sẽ xảy ra nếu chúng ta có thể quan sát trọn vẹn cuộc đời con người khi nó diễn ra theo thời gian?"
      },
      {
        "id": "c12",
        "start": 83,
        "end": 91,
        "text": "What if we could study people from the time that they were teenagers all the way into old age to see what really keeps people happy and healthy?",
        "vi": "Nếu ta nghiên cứu con người từ tuổi thiếu niên đến tận tuổi già để xem điều gì thực sự giữ họ hạnh phúc và khỏe mạnh?",
        "translation": "Nếu ta nghiên cứu con người từ tuổi thiếu niên đến tận tuổi già để xem điều gì thực sự giữ họ hạnh phúc và khỏe mạnh?"
      },
      {
        "id": "c13",
        "start": 91.5,
        "end": 97,
        "text": "We did that. The Harvard Study of Adult Development may be the longest study of adult life that's ever been done.",
        "vi": "Chúng tôi đã làm điều đó. Nghiên cứu Phát triển Người trưởng thành của Harvard có thể là công trình dài nhất từng được thực hiện.",
        "translation": "Chúng tôi đã làm điều đó. Nghiên cứu Phát triển Người trưởng thành của Harvard có thể là công trình dài nhất từng được thực hiện."
      }
    ]
  },
  {
    "id": "vid-Y6bbMQXQ180",
    "videoId": "Y6bbMQXQ180",
    "title": "8 Secrets of Success",
    "titleVi": "8 bí quyết dẫn tới thành công",
    "lang": "en",
    "language": "en",
    "category": "🎤 Thuyết trình & TED",
    "duration": "3:30",
    "level": "Cơ bản",
    "channel": "TED",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.8,
        "text": "This is really a two-hour presentation I give to high school students, cut down to three minutes.",
        "vi": "Đây thực ra là bài thuyết trình dài 2 tiếng tôi dành cho học sinh, được cô đọng lại còn 3 phút.",
        "translation": "Đây thực ra là bài thuyết trình dài 2 tiếng tôi dành cho học sinh, được cô đọng lại còn 3 phút."
      },
      {
        "id": "c2",
        "start": 6.2,
        "end": 11.8,
        "text": "And it all started one day on a plane, on my way to TED, seven years ago.",
        "vi": "Và mọi thứ bắt đầu trên một chuyến bay đến TED 7 năm trước.",
        "translation": "Và mọi thứ bắt đầu trên một chuyến bay đến TED 7 năm trước."
      },
      {
        "id": "c3",
        "start": 12.2,
        "end": 18.8,
        "text": "In the seat next to me was a high school student, a teenager, and she came from a really poor family.",
        "vi": "Ngồi cạnh tôi là một cô bé học sinh cấp 3, đến từ một gia đình rất nghèo khó.",
        "translation": "Ngồi cạnh tôi là một cô bé học sinh cấp 3, đến từ một gia đình rất nghèo khó."
      },
      {
        "id": "c4",
        "start": 19.2,
        "end": 24.8,
        "text": "And she wanted to make something of her life, and she asked me a simple little question.",
        "vi": "Cô bé muốn làm nên điều gì đó cho cuộc đời mình, và hỏi tôi một câu hỏi giản dị.",
        "translation": "Cô bé muốn làm nên điều gì đó cho cuộc đời mình, và hỏi tôi một câu hỏi giản dị."
      },
      {
        "id": "c5",
        "start": 25.2,
        "end": 28.8,
        "text": "She said, 'What leads to success?'",
        "vi": "Cô bé hỏi: 'Điều gì dẫn tới thành công?'",
        "translation": "Cô bé hỏi: 'Điều gì dẫn tới thành công?'"
      },
      {
        "id": "c6",
        "start": 29.2,
        "end": 33.8,
        "text": "And I felt really badly, because I couldn't give her a good answer.",
        "vi": "Tôi cảm thấy rất áy náy vì không thể cho cô bé một câu trả lời thỏa đáng.",
        "translation": "Tôi cảm thấy rất áy náy vì không thể cho cô bé một câu trả lời thỏa đáng."
      },
      {
        "id": "c7",
        "start": 34.2,
        "end": 37.8,
        "text": "So I get off the plane, and I come to TED.",
        "vi": "Vì thế khi bước xuống máy bay và đến TED,",
        "translation": "Vì thế khi bước xuống máy bay và đến TED,"
      },
      {
        "id": "c8",
        "start": 38.2,
        "end": 43,
        "text": "And I think, jeez, I'm in the middle of a room of successful people!",
        "vi": "tôi nghĩ: trời đất ơi, mình đang ở giữa một khán phòng toàn những con người thành công!",
        "translation": "tôi nghĩ: trời đất ơi, mình đang ở giữa một khán phòng toàn những con người thành công!"
      },
      {
        "id": "c9",
        "start": 43.5,
        "end": 49,
        "text": "So why don't I ask them what helped them succeed, and pass it on to kids?",
        "vi": "Tại sao mình không hỏi xem điều gì giúp họ thành công rồi truyền lại cho các bạn trẻ?",
        "translation": "Tại sao mình không hỏi xem điều gì giúp họ thành công rồi truyền lại cho các bạn trẻ?"
      },
      {
        "id": "c10",
        "start": 49.5,
        "end": 57.5,
        "text": "So here we are, seven years, 500 interviews later, and I'm going to tell you what really leads to success.",
        "vi": "Và giờ đây, sau 7 năm và 500 cuộc phỏng vấn, tôi sẽ nói cho bạn biết điều gì thực sự tạo nên thành công.",
        "translation": "Và giờ đây, sau 7 năm và 500 cuộc phỏng vấn, tôi sẽ nói cho bạn biết điều gì thực sự tạo nên thành công."
      },
      {
        "id": "c11",
        "start": 58,
        "end": 64,
        "text": "The first thing is passion. Freeman Thomas says, 'I'm driven by my passion.'",
        "vi": "Điều đầu tiên là đam mê. Freeman Thomas nói: 'Tôi được thôi thúc bởi đam mê.'",
        "translation": "Điều đầu tiên là đam mê. Freeman Thomas nói: 'Tôi được thôi thúc bởi đam mê.'"
      },
      {
        "id": "c12",
        "start": 64.5,
        "end": 71,
        "text": "TED-sters do it for love; they don't do it for money.",
        "vi": "Những người ở TED làm vì tình yêu, họ không làm chỉ vì tiền.",
        "translation": "Những người ở TED làm vì tình yêu, họ không làm chỉ vì tiền."
      },
      {
        "id": "c13",
        "start": 71.5,
        "end": 78,
        "text": "The second thing is work. Rupert Murdoch told me, 'It's all hard work. Nothing comes easily.'",
        "vi": "Điều thứ hai là lao động chăm chỉ. Rupert Murdoch từng nói: 'Tất cả là sự chăm chỉ. Không có gì đến dễ dàng.'",
        "translation": "Điều thứ hai là lao động chăm chỉ. Rupert Murdoch từng nói: 'Tất cả là sự chăm chỉ. Không có gì đến dễ dàng.'"
      }
    ]
  },
  {
    "id": "vid-Ks-_Mh1QhMc",
    "videoId": "Ks-_Mh1QhMc",
    "title": "Your Body Language May Shape Who You Are",
    "titleVi": "Ngôn ngữ cơ thể định hình con người bạn",
    "lang": "en",
    "language": "en",
    "category": "🎤 Thuyết trình & TED",
    "duration": "21:00",
    "level": "Trung cấp",
    "channel": "TED",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5,
        "text": "So I want to start by offering you a free, no-tech life hack,",
        "vi": "Tôi muốn bắt đầu bằng cách trao cho bạn một bí quyết cuộc sống miễn phí, không cần công nghệ,",
        "translation": "Tôi muốn bắt đầu bằng cách trao cho bạn một bí quyết cuộc sống miễn phí, không cần công nghệ,"
      },
      {
        "id": "c2",
        "start": 5.4,
        "end": 11.5,
        "text": "and all it requires of you is this: that you change your posture for two minutes.",
        "vi": "và tất cả những gì bạn cần làm là: thay đổi tư thế trong vòng hai phút.",
        "translation": "và tất cả những gì bạn cần làm là: thay đổi tư thế trong vòng hai phút."
      },
      {
        "id": "c3",
        "start": 12,
        "end": 18.5,
        "text": "So before we begin, I want you to do a little audit of your body and what you're doing with your body.",
        "vi": "Trước khi bắt đầu, tôi muốn bạn tự kiểm tra cơ thể mình và tư thế bạn đang ngồi.",
        "translation": "Trước khi bắt đầu, tôi muốn bạn tự kiểm tra cơ thể mình và tư thế bạn đang ngồi."
      },
      {
        "id": "c4",
        "start": 19,
        "end": 23.8,
        "text": "So how many of you are sort of making yourselves smaller?",
        "vi": "Có bao nhiêu bạn đang vô thức thu nhỏ cơ thể mình lại?",
        "translation": "Có bao nhiêu bạn đang vô thức thu nhỏ cơ thể mình lại?"
      },
      {
        "id": "c5",
        "start": 24.2,
        "end": 29.5,
        "text": "Maybe you're crossing your legs, maybe wrapping your ankles,",
        "vi": "Có thể bạn đang bắt chéo chân, khép hai mắt cá chân lại,",
        "translation": "Có thể bạn đang bắt chéo chân, khép hai mắt cá chân lại,"
      },
      {
        "id": "c6",
        "start": 30,
        "end": 35,
        "text": "maybe you're holding your arms, maybe you're spreading out.",
        "vi": "hoặc đang khoanh tay, hay ngược lại là đang mở rộng cơ thể.",
        "translation": "hoặc đang khoanh tay, hay ngược lại là đang mở rộng cơ thể."
      },
      {
        "id": "c7",
        "start": 35.5,
        "end": 40,
        "text": "I want you to pay attention to what you're doing right now.",
        "vi": "Tôi muốn bạn chú ý đến những gì mình đang làm ngay lúc này.",
        "translation": "Tôi muốn bạn chú ý đến những gì mình đang làm ngay lúc này."
      },
      {
        "id": "c8",
        "start": 40.5,
        "end": 44.5,
        "text": "We're going to come back to that in a few minutes,",
        "vi": "Chúng ta sẽ quay trở lại với điều đó trong vài phút nữa,",
        "translation": "Chúng ta sẽ quay trở lại với điều đó trong vài phút nữa,"
      },
      {
        "id": "c9",
        "start": 45,
        "end": 52,
        "text": "and I'm hoping that if you learn to tweak this a little bit, it could significantly change the way your life unfolds.",
        "vi": "và tôi hi vọng nếu bạn học cách điều chỉnh một chút, nó có thể thay đổi đáng kể bước ngoặt cuộc đời bạn.",
        "translation": "và tôi hi vọng nếu bạn học cách điều chỉnh một chút, nó có thể thay đổi đáng kể bước ngoặt cuộc đời bạn."
      }
    ]
  },
  {
    "id": "vid-eVFzbxmKNUw",
    "videoId": "eVFzbxmKNUw",
    "title": "Steve Jobs' 2005 Stanford Commencement Address",
    "titleVi": "Bài diễn văn huyền thoại của Steve Jobs tại Đại học Stanford 2005",
    "lang": "en",
    "language": "en",
    "category": "🎤 Thuyết trình & TED",
    "duration": "15:04",
    "level": "Nâng cao",
    "channel": "Stanford",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 7.8,
        "text": "I am honored to be with you today at your commencement from one of the finest universities in the world.",
        "vi": "Tôi rất vinh dự được có mặt cùng các bạn hôm nay trong lễ tốt nghiệp tại một trong những trường đại học danh giá nhất thế giới.",
        "translation": "Tôi rất vinh dự được có mặt cùng các bạn hôm nay trong lễ tốt nghiệp tại một trong những trường đại học danh giá nhất thế giới."
      },
      {
        "id": "c2",
        "start": 8.2,
        "end": 10.8,
        "text": "I never graduated from college.",
        "vi": "Tôi chưa bao giờ tốt nghiệp đại học.",
        "translation": "Tôi chưa bao giờ tốt nghiệp đại học."
      },
      {
        "id": "c3",
        "start": 11.2,
        "end": 16,
        "text": "Truth be told, this is the closest I've ever gotten to a college graduation.",
        "vi": "Thành thật mà nói, đây là khoảnh khắc gần nhất tôi chạm tới một buổi lễ tốt nghiệp đại học.",
        "translation": "Thành thật mà nói, đây là khoảnh khắc gần nhất tôi chạm tới một buổi lễ tốt nghiệp đại học."
      },
      {
        "id": "c4",
        "start": 16.5,
        "end": 20.2,
        "text": "Today I want to tell you three stories from my life.",
        "vi": "Hôm nay tôi muốn kể cho các bạn nghe ba câu chuyện từ cuộc đời tôi.",
        "translation": "Hôm nay tôi muốn kể cho các bạn nghe ba câu chuyện từ cuộc đời tôi."
      },
      {
        "id": "c5",
        "start": 20.6,
        "end": 24.8,
        "text": "That's it. No big deal. Just three stories.",
        "vi": "Chỉ vậy thôi. Không có gì to tát. Chỉ ba câu chuyện.",
        "translation": "Chỉ vậy thôi. Không có gì to tát. Chỉ ba câu chuyện."
      },
      {
        "id": "c6",
        "start": 25.2,
        "end": 29.5,
        "text": "The first story is about connecting the dots.",
        "vi": "Câu chuyện đầu tiên là về việc kết nối những dấu chấm.",
        "translation": "Câu chuyện đầu tiên là về việc kết nối những dấu chấm."
      },
      {
        "id": "c7",
        "start": 30,
        "end": 39.5,
        "text": "I dropped out of Reed College after the first 6 months, but then stayed around as a drop-in for another 18 months or so before I really quit.",
        "vi": "Tôi bỏ học tại trường Reed sau 6 tháng đầu, nhưng vẫn nán lại dự thính thêm khoảng 18 tháng trước khi thực sự rời đi.",
        "translation": "Tôi bỏ học tại trường Reed sau 6 tháng đầu, nhưng vẫn nán lại dự thính thêm khoảng 18 tháng trước khi thực sự rời đi."
      },
      {
        "id": "c8",
        "start": 40,
        "end": 43.5,
        "text": "So why did I drop out?",
        "vi": "Vậy tại sao tôi lại bỏ học?",
        "translation": "Vậy tại sao tôi lại bỏ học?"
      },
      {
        "id": "c9",
        "start": 44,
        "end": 51.5,
        "text": "It started before I was born. My biological mother was a young, unwed college graduate student.",
        "vi": "Mọi chuyện bắt đầu từ trước khi tôi sinh ra. Mẹ ruột tôi là một nữ sinh viên tốt nghiệp trẻ tuổi, chưa lập gia đình.",
        "translation": "Mọi chuyện bắt đầu từ trước khi tôi sinh ra. Mẹ ruột tôi là một nữ sinh viên tốt nghiệp trẻ tuổi, chưa lập gia đình."
      },
      {
        "id": "c10",
        "start": 52,
        "end": 58,
        "text": "and she decided to put me up for adoption.",
        "vi": "và bà đã quyết định cho tôi làm con nuôi.",
        "translation": "và bà đã quyết định cho tôi làm con nuôi."
      }
    ]
  },
  {
    "id": "vid-eIho2S0ZahI",
    "videoId": "eIho2S0ZahI",
    "title": "How to Speak So That People Want to Listen",
    "titleVi": "Cách nói chuyện để người khác say sưa lắng nghe bạn",
    "lang": "en",
    "language": "en",
    "category": "🎤 Thuyết trình & TED",
    "duration": "9:58",
    "level": "Trung cấp",
    "channel": "TED",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "The human voice: It's the instrument we all play. It's the most powerful sound in the world, probably.",
        "vi": "Giọng nói con người: đó là nhạc cụ mà tất cả chúng ta đều chơi. Có lẽ đó là âm thanh quyền năng nhất trên thế giới.",
        "translation": "Giọng nói con người: đó là nhạc cụ mà tất cả chúng ta đều chơi. Có lẽ đó là âm thanh quyền năng nhất trên thế giới."
      },
      {
        "id": "c2",
        "start": 6,
        "end": 11.8,
        "text": "It's the only one that can start a war or say 'I love you.'",
        "vi": "Đó là thứ duy nhất có thể châm ngòi cho một cuộc chiến tranh hoặc cất lời 'Tôi yêu bạn.'",
        "translation": "Đó là thứ duy nhất có thể châm ngòi cho một cuộc chiến tranh hoặc cất lời 'Tôi yêu bạn.'"
      },
      {
        "id": "c3",
        "start": 12.2,
        "end": 18.5,
        "text": "And yet many people have the experience that when they speak, people don't listen to them.",
        "vi": "Tuy nhiên, nhiều người lại trải qua cảm giác khi họ cất tiếng nói, mọi người xung quanh chẳng hề lắng nghe.",
        "translation": "Tuy nhiên, nhiều người lại trải qua cảm giác khi họ cất tiếng nói, mọi người xung quanh chẳng hề lắng nghe."
      },
      {
        "id": "c4",
        "start": 19,
        "end": 21.8,
        "text": "And why is that? How can we speak powerfully to make change in the world?",
        "vi": "Tại sao lại như vậy? Làm sao để chúng ta nói một cách đầy sức hút và tạo ra sự thay đổi?",
        "translation": "Tại sao lại như vậy? Làm sao để chúng ta nói một cách đầy sức hút và tạo ra sự thay đổi?"
      },
      {
        "id": "c5",
        "start": 22.2,
        "end": 27.5,
        "text": "I'd like to suggest that there are a number of habits that we need to move away from.",
        "vi": "Tôi muốn chỉ ra rằng có một vài thói quen xấu trong giao tiếp mà chúng ta cần từ bỏ.",
        "translation": "Tôi muốn chỉ ra rằng có một vài thói quen xấu trong giao tiếp mà chúng ta cần từ bỏ."
      },
      {
        "id": "c6",
        "start": 28,
        "end": 34,
        "text": "I've assembled for your pleasure the seven deadly sins of speaking.",
        "vi": "Tôi đã tổng hợp cho các bạn 7 'đại tội' trong cách nói chuyện.",
        "translation": "Tôi đã tổng hợp cho các bạn 7 'đại tội' trong cách nói chuyện."
      },
      {
        "id": "c7",
        "start": 34.5,
        "end": 41,
        "text": "First, gossip: speaking ill of somebody who's not present. Not a nice habit, and we know that the person gossiping five minutes later will be gossiping about us.",
        "vi": "Thứ nhất là buôn chuyện, nói xấu người vắng mặt. Chúng ta biết người đang ngồi nói xấu người khác thì 5 phút sau sẽ quay sang nói xấu chính mình.",
        "translation": "Thứ nhất là buôn chuyện, nói xấu người vắng mặt. Chúng ta biết người đang ngồi nói xấu người khác thì 5 phút sau sẽ quay sang nói xấu chính mình."
      }
    ]
  },
  {
    "id": "vid-H14bBuluwB8",
    "videoId": "H14bBuluwB8",
    "title": "The Skill of Self Confidence",
    "titleVi": "Kỹ năng tự tin vào chính bản thân",
    "lang": "en",
    "language": "en",
    "category": "🎤 Thuyết trình & TED",
    "duration": "13:20",
    "level": "Trung cấp",
    "channel": "TEDx",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "Self-confidence is the ability or the belief to believe in yourself, to accomplish any task,",
        "vi": "Sự tự tin là khả năng hay niềm tin vững chắc vào bản thân rằng mình có thể hoàn thành bất kỳ nhiệm vụ nào,",
        "translation": "Sự tự tin là khả năng hay niềm tin vững chắc vào bản thân rằng mình có thể hoàn thành bất kỳ nhiệm vụ nào,"
      },
      {
        "id": "c2",
        "start": 6,
        "end": 11.2,
        "text": "no matter the odds, no matter the difficulty, no matter the adversity.",
        "vi": "bất kể nghịch cảnh, bất kể độ khó và bất kể tỷ lệ thành công có mong manh đến đâu.",
        "translation": "bất kể nghịch cảnh, bất kể độ khó và bất kể tỷ lệ thành công có mong manh đến đâu."
      },
      {
        "id": "c3",
        "start": 11.8,
        "end": 17.5,
        "text": "The belief that you can accomplish it. How do you build self-confidence?",
        "vi": "Niềm tin rằng bạn có thể làm được. Vậy làm thế nào để xây dựng sự tự tin?",
        "translation": "Niềm tin rằng bạn có thể làm được. Vậy làm thế nào để xây dựng sự tự tin?"
      },
      {
        "id": "c4",
        "start": 18,
        "end": 23.5,
        "text": "The easiest way is repetition, repetition, repetition.",
        "vi": "Cách đơn giản và hiệu quả nhất là lặp lại, lặp lại và không ngừng lặp lại.",
        "translation": "Cách đơn giản và hiệu quả nhất là lặp lại, lặp lại và không ngừng lặp lại."
      },
      {
        "id": "c5",
        "start": 24,
        "end": 30.5,
        "text": "Do you practice your craft over and over until you cannot fail?",
        "vi": "Bạn có luyện tập kỹ năng của mình hàng nghìn lần cho tới khi không thể thất bại được nữa hay không?",
        "translation": "Bạn có luyện tập kỹ năng của mình hàng nghìn lần cho tới khi không thể thất bại được nữa hay không?"
      }
    ]
  },
  {
    "id": "vid-LpSDuDIaBGk",
    "videoId": "LpSDuDIaBGk",
    "title": "How to Learn Any Language in 6 Months",
    "titleVi": "Cách chinh phục bất kỳ ngôn ngữ nào chỉ trong 6 tháng",
    "lang": "en",
    "language": "en",
    "category": "🎤 Thuyết trình & TED",
    "duration": "18:25",
    "level": "Trung cấp",
    "channel": "TEDx",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.8,
        "text": "The question is: how can you speed up learning so that you can learn any language in 6 months?",
        "vi": "Câu hỏi đặt ra là: làm thế nào bạn có thể đẩy nhanh tốc độ học để chinh phục bất kỳ ngôn ngữ nào trong 6 tháng?",
        "translation": "Câu hỏi đặt ra là: làm thế nào bạn có thể đẩy nhanh tốc độ học để chinh phục bất kỳ ngôn ngữ nào trong 6 tháng?"
      },
      {
        "id": "c2",
        "start": 6.2,
        "end": 12.5,
        "text": "Principle number one: Focus on language content that is relevant to you.",
        "vi": "Nguyên tắc số 1: Hãy tập trung vào những nội dung ngôn ngữ thực sự liên quan và có ý nghĩa đối với bạn.",
        "translation": "Nguyên tắc số 1: Hãy tập trung vào những nội dung ngôn ngữ thực sự liên quan và có ý nghĩa đối với bạn."
      },
      {
        "id": "c3",
        "start": 13,
        "end": 18.5,
        "text": "Principle number two: Use your new language as a tool to communicate from day one.",
        "vi": "Nguyên tắc số 2: Hãy dùng ngôn ngữ mới như một công cụ giao tiếp ngay từ ngày đầu tiên.",
        "translation": "Nguyên tắc số 2: Hãy dùng ngôn ngữ mới như một công cụ giao tiếp ngay từ ngày đầu tiên."
      },
      {
        "id": "c4",
        "start": 19,
        "end": 25,
        "text": "When you first understand the message, you will unconsciously acquire the language.",
        "vi": "Khi bạn hiểu được thông điệp cốt lõi, bạn sẽ tiếp thu ngôn ngữ đó một cách vô thức tự nhiên.",
        "translation": "Khi bạn hiểu được thông điệp cốt lõi, bạn sẽ tiếp thu ngôn ngữ đó một cách vô thức tự nhiên."
      }
    ]
  },
  {
    "id": "vid-3JZ_D3ELwOQ",
    "videoId": "3JZ_D3ELwOQ",
    "title": "Learn English with Friends: Joey Tribbiani Funniest Moments",
    "titleVi": "Học tiếng Anh cùng Friends: Những khoảnh khắc hài hước nhất của Joey",
    "lang": "en",
    "language": "en",
    "category": "🎬 Phim ảnh & Sitcom",
    "duration": "14:20",
    "level": "Trung cấp",
    "channel": "Learn English With TV Series",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 3.5,
        "text": "How you doin'?",
        "vi": "Em dạo này thế nào? (Câu làm quen huyền thoại của Joey)",
        "translation": "Em dạo này thế nào? (Câu làm quen huyền thoại của Joey)"
      },
      {
        "id": "c2",
        "start": 4,
        "end": 8.5,
        "text": "I'm doing good baby, how you doing?",
        "vi": "Em khỏe lắm cưng, còn anh thì sao?",
        "translation": "Em khỏe lắm cưng, còn anh thì sao?"
      },
      {
        "id": "c3",
        "start": 9,
        "end": 13.5,
        "text": "Joey doesn't share food!",
        "vi": "Joey không bao giờ chia sẻ đồ ăn của mình!",
        "translation": "Joey không bao giờ chia sẻ đồ ăn của mình!"
      },
      {
        "id": "c4",
        "start": 14,
        "end": 18.5,
        "text": "What are you talking about? It's just a couple of french fries!",
        "vi": "Cậu nói gì vậy? Chỉ là vài cọng khoai tây chiên thôi mà!",
        "translation": "Cậu nói gì vậy? Chỉ là vài cọng khoai tây chiên thôi mà!"
      },
      {
        "id": "c5",
        "start": 19,
        "end": 24.5,
        "text": "It's not about the fries, it's about the principle!",
        "vi": "Không phải là chuyện khoai tây, đó là nguyên tắc sống!",
        "translation": "Không phải là chuyện khoai tây, đó là nguyên tắc sống!"
      },
      {
        "id": "c6",
        "start": 25,
        "end": 31,
        "text": "Look, I know what you're thinking, but hear me out before you judge.",
        "vi": "Này, tôi biết bạn đang nghĩ gì, nhưng hãy nghe tôi giải thích trước khi phán xét.",
        "translation": "Này, tôi biết bạn đang nghĩ gì, nhưng hãy nghe tôi giải thích trước khi phán xét."
      },
      {
        "id": "c7",
        "start": 31.5,
        "end": 37,
        "text": "Could I BE wearing any more clothes?",
        "vi": "Liệu tôi có thể mặc thêm bộ quần áo nào nữa không hả trời?",
        "translation": "Liệu tôi có thể mặc thêm bộ quần áo nào nữa không hả trời?"
      },
      {
        "id": "c8",
        "start": 37.5,
        "end": 43.5,
        "text": "Look at me! I'm Chandler! Could I BE any more Chandler?",
        "vi": "Nhìn tôi đây này! Tôi là Chandler! Trông tôi có giống Chandler hơn được nữa không?",
        "translation": "Nhìn tôi đây này! Tôi là Chandler! Trông tôi có giống Chandler hơn được nữa không?"
      }
    ]
  },
  {
    "id": "vid-_DvdlyQq5gI",
    "videoId": "_DvdlyQq5gI",
    "title": "Learn English with Friends: Monica and Chandler Romance",
    "titleVi": "Học tiếng Anh cùng Friends: Chuyện tình Monica & Chandler",
    "lang": "en",
    "language": "en",
    "category": "🎬 Phim ảnh & Sitcom",
    "duration": "16:10",
    "level": "Trung cấp",
    "channel": "Learn English With TV Series",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "They don't know that we know they know we know!",
        "vi": "Họ không biết là chúng ta biết họ biết chúng ta biết!",
        "translation": "Họ không biết là chúng ta biết họ biết chúng ta biết!"
      },
      {
        "id": "c2",
        "start": 6,
        "end": 10.5,
        "text": "Joey, you can't tell anyone, do you hear me?",
        "vi": "Joey, cậu tuyệt đối không được nói cho ai, nghe rõ chưa?",
        "translation": "Joey, cậu tuyệt đối không được nói cho ai, nghe rõ chưa?"
      },
      {
        "id": "c3",
        "start": 11,
        "end": 16,
        "text": "My eyes! My eyes! Phoebe, what did you see?",
        "vi": "Mắt tôi! Mắt tôi! Phoebe, cậu vừa nhìn thấy cái gì thế?",
        "translation": "Mắt tôi! Mắt tôi! Phoebe, cậu vừa nhìn thấy cái gì thế?"
      },
      {
        "id": "c4",
        "start": 16.5,
        "end": 22,
        "text": "Chandler and Monica! They're doing it right in front of the window!",
        "vi": "Chandler và Monica! Họ đang ôm nhau ngay trước cửa sổ kìa!",
        "translation": "Chandler và Monica! Họ đang ôm nhau ngay trước cửa sổ kìa!"
      },
      {
        "id": "c5",
        "start": 22.5,
        "end": 28.5,
        "text": "I thought that it was just going to be a casual thing in London.",
        "vi": "Tôi từng nghĩ chuyện đó ở London chỉ là một sự tình cờ thoáng qua.",
        "translation": "Tôi từng nghĩ chuyện đó ở London chỉ là một sự tình cờ thoáng qua."
      },
      {
        "id": "c6",
        "start": 29,
        "end": 35,
        "text": "But it turns out, I'm completely in love with you.",
        "vi": "Nhưng hóa ra, anh đã hoàn toàn yêu em mất rồi.",
        "translation": "Nhưng hóa ra, anh đã hoàn toàn yêu em mất rồi."
      }
    ]
  },
  {
    "id": "vid-EBb1BqLLiZ8",
    "videoId": "EBb1BqLLiZ8",
    "title": "Learn English with Harry Potter: Spells and Dialogue",
    "titleVi": "Học tiếng Anh cùng Harry Potter: Bùa chú & Hội thoại pháp thuật",
    "lang": "en",
    "language": "en",
    "category": "🎬 Phim ảnh & Sitcom",
    "duration": "18:40",
    "level": "Trung cấp",
    "channel": "Learn English With TV Series",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 4.5,
        "text": "It's Leviosa, not Leviosar!",
        "vi": "Phải đọc là Leviosa, chứ không phải Leviosar!",
        "translation": "Phải đọc là Leviosa, chứ không phải Leviosar!"
      },
      {
        "id": "c2",
        "start": 5,
        "end": 10,
        "text": "You're saying it wrong. Make the 'gar' nice and long.",
        "vi": "Cậu phát âm sai rồi. Phải lướt nhẹ và kéo dài âm đuôi ra.",
        "translation": "Cậu phát âm sai rồi. Phải lướt nhẹ và kéo dài âm đuôi ra."
      },
      {
        "id": "c3",
        "start": 10.5,
        "end": 15.5,
        "text": "You're a wizard, Harry! A what? A wizard!",
        "vi": "Cháu là một phù thủy đấy Harry! Cháu là gì cơ? Một phù thủy!",
        "translation": "Cháu là một phù thủy đấy Harry! Cháu là gì cơ? Một phù thủy!"
      },
      {
        "id": "c4",
        "start": 16,
        "end": 21.5,
        "text": "It takes a great deal of bravery to stand up to our enemies,",
        "vi": "Cần rất nhiều lòng dũng cảm để đứng lên đối đầu với kẻ thù,",
        "translation": "Cần rất nhiều lòng dũng cảm để đứng lên đối đầu với kẻ thù,"
      },
      {
        "id": "c5",
        "start": 22,
        "end": 28,
        "text": "but just as much to stand up to our friends.",
        "vi": "nhưng cũng cần nhiều lòng dũng cảm không kém để khuyên can bạn bè mình.",
        "translation": "nhưng cũng cần nhiều lòng dũng cảm không kém để khuyên can bạn bè mình."
      }
    ]
  },
  {
    "id": "vid-9fn_n-Lj24o",
    "videoId": "9fn_n-Lj24o",
    "title": "Friends: Phoebe Buffay's Most Iconic Quotes",
    "titleVi": "Friends: Những phát ngôn kinh điển nhất của Phoebe",
    "lang": "en",
    "language": "en",
    "category": "🎬 Phim ảnh & Sitcom",
    "duration": "12:30",
    "level": "Trung cấp",
    "channel": "Learn English With TV Series",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.2,
        "text": "I wish I could, but I don't want to.",
        "vi": "Tôi ước gì tôi có thể giúp, nhưng tôi lại không muốn.",
        "translation": "Tôi ước gì tôi có thể giúp, nhưng tôi lại không muốn."
      },
      {
        "id": "c2",
        "start": 5.8,
        "end": 10.5,
        "text": "Smelly cat, smelly cat, what are they feeding you?",
        "vi": "Mèo bốc mùi ơi, người ta đang cho mày ăn cái gì thế?",
        "translation": "Mèo bốc mùi ơi, người ta đang cho mày ăn cái gì thế?"
      },
      {
        "id": "c3",
        "start": 11,
        "end": 16.5,
        "text": "Smelly cat, smelly cat, it's not your fault!",
        "vi": "Mèo bốc mùi ơi, đó đâu phải lỗi của mày đâu!",
        "translation": "Mèo bốc mùi ơi, đó đâu phải lỗi của mày đâu!"
      },
      {
        "id": "c4",
        "start": 17,
        "end": 22.5,
        "text": "He's her lobster! See? Lobsters fall in love and mate for life.",
        "vi": "Anh ấy là con tôm hùm của cô ấy! Thấy chưa? Tôm hùm khi yêu sẽ gắn bó trọn đời.",
        "translation": "Anh ấy là con tôm hùm của cô ấy! Thấy chưa? Tôm hùm khi yêu sẽ gắn bó trọn đời."
      }
    ]
  },
  {
    "id": "vid-Y681hXWwhQY",
    "videoId": "Y681hXWwhQY",
    "title": "6 Minute English: Technology & Smartphone Addiction",
    "titleVi": "6 phút tiếng Anh: Công nghệ & Hội chứng nghiện điện thoại",
    "lang": "en",
    "language": "en",
    "category": "🗣️ Giao tiếp đời sống",
    "duration": "6:15",
    "level": "Cơ bản",
    "channel": "BBC Learning English",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5,
        "text": "Hello and welcome to 6 Minute English from BBC Learning English.",
        "vi": "Xin chào và chào mừng các bạn đến với chương trình 6 Minute English của BBC.",
        "translation": "Xin chào và chào mừng các bạn đến với chương trình 6 Minute English của BBC."
      },
      {
        "id": "c2",
        "start": 5.4,
        "end": 7.2,
        "text": "I'm Neil.",
        "vi": "Tôi là Neil.",
        "translation": "Tôi là Neil."
      },
      {
        "id": "c3",
        "start": 7.5,
        "end": 9.2,
        "text": "And I'm Sam.",
        "vi": "Và tôi là Sam.",
        "translation": "Và tôi là Sam."
      },
      {
        "id": "c4",
        "start": 9.6,
        "end": 15,
        "text": "In this programme, we're talking about smartphones and how much time we spend on them.",
        "vi": "Trong chương trình hôm nay, chúng ta sẽ nói về điện thoại thông minh và lượng thời gian ta dành cho chúng.",
        "translation": "Trong chương trình hôm nay, chúng ta sẽ nói về điện thoại thông minh và lượng thời gian ta dành cho chúng."
      },
      {
        "id": "c5",
        "start": 15.5,
        "end": 21,
        "text": "How many times do you think you check your phone every day, Sam?",
        "vi": "Sam này, bạn nghĩ mỗi ngày mình cầm điện thoại lên xem bao nhiêu lần?",
        "translation": "Sam này, bạn nghĩ mỗi ngày mình cầm điện thoại lên xem bao nhiêu lần?"
      },
      {
        "id": "c6",
        "start": 21.5,
        "end": 27.5,
        "text": "Oh, probably dozens of times! It's very easy to get distracted by notifications.",
        "vi": "Ồ, chắc hàng chục lần đấy! Rất dễ bị phân tâm bởi các thông báo liên tục.",
        "translation": "Ồ, chắc hàng chục lần đấy! Rất dễ bị phân tâm bởi các thông báo liên tục."
      },
      {
        "id": "c7",
        "start": 28,
        "end": 34.5,
        "text": "Indeed, and that brings us to our quiz question for today.",
        "vi": "Đúng vậy, và điều đó dẫn chúng ta đến câu đố kiến thức của ngày hôm nay.",
        "translation": "Đúng vậy, và điều đó dẫn chúng ta đến câu đố kiến thức của ngày hôm nay."
      },
      {
        "id": "c8",
        "start": 35,
        "end": 43,
        "text": "According to recent research, how many times does an average person check their smartphone in a day?",
        "vi": "Theo nghiên cứu gần đây, trung bình một người kiểm tra điện thoại thông minh bao nhiêu lần mỗi ngày?",
        "translation": "Theo nghiên cứu gần đây, trung bình một người kiểm tra điện thoại thông minh bao nhiêu lần mỗi ngày?"
      },
      {
        "id": "c9",
        "start": 43.5,
        "end": 50,
        "text": "Is it a) 58 times, b) 96 times, or c) 150 times?",
        "vi": "Là a) 58 lần, b) 96 lần, hay c) 150 lần?",
        "translation": "Là a) 58 lần, b) 96 lần, hay c) 150 lần?"
      }
    ]
  },
  {
    "id": "vid-vW2HKouGOPE",
    "videoId": "vW2HKouGOPE",
    "title": "6 Minute English: Healthy Eating and Superfoods",
    "titleVi": "6 phút tiếng Anh: Ăn uống lành mạnh & Siêu thực phẩm",
    "lang": "en",
    "language": "en",
    "category": "🗣️ Giao tiếp đời sống",
    "duration": "6:12",
    "level": "Cơ bản",
    "channel": "BBC Learning English",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 4.8,
        "text": "Hello and welcome to 6 Minute English with BBC Learning English.",
        "vi": "Xin chào và chào mừng bạn đến với 6 Minute English của BBC.",
        "translation": "Xin chào và chào mừng bạn đến với 6 Minute English của BBC."
      },
      {
        "id": "c2",
        "start": 5.2,
        "end": 9,
        "text": "I'm Neil, and joining me today is Georgina.",
        "vi": "Tôi là Neil, và người đồng hành cùng tôi hôm nay là Georgina.",
        "translation": "Tôi là Neil, và người đồng hành cùng tôi hôm nay là Georgina."
      },
      {
        "id": "c3",
        "start": 9.5,
        "end": 15.5,
        "text": "Today we're discussing healthy eating and whether so-called 'superfoods' really work.",
        "vi": "Hôm nay chúng ta sẽ thảo luận về chế độ ăn lành mạnh và liệu 'siêu thực phẩm' có thực sự tốt như lời đồn.",
        "translation": "Hôm nay chúng ta sẽ thảo luận về chế độ ăn lành mạnh và liệu 'siêu thực phẩm' có thực sự tốt như lời đồn."
      },
      {
        "id": "c4",
        "start": 16,
        "end": 22,
        "text": "Superfoods are foods that are believed to be especially good for your health.",
        "vi": "Siêu thực phẩm là những loại thức ăn được tin rằng đặc biệt bổ dưỡng cho sức khỏe.",
        "translation": "Siêu thực phẩm là những loại thức ăn được tin rằng đặc biệt bổ dưỡng cho sức khỏe."
      },
      {
        "id": "c5",
        "start": 22.5,
        "end": 28.5,
        "text": "Things like blueberries, kale, chia seeds, and avocado.",
        "vi": "Những món như quả việt quất, cải xoăn, hạt chia và quả bơ.",
        "translation": "Những món như quả việt quất, cải xoăn, hạt chia và quả bơ."
      },
      {
        "id": "c6",
        "start": 29,
        "end": 35,
        "text": "Let's look at the scientific evidence behind these nutritional claims.",
        "vi": "Hãy cùng tìm hiểu những bằng chứng khoa học đằng sau những tuyên bố dinh dưỡng này nhé.",
        "translation": "Hãy cùng tìm hiểu những bằng chứng khoa học đằng sau những tuyên bố dinh dưỡng này nhé."
      }
    ]
  },
  {
    "id": "vid-h_KUklZdq5w",
    "videoId": "h_KUklZdq5w",
    "title": "100 Common English Phrases for Daily Conversation",
    "titleVi": "100 câu đàm thoại tiếng Anh thông dụng hàng ngày",
    "lang": "en",
    "language": "en",
    "category": "🗣️ Giao tiếp đời sống",
    "duration": "22:15",
    "level": "Cơ bản",
    "channel": "EnglishClass101",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 4.5,
        "text": "Hi everyone! Welcome back to EnglishClass101.com.",
        "vi": "Xin chào mọi người! Chào mừng quay trở lại với EnglishClass101.",
        "translation": "Xin chào mọi người! Chào mừng quay trở lại với EnglishClass101."
      },
      {
        "id": "c2",
        "start": 5,
        "end": 10,
        "text": "Today we're going to practice essential English phrases for everyday situations.",
        "vi": "Hôm nay chúng ta sẽ luyện tập các cụm từ tiếng Anh thiết yếu trong đời sống thường ngày.",
        "translation": "Hôm nay chúng ta sẽ luyện tập các cụm từ tiếng Anh thiết yếu trong đời sống thường ngày."
      },
      {
        "id": "c3",
        "start": 10.5,
        "end": 14.5,
        "text": "Phrase number one: 'How's everything going?'",
        "vi": "Cụm từ số 1: 'Mọi việc dạo này thế nào rồi?'",
        "translation": "Cụm từ số 1: 'Mọi việc dạo này thế nào rồi?'"
      },
      {
        "id": "c4",
        "start": 15,
        "end": 19.5,
        "text": "You can reply: 'Pretty good, thanks! How about you?'",
        "vi": "Bạn có thể đáp: 'Khá tốt, cảm ơn bạn! Còn bạn thì sao?'",
        "translation": "Bạn có thể đáp: 'Khá tốt, cảm ơn bạn! Còn bạn thì sao?'"
      },
      {
        "id": "c5",
        "start": 20,
        "end": 24.5,
        "text": "Phrase number two: 'I really appreciate your help.'",
        "vi": "Cụm từ số 2: 'Tôi thực sự rất cảm kích sự giúp đỡ của bạn.'",
        "translation": "Cụm từ số 2: 'Tôi thực sự rất cảm kích sự giúp đỡ của bạn.'"
      },
      {
        "id": "c6",
        "start": 25,
        "end": 29.5,
        "text": "Phrase number three: 'Never mind, it doesn't matter.'",
        "vi": "Cụm từ số 3: 'Không sao đâu, chuyện nhỏ mà.'",
        "translation": "Cụm từ số 3: 'Không sao đâu, chuyện nhỏ mà.'"
      }
    ]
  },
  {
    "id": "vid-M380ySm1vOk",
    "videoId": "M380ySm1vOk",
    "title": "Daily Routine Conversation in English",
    "titleVi": "Hội thoại về thói quen sinh hoạt hàng ngày",
    "lang": "en",
    "language": "en",
    "category": "🗣️ Giao tiếp đời sống",
    "duration": "11:30",
    "level": "Cơ bản",
    "channel": "Oxford Online English",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "In this lesson, you can learn how to talk about your daily routine in English.",
        "vi": "Trong bài học này, bạn sẽ học cách nói về thói quen sinh hoạt mỗi ngày bằng tiếng Anh.",
        "translation": "Trong bài học này, bạn sẽ học cách nói về thói quen sinh hoạt mỗi ngày bằng tiếng Anh."
      },
      {
        "id": "c2",
        "start": 6,
        "end": 11.5,
        "text": "What do you do first thing in the morning when you wake up?",
        "vi": "Điều đầu tiên bạn làm vào buổi sáng khi thức dậy là gì?",
        "translation": "Điều đầu tiên bạn làm vào buổi sáng khi thức dậy là gì?"
      },
      {
        "id": "c3",
        "start": 12,
        "end": 17.5,
        "text": "I usually wake up around 6:30 AM, drink a glass of water, and stretch.",
        "vi": "Tôi thường thức dậy lúc 6:30 sáng, uống một ly nước và tập giãn cơ.",
        "translation": "Tôi thường thức dậy lúc 6:30 sáng, uống một ly nước và tập giãn cơ."
      },
      {
        "id": "c4",
        "start": 18,
        "end": 23.5,
        "text": "Then I take a quick shower, get dressed, and have breakfast with coffee.",
        "vi": "Sau đó tôi tắm nhanh, mặc quần áo và ăn sáng cùng một tách cà phê.",
        "translation": "Sau đó tôi tắm nhanh, mặc quần áo và ăn sáng cùng một tách cà phê."
      },
      {
        "id": "c5",
        "start": 24,
        "end": 29.5,
        "text": "I leave the house around 7:45 to catch the subway to work.",
        "vi": "Tôi rời khỏi nhà vào khoảng 7:45 để kịp đón tàu điện ngầm đi làm.",
        "translation": "Tôi rời khỏi nhà vào khoảng 7:45 để kịp đón tàu điện ngầm đi làm."
      }
    ]
  },
  {
    "id": "vid-LapsVemsa20",
    "videoId": "LapsVemsa20",
    "title": "Real English Conversation Practice: Small Talk",
    "titleVi": "Luyện giao tiếp tiếng Anh thực tế: Trò chuyện xã giao",
    "lang": "en",
    "language": "en",
    "category": "🗣️ Giao tiếp đời sống",
    "duration": "14:50",
    "level": "Trung cấp",
    "channel": "Rachel's English",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "Small talk is what you say when you run into someone at the elevator or office kitchen.",
        "vi": "Trò chuyện xã giao là những câu ngắn bạn nói khi tình cờ gặp ai đó ở thang máy hoặc phòng bếp văn phòng.",
        "translation": "Trò chuyện xã giao là những câu ngắn bạn nói khi tình cờ gặp ai đó ở thang máy hoặc phòng bếp văn phòng."
      },
      {
        "id": "c2",
        "start": 6,
        "end": 11.5,
        "text": "A great topic to start with is always the weather or the upcoming weekend.",
        "vi": "Một chủ đề mở đầu tuyệt vời luôn là thời tiết hoặc kế hoạch cuối tuần sắp tới.",
        "translation": "Một chủ đề mở đầu tuyệt vời luôn là thời tiết hoặc kế hoạch cuối tuần sắp tới."
      },
      {
        "id": "c3",
        "start": 12,
        "end": 17.5,
        "text": "'Crazy weather we're having today, isn't it?' 'Yeah, it poured all morning!'",
        "vi": "'Hôm nay thời tiết thất thường thật đấy nhỉ?' 'Đúng thế, trời mưa như trút nước suốt cả buổi sáng!'",
        "translation": "'Hôm nay thời tiết thất thường thật đấy nhỉ?' 'Đúng thế, trời mưa như trút nước suốt cả buổi sáng!'"
      },
      {
        "id": "c4",
        "start": 18,
        "end": 24,
        "text": "'Got any fun plans for the long weekend?' 'Just relaxing and catching up on sleep.'",
        "vi": "'Kỳ nghỉ lễ cuối tuần này có dự định gì vui không?' 'Mình chỉ ở nhà nghỉ ngơi và ngủ bù thôi.'",
        "translation": "'Kỳ nghỉ lễ cuối tuần này có dự định gì vui không?' 'Mình chỉ ở nhà nghỉ ngơi và ngủ bù thôi.'"
      }
    ]
  },
  {
    "id": "vid-fr-mwiyhZAo",
    "videoId": "fr-mwiyhZAo",
    "title": "Top 5 Job Interview Questions and Answers",
    "titleVi": "Top 5 câu hỏi phỏng vấn xin việc & Cách trả lời xuất sắc",
    "lang": "en",
    "language": "en",
    "category": "💼 Công việc & Phỏng vấn",
    "duration": "11:45",
    "level": "Trung cấp",
    "channel": "CareerVidz",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.2,
        "text": "In this video tutorial, I'm going to give you the top 5 job interview questions and high-scoring answers.",
        "vi": "Trong video này, tôi sẽ hướng dẫn bạn top 5 câu hỏi phỏng vấn phổ biến nhất cùng câu trả lời đạt điểm tối đa.",
        "translation": "Trong video này, tôi sẽ hướng dẫn bạn top 5 câu hỏi phỏng vấn phổ biến nhất cùng câu trả lời đạt điểm tối đa."
      },
      {
        "id": "c2",
        "start": 5.8,
        "end": 11.5,
        "text": "Question number one is always: 'Tell me about yourself.'",
        "vi": "Câu hỏi số một luôn là: 'Hãy giới thiệu đôi nét về bản thân bạn.'",
        "translation": "Câu hỏi số một luôn là: 'Hãy giới thiệu đôi nét về bản thân bạn.'"
      },
      {
        "id": "c3",
        "start": 12,
        "end": 18.5,
        "text": "Do not give your life story! Focus on your skills, experience, and what you can bring to the role.",
        "vi": "Đừng kể lể toàn bộ tiểu sử đời bạn! Hãy tập trung vào kỹ năng, kinh nghiệm và giá trị bạn mang lại cho vị trí này.",
        "translation": "Đừng kể lể toàn bộ tiểu sử đời bạn! Hãy tập trung vào kỹ năng, kinh nghiệm và giá trị bạn mang lại cho vị trí này."
      },
      {
        "id": "c4",
        "start": 19,
        "end": 25.5,
        "text": "Question number two: 'Why do you want to work for our company?'",
        "vi": "Câu hỏi số hai: 'Tại sao bạn lại muốn làm việc cho công ty chúng tôi?'",
        "translation": "Câu hỏi số hai: 'Tại sao bạn lại muốn làm việc cho công ty chúng tôi?'"
      },
      {
        "id": "c5",
        "start": 26,
        "end": 32.5,
        "text": "Show that you have researched their culture, their mission, and their recent achievements.",
        "vi": "Hãy chứng minh bạn đã tìm hiểu kỹ về văn hóa, sứ mệnh và các thành tựu gần đây của công ty.",
        "translation": "Hãy chứng minh bạn đã tìm hiểu kỹ về văn hóa, sứ mệnh và các thành tựu gần đây của công ty."
      },
      {
        "id": "c6",
        "start": 33,
        "end": 39.5,
        "text": "Question number three: 'What are your greatest strengths and weaknesses?'",
        "vi": "Câu hỏi số ba: 'Điểm mạnh và điểm yếu lớn nhất của bạn là gì?'",
        "translation": "Câu hỏi số ba: 'Điểm mạnh và điểm yếu lớn nhất của bạn là gì?'"
      }
    ]
  },
  {
    "id": "vid-U0YdO6zGSHk",
    "videoId": "U0YdO6zGSHk",
    "title": "Tell Me About Yourself: Best Interview Answer",
    "titleVi": "Giới thiệu bản thân: Mẫu câu trả lời phỏng vấn ấn tượng nhất",
    "lang": "en",
    "language": "en",
    "category": "💼 Công việc & Phỏng vấn",
    "duration": "10:15",
    "level": "Trung cấp",
    "channel": "CareerVidz",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "Here is a brilliant structure to answer 'Tell me about yourself'.",
        "vi": "Đây là cấu trúc tuyệt vời để trả lời câu 'Hãy giới thiệu về bản thân bạn'.",
        "translation": "Đây là cấu trúc tuyệt vời để trả lời câu 'Hãy giới thiệu về bản thân bạn'."
      },
      {
        "id": "c2",
        "start": 6,
        "end": 11.5,
        "text": "Use the SEAT formula: Skills, Experience, Achievements, and Type of person you are.",
        "vi": "Hãy áp dụng công thức SEAT: Kỹ năng, Kinh nghiệm, Thành tựu và Tính cách của bạn.",
        "translation": "Hãy áp dụng công thức SEAT: Kỹ năng, Kinh nghiệm, Thành tựu và Tính cách của bạn."
      },
      {
        "id": "c3",
        "start": 12,
        "end": 18,
        "text": "I am an industrious, highly driven, and positive professional with over 5 years of experience.",
        "vi": "Tôi là một người chăm chỉ, đầy nhiệt huyết và tích cực với hơn 5 năm kinh nghiệm chuyên môn.",
        "translation": "Tôi là một người chăm chỉ, đầy nhiệt huyết và tích cực với hơn 5 năm kinh nghiệm chuyên môn."
      },
      {
        "id": "c4",
        "start": 18.5,
        "end": 24.5,
        "text": "In my previous position, I successfully increased team productivity by 25 percent.",
        "vi": "Ở vị trí trước đây, tôi đã giúp tăng 25% năng suất làm việc của toàn đội nhóm.",
        "translation": "Ở vị trí trước đây, tôi đã giúp tăng 25% năng suất làm việc của toàn đội nhóm."
      },
      {
        "id": "c5",
        "start": 25,
        "end": 30.5,
        "text": "If you hire me, I will bring that same level of dedication to this role.",
        "vi": "Nếu được trao cơ hội, tôi sẽ đem trọn vẹn sự tận tâm đó vào vị trí mới này.",
        "translation": "Nếu được trao cơ hội, tôi sẽ đem trọn vẹn sự tận tâm đó vào vị trí mới này."
      }
    ]
  },
  {
    "id": "vid-CJaMEfU-Jwg",
    "videoId": "CJaMEfU-Jwg",
    "title": "Why Should We Hire You? Job Interview Strategy",
    "titleVi": "Tại sao chúng tôi nên tuyển bạn? Chiến lược trả lời phỏng vấn",
    "lang": "en",
    "language": "en",
    "category": "💼 Công việc & Phỏng vấn",
    "duration": "12:00",
    "level": "Nâng cao",
    "channel": "CareerVidz",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5,
        "text": "'Why should we hire you?' is your golden opportunity to sell your unique value.",
        "vi": "'Tại sao chúng tôi nên tuyển bạn?' là cơ hội vàng để bạn nêu bật giá trị độc nhất của mình.",
        "translation": "'Tại sao chúng tôi nên tuyển bạn?' là cơ hội vàng để bạn nêu bật giá trị độc nhất của mình."
      },
      {
        "id": "c2",
        "start": 5.5,
        "end": 11,
        "text": "You should hire me because my track record shows I don't just meet targets, I exceed them.",
        "vi": "Quý công ty nên tuyển tôi vì thành tích quá khứ cho thấy tôi không chỉ đạt chỉ tiêu mà luôn vượt mức kỳ vọng.",
        "translation": "Quý công ty nên tuyển tôi vì thành tích quá khứ cho thấy tôi không chỉ đạt chỉ tiêu mà luôn vượt mức kỳ vọng."
      },
      {
        "id": "c3",
        "start": 11.5,
        "end": 17.5,
        "text": "I have the exact combination of technical expertise and leadership required for this role.",
        "vi": "Tôi sở hữu sự kết hợp hoàn hảo giữa năng lực chuyên môn kỹ thuật và kỹ năng lãnh đạo mà vị trí này yêu cầu.",
        "translation": "Tôi sở hữu sự kết hợp hoàn hảo giữa năng lực chuyên môn kỹ thuật và kỹ năng lãnh đạo mà vị trí này yêu cầu."
      }
    ]
  },
  {
    "id": "vid-d1D81UrlCUE",
    "videoId": "d1D81UrlCUE",
    "title": "English at the Airport: Check-in, Security & Boarding",
    "titleVi": "Tiếng Anh tại sân bay: Làm thủ tục, qua an ninh & Lên máy bay",
    "lang": "en",
    "language": "en",
    "category": "✈️ Du lịch & Khách sạn",
    "duration": "13:50",
    "level": "Cơ bản",
    "channel": "Oxford Online English",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "Traveling by plane can be stressful, especially in another language.",
        "vi": "Đi máy bay có thể gây căng thẳng, đặc biệt là khi phải giao tiếp bằng ngoại ngữ.",
        "translation": "Đi máy bay có thể gây căng thẳng, đặc biệt là khi phải giao tiếp bằng ngoại ngữ."
      },
      {
        "id": "c2",
        "start": 6,
        "end": 11.5,
        "text": "In this lesson, you'll learn all the essential phrases you need at the airport.",
        "vi": "Trong bài học này, bạn sẽ học tất cả các mẫu câu cần thiết nhất khi ở sân bay.",
        "translation": "Trong bài học này, bạn sẽ học tất cả các mẫu câu cần thiết nhất khi ở sân bay."
      },
      {
        "id": "c3",
        "start": 12,
        "end": 17.5,
        "text": "'May I see your passport and ticket, please?'",
        "vi": "'Tôi có thể kiểm tra hộ chiếu và vé máy bay của quý khách được không?'",
        "translation": "'Tôi có thể kiểm tra hộ chiếu và vé máy bay của quý khách được không?'"
      },
      {
        "id": "c4",
        "start": 18,
        "end": 23.5,
        "text": "'Would you prefer a window seat or an aisle seat?'",
        "vi": "'Quý khách muốn chọn ghế cạnh cửa sổ hay ghế cạnh lối đi ạ?'",
        "translation": "'Quý khách muốn chọn ghế cạnh cửa sổ hay ghế cạnh lối đi ạ?'"
      },
      {
        "id": "c5",
        "start": 24,
        "end": 29.5,
        "text": "'How many bags are you checking in today?'",
        "vi": "'Hôm nay quý khách có bao nhiêu kiện hành lý ký gửi ạ?'",
        "translation": "'Hôm nay quý khách có bao nhiêu kiện hành lý ký gửi ạ?'"
      },
      {
        "id": "c6",
        "start": 30,
        "end": 35.5,
        "text": "'Here is your boarding pass. Your gate is B14 and boarding starts at 3:15.'",
        "vi": "'Đây là thẻ lên tàu bay của quý khách. Cửa khởi hành là B14 và bắt đầu lên máy bay lúc 3:15.'",
        "translation": "'Đây là thẻ lên tàu bay của quý khách. Cửa khởi hành là B14 và bắt đầu lên máy bay lúc 3:15.'"
      }
    ]
  },
  {
    "id": "vid-0pTCIdGl2MA",
    "videoId": "0pTCIdGl2MA",
    "title": "Hotel English: Check-in, Room Service & Complaints",
    "titleVi": "Tiếng Anh tại khách sạn: Nhận phòng, gọi dịch vụ & Phản ánh sự cố",
    "lang": "en",
    "language": "en",
    "category": "✈️ Du lịch & Khách sạn",
    "duration": "12:10",
    "level": "Cơ bản",
    "channel": "EnglishClass101",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5,
        "text": "Good afternoon! I have a reservation under the name John Smith.",
        "vi": "Xin chào buổi chiều! Tôi có đặt phòng trước dưới tên John Smith.",
        "translation": "Xin chào buổi chiều! Tôi có đặt phòng trước dưới tên John Smith."
      },
      {
        "id": "c2",
        "start": 5.5,
        "end": 10.5,
        "text": "Welcome to Grand Hotel, Mr. Smith. We have you booked for a deluxe king room for 3 nights.",
        "vi": "Chào mừng quý khách đến khách sạn Grand, ông Smith. Quý khách đã đặt phòng Deluxe giường đôi trong 3 đêm.",
        "translation": "Chào mừng quý khách đến khách sạn Grand, ông Smith. Quý khách đã đặt phòng Deluxe giường đôi trong 3 đêm."
      },
      {
        "id": "c3",
        "start": 11,
        "end": 16,
        "text": "Could you please fill out this registration form and provide an ID?",
        "vi": "Xin quý khách vui lòng điền vào phiếu đăng ký này và xuất trình giấy tờ tùy thân ạ.",
        "translation": "Xin quý khách vui lòng điền vào phiếu đăng ký này và xuất trình giấy tờ tùy thân ạ."
      },
      {
        "id": "c4",
        "start": 16.5,
        "end": 21.5,
        "text": "Is breakfast included in the room rate? Yes, from 6:30 to 10:00 AM on the 2nd floor.",
        "vi": "Bữa sáng đã bao gồm trong tiền phòng chưa? Dạ có rồi, phục vụ từ 6:30 đến 10:00 sáng tại tầng 2 ạ.",
        "translation": "Bữa sáng đã bao gồm trong tiền phòng chưa? Dạ có rồi, phục vụ từ 6:30 đến 10:00 sáng tại tầng 2 ạ."
      },
      {
        "id": "c5",
        "start": 22,
        "end": 27.5,
        "text": "What is the Wi-Fi password? It is printed on your key card envelope.",
        "vi": "Mật khẩu Wi-Fi là gì vậy? Dạ mật khẩu có in sẵn trên phong bì đựng thẻ từ của quý khách ạ.",
        "translation": "Mật khẩu Wi-Fi là gì vậy? Dạ mật khẩu có in sẵn trên phong bì đựng thẻ từ của quý khách ạ."
      }
    ]
  },
  {
    "id": "vid-TZTbA5lsjCQ",
    "videoId": "TZTbA5lsjCQ",
    "title": "Asking for Directions in English: Streets, Landmarks & Subway",
    "titleVi": "Hỏi đường bằng tiếng Anh: Đường phố, Địa danh & Tàu điện ngầm",
    "lang": "en",
    "language": "en",
    "category": "✈️ Du lịch & Khách sạn",
    "duration": "9:30",
    "level": "Cơ bản",
    "channel": "BBC Learning English",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5,
        "text": "Excuse me, could you tell me how to get to the nearest subway station?",
        "vi": "Xin lỗi, bạn có thể chỉ cho tôi đường đến ga tàu điện ngầm gần nhất được không?",
        "translation": "Xin lỗi, bạn có thể chỉ cho tôi đường đến ga tàu điện ngầm gần nhất được không?"
      },
      {
        "id": "c2",
        "start": 5.5,
        "end": 10.5,
        "text": "Sure! Go straight down this street for two blocks, then turn left at the traffic lights.",
        "vi": "Chắc chắn rồi! Bạn cứ đi thẳng con phố này qua 2 ngã tư, sau đó rẽ trái ở chỗ đèn giao thông nhé.",
        "translation": "Chắc chắn rồi! Bạn cứ đi thẳng con phố này qua 2 ngã tư, sau đó rẽ trái ở chỗ đèn giao thông nhé."
      },
      {
        "id": "c3",
        "start": 11,
        "end": 16.5,
        "text": "Is it within walking distance? Yes, it takes about five minutes on foot.",
        "vi": "Đi bộ tới đó có gần không? Có, chỉ mất khoảng 5 phút đi bộ thôi.",
        "translation": "Đi bộ tới đó có gần không? Có, chỉ mất khoảng 5 phút đi bộ thôi."
      },
      {
        "id": "c4",
        "start": 17,
        "end": 22,
        "text": "Thank you so much for your help! You're very welcome, have a great day!",
        "vi": "Cảm ơn bạn rất nhiều! Không có chi, chúc bạn một ngày tốt lành!",
        "translation": "Cảm ơn bạn rất nhiều! Không có chi, chúc bạn một ngày tốt lành!"
      }
    ]
  },
  {
    "id": "vid-mHpysQRzBLg",
    "videoId": "mHpysQRzBLg",
    "title": "Ordering Food at a Restaurant in English",
    "titleVi": "Gọi món ăn tại nhà hàng bằng tiếng Anh",
    "lang": "en",
    "language": "en",
    "category": "🍜 Ăn uống & Mua sắm",
    "duration": "10:05",
    "level": "Cơ bản",
    "channel": "EnglishClass101",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 4.8,
        "text": "Hi, a table for two, please.",
        "vi": "Xin chào, cho chúng tôi bàn 2 người nhé.",
        "translation": "Xin chào, cho chúng tôi bàn 2 người nhé."
      },
      {
        "id": "c2",
        "start": 5.2,
        "end": 9.5,
        "text": "Right this way. Here are your menus. Can I get you something to drink first?",
        "vi": "Mời quý khách đi lối này. Đây là thực đơn. Tôi có thể lấy đồ uống gì trước cho quý khách không ạ?",
        "translation": "Mời quý khách đi lối này. Đây là thực đơn. Tôi có thể lấy đồ uống gì trước cho quý khách không ạ?"
      },
      {
        "id": "c3",
        "start": 10,
        "end": 14.5,
        "text": "Just some sparkling water with lemon for now, please.",
        "vi": "Cho tôi một ly nước khoáng có ga kèm lát chanh trước nhé.",
        "translation": "Cho tôi một ly nước khoáng có ga kèm lát chanh trước nhé."
      },
      {
        "id": "c4",
        "start": 15,
        "end": 20,
        "text": "Are you ready to order or do you need a few more minutes?",
        "vi": "Quý khách đã sẵn sàng gọi món chưa hay cần thêm vài phút ạ?",
        "translation": "Quý khách đã sẵn sàng gọi món chưa hay cần thêm vài phút ạ?"
      },
      {
        "id": "c5",
        "start": 20.5,
        "end": 26,
        "text": "I'll have the grilled salmon with roasted vegetables, please.",
        "vi": "Cho tôi một phần cá hồi nướng ăn kèm rau củ bỏ lò nhé.",
        "translation": "Cho tôi một phần cá hồi nướng ăn kèm rau củ bỏ lò nhé."
      },
      {
        "id": "c6",
        "start": 26.5,
        "end": 31,
        "text": "Could we have the bill, please? Do you take credit cards?",
        "vi": "Làm ơn tính tiền cho chúng tôi nhé. Nhà hàng có nhận thẻ tín dụng không?",
        "translation": "Làm ơn tính tiền cho chúng tôi nhé. Nhà hàng có nhận thẻ tín dụng không?"
      }
    ]
  },
  {
    "id": "vid-bgfdqVmVjfk",
    "videoId": "bgfdqVmVjfk",
    "title": "Shopping for Clothes in English: Sizing, Prices & Discounts",
    "titleVi": "Mua sắm quần áo bằng tiếng Anh: Chọn size, Hỏi giá & Giảm giá",
    "lang": "en",
    "language": "en",
    "category": "🍜 Ăn uống & Mua sắm",
    "duration": "11:15",
    "level": "Cơ bản",
    "channel": "Oxford Online English",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 4.5,
        "text": "Can I help you find anything in particular today?",
        "vi": "Tôi có thể giúp bạn tìm món đồ nào cụ thể hôm nay không?",
        "translation": "Tôi có thể giúp bạn tìm món đồ nào cụ thể hôm nay không?"
      },
      {
        "id": "c2",
        "start": 5,
        "end": 9.5,
        "text": "Yes, I'm looking for a warm jacket in medium size.",
        "vi": "Vâng, tôi đang tìm một chiếc áo khoác ấm cỡ vừa (size M).",
        "translation": "Vâng, tôi đang tìm một chiếc áo khoác ấm cỡ vừa (size M)."
      },
      {
        "id": "c3",
        "start": 10,
        "end": 14.5,
        "text": "Where are the fitting rooms? They are right around the corner.",
        "vi": "Phòng thử đồ ở đâu vậy bạn? Dạ ở ngay góc rẽ đằng kia ạ.",
        "translation": "Phòng thử đồ ở đâu vậy bạn? Dạ ở ngay góc rẽ đằng kia ạ."
      },
      {
        "id": "c4",
        "start": 15,
        "end": 20,
        "text": "Does this come with a discount? Yes, it's 20 percent off today.",
        "vi": "Món này có được giảm giá không? Dạ có, hôm nay đang được giảm 20% ạ.",
        "translation": "Món này có được giảm giá không? Dạ có, hôm nay đang được giảm 20% ạ."
      }
    ]
  },
  {
    "id": "vid-0L0KuH05b7c",
    "videoId": "0L0KuH05b7c",
    "title": "Chinese Restaurant Ordering: Dumplings, Noodles & Drinks",
    "titleVi": "Gọi món ăn Trung Hoa: Sủi cảo, Mì & Đồ uống",
    "lang": "zh",
    "language": "zh",
    "category": "🍜 Ăn uống & Mua sắm",
    "duration": "11:20",
    "level": "Cơ bản",
    "channel": "ChineseClass101",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 4.5,
        "text": "服务员，请给我们一份菜单。",
        "pinyin": "Fúwùyuán, qǐng gěi wǒmen yī fèn càidān.",
        "vi": "Phục vụ ơi, vui lòng cho chúng tôi xin một cuốn thực đơn.",
        "translation": "Phục vụ ơi, vui lòng cho chúng tôi xin một cuốn thực đơn."
      },
      {
        "id": "c2",
        "start": 5,
        "end": 9.5,
        "text": "请问你们几位？我们一共三个人。",
        "pinyin": "Qǐngwèn nǐmen jǐ wèi? Wǒmen yīgòng sān gè rén.",
        "vi": "Xin hỏi quý khách đi mấy người? Chúng tôi có tất cả 3 người.",
        "translation": "Xin hỏi quý khách đi mấy người? Chúng tôi có tất cả 3 người."
      },
      {
        "id": "c3",
        "start": 10,
        "end": 15,
        "text": "你们有什么特色菜推荐吗？",
        "pinyin": "Nǐmen yǒu shénme tèsè cài tuījiàn ma?",
        "vi": "Quán có món đặc sản nào giới thiệu cho chúng tôi không?",
        "translation": "Quán có món đặc sản nào giới thiệu cho chúng tôi không?"
      },
      {
        "id": "c4",
        "start": 15.5,
        "end": 21,
        "text": "我们这儿的小笼包和牛肉面非常有名。",
        "pinyin": "Wǒmen zhèr de xiǎolóngbāo hé niúròumiàn fēicháng yǒumíng.",
        "vi": "Ở đây tiểu long bao và mì bò của chúng tôi rất nổi tiếng.",
        "translation": "Ở đây tiểu long bao và mì bò của chúng tôi rất nổi tiếng."
      },
      {
        "id": "c5",
        "start": 21.5,
        "end": 27,
        "text": "好的，那我们要一笼小笼包和两碗牛肉面。",
        "pinyin": "Hǎo de, nà wǒmen yào yī lóng xiǎolóngbāo hé liǎng wǎn niúròumiàn.",
        "vi": "Được rồi, vậy cho chúng tôi 1 xửng tiểu long bao và 2 tô mì bò nhé.",
        "translation": "Được rồi, vậy cho chúng tôi 1 xửng tiểu long bao và 2 tô mì bò nhé."
      },
      {
        "id": "c6",
        "start": 27.5,
        "end": 32.5,
        "text": "请不要放香菜，不要太辣，谢谢！",
        "pinyin": "Qǐng bùyào fàng xiāngcài, bùyào tài là, xièxie!",
        "vi": "Làm ơn đừng bỏ rau mùi, đừng làm cay quá nhé, cảm ơn!",
        "translation": "Làm ơn đừng bỏ rau mùi, đừng làm cay quá nhé, cảm ơn!"
      }
    ]
  },
  {
    "id": "vid-j9tnxTWtHJs",
    "videoId": "j9tnxTWtHJs",
    "title": "Asking for the Bill and Paying in Chinese",
    "titleVi": "Cách gọi thanh toán và thanh toán tiền bằng tiếng Trung",
    "lang": "zh",
    "language": "zh",
    "category": "🍜 Ăn uống & Mua sắm",
    "duration": "8:40",
    "level": "Cơ bản",
    "channel": "Everyday Chinese",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 4.5,
        "text": "服务员，买单！",
        "pinyin": "Fúwùyuán, mǎidān!",
        "vi": "Phục vụ ơi, tính tiền!",
        "translation": "Phục vụ ơi, tính tiền!"
      },
      {
        "id": "c2",
        "start": 5,
        "end": 9.5,
        "text": "您好，一共是一百八十八块钱。",
        "pinyin": "Nínhǎo, yīgòng shì yībǎi bāshíbā kuài qián.",
        "vi": "Dạ xin chào quý khách, tổng cộng là 188 tệ ạ.",
        "translation": "Dạ xin chào quý khách, tổng cộng là 188 tệ ạ."
      },
      {
        "id": "c3",
        "start": 10,
        "end": 14.5,
        "text": "请问可以微信或者支付宝支付吗？",
        "pinyin": "Qǐngwèn kěyǐ Wēixìn huòzhě Zhīfùbǎo zhīfù ma?",
        "vi": "Xin hỏi có thể thanh toán bằng WeChat hoặc Alipay không?",
        "translation": "Xin hỏi có thể thanh toán bằng WeChat hoặc Alipay không?"
      },
      {
        "id": "c4",
        "start": 15,
        "end": 19.5,
        "text": "可以的，您扫桌上的二维码就行。",
        "pinyin": "Kěyǐ de, nín sǎo zhuō shàng de èrwéimǎ jiù xíng.",
        "vi": "Được ạ, quý khách quét mã QR trên bàn là xong ạ.",
        "translation": "Được ạ, quý khách quét mã QR trên bàn là xong ạ."
      },
      {
        "id": "c5",
        "start": 20,
        "end": 24.5,
        "text": "好的，我已经付款成功了，谢谢！",
        "pinyin": "Hǎo de, wǒ yǐjīng fùkuǎn chénggōng le, xièxie!",
        "vi": "Được rồi, tôi đã thanh toán thành công rồi, cảm ơn bạn!",
        "translation": "Được rồi, tôi đã thanh toán thành công rồi, cảm ơn bạn!"
      }
    ]
  },
  {
    "id": "vid-enOrZzX0NRg",
    "videoId": "enOrZzX0NRg",
    "title": "HSK 1 Listening & Speaking: Daily Greetings and Introductions",
    "titleVi": "Luyện nghe HSK 1: Chào hỏi hàng ngày & Giới thiệu bản thân",
    "lang": "zh",
    "language": "zh",
    "category": "📚 Luyện thi HSK",
    "duration": "15:20",
    "level": "Cơ bản",
    "channel": "Chinese Zero to Hero",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 4.5,
        "text": "你好！很高兴认识你。",
        "pinyin": "Nǐ hǎo! Hěn gāoxìng rènshi nǐ.",
        "vi": "Xin chào! Rất vui được làm quen với bạn.",
        "translation": "Xin chào! Rất vui được làm quen với bạn."
      },
      {
        "id": "c2",
        "start": 5,
        "end": 9.5,
        "text": "我叫王明，我是中国人。你叫什么名字？",
        "pinyin": "Wǒ jiào Wáng Míng, wǒ shì Zhōngguó rén. Nǐ jiào shénme míngzi?",
        "vi": "Tôi tên là Vương Minh, tôi là người Trung Quốc. Bạn tên là gì?",
        "translation": "Tôi tên là Vương Minh, tôi là người Trung Quốc. Bạn tên là gì?"
      },
      {
        "id": "c3",
        "start": 10,
        "end": 15,
        "text": "我叫大卫，我是美国人。我也很高兴认识你。",
        "pinyin": "Wǒ jiào Dàwèi, wǒ shì Měiguó rén. Wǒ yě hěn gāoxìng rènshi nǐ.",
        "vi": "Tôi tên là David, tôi là người Mỹ. Tôi cũng rất vui được làm quen với bạn.",
        "translation": "Tôi tên là David, tôi là người Mỹ. Tôi cũng rất vui được làm quen với bạn."
      },
      {
        "id": "c4",
        "start": 15.5,
        "end": 20.5,
        "text": "你会说汉语吗？我会说一点点汉语。",
        "pinyin": "Nǐ huì shuō Hànyǔ ma? Wǒ huì shuō yī diǎndiǎn Hànyǔ.",
        "vi": "Bạn biết nói tiếng Trung không? Tôi biết nói một chút ít tiếng Trung.",
        "translation": "Bạn biết nói tiếng Trung không? Tôi biết nói một chút ít tiếng Trung."
      },
      {
        "id": "c5",
        "start": 21,
        "end": 26.5,
        "text": "你学汉语多长时间了？我学了三个月了。",
        "pinyin": "Nǐ xué Hànyǔ duō cháng shíjiān le? Wǒ xué le sān gè yuè le.",
        "vi": "Bạn học tiếng Trung bao lâu rồi? Tôi học được ba tháng rồi.",
        "translation": "Bạn học tiếng Trung bao lâu rồi? Tôi học được ba tháng rồi."
      },
      {
        "id": "c6",
        "start": 27,
        "end": 32.5,
        "text": "你的汉语说得很好！谢谢你的鼓励！",
        "pinyin": "Nǐ de Hànyǔ shuō de hěn hǎo! Xièxie nǐ de gǔlì!",
        "vi": "Bạn nói tiếng Trung rất hay đấy! Cảm ơn lời khen của bạn!",
        "translation": "Bạn nói tiếng Trung rất hay đấy! Cảm ơn lời khen của bạn!"
      }
    ]
  },
  {
    "id": "vid-SV_6Ko6Ow7Y",
    "videoId": "SV_6Ko6Ow7Y",
    "title": "HSK 1 Basic Vocabulary and Daily Dialogue",
    "titleVi": "Từ vựng cốt lõi & Mẫu câu đàm thoại HSK 1",
    "lang": "zh",
    "language": "zh",
    "category": "📚 Luyện thi HSK",
    "duration": "14:30",
    "level": "Cơ bản",
    "channel": "Everyday Chinese",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 4.8,
        "text": "今天天气怎么样？今天天气非常好，很暖和。",
        "pinyin": "Jīntiān tiānqì zěnmeyàng? Jīntiān tiānqì fēicháng hǎo, hěn nuǎnhuo.",
        "vi": "Hôm nay thời tiết thế nào? Hôm nay thời tiết rất đẹp, rất ấm áp.",
        "translation": "Hôm nay thời tiết thế nào? Hôm nay thời tiết rất đẹp, rất ấm áp."
      },
      {
        "id": "c2",
        "start": 5.2,
        "end": 10,
        "text": "你想喝茶还是喝咖啡？我想喝一杯热茶。",
        "pinyin": "Nǐ xiǎng hē chá háishì hē kāfēi? Wǒ xiǎng hē yībēi rè chá.",
        "vi": "Bạn muốn uống trà hay uống cà phê? Tôi muốn uống một tách trà nóng.",
        "translation": "Bạn muốn uống trà hay uống cà phê? Tôi muốn uống một tách trà nóng."
      },
      {
        "id": "c3",
        "start": 10.5,
        "end": 15.5,
        "text": "现在几点了？现在是下午三点半。",
        "pinyin": "Xiànzài jǐ diǎn le? Xiànzài shì xiàwǔ sān diǎn bàn.",
        "vi": "Bây giờ là mấy giờ rồi? Bây giờ là 3 giờ rưỡi chiều.",
        "translation": "Bây giờ là mấy giờ rồi? Bây giờ là 3 giờ rưỡi chiều."
      },
      {
        "id": "c4",
        "start": 16,
        "end": 21,
        "text": "你明天有时间吗？我们一起去书店吧。",
        "pinyin": "Nǐ míngtiān yǒu shíjiān ma? Wǒmen yīqǐ qù shūdiàn ba.",
        "vi": "Ngày mai bạn có rảnh không? Chúng mình cùng đi nhà sách nhé.",
        "translation": "Ngày mai bạn có rảnh không? Chúng mình cùng đi nhà sách nhé."
      },
      {
        "id": "c5",
        "start": 21.5,
        "end": 27,
        "text": "好啊，明天下午我们在学校门口见面。",
        "pinyin": "Hǎo a, míngtiān xiàwǔ wǒmen zài xuéxiào ménkǒu jiànmiàn.",
        "vi": "Được thôi, chiều mai tụi mình gặp nhau ở cổng trường nhé.",
        "translation": "Được thôi, chiều mai tụi mình gặp nhau ở cổng trường nhé."
      }
    ]
  },
  {
    "id": "vid-iTWNZ4V1vlw",
    "videoId": "iTWNZ4V1vlw",
    "title": "HSK 2 Listening Practice: Daily Life Conversations",
    "titleVi": "Luyện nghe HSK 2: Hội thoại đời sống sinh hoạt",
    "lang": "zh",
    "language": "zh",
    "category": "📚 Luyện thi HSK",
    "duration": "18:10",
    "level": "Trung cấp",
    "channel": "Everyday Chinese",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5,
        "text": "这个周末你打算做什么？我打算在家休息。",
        "pinyin": "Zhège zhōumò nǐ dǎsuàn zuò shénme? Wǒ dǎsuàn zài jiā xiūxi.",
        "vi": "Cuối tuần này bạn dự định làm gì? Tôi dự định ở nhà nghỉ ngơi.",
        "translation": "Cuối tuần này bạn dự định làm gì? Tôi dự định ở nhà nghỉ ngơi."
      },
      {
        "id": "c2",
        "start": 5.5,
        "end": 10.5,
        "text": "你生病了吗？身体不舒服吗？有一点感冒。",
        "pinyin": "Nǐ shēngbìng le ma? Shēntǐ bù shūfu ma? Yǒu yīdiǎn gǎnmào.",
        "vi": "Bạn bị ốm à? Trong người thấy khó chịu hả? Tôi hơi bị cảm một chút.",
        "translation": "Bạn bị ốm à? Trong người thấy khó chịu hả? Tôi hơi bị cảm một chút."
      },
      {
        "id": "c3",
        "start": 11,
        "end": 16.5,
        "text": "那你多喝点温水，按时吃药，好好睡一觉。",
        "pinyin": "Nà nǐ duō hē diǎn wēnshuǐ, ànshí chī yào, hǎohǎo shuì yī jiào.",
        "vi": "Vậy bạn nhớ uống nhiều nước ấm, uống thuốc đúng giờ và ngủ một giấc thật ngon nhé.",
        "translation": "Vậy bạn nhớ uống nhiều nước ấm, uống thuốc đúng giờ và ngủ một giấc thật ngon nhé."
      },
      {
        "id": "c4",
        "start": 17,
        "end": 22,
        "text": "谢谢你的关心，我想明天就会好起来的。",
        "pinyin": "Xièxie nǐ de guānxīn, wǒ xiǎng míngtiān jiù huì hǎo qǐlai de.",
        "vi": "Cảm ơn bạn đã quan tâm, tôi nghĩ ngày mai sẽ khỏe lại thôi.",
        "translation": "Cảm ơn bạn đã quan tâm, tôi nghĩ ngày mai sẽ khỏe lại thôi."
      }
    ]
  },
  {
    "id": "vid-PcergOJuC1M",
    "videoId": "PcergOJuC1M",
    "title": "HSK 3 Listening: Workplace & Office Chinese",
    "titleVi": "Luyện nghe HSK 3: Tiếng Trung công sở & Họp hành văn phòng",
    "lang": "zh",
    "language": "zh",
    "category": "📚 Luyện thi HSK",
    "duration": "16:40",
    "level": "Trung cấp",
    "channel": "Everyday Chinese",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "王经理，昨天的会议纪要我已经发到您的邮箱了。",
        "pinyin": "Wáng jīnglǐ, zuótiān de huìyì jìyào wǒ yǐjīng fā dào nín de yóuxiāng le.",
        "vi": "Giám đốc Vương, biên bản cuộc họp hôm qua tôi đã gửi vào email của sếp rồi ạ.",
        "translation": "Giám đốc Vương, biên bản cuộc họp hôm qua tôi đã gửi vào email của sếp rồi ạ."
      },
      {
        "id": "c2",
        "start": 6,
        "end": 11.5,
        "text": "好的，我马上查看一下。下周一的项目方案准备得怎么样了？",
        "pinyin": "Hǎo de, wǒ mǎshàng chákàn yīxià. Xià zhōuyī de xiàngmù fāng'àn zhǔnbèi de zěnmeyàng le?",
        "vi": "Được rồi, tôi sẽ xem ngay. Phương án dự án cho thứ hai tuần tới đã chuẩn bị thế nào rồi?",
        "translation": "Được rồi, tôi sẽ xem ngay. Phương án dự án cho thứ hai tuần tới đã chuẩn bị thế nào rồi?"
      },
      {
        "id": "c3",
        "start": 12,
        "end": 17.5,
        "text": "我们团队正在完善最后的PPT，今天下班前一定能提交给您。",
        "pinyin": "Wǒmen tuánduì zhèngzài wánshàn zuìhòu de PPT, jīntiān xiàbān qián yīdìng néng tíjiāo gěi nín.",
        "vi": "Đội ngũ chúng tôi đang hoàn thiện bản slide cuối cùng, trước giờ tan làm hôm nay chắc chắn sẽ nộp cho sếp ạ.",
        "translation": "Đội ngũ chúng tôi đang hoàn thiện bản slide cuối cùng, trước giờ tan làm hôm nay chắc chắn sẽ nộp cho sếp ạ."
      },
      {
        "id": "c4",
        "start": 18,
        "end": 23.5,
        "text": "辛苦大家了，做完这个项目我们一起聚餐庆功！",
        "pinyin": "Xīnkǔ dàjiā le, zuò wán zhège xiàngmù wǒmen yīqǐ jùcān qìnggōng!",
        "vi": "Vất vả cho mọi người rồi, hoàn thành xong dự án này chúng ta sẽ cùng đi ăn liên hoan mừng công!",
        "translation": "Vất vả cho mọi người rồi, hoàn thành xong dự án này chúng ta sẽ cùng đi ăn liên hoan mừng công!"
      }
    ]
  },
  {
    "id": "vid-C_wrXDRxuUY",
    "videoId": "C_wrXDRxuUY",
    "title": "Peppa Pig Chinese: Muddy Puddles (小猪佩奇: 泥坑)",
    "titleVi": "Heo Peppa tiếng Trung: Nhảy vũng bùn (Tập 1)",
    "lang": "zh",
    "language": "zh",
    "category": "🏮 Văn hóa & Đời sống",
    "duration": "5:02",
    "level": "Cơ bản",
    "channel": "Peppa Pig Chinese",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "我是佩奇，这是我的弟弟乔治。",
        "pinyin": "Wǒ shì Pèiqí, zhè shì wǒ de dìdi Qiáozhì.",
        "vi": "Tôi là Peppa, đây là em trai George của tôi.",
        "translation": "Tôi là Peppa, đây là em trai George của tôi."
      },
      {
        "id": "c2",
        "start": 6,
        "end": 9.5,
        "text": "这是我的妈妈。这是我的爸爸。",
        "pinyin": "Zhè shì wǒ de māmā. Zhè shì wǒ de bàba.",
        "vi": "Đây là mẹ của tôi. Đây là bố của tôi.",
        "translation": "Đây là mẹ của tôi. Đây là bố của tôi."
      },
      {
        "id": "c3",
        "start": 10,
        "end": 14.5,
        "text": "小猪佩奇！泥坑！",
        "pinyin": "Xiǎozhū Pèiqí! Níkēng!",
        "vi": "Heo Peppa! Vũng bùn!",
        "translation": "Heo Peppa! Vũng bùn!"
      },
      {
        "id": "c4",
        "start": 15,
        "end": 22,
        "text": "今天下着雨，佩奇和乔治不能出去玩了。",
        "pinyin": "Jīntiān xiàzhe yǔ, Pèiqí hé Qiáozhì bùnéng chūqù wán le.",
        "vi": "Hôm nay trời đang mưa, Peppa và George không thể ra ngoài chơi được.",
        "translation": "Hôm nay trời đang mưa, Peppa và George không thể ra ngoài chơi được."
      },
      {
        "id": "c5",
        "start": 22.5,
        "end": 29,
        "text": "雨停了。佩奇和乔治可以出去玩了！",
        "pinyin": "Yǔ tíng le. Pèiqí hé Qiáozhì kěyǐ chūqù wán le!",
        "vi": "Mưa tạnh rồi. Peppa và George có thể ra ngoài chơi rồi!",
        "translation": "Mưa tạnh rồi. Peppa và George có thể ra ngoài chơi rồi!"
      },
      {
        "id": "c6",
        "start": 29.5,
        "end": 36.5,
        "text": "佩奇喜欢在泥坑里跳来跳去！",
        "pinyin": "Pèiqí xǐhuan zài níkēng lǐ tiào lái tiào qù!",
        "vi": "Peppa rất thích nhảy qua nhảy lại trong những vũng bùn!",
        "translation": "Peppa rất thích nhảy qua nhảy lại trong những vũng bùn!"
      },
      {
        "id": "c7",
        "start": 37,
        "end": 45,
        "text": "如果你要在泥坑里跳，你必须要穿上靴子！",
        "pinyin": "Rúguǒ nǐ yào zài níkēng lǐ tiào, nǐ bìxū yào chuān shàng xuēzi!",
        "vi": "Nếu con muốn nhảy trong vũng bùn, con bắt buộc phải đi ủng vào!",
        "translation": "Nếu con muốn nhảy trong vũng bùn, con bắt buộc phải đi ủng vào!"
      },
      {
        "id": "c8",
        "start": 45.5,
        "end": 50,
        "text": "对不起，妈妈！佩奇喜欢穿上雨靴！",
        "pinyin": "Duìbuqǐ, māmā! Pèiqí xǐhuan chuān shàng yǔxuē!",
        "vi": "Con xin lỗi mẹ! Peppa rất thích đi ủng đi mưa!",
        "translation": "Con xin lỗi mẹ! Peppa rất thích đi ủng đi mưa!"
      }
    ]
  },
  {
    "id": "vid-KuvDtc4I_Hg",
    "videoId": "KuvDtc4I_Hg",
    "title": "Mandarin Corner: Street Interview in Beijing",
    "titleVi": "Phỏng vấn đường phố Bắc Kinh: Cuộc sống người dân thủ đô",
    "lang": "zh",
    "language": "zh",
    "category": "🏮 Văn hóa & Đời sống",
    "duration": "15:40",
    "level": "Trung cấp",
    "channel": "Mandarin Corner",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "大家好！今天我们来到北京的街头，采访一下当地的居民。",
        "pinyin": "Dàjiā hǎo! Jīntiān wǒmen lái dào Běijīng de jiētóu, cǎifǎng yīxià dāngdì de jūmín.",
        "vi": "Xin chào mọi người! Hôm nay chúng tôi có mặt trên đường phố Bắc Kinh để phỏng vấn người dân bản xứ.",
        "translation": "Xin chào mọi người! Hôm nay chúng tôi có mặt trên đường phố Bắc Kinh để phỏng vấn người dân bản xứ."
      },
      {
        "id": "c2",
        "start": 6,
        "end": 11.5,
        "text": "您好！请问您在北京生活多少年了？",
        "pinyin": "Nínhǎo! Qǐngwèn nín zài Běijīng shēnghuó duōshao nián le?",
        "vi": "Dạ xin chào bác! Xin hỏi bác đã sinh sống tại Bắc Kinh bao nhiêu năm rồi ạ?",
        "translation": "Dạ xin chào bác! Xin hỏi bác đã sinh sống tại Bắc Kinh bao nhiêu năm rồi ạ?"
      },
      {
        "id": "c3",
        "start": 12,
        "end": 18,
        "text": "我是土生土长的北京人，已经在这里住了快五十年了。",
        "pinyin": "Wǒ shì tǔshēng tǔzhǎng de Běijīng rén, yǐjīng zài zhèlǐ zhù le kuài wǔshí nián le.",
        "vi": "Tôi là người sinh ra và lớn lên ở Bắc Kinh, đã sống ở đây gần 50 năm rồi.",
        "translation": "Tôi là người sinh ra và lớn lên ở Bắc Kinh, đã sống ở đây gần 50 năm rồi."
      },
      {
        "id": "c4",
        "start": 18.5,
        "end": 24.5,
        "text": "您觉得这几十年北京最大的变化是什么？",
        "pinyin": "Nín juéde zhè jǐ shí nián Běijīng zuì dà de biànhuà shì shénme?",
        "vi": "Bác cảm thấy sự thay đổi lớn nhất của Bắc Kinh trong vài thập kỷ qua là gì?",
        "translation": "Bác cảm thấy sự thay đổi lớn nhất của Bắc Kinh trong vài thập kỷ qua là gì?"
      },
      {
        "id": "c5",
        "start": 25,
        "end": 32,
        "text": "交通越来越方便了，地铁四通八达，城市绿化也越来越美了。",
        "pinyin": "Jiāotōng yuèláiyuè fāngbiàn le, dìtiě sìtōngbādá, chéngshì lǜhuà yě yuèláiyuè měi le.",
        "vi": "Giao thông ngày càng thuận tiện, mạng lưới tàu điện ngầm khắp nơi, cây xanh thành phố cũng ngày càng đẹp hơn.",
        "translation": "Giao thông ngày càng thuận tiện, mạng lưới tàu điện ngầm khắp nơi, cây xanh thành phố cũng ngày càng đẹp hơn."
      }
    ]
  },
  {
    "id": "vid-88GxFwsKUfA",
    "videoId": "88GxFwsKUfA",
    "title": "Traditional Chinese Culture: Mid-Autumn Festival and Mooncakes",
    "titleVi": "Văn hóa truyền thống Trung Hoa: Tết Trung Thu & Bánh Trung Thu",
    "lang": "zh",
    "language": "zh",
    "category": "🏮 Văn hóa & Đời sống",
    "duration": "12:50",
    "level": "Nâng cao",
    "channel": "CCTV Culture",
    "cues": [
      {
        "id": "c1",
        "start": 0,
        "end": 5.5,
        "text": "中秋节是中国最重要的传统节日之一，象征着团圆与和谐。",
        "pinyin": "Zhōngqiūjié shì Zhōngguó zuì zhòngyào de chuántǒng jiérì zhī yī, xiàngzhēngzhe tuányuán yǔ héxié.",
        "vi": "Tết Trung thu là một trong những lễ hội truyền thống quan trọng nhất của Trung Quốc, tượng trưng cho sự đoàn viên và hòa hợp.",
        "translation": "Tết Trung thu là một trong những lễ hội truyền thống quan trọng nhất của Trung Quốc, tượng trưng cho sự đoàn viên và hòa hợp."
      },
      {
        "id": "c2",
        "start": 6,
        "end": 12,
        "text": "农历八月十五这一天，月亮最圆最亮，全家人都会聚在一起吃月饼、赏月。",
        "pinyin": "Nónglì bā yuè shíwǔ zhè yī tiān, yuèliang zuì yuán zuì liàng, quán jiā rén dōu huì jù zài yīqǐ chī yuèbǐng, shǎng yuè.",
        "vi": "Vào ngày Rằm tháng Tám âm lịch, trăng tròn và sáng nhất, cả gia đình sẽ quây quần bên nhau ăn bánh trung thu và ngắm trăng.",
        "translation": "Vào ngày Rằm tháng Tám âm lịch, trăng tròn và sáng nhất, cả gia đình sẽ quây quần bên nhau ăn bánh trung thu và ngắm trăng."
      },
      {
        "id": "c3",
        "start": 12.5,
        "end": 18.5,
        "text": "月饼圆圆的形状代表着家庭圆满，寄托了人们对美好生活的向往。",
        "pinyin": "Yuèbǐng yuányuán de xíngzhuàng dàibiǎozhe jiātíng yuánmǎn, jìtuō le rénmen duì měihǎo shēnghuó de xiàngwǎng.",
        "vi": "Hình dáng tròn trịa của chiếc bánh trung thu đại diện cho sự vẹn tròn của gia đình, gửi gắm ước nguyện về một cuộc sống tốt đẹp.",
        "translation": "Hình dáng tròn trịa của chiếc bánh trung thu đại diện cho sự vẹn tròn của gia đình, gửi gắm ước nguyện về một cuộc sống tốt đẹp."
      }
    ]
  }
]
