export type SubtitleCue = {
  start: number
  end: number
  text: string
  vi?: string
  pinyin?: string
}

export type VideoLesson = {
  id: string
  title: string
  videoId: string
  lang: 'en' | 'zh'
  category: string
  level: 'Cơ bản' | 'Trung cấp' | 'Nâng cao'
  duration?: string
  isOfficial?: boolean
  cues: SubtitleCue[]
}

export const VIDEO_CATEGORIES = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'DAILY', label: '🗣️ Giao tiếp đời sống' },
  { id: 'WORK', label: '💼 Công việc & Phỏng vấn' },
  { id: 'TRAVEL', label: '✈️ Du lịch & Khách sạn' },
  { id: 'FOOD', label: '🍜 Ăn uống & Mua sắm' },
  { id: 'MOVIE', label: '🎬 Phim ảnh & Sitcom' },
  { id: 'TED', label: '🎤 Thuyết trình & TED' },
  { id: 'HSK', label: '📚 Luyện thi HSK' },
  { id: 'CULTURE', label: '🏮 Văn hóa & Đời sống' },
] as const

export const VIDEO_LESSONS_DATABASE: VideoLesson[] = [
  // =========================================================================
  // 1. TIẾNG ANH - GIAO TIẾP ĐỜI SỐNG (DAILY CONVERSATION)
  // =========================================================================
  {
    id: 'en-daily-01',
    title: 'Giao tiếp hàng ngày: 10 Cách để có cuộc trò chuyện tuyệt vời (TED)',
    videoId: '8KkKuTCFvzI',
    lang: 'en',
    category: '🗣️ Giao tiếp đời sống',
    level: 'Cơ bản',
    duration: '03:15',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: 'A good conversation is like a miniskirt: short enough to retain interest, but long enough to cover the subject.', vi: 'Một cuộc trò chuyện hay giống như một chiếc váy ngắn: đủ ngắn để giữ sự hứng thú, nhưng đủ dài để bao quát chủ đề.' },
      { start: 4.5, end: 10.0, text: 'Number one: Don’t multitask. Be present. Be in that moment.', vi: 'Điều số một: Đừng làm nhiều việc cùng lúc. Hãy hiện diện trọn vẹn trong khoảnh khắc đó.' },
      { start: 10.0, end: 15.5, text: 'Number two: Don’t pontificate. Enter every conversation assuming you have something to learn.', vi: 'Điều số hai: Đừng lên mặt dạy đời. Hãy bước vào mọi cuộc trò chuyện với tâm thế luôn có điều để học hỏi.' },
      { start: 15.5, end: 21.0, text: 'Number three: Use open-ended questions. Start with who, what, where, when, why, or how.', vi: 'Điều số ba: Dùng câu hỏi mở. Bắt đầu bằng ai, cái gì, ở đâu, khi nào, tại sao hoặc như thế nào.' },
      { start: 21.0, end: 27.0, text: 'Number four: Go with the flow. Thoughts will come into your mind, and you need to let them go out.', vi: 'Điều số bốn: Hãy thuận theo dòng chảy. Những suy nghĩ sẽ lướt qua tâm trí bạn, và bạn cần để chúng nhẹ nhàng trôi đi.' },
    ],
  },
  {
    id: 'en-daily-02',
    title: 'Thử điều mới trong 30 ngày để thay đổi cuộc sống (Try Something New)',
    videoId: '_Z0z87Pey8Q',
    lang: 'en',
    category: '🗣️ Giao tiếp đời sống',
    level: 'Cơ bản',
    duration: '03:10',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: 'A few years ago, I felt like I was stuck in a rut, so I decided to follow in the footsteps of the great American philosopher, Morgan Spurlock.', vi: 'Vài năm trước, tôi cảm thấy mình bị mắc kẹt trong lối mòn, nên tôi quyết định noi theo bước chân của nhà triết học vĩ đại người Mỹ, Morgan Spurlock.' },
      { start: 4.5, end: 9.5, text: 'The idea is actually pretty simple: Think about something you’ve always wanted to add to your life and try it for the next 30 days.', vi: 'Ý tưởng thực ra rất đơn giản: Nghĩ về điều bạn luôn muốn bổ sung vào cuộc sống và thử làm nó trong 30 ngày tới.' },
      { start: 9.5, end: 15.0, text: 'It turns out, 30 days is just about the right amount of time to add a new habit or subtract a habit from your life.', vi: 'Hóa ra, 30 ngày là khoảng thời gian vừa vặn để hình thành một thói quen mới hoặc từ bỏ một thói quen cũ trong cuộc sống.' },
      { start: 15.0, end: 20.5, text: 'Instead of the months flying by, forgotten, the time was much more memorable.', vi: 'Thay vì để những tháng ngày trôi qua trong quên lãng, thời gian trở nên đáng nhớ hơn rất nhiều.' },
      { start: 20.5, end: 26.0, text: 'So what are you waiting for? I guarantee you the next 30 days are going to pass whether you like it or not.', vi: 'Vậy bạn còn chờ đợi điều gì nữa? Tôi đảm bảo rằng 30 ngày tiếp theo vẫn sẽ trôi qua dù bạn muốn hay không.' },
    ],
  },
  {
    id: 'en-daily-03',
    title: 'Làm quen bạn mới & Hỏi thăm nơi chốn (Meeting New Friends)',
    videoId: 'iCvmsMzlF7o',
    lang: 'en',
    category: '🗣️ Giao tiếp đời sống',
    level: 'Cơ bản',
    duration: '02:30',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.0, text: 'Hi there! Mind if I sit here? Everywhere else seems to be packed.', vi: 'Chào bạn! Mình ngồi đây được không? Chỗ nào cũng kín bàn cả rồi.' },
      { start: 4.0, end: 8.5, text: 'Sure, please take a seat! Are you studying for upcoming exams?', vi: 'Được chứ, bạn cứ tự nhiên ngồi đi! Bạn đang ôn thi kỳ tới à?' },
      { start: 8.5, end: 13.5, text: 'Yes, studying computer science. By the way, I’m Minh, nice to meet you!', vi: 'Đúng vậy, mình học ngành công nghệ thông tin. Tiện thể mình là Minh, rất vui được gặp bạn!' },
      { start: 13.5, end: 18.0, text: 'Nice to meet you too, Minh! I’m Sarah, majoring in graphic design.', vi: 'Rất vui được gặp bạn, Minh! Mình là Sarah, sinh viên chuyên ngành thiết kế đồ họa.' },
      { start: 18.0, end: 23.0, text: 'That’s awesome! If you ever want to grab lunch together on campus, let me know.', vi: 'Tuyệt quá! Nếu lúc nào rảnh muốn cùng ăn trưa ở trường thì ới mình nhé.' },
    ],
  },
  {
    id: 'en-daily-04',
    title: 'Lên lịch hẹn cuối tuần & Hoạt động dã ngoại (Weekend Outdoor Activities)',
    videoId: 'Ks-_Mh1QhMc',
    lang: 'en',
    category: '🗣️ Giao tiếp đời sống',
    level: 'Cơ bản',
    duration: '02:15',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.2, text: 'The weather forecast says it will be sunny and warm this Saturday.', vi: 'Dự báo thời tiết nói thứ Bảy tuần này trời sẽ nắng ráo và ấm áp.' },
      { start: 4.2, end: 9.0, text: 'Perfect! Do you want to go hiking up the national park trails?', vi: 'Hoàn hảo! Bạn có muốn cùng đi leo núi ở các cung đường công viên quốc gia không?' },
      { start: 9.0, end: 13.5, text: 'I’d love to! Should we pack our own sandwiches and plenty of water?', vi: 'Mình rất thích! Tụi mình có nên tự chuẩn bị bánh mì kẹp và mang nhiều nước không?' },
      { start: 13.5, end: 18.0, text: 'Definitely. Let’s meet at the park entrance at eight in the morning.', vi: 'Chắc chắn rồi. Tụi mình hẹn nhau ở cổng công viên lúc 8 giờ sáng nhé.' },
    ],
  },
  {
    id: 'en-daily-05',
    title: 'Mượn đồ & Cảm ơn lịch sự (Borrowing & Saying Thanks)',
    videoId: 'Y6bbMQXQ180',
    lang: 'en',
    category: '🗣️ Giao tiếp đời sống',
    level: 'Cơ bản',
    duration: '01:50',
    isOfficial: true,
    cues: [
      { start: 0, end: 3.5, text: 'Excuse me, do you happen to have a spare umbrella I could borrow?', vi: 'Xin lỗi, bạn có chiếc ô thừa nào cho mình mượn được không?' },
      { start: 3.5, end: 7.5, text: 'It started pouring rain out of nowhere and I left mine at home.', vi: 'Trời bỗng nhiên đổ mưa to quá mà mình lại để quên ô ở nhà.' },
      { start: 7.5, end: 12.0, text: 'Yes, of course! I keep an extra umbrella right in my locker.', vi: 'Có chứ, tất nhiên rồi! Mình luôn để sẵn một chiếc ô sơ cua trong tủ đồ.' },
      { start: 12.0, end: 16.5, text: 'You can return it to me tomorrow. Stay dry out there!', vi: 'Ngày mai bạn gửi lại mình cũng được. Đi đường cẩn thận kẻo ướt nhé!' },
      { start: 16.5, end: 20.5, text: 'Thank you so much! I really appreciate your kindness.', vi: 'Cảm ơn bạn nhiều lắm! Mình rất trân trọng lòng tốt của bạn.' },
    ],
  },

  // =========================================================================
  // 2. TIẾNG ANH - CÔNG VIỆC & PHỎNG VẤN (WORK & CAREER)
  // =========================================================================
  {
    id: 'en-work-01',
    title: 'Tại sao những nhà lãnh đạo xuất sắc truyền cảm hứng (Simon Sinek TED)',
    videoId: 'Y6bbMQXQ180',
    lang: 'en',
    category: '💼 Công việc & Phỏng vấn',
    level: 'Trung cấp',
    duration: '03:40',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: 'How do you explain when things don’t go as we assume? Or better, how do you explain when others are able to achieve things that seem to defy all of the assumptions?', vi: 'Làm thế nào bạn giải thích được khi mọi thứ không diễn ra như chúng ta dự đoán? Hay kỳ diệu hơn, làm sao người khác có thể đạt được những thành tựu vượt xa mọi giả định?' },
      { start: 4.5, end: 10.0, text: 'As it turns out, there’s a pattern. All the great inspiring leaders in the world think, act, and communicate the exact same way.', vi: 'Hóa ra, luôn có một khuôn mẫu. Tất cả những nhà lãnh đạo truyền cảm hứng vĩ đại trên thế giới đều suy nghĩ, hành động và giao tiếp theo cùng một cách.' },
      { start: 10.0, end: 15.5, text: 'And it’s the complete opposite to everyone else. I codified it, and I call it the Golden Circle: Why, How, What.', vi: 'Và cách làm đó hoàn toàn trái ngược với số đông. Tôi đã đúc kết nó lại, và gọi nó là Vòng tròn Hoàng kim: Tại sao, Bằng cách nào, Cái gì.' },
      { start: 15.5, end: 21.0, text: 'People don’t buy what you do; they buy why you do it. The goal is not just to hire people who need a job, it’s to hire people who believe what you believe.', vi: 'Mọi người không mua thứ bạn làm ra; họ mua lý do tại sao bạn làm điều đó. Mục tiêu không chỉ là tuyển người cần việc làm, mà là tuyển người cùng chung niềm tin với bạn.' },
    ],
  },
  {
    id: 'en-work-02',
    title: 'Phỏng vấn xin việc: Điểm mạnh & Điểm yếu của bạn (Strengths & Weaknesses)',
    videoId: '8KkKuTCFvzI',
    lang: 'en',
    category: '💼 Công việc & Phỏng vấn',
    level: 'Trung cấp',
    duration: '02:45',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: 'Could you tell us about your greatest professional strength and an area where you’re currently improving?', vi: 'Bạn có thể chia sẻ về thế mạnh chuyên môn lớn nhất và một điểm bạn đang nỗ lực cải thiện không?' },
      { start: 4.5, end: 10.0, text: 'My greatest strength is analytical problem-solving and cross-functional team collaboration.', vi: 'Thế mạnh lớn nhất của tôi là khả năng phân tích giải quyết vấn đề và cộng tác nhịp nhàng giữa các phòng ban.' },
      { start: 10.0, end: 15.5, text: 'In terms of growth, I used to struggle with delegating tasks because I wanted everything done perfectly.', vi: 'Về mặt hoàn thiện bản thân, trước đây tôi từng gặp khó khăn khi phân quyền giao việc vì cầu toàn.' },
      { start: 15.5, end: 21.0, text: 'I’ve learned to trust my team, communicate clear expectations, and empower them to take ownership.', vi: 'Tôi đã học cách tin tưởng đồng nghiệp, truyền đạt kỳ vọng rõ ràng và trao quyền để họ tự làm chủ công việc.' },
    ],
  },
  {
    id: 'en-work-03',
    title: 'Họp điều phối Sprint & Báo cáo tiến độ (Agile Sprint Standup Meeting)',
    videoId: 'Ks-_Mh1QhMc',
    lang: 'en',
    category: '💼 Công việc & Phỏng vấn',
    level: 'Trung cấp',
    duration: '02:20',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.0, text: 'Good morning everyone! Let’s keep today’s standup quick and focused.', vi: 'Chào buổi sáng mọi người! Buổi họp đầu ngày hôm nay chúng ta tóm gọn và tập trung nhé.' },
      { start: 4.0, end: 8.5, text: 'Yesterday, I finished the responsive user profile UI and ran automated test suites.', vi: 'Hôm qua, tôi đã hoàn thiện giao diện trang cá nhân responsive và chạy xong bộ kiểm thử tự động.' },
      { start: 8.5, end: 13.0, text: 'Today, I will begin implementing real-time push notification WebSocket handlers.', vi: 'Hôm nay, tôi sẽ bắt đầu triển khai các hàm xử lý thông báo đẩy thời gian thực qua WebSocket.' },
      { start: 13.0, end: 17.5, text: 'I have no blockers at the moment. Everything is on track for Friday’s release.', vi: 'Hiện tại tôi không gặp vướng mắc nào cả. Mọi thứ đang diễn ra đúng tiến độ cho đợt phát hành thứ Sáu.' },
    ],
  },

  // =========================================================================
  // 3. TIẾNG ANH - DU LỊCH & KHÁCH SẠN (TRAVEL & HOTEL)
  // =========================================================================
  {
    id: 'en-travel-01',
    title: 'Thủ tục làm thủ tục sân bay & Hành lý xách tay (Airport Check-in)',
    videoId: '_Z0z87Pey8Q',
    lang: 'en',
    category: '✈️ Du lịch & Khách sạn',
    level: 'Cơ bản',
    duration: '02:10',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.0, text: 'Good morning! Here is my passport and electronic ticket reference.', vi: 'Chào buổi sáng! Đây là hộ chiếu và mã vé điện tử của tôi.' },
      { start: 4.0, end: 8.5, text: 'Thank you. Would you prefer an aisle seat or a window seat today?', vi: 'Cảm ơn quý khách. Hôm nay bạn muốn chọn ghế lối đi hay ghế cạnh cửa sổ?' },
      { start: 8.5, end: 13.0, text: 'A window seat towards the front of the aircraft would be fantastic.', vi: 'Một ghế cạnh cửa sổ ở phía đầu máy bay thì tuyệt vời quá ạ.' },
      { start: 13.0, end: 18.0, text: 'Here is your boarding pass. Boarding will begin at gate 24 at 10:15 AM.', vi: 'Đây là thẻ lên máy bay của bạn. Giờ lên tàu bay bắt đầu lúc 10:15 sáng tại cổng số 24.' },
    ],
  },
  {
    id: 'en-travel-02',
    title: 'Đặt phòng khách sạn & Yêu cầu tiện nghi (Hotel Check-in & Amenities)',
    videoId: 'iCvmsMzlF7o',
    lang: 'en',
    category: '✈️ Du lịch & Khách sạn',
    level: 'Cơ bản',
    duration: '02:25',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: 'Hello! I have a booking under Michael Nguyen for four nights.', vi: 'Xin chào! Tôi có đặt phòng dưới tên Michael Nguyễn trong 4 đêm.' },
      { start: 4.5, end: 9.0, text: 'Welcome to Sunset Bay Resort! Your ocean-view suite is ready.', vi: 'Chào mừng quý khách đến Sunset Bay Resort! Phòng Suite nhìn ra biển của bạn đã sẵn sàng.' },
      { start: 9.0, end: 13.5, text: 'Is complimentary airport shuttle service included upon checkout?', vi: 'Khi trả phòng bên mình có dịch vụ xe đưa đón ra sân bay miễn phí không ạ?' },
      { start: 13.5, end: 18.5, text: 'Yes, just inform the front desk 2 hours before your flight departure.', vi: 'Có ạ, bạn chỉ cần báo với quầy lễ tân trước 2 tiếng so với giờ bay là được.' },
    ],
  },

  // =========================================================================
  // 4. TIẾNG ANH - THUYẾT TRÌNH & TED TALKS (TED TALKS)
  // =========================================================================
  {
    id: 'en-ted-01',
    title: 'Bền bỉ: Sức mạnh của niềm đam mê và lòng kiên định (Grit - Angela Duckworth)',
    videoId: 'Ks-_Mh1QhMc',
    lang: 'en',
    category: '🎤 Thuyết trình & TED',
    level: 'Nâng cao',
    duration: '03:30',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: 'When I was 27 years old, I left a very demanding job in management consulting for a job that was even more demanding: teaching.', vi: 'Năm tôi 27 tuổi, tôi đã rời bỏ một công việc cố vấn quản trị đầy áp lực để chọn một công việc còn đòi hỏi khắt khe hơn: nghề dạy học.' },
      { start: 4.5, end: 10.0, text: 'I came to realize that IQ was not the only difference between my best and worst students.', vi: 'Tôi nhận ra rằng chỉ số IQ không phải là điểm khác biệt duy nhất giữa học sinh giỏi nhất và kém nhất của tôi.' },
      { start: 10.0, end: 15.5, text: 'Across very different contexts, one characteristic emerged as a significant predictor of success: and it wasn’t social intelligence, it wasn’t good looks, physical health, and it wasn’t IQ. It was grit.', vi: 'Trong vô số hoàn cảnh khác nhau, một phẩm chất nổi bật lên như yếu tố dự báo thành công quan trọng nhất: không phải trí thông minh xã hội, không phải ngoại hình đẹp, sức khỏe thể chất, cũng chẳng phải IQ. Đó chính là sự bền bỉ (Grit).' },
      { start: 15.5, end: 21.5, text: 'Grit is living life like it’s a marathon, not a sprint.', vi: 'Bền bỉ là sống cuộc đời như một cuộc chạy việt dã marathon, chứ không phải một cú chạy nước rút ngắn ngủi.' },
    ],
  },
  {
    id: 'en-ted-02',
    title: 'Tự tin từ dáng đứng: Ngôn ngữ cơ thể làm thay đổi tâm lý (Amy Cuddy TED)',
    videoId: 'iCvmsMzlF7o',
    lang: 'en',
    category: '🎤 Thuyết trình & TED',
    level: 'Nâng cao',
    duration: '03:15',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: 'Body language affects how others see us, but it may also change how we see ourselves.', vi: 'Ngôn ngữ cơ thể ảnh hưởng đến cách người khác nhìn nhận chúng ta, nhưng nó cũng có thể thay đổi cách chúng ta nhìn nhận chính mình.' },
      { start: 4.5, end: 10.0, text: 'When you feel powerful, you make yourself bigger. When you feel powerless, you close up.', vi: 'Khi bạn cảm thấy mạnh mẽ, bạn mở rộng tư thế ra. Khi cảm thấy yếu thế, bạn thu mình lại.' },
      { start: 10.0, end: 15.5, text: 'Our bodies change our minds, our minds can change our behavior, and our behavior can change our outcomes.', vi: 'Cơ thể thay đổi tâm trí, tâm trí có thể thay đổi hành vi, và hành vi có thể thay đổi toàn bộ kết quả của chúng ta.' },
    ],
  },

  // =========================================================================
  // 5. TIẾNG TRUNG - KHẨU NGỮ ĐỜI SỐNG (DAILY CHINESE)
  // =========================================================================
  {
    id: 'zh-daily-01',
    title: 'Giao tiếp hàng ngày: Chào hỏi, làm quen & hỏi thăm nơi chốn (日常问候与打招呼)',
    videoId: 'v1y87n9KzY0',
    lang: 'zh',
    category: '🗣️ Giao tiếp đời sống',
    level: 'Cơ bản',
    duration: '02:20',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.0, text: '你好！请问附近有地铁站或者公交车站吗？', pinyin: 'Nǐ hǎo! Qǐng wèn fù jìn yǒu dì tiě zhàn huò zhě gōng jiāo chē zhàn ma?', vi: 'Chào bạn! Cho hỏi gần đây có ga tàu điện ngầm hay trạm xe buýt nào không?' },
      { start: 4.0, end: 8.5, text: '沿着这条街一直往前走，过两个红绿灯就到了。', pinyin: 'Yán zhe zhè tiáo jiē yī zhí wǎng qián zǒu, guò liǎng gè hóng lǜ dēng jiù dào le.', vi: 'Cứ đi thẳng dọc theo con phố này, qua 2 cột đèn giao thông là tới nơi nhé.' },
      { start: 8.5, end: 13.0, text: '大概需要步行多长时间？需要过马路吗？', pinyin: 'Dà gài xū yào bù xíng duō cháng shí jiān? Xū yào guò mǎ lù ma?', vi: 'Đi bộ mất khoảng bao lâu? Có cần phải băng qua đường không bạn?' },
      { start: 13.0, end: 17.5, text: '走路差不多五分钟，在右手边就能看到地铁入口。', pinyin: 'Zǒu lù chà bu duō wǔ fēn zhōng, zài yòu shǒu biān jiù néng kàn dào dì tiě rù kǒu.', vi: 'Đi bộ chừng 5 phút thôi, ở phía tay phải là bạn nhìn thấy cửa vào ga tàu điện rồi.' },
      { start: 17.5, end: 21.0, text: '太感谢你了！祝你今天过得愉快！', pinyin: 'Tài gǎn xiè nǐ le! Zhù nǐ jīn tiān guò de yú kuài!', vi: 'Cảm ơn bạn nhiều lắm! Chúc bạn một ngày tốt lành nhé!' },
    ],
  },
  {
    id: 'zh-daily-02',
    title: 'Hẹn hò cuối tuần & Lên kế hoạch đi dạo phố (周末约会与逛街计划)',
    videoId: '3JZ_D3ELwOQ',
    lang: 'zh',
    category: '🗣️ Giao tiếp đời sống',
    level: 'Cơ bản',
    duration: '02:05',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: '明天下班后你有空吗？要不要一起去三里屯逛逛？', pinyin: 'Míng tiān xià bān hòu nǐ yǒu kòng ma? Yào bu yào yī qǐ qù Sān lǐ tún guàng guang?', vi: 'Ngày mai sau khi tan làm bạn có rảnh không? Có muốn cùng đi dạo chơi ở Tam Lý Đồn không?' },
      { start: 4.5, end: 9.0, text: '好啊！听说那里新开了一家特别棒的书店和咖啡馆。', pinyin: 'Hǎo a! Tīng shuō nà lǐ xīn kāi le yī jiā tè bié bàng de shū diàn hé kā fēi guǎn.', vi: 'Được chứ! Nghe nói ở đó vừa mở một tiệm sách kiêm quán cà phê siêu xịn.' },
      { start: 9.0, end: 13.5, text: '那我们六点半在地铁站出口见，顺便吃个晚饭。', pinyin: 'Nà wǒ men liù diǎn bàn zài dì tiě zhàn chū kǒu jiàn, shùn biàn chī gè wǎn fàn.', vi: 'Vậy tụi mình hẹn 6 rưỡi gặp ở cửa ra ga tàu điện, tiện thể đi ăn tối luôn nhé.' },
      { start: 13.5, end: 18.0, text: '一言为定！明天见！', pinyin: 'Yī yán wéi dìng! Míng tiān jiàn!', vi: 'Nhất trí như vậy nhé! Hẹn mai gặp!' },
    ],
  },

  // =========================================================================
  // 6. TIẾNG TRUNG - ẨM THỰC & MUA SẮM (FOOD & SHOPPING)
  // =========================================================================
  {
    id: 'zh-food-01',
    title: 'Giao tiếp gọi món tại quán Lẩu Tứ Xuyên (四川火锅点餐实用对话)',
    videoId: 'v1y87n9KzY0',
    lang: 'zh',
    category: '🍜 Ăn uống & Mua sắm',
    level: 'Cơ bản',
    duration: '02:30',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.0, text: '服务员，请给我们上一份九宫格牛油麻辣锅底。', pinyin: 'Fú wù yuán, qǐng gěi wǒ men shàng yī fèn jiǔ gōng gé niú yóu má là guō dǐ.', vi: 'Phục vụ ơi, cho chúng tôi một nồi lẩu chín ô dầu bò cay tê Tứ Xuyên nhé.' },
      { start: 4.0, end: 8.5, text: '好的，请问能吃辣吗？我们需要给您做微辣还是中辣？', pinyin: 'Hǎo de, qǐng wèn néng chī là ma? Wǒ men xū yào gěi nín zuò wēi là hái shì zhōng là?', vi: 'Dạ vâng, xin hỏi anh chị ăn cay tốt không ạ? Quán làm cay vừa hay cay vừa phải cho anh chị?' },
      { start: 8.5, end: 13.0, text: '微辣就好。肉类要两份毛肚、一份鸭肠和一份手打虾滑。', pinyin: 'Wēi là jiù hǎo. Ròu lèi yào liǎng fèn máo dù, yī fèn yā cháng hé yī fèn shǒu dǎ xiā huá.', vi: 'Ít cay thôi em nhé. Thịt thì cho 2 phần sách bò, 1 phần lòng vịt và 1 phần chả tôm quết tay.' },
      { start: 13.0, end: 17.5, text: '没问题！调料台在进门左侧，您可以自取香油蒜泥小料。', pinyin: 'Méi wèn tí! Tiáo liào tái zài jìn mén zuǒ cè, nín kě yǐ zì qǔ xiāng yóu suàn ní xiǎo liào.', vi: 'Dạ không vấn đề! Quầy nước chấm ở bên trái lối vào, anh chị có thể tự lấy dầu mè và tỏi ớt băm ạ.' },
      { start: 17.5, end: 22.0, text: '好的，谢谢！再给我们拿两听冰可乐。', pinyin: 'Hǎo de, xiè xie! Zài gěi wǒ men ná liǎng tīng bīng kě lè.', vi: 'Được rồi cảm ơn em! Lấy thêm cho tụi anh 2 lon coca ướp lạnh nữa nha.' },
    ],
  },
  {
    id: 'zh-shopping-01',
    title: 'Mua sắm quần áo & Mặc cả khéo léo tại chợ (服装店购物与讨价还价)',
    videoId: '3JZ_D3ELwOQ',
    lang: 'zh',
    category: '🍜 Ăn uống & Mua sắm',
    level: 'Cơ bản',
    duration: '02:15',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.0, text: '老板，这件黑色大衣有大一号的尺码吗？', pinyin: 'Lǎo bǎn, zhè jiàn hēi sè dà yī yǒu dà yī hào de chǐ mǎ ma?', vi: 'Chị chủ ơi, chiếc áo khoác dạ đen này có cỡ lớn hơn một số không?' },
      { start: 4.0, end: 8.5, text: '有的，我去仓库给你拿一件L码的试穿一下。', pinyin: 'Yǒu de, wǒ qù cāng kù gěi nǐ ná yī jiàn L mǎ de shì chuān yī xià.', vi: 'Có chứ em, để chị vào kho lấy cho em một chiếc size L mặc thử nhé.' },
      { start: 8.5, end: 13.0, text: '试衣间在右边。穿上版型特别修身，显瘦！', pinyin: 'Shì yī jiān zài yòu biān. Chuān shàng bǎn xíng tè bié xiū shēn, xiǎn shòu!', vi: 'Phòng thử đồ ở bên phải nha. Mặc lên phom dáng cực kỳ tôn dáng, trông thon gọn hẳn!' },
      { start: 13.0, end: 17.5, text: '版型确实不错。如果诚心买，能给打个折吗？', pinyin: 'Bǎn xíng què shí bù cuò. Rú guǒ chéng xīn mǎi, néng gěi dǎ gè zhé ma?', vi: 'Phom áo đúng là đẹp thật. Nếu em mua thật lòng, chị bớt giá cho em chút được không?' },
      { start: 17.5, end: 22.0, text: '看你这么喜欢，原价300算你240，够实惠了吧！', pinyin: 'Kàn nǐ zhè me xǐ huan, yuán jià sān bǎi suàn nǐ èr bǎi sì, gòu shí huì le ba!', vi: 'Thấy em thích thế này, giá gốc 300 tính em 240 thôi, quá hời rồi nhé!' },
    ],
  },

  // =========================================================================
  // 7. TIẾNG TRUNG - DU LỊCH & ĐI LẠI (TRAVEL ZH)
  // =========================================================================
  {
    id: 'zh-travel-01',
    title: 'Bắt taxi, gọi xe qua app & Chỉ đường (打车与定位导航)',
    videoId: '3JZ_D3ELwOQ',
    lang: 'zh',
    category: '✈️ Du lịch & Khách sạn',
    level: 'Cơ bản',
    duration: '02:00',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.0, text: '师傅，请问去首都机场大兴航站楼走高速吗？', pinyin: 'Shī fu, qǐng wèn qù Shǒu dū jī chǎng Dà xīng háng zhàn lóu zǒu gāo sù ma?', vi: 'Bác tài ơi, đi đến nhà ga sân bay Đại Hưng mình đi đường cao tốc đúng không ạ?' },
      { start: 4.0, end: 8.5, text: '对，走机场高速路况好，不会耽误你的航班。', pinyin: 'Duì, zǒu jī chǎng gāo sù lù kuàng hǎo, bù huì dān wu nǐ de háng bān.', vi: 'Đúng rồi, đi cao tốc sân bay đường thông thoáng, không sợ lỡ chuyến bay của cháu đâu.' },
      { start: 8.5, end: 13.0, text: '大概需要多长时间？我需要在下午两点前赶到。', pinyin: 'Dà gài xū yào duō cháng shí jiān? Wǒ xū yào zài xià wǔ liǎng diǎn qián gǎn dào.', vi: 'Mất khoảng bao lâu hả bác? Cháu cần có mặt trước 2 giờ chiều.' },
      { start: 13.0, end: 17.5, text: '放心吧，四十分钟准能到出发层4号门。', pinyin: 'Fàng xīn ba, sì shí fēn zhōng zhǔn néng dào chū fā céng sì hào mén.', vi: 'Yên tâm đi, 40 phút nữa là chuẩn xác tới cổng số 4 tầng ga đi nhé.' },
    ],
  },

  // =========================================================================
  // 8. TIẾNG TRUNG - LUYỆN THI HSK (HSK 3 - 4 - 5)
  // =========================================================================
  {
    id: 'zh-hsk-01',
    title: 'HSK 4: Hội thoại đàm phán công việc & Báo cáo kế hoạch (工作汇报与项目跟进)',
    videoId: 'v1y87n9KzY0',
    lang: 'zh',
    category: '📚 Luyện thi HSK',
    level: 'Trung cấp',
    duration: '02:40',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: '张总，这是新产品的市场调研报告和用户反馈总结。', pinyin: 'Zhāng zǒng, zhè shì xīn chǎn pǐn de shì chǎng diào yán bào gào hé yòng hù fǎn kuì zǒng jié.', vi: 'Tổng giám đốc Trương, đây là báo cáo khảo sát thị trường và tổng kết phản hồi người dùng sản phẩm mới.' },
      { start: 4.5, end: 9.5, text: '数据显示，年轻消费者对智能环保功能最感兴趣。', pinyin: 'Shù jù xiǎn shì, nián qīng xiāo fèi zhě duì zhì néng huán bǎo gōng néng zuì gǎn xìng qù.', vi: 'Số liệu cho thấy, người tiêu dùng trẻ tuổi quan tâm nhiều nhất đến tính năng thông minh và bảo vệ môi trường.' },
      { start: 9.5, end: 15.0, text: '因此，我们建议在下一阶段重点优化手机端应用程序的交互体验。', pinyin: 'Yīn cǐ, wǒ men jiàn yì zài xià yī jiē duàn zhòng diǎn yōu huà shǒu jī duān yīng yòng chéng xù de jiāo hù tǐ yàn.', vi: 'Vì vậy, chúng tôi kiến nghị giai đoạn tiếp theo tập trung tối ưu hóa trải nghiệm tương tác của ứng dụng di động.' },
      { start: 15.0, end: 20.0, text: '分析得很到位，抓紧安排研发团队下周启动第一期迭代。', pinyin: 'Fēn xī de hěn dào wèi, zhuā jǐn ān pái yán fā tuán duì xià zhōu qǐ dòng dì yī qī dié dài.', vi: 'Phân tích rất sâu sát, khẩn trương sắp xếp đội ngũ R&D tuần sau khởi động đợt cập nhật đầu tiên nhé.' },
    ],
  },
  {
    id: 'zh-hsk-02',
    title: 'HSK 5: Triết lý cuộc sống, kiên trì và tự hoàn thiện (坚持与心态修养)',
    videoId: '3JZ_D3ELwOQ',
    lang: 'zh',
    category: '📚 Luyện thi HSK',
    level: 'Nâng cao',
    duration: '03:10',
    isOfficial: true,
    cues: [
      { start: 0, end: 5.0, text: '古人说：“不积跬步，无以至千里；不积小流，无以成江海。”', pinyin: 'Gǔ rén shuō: “Bù jī kuǐ bù, wú yǐ zhì qiān lǐ; bù jī xiǎo liú, wú yǐ chéng jiāng hǎi.”', vi: 'Người xưa nói: “Không tích từng nửa bước, không thể đi ngàn dặm; không gom từng con suối nhỏ, không thể hóa thành sông biển mênh mông.”' },
      { start: 5.0, end: 10.5, text: '学习一门外语就像长跑，最关键的不是瞬间的爆发力，而是持久的自律与恒心。', pinyin: 'Xué xí yī mén wài yǔ jiù xiàng cháng pǎo, zuì guān jiàn de bù shì shùn jiān de bào fā lì, ér shì chí jiǔ de zì lǜ yǔ héng xīn.', vi: 'Học một ngoại ngữ cũng như chạy đường dài, điều cốt lõi nhất không phải là sự bùng nổ tức thời, mà là tính kỷ luật và lòng kiên trì bền bỉ.' },
      { start: 10.5, end: 16.5, text: '只要每天坚持阅读和听力练习，你的语言能力就一定会在潜移默化中突飞猛进。', pinyin: 'Zhǐ yào měi tiān jiān chí yuè dú hé tīng lì liàn xí, nǐ de yǔ yán néng lì jiù yī dìng huì zài qián yí mò huà zhōng tū fēi měng jìn.', vi: 'Chỉ cần mỗi ngày kiên trì luyện đọc và nghe, khả năng ngôn ngữ của bạn chắc chắn sẽ tiến bộ vượt bậc từng ngày.' },
    ],
  },

  // =========================================================================
  // 9. TIẾNG TRUNG - VĂN HÓA & PHIM ẢNH (CHINESE CULTURE & DRAMAS)
  // =========================================================================
  {
    id: 'zh-culture-01',
    title: 'Trà đạo & Phong tục thưởng trà Trung Hoa (中国传统茶文化与品茶礼仪)',
    videoId: 'v1y87n9KzY0',
    lang: 'zh',
    category: '🏮 Văn hóa & Đời sống',
    level: 'Trung cấp',
    duration: '02:50',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: '在中国，茶不仅是一种健康的饮品，更是一种传承千年的生活艺术。', pinyin: 'Zài Zhōng guó, chá bù jǐn shì yī zhǒng jiàn kāng de yǐn pǐn, gèng shì yī zhǒng chuán chéng qiān nián de shēng huó yì shù.', vi: 'Tại Trung Quốc, trà không chỉ là thức uống tốt cho sức khỏe, mà còn là một nghệ thuật sống lưu truyền ngàn năm.' },
      { start: 4.5, end: 9.5, text: '品茶讲究水温、茶具与心境，绿茶宜用80度水，而普洱与黑茶则需沸水冲泡。', pinyin: 'Pǐn chá jiǎng jiu shuǐ wēn, chá jù yǔ xīn jìng, lǜ chá yí yòng bā shí dù shuǐ, ér pǔ ěr yǔ hēi chá zé xū fèi shuǐ chōng pào.', vi: 'Thưởng trà chú trọng nhiệt độ nước, ấm chén và tâm thái, trà xanh nên dùng nước 80 độ, còn trà Phổ Nhĩ và trà đen cần nước sôi 100 độ.' },
      { start: 9.5, end: 15.0, text: '端起茶杯，先观其色，再闻其香，细细品味入口后的回甘。', pinyin: 'Duān qǐ chá bēi, xiān guān qí sè, zài wén qí xiāng, xì xì pǐn wèi rù kǒu hòu de huí gān.', vi: 'Nâng chén trà lên, trước ngắm màu nước, sau ngửi hương thơm, rồi chậm rãi thưởng thức vị ngọt hậu đọng lại nơi cuống họng.' },
    ],
  },
]
