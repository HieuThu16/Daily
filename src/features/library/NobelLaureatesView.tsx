import { useMemo, useState } from 'react'
import { Award, BookOpen, Check, Plus, Search } from 'lucide-react'
import type { Media } from '../../types'
import { localDate } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ToastContext'

export interface NobelBook {
  title: string
  originalTitle?: string
  year?: number
  summary: string
  genre?: string
  coverUrl?: string
}

export interface NobelAuthor {
  id: string
  year: number
  author: string
  country: string
  flag: string
  avatarUrl?: string
  citation: string
  bio: string
  masterpieces: NobelBook[]
}

export const NOBEL_AUTHORS_DATA: NobelAuthor[] = [
  {
    id: 'nobel-2024',
    year: 2024,
    author: 'Han Kang',
    country: 'Hàn Quốc',
    flag: '🇰🇷',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì văn xuôi giàu chất thơ mãnh liệt đối mặt với những chấn thương lịch sử và phơi bày sự mong manh của đời sống con người.',
    bio: 'Nhà văn nữ đầu tiên của châu Á và Hàn Quốc đoạt giải Nobel Văn học, nổi tiếng với phong cách viết gợi cảm xúc sâu sắc và giàu tính ẩn dụ.',
    masterpieces: [
      {
        title: 'Người Ăn Chay (The Vegetarian)',
        originalTitle: 'Chaesikjuuija',
        year: 2007,
        genre: 'Tiểu thuyết tâm lý, Hiện sinh',
        summary: 'Quyết định từ bỏ ăn thịt của người phụ nữ Yeong-hye kéo theo sự sụp đổ của các mối quan hệ gia đình và xã hội hà khắc.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Bản Chất Của Người (Human Acts)',
        originalTitle: 'Sonyeoni Onda',
        year: 2014,
        genre: 'Lịch sử, Bi kịch',
        summary: 'Tái hiện cuộc đàn áp phong trào sinh viên Gwangju năm 1980 qua góc nhìn của những nạn nhân và linh hồn người đã khuất.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Trắng (The White Book)',
        originalTitle: 'Huin',
        year: 2016,
        genre: 'Văn xuôi trữ tình, Hồi ức',
        summary: 'Tập hợp 65 suy tưởng về những vật màu trắng để tưởng niệm người chị gái đã mất chỉ vài giờ sau khi chào đời.',
        coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2023',
    year: 2023,
    author: 'Jon Fosse',
    country: 'Na Uy',
    flag: '🇳🇴',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì những vở kịch và tác phẩm văn xuôi đầy tính sáng tạo cất lên tiếng nói cho những điều không thể nói thành lời.',
    bio: 'Đại văn hào và nhà viết kịch đương đại người Na Uy viết bằng tiếng Nynorsk, nổi tiếng với phong cách tối giản và lặp lại thôi miên.',
    masterpieces: [
      {
        title: 'Septology (Bảy Hồi)',
        originalTitle: 'Det andre namnet (Septologien)',
        year: 2019,
        genre: 'Đại tiểu thuyết, Tâm linh',
        summary: 'Kiệt tác đồ sộ 7 phần viết bằng một câu văn duy nhất về cuộc đời của hai họa sĩ mang cùng tên Asle nhưng chọn ngã rẽ khác nhau.',
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Sáng Và Tối (Morning and Evening)',
        originalTitle: 'Morgon og kveld',
        year: 2000,
        genre: 'Tiểu thuyết ngắn, Sinh tử',
        summary: 'Hai khoảnh khắc trọng đại nhất của một người đánh cá: buổi sáng chào đời và buổi tối thanh thản từ giã cõi đời.',
        coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2022',
    year: 2022,
    author: 'Annie Ernaux',
    country: 'Pháp',
    flag: '🇫🇷',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì sự dũng cảm và nhạy bén lâm sàng giúp bà phơi bày cội rễ, sự tha hóa và những rào cản tập thể của ký ức cá nhân.',
    bio: 'Bà là người tiên phong của thể loại tự truyện xã hội học (auto-socio-biography), ghi lại cuộc đời mình hòa cùng dòng chảy lịch sử nước Pháp.',
    masterpieces: [
      {
        title: 'Những Năm Tháng (Les Années)',
        originalTitle: 'Les Années',
        year: 2008,
        genre: 'Tự truyện tập thể, Xã hội học',
        summary: 'Bức tranh toàn cảnh 6 thập kỷ nước Pháp từ sau Thế chiến II đến đầu thế kỷ 21 qua góc nhìn của ngôi thứ ba “bà”.',
        coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Nỗi Tủi Nhục (La Honte)',
        originalTitle: 'La Honte',
        year: 1997,
        genre: 'Tự sự, Tâm lý',
        summary: 'Ký ức kinh hoàng tuổi 12 khi chứng kiến cha định giết mẹ vào một chiều Chủ nhật tháng 6 năm 1952.',
        coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Một Chỗ Trong Đời (La Place)',
        originalTitle: 'La Place',
        year: 1983,
        genre: 'Hồi ức, Tình cha con',
        summary: 'Khắc họa chân dung người cha nông dân lao động nghèo và khoảng cách văn hóa đau đớn khi người con gái vươn lên tầng lớp tư sản.',
        coverUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2021',
    year: 2021,
    author: 'Abdulrazak Gurnah',
    country: 'Tanzania / Anh',
    flag: '🇹🇿',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì sự thâm nhập kiên định và giàu lòng trắc ẩn vào những ảnh hưởng của chủ nghĩa thực dân và số phận của những người tị nạn.',
    bio: 'Nhà văn gốc Zanzibar, miêu tả sâu sắc những va chạm văn hóa và thân phận người nhập cư Đông Phi.',
    masterpieces: [
      {
        title: 'Thiên Đường (Paradise)',
        originalTitle: 'Paradise',
        year: 1994,
        genre: 'Tiểu thuyết lịch sử, Đông Phi',
        summary: 'Cậu bé Yusuf 12 tuổi bị cha gán nợ cho một thương gia giàu có và chuyến hành trình buôn bán vào sâu vùng nội địa châu Phi hoang dã.',
        coverUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Bên Bờ Biển (By the Sea)',
        originalTitle: 'By the Sea',
        year: 2001,
        genre: 'Thân phận tị nạn, Ký ức',
        summary: 'Cuộc gặp gỡ tình cờ giữa hai người tị nạn Zanzibar tại một thị trấn ven biển nước Anh phơi bày những oán thù xưa cũ.',
        coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2020',
    year: 2020,
    author: 'Louise Glück',
    country: 'Mỹ',
    flag: '🇺🇸',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì giọng thơ thi ca không thể nhầm lẫn, với vẻ đẹp khắc khổ làm cho sự tồn tại cá nhân trở thành phổ quát.',
    bio: 'Nữ thi sĩ kiệt xuất nước Mỹ, từng đoạt giải Pulitzer, nổi tiếng với những bài thơ ngắn gọn, sắc bén về nỗi mất mát và thần thoại Hy Lạp.',
    masterpieces: [
      {
        title: 'Hoa Diên Vĩ Hoang Dã (The Wild Iris)',
        originalTitle: 'The Wild Iris',
        year: 1992,
        genre: 'Tập thơ đoạt giải Pulitzer',
        summary: 'Những bài thơ đối thoại giữa các loài hoa trong vườn, con người và Thượng đế về cái chết và sự tái sinh kỳ diệu.',
        coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Averno',
        originalTitle: 'Averno',
        year: 2006,
        genre: 'Thơ thần thoại, Nỗi buồn',
        summary: 'Tái diễn giải huyền thoại Persephone bị bắt cóc xuống âm phủ qua nỗi đau đớn của người mẹ Demeter và nỗi sợ về sự già nua.',
        coverUrl: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2019',
    year: 2019,
    author: 'Peter Handke',
    country: 'Áo',
    flag: '🇦🇹',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì một tác phẩm có ảnh hưởng lớn, với sự khéo léo về ngôn ngữ đã khám phá ngoại vi và tính đặc thù của trải nghiệm con người.',
    bio: 'Nhà văn và nhà biên kịch nổi tiếng người Áo, từng đồng viết kịch bản cho kiệt tác điện ảnh Wings of Desire của Wim Wenders.',
    masterpieces: [
      {
        title: 'Nỗi Sợ Của Thủ Môn Trước Chấm Phạt Đền',
        originalTitle: 'Die Angst des Tormanns beim Elfmeter',
        year: 1970,
        genre: 'Tâm lý tội phạm hiện sinh',
        summary: 'Cựu thủ môn bóng đá Josef Bloch rơi vào trạng thái hoang tưởng mất kết nối với thực tại sau khi phạm một vụ giết người vô nghĩa.',
        coverUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2018',
    year: 2018,
    author: 'Olga Tokarczuk',
    country: 'Ba Lan',
    flag: '🇵🇱',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì một trí tưởng tượng tự sự với niềm đam mê bách khoa đại diện cho việc vượt qua các ranh giới như một hình thức của cuộc sống.',
    bio: 'Cây bút nổi bật nhất văn đàn Ba Lan hiện đại, sở hữu phong cách “tiểu thuyết chòm sao” (constellation novel) đầy mê hoặc.',
    masterpieces: [
      {
        title: 'Những Người Du Hành (Flights)',
        originalTitle: 'Bieguni',
        year: 2007,
        genre: 'Tiểu thuyết du ký triết học (Man Booker Int.)',
        summary: 'Tập hợp các mảnh ghép câu chuyện về sự xê dịch, giải phẫu cơ thể người và khát vọng thoát ly khỏi sự tù túng.',
        coverUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Dẫn Cày Qua Xương Người Chết',
        originalTitle: 'Prowadź swój pług przez kości umarłych',
        year: 2009,
        genre: 'Trinh thám sinh thái, Huyền bí',
        summary: 'Bà lão Duszejko sống cô độc giữa rừng núi tin rằng các loài động vật hoang dã đang trả thù những kẻ săn trộm tàn bạo.',
        coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2017',
    year: 2017,
    author: 'Kazuo Ishiguro',
    country: 'Anh / Nhật Bản',
    flag: '🇬🇧',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    citation: 'Người trong những cuốn tiểu thuyết giàu cảm xúc đã mở ra vực thẳm bên dưới cảm giác huyễn tưởng về sự kết nối của chúng ta với thế giới.',
    bio: 'Nhà văn Anh gốc Nhật, bậc thầy của nghệ thuật khơi gợi ký ức, sự hoài niệm và những nỗi đau kìm nén.',
    masterpieces: [
      {
        title: 'Mãi Đừng Xa Tôi (Never Let Me Go)',
        originalTitle: 'Never Let Me Go',
        year: 2005,
        genre: 'Dystopia, Tâm lý, Cảm động',
        summary: 'Cuộc đời của Kathy cùng những người bạn được nuôi lớn tại trường nội trú Hailsham chỉ với mục đích nhân bản để hiến tạng.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Tàn Ngày Để Lại (The Remains of the Day)',
        originalTitle: 'The Remains of the Day',
        year: 1989,
        genre: 'Kinh điển hiện đại (Giải Man Booker)',
        summary: 'Người quản gia mẫu mực Stevens nhìn lại cuộc đời phụng sự tận tụy nhưng đã bỏ lỡ tình yêu chân thành và lý tưởng chính trị mù quáng.',
        coverUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Người Khổng Lồ Ngủ Quên (The Buried Giant)',
        originalTitle: 'The Buried Giant',
        year: 2015,
        genre: 'Kỳ ảo lịch sử, Lãng quên',
        summary: 'Đôi vợ chồng già Axl và Beatrice lên đường tìm con trai trong một thế giới bị bao phủ bởi làn sương mù xóa sạch mọi ký ức.',
        coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2016',
    year: 2016,
    author: 'Bob Dylan',
    country: 'Mỹ',
    flag: '🇺🇸',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì đã tạo ra những biểu đạt thi ca mới mẻ bên trong truyền thống ca khúc vĩ đại của nước Mỹ.',
    bio: 'Nhạc sĩ kiêm nhà thơ huyền thoại nước Mỹ, người đưa ca từ âm nhạc dân gian và rock đạt tới tầm cao văn học thế giới.',
    masterpieces: [
      {
        title: 'Biên Niên Ký (Chronicles: Volume One)',
        originalTitle: 'Chronicles: Volume One',
        year: 2004,
        genre: 'Hồi ký âm nhạc & Văn hóa Mỹ',
        summary: 'Những ký ức sống động về những ngày đầu đặt chân đến Greenwich Village, New York thập niên 60 và quá trình sáng tác đỉnh cao.',
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2015',
    year: 2015,
    author: 'Svetlana Alexievich',
    country: 'Belarus',
    flag: '🇧🇾',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì những tác phẩm phức điệu của bà, một tượng đài cho nỗi đau và lòng dũng cảm trong thời đại của chúng ta.',
    bio: 'Nhà báo điều tra vĩ đại sáng tạo nên thể loại “tiểu thuyết phức điệu từ giọng nói đời thực” (polyphonic novel).',
    masterpieces: [
      {
        title: 'Chiến Tranh Không Có Một Khuôn Mặt Phụ Nữ',
        originalTitle: 'U voyny ne zhenskoe litso',
        year: 1985,
        genre: 'Phóng sự tư liệu, Lịch sử',
        summary: 'Ghi chép lời kể đau xót của hơn 500 phụ nữ Liên Xô từng cầm súng chiến đấu ở tiền tuyến trong Thế chiến II.',
        coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Lời Nguyện Cầu Chernobyl (Voices from Chernobyl)',
        originalTitle: 'Chernobylskaia molitva',
        year: 1997,
        genre: 'Tư liệu thảm họa hạt nhân',
        summary: 'Những lời trần tình đẫm nước mắt của những người lính cứu hỏa, góa phụ và cư dân sau thảm họa nổ lò phản ứng hạt nhân 1986.',
        coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2014',
    year: 2014,
    author: 'Patrick Modiano',
    country: 'Pháp',
    flag: '🇫🇷',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì nghệ thuật ký ức mà qua đó ông đã gợi lại những số phận con người khó nắm bắt nhất và phơi bày thế giới của sự chiếm đóng.',
    bio: 'Nhà văn Pháp chuyên khám phá mê cung ký ức, bóng ma quá khứ và không gian Paris thời Đức chiếm đóng.',
    masterpieces: [
      {
        title: 'Ở Quán Cà Phê Của Tuổi Trẻ Lạc Lối',
        originalTitle: 'Dans le café de la jeunesse perdue',
        year: 2007,
        genre: 'Tiểu thuyết hoài niệm Paris',
        summary: 'Bốn góc nhìn khác nhau xoay quanh người phụ nữ bí ẩn Louki tại quán cà phê Le Condé ở Paris thập niên 1960.',
        coverUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Phố Những Ngọn Đèn Mù (Missing Person)',
        originalTitle: 'Rue des Boutiques Obscures',
        year: 1978,
        genre: 'Giải Goncourt, Trinh thám danh tính',
        summary: 'Thám tử Guy Roland bị mất trí nhớ lên đường lần tìm lại từng manh mối quá khứ để trả lời câu hỏi: “Tôi thực sự là ai?”.',
        coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2013',
    year: 2013,
    author: 'Alice Munro',
    country: 'Canada',
    flag: '🇨🇦',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    citation: 'Bậc thầy của truyện ngắn đương đại.',
    bio: 'Nhà văn Canada được mệnh danh là “Chekhov của Bắc Mỹ”, có khả năng cô đọng cả đời người bên trong một truyện ngắn.',
    masterpieces: [
      {
        title: 'Trốn Chạy (Runaway)',
        originalTitle: 'Runaway',
        year: 2004,
        genre: 'Tập truyện ngắn tâm lý xuất sắc',
        summary: 'Những người phụ nữ vùng nông thôn Ontario đấu tranh giữa khao khát trốn chạy và sự níu giữ của trách nhiệm gia đình.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2012',
    year: 2012,
    author: 'Mạc Ngôn (Mo Yan)',
    country: 'Trung Quốc',
    flag: '🇨🇳',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    citation: 'Người với chủ nghĩa hiện thực huyền ảo kết hợp truyện dân gian, lịch sử và tính đương đại.',
    bio: 'Đại văn hào Trung Quốc với phong cách hiện thực huyền ảo phương Đông rực rỡ và sức tưởng tượng dân gian cuồn cuộn.',
    masterpieces: [
      {
        title: 'Cao Lương Đỏ (Red Sorghum)',
        originalTitle: 'Hóng Gāoliang Jiāzú',
        year: 1986,
        genre: 'Sử thi dân gian, Kháng Nhật',
        summary: 'Sức sống hoang dại và bi tráng của gia đình họ Dư trên cánh đồng cao lương đỏ vùng Cao Mật thời kỳ kháng chiến.',
        coverUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Báu Vật Của Đời (Big Breasts and Wide Hips)',
        originalTitle: 'Fēngrǔ Fétún',
        year: 1995,
        genre: 'Sử thi gia tộc, Người mẹ',
        summary: 'Chân dung người Mẹ Lỗ Tuyền kiên cường gánh vác 9 người con vượt qua biến thiên lịch sử hiện đại Trung Quốc.',
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Đàn Hương Hình (Sandalwood Death)',
        originalTitle: 'Tánxiāngxíng',
        year: 2001,
        genre: 'Bi kịch lịch sử, Opera dân gian',
        summary: 'Một thiên tiểu thuyết độc đáo mô tả sự xung đột văn hóa thời Mãn Thanh và thứ nghệ thuật hành hình rùng rợn.',
        coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-2006',
    year: 2006,
    author: 'Orhan Pamuk',
    country: 'Thổ Nhĩ Kỳ',
    flag: '🇹🇷',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    citation: 'Người trong cuộc tìm kiếm linh hồn u sầu của thành phố quê hương đã phát hiện ra những biểu tượng mới cho sự xung đột và đan xen của các nền văn hóa.',
    bio: 'Nhà văn Thổ Nhĩ Kỳ đầu tiên đoạt giải Nobel, cây cầu nối văn hóa Đông - Tây tại thành phố huyền thoại Istanbul.',
    masterpieces: [
      {
        title: 'Tên Tôi Là Đỏ (My Name Is Red)',
        originalTitle: 'Benim Adım Kırmızı',
        year: 1998,
        genre: 'Trinh thám nghệ thuật, Hội họa Hồi giáo',
        summary: 'Vụ án mạng bí ẩn giữa các họa sư cung đình Ottoman thế kỷ 16 và cuộc xung đột tư tưởng hội họa phương Đông - phương Tây.',
        coverUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Bảo Tàng Của Sự Ngây Thơ (The Museum of Innocence)',
        originalTitle: 'Masumiyet Müzesi',
        year: 2008,
        genre: 'Tình yêu si mê, Hoài niệm',
        summary: 'Chàng công tử Kemal dành cả cuộc đời thu thập từng mẩu tàn thuốc, khuyên tai của người tình Füsun để xây nên bảo tàng kỷ vật.',
        coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-1982',
    year: 1982,
    author: 'Gabriel García Márquez',
    country: 'Colombia',
    flag: '🇨🇴',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì những cuốn tiểu thuyết và truyện ngắn kết hợp cái kỳ ảo và cái hiện thực trong một thế giới giàu trí tưởng tượng phản ánh cuộc sống và xung đột của một lục địa.',
    bio: 'Cây đại thụ của văn học Mỹ Latinh, người đưa chủ nghĩa hiện thực huyền ảo trở thành đỉnh cao rực rỡ của thế giới.',
    masterpieces: [
      {
        title: 'Trăm Năm Cô Đơn (One Hundred Years of Solitude)',
        originalTitle: 'Cien años de soledad',
        year: 1967,
        genre: 'Kiệt tác hiện thực huyền ảo thế giới',
        summary: 'Lịch sử 7 thế hệ thị tộc Buendía tại ngôi làng huyền thoại Macondo và lời nguyền cô đơn truyền kiếp.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Tình Yêu Thời Thổ Tả (Love in the Time of Cholera)',
        originalTitle: 'El amor en los tiempos del cólera',
        year: 1985,
        genre: 'Trường ca tình yêu bất hủ',
        summary: 'Florentino Ariza kiên nhẫn chờ đợi người tình Fermina Daza suốt 51 năm 9 tháng 4 ngày để nối lại tình đầu khi tuổi đã xế chiều.',
        coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-1968',
    year: 1968,
    author: 'Kawabata Yasunari',
    country: 'Nhật Bản',
    flag: '🇯🇵',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì sự bậc thầy trong nghệ thuật tự sự, thể hiện bản chất tâm hồn Nhật Bản với sự nhạy cảm sâu sắc.',
    bio: 'Nhà văn Nhật Bản đầu tiên đoạt giải Nobel Văn học, bậc thầy của mỹ học u hoài (Mono no aware) và vẻ đẹp hư ảo.',
    masterpieces: [
      {
        title: 'Xứ Tuyết (Snow Country)',
        originalTitle: 'Yukiguni',
        year: 1948,
        genre: 'Kiệt tác mỹ học Nhật Bản',
        summary: 'Mối tình hư ảo giữa chàng quý tộc Shimamura và nàng geisha Komako tại vùng suối nước nóng phủ tuyết trắng xóa.',
        coverUrl: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Ngàn Cánh Hạc (Thousand Cranes)',
        originalTitle: 'Sembarizuru',
        year: 1952,
        genre: 'Trà đạo, Tội lỗi và Mỹ cảm',
        summary: 'Những mối quan hệ tình cảm đan xen đầy u ẩn xoay quanh các nghi lễ Trà đạo truyền thống xứ Phù Tang.',
        coverUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Cố Đô (The Old Capital)',
        originalTitle: 'Koto',
        year: 1962,
        genre: 'Văn hóa Kyoto, Tình chị em',
        summary: 'Bức tranh mùa lễ hội tại Kyoto cổ kính và số phận của hai chị em sinh đôi Chieko và Naeko bị thất lạc nhau từ nhỏ.',
        coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-1957',
    year: 1957,
    author: 'Albert Camus',
    country: 'Pháp',
    flag: '🇫🇷',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì những sáng tác văn học quan trọng đã soi sáng những vấn đề của lương tri con người trong thời đại của chúng ta.',
    bio: 'Triết gia và nhà văn hiện sinh lớn của Pháp, người đề xướng triết lý về Phi lý (Absurdism) và sự phản kháng.',
    masterpieces: [
      {
        title: 'Người Xa Lạ (L’Étranger)',
        originalTitle: "L'Étranger",
        year: 1942,
        genre: 'Hiện sinh, Phi lý',
        summary: 'Chàng Meursault thờ ơ trước cái chết của mẹ và vô tình bắn chết một người Ả Rập dưới ánh mặt trời gay gắt bãi biển Algiers.',
        coverUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Dịch Hạch (La Peste)',
        originalTitle: 'La Peste',
        year: 1947,
        genre: 'Ẩn dụ dịch bệnh, Phản kháng',
        summary: 'Bác sĩ Rieux cùng những người bạn chiến đấu dũng cảm chống lại nạn dịch hạch phong tỏa thành phố Oran.',
        coverUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'nobel-1954',
    year: 1954,
    author: 'Ernest Hemingway',
    country: 'Mỹ',
    flag: '🇺🇸',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    citation: 'Vì sự bậc thầy trong nghệ thuật tự sự, thể hiện gần đây nhất trong Ông Già Và Biển Cả, và vì ảnh hưởng của ông đối với phong cách đương đại.',
    bio: 'Đại văn hào Mỹ nổi tiếng với nguyên lý Tảng băng trôi (Iceberg Theory) và tinh thần bất khuất trước nghịch cảnh.',
    masterpieces: [
      {
        title: 'Ông Già Và Biển Cả (The Old Man and the Sea)',
        originalTitle: 'The Old Man and the Sea',
        year: 1952,
        genre: 'Kiệt tác văn học thế giới (Pulitzer & Nobel)',
        summary: 'Cuộc chiến đơn độc kéo dài 3 ngày đêm của ông lão đánh cá Santiago với con cá kiếm khổng lồ trên dòng hải lưu Cuba: “Con người có thể bị hủy diệt nhưng không thể bị đánh bại”.',
        coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=80',
      },
      {
        title: 'Giã Từ Vũ Khí (A Farewell to Arms)',
        originalTitle: 'A Farewell to Arms',
        year: 1929,
        genre: 'Chiến tranh, Tình yêu bi kịch',
        summary: 'Chuyện tình giữa trung úy lái xe cứu thương Frederic Henry và cô y tá Catherine Barkley giữa mưa bom Thế chiến I.',
        coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=300&auto=format&fit=crop&q=80',
      },
    ],
  },
]

export function NobelLaureatesView({
  existingBooks,
  onAdded,
}: {
  existingBooks: Media[]
  onAdded?: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedEra, setSelectedEra] = useState<string>('ALL')
  const [addingTitle, setAddingTitle] = useState<string | null>(null)
  const { showToast } = useToast()

  const existingBookNames = useMemo(() => {
    return new Set(existingBooks.map((b) => b.name.toLowerCase().trim()))
  }, [existingBooks])

  const filteredAuthors = useMemo(() => {
    const q = search.toLowerCase().trim()
    return NOBEL_AUTHORS_DATA.filter((item) => {
      const matchSearch =
        !q ||
        item.author.toLowerCase().includes(q) ||
        item.country.toLowerCase().includes(q) ||
        String(item.year).includes(q) ||
        item.citation.toLowerCase().includes(q) ||
        item.masterpieces.some(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            (m.originalTitle && m.originalTitle.toLowerCase().includes(q)) ||
            m.summary.toLowerCase().includes(q),
        )

      let matchEra = true
      if (selectedEra === '2020s') matchEra = item.year >= 2020
      else if (selectedEra === '2010s') matchEra = item.year >= 2010 && item.year < 2020
      else if (selectedEra === '2000s') matchEra = item.year >= 2000 && item.year < 2010
      else if (selectedEra === 'classic') matchEra = item.year < 2000

      return matchSearch && matchEra
    })
  }, [search, selectedEra])

  async function handleAddMasterpiece(author: NobelAuthor, book: NobelBook) {
    setAddingTitle(book.title)
    try {
      if (supabase) {
        await supabase.from('media_items').insert({
          type: 'BOOK',
          name: book.title,
          author: author.author,
          genre: book.genre?.split(',')[0]?.trim() || 'Nobel Văn học',
          status: 'PLANNED',
          cover_url: book.coverUrl || null,
          description: `Tác phẩm của tác giả đoạt giải Nobel Văn học ${author.year} (${author.country}). ${book.summary}`,
          log_date: localDate(),
        })
      }
      showToast(`📖 Đã thêm "${book.title}" của ${author.author} vào Thư viện Sách!`, 'success')
      onAdded?.()
    } catch (e) {
      console.error(e)
      showToast('⚠️ Không thể thêm sách vào thư viện', 'error')
    } finally {
      setAddingTitle(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
      {/* Search & Era Selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div
          style={{
            position: 'relative',
            flex: '1 1 200px',
            minWidth: 0,
          }}
        >
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tác giả, quốc gia, năm Nobel, tên tác phẩm..."
            style={{
              width: '100%',
              paddingLeft: 32,
              paddingRight: 10,
              paddingTop: 8,
              paddingBottom: 8,
              fontSize: '0.82rem',
              borderRadius: 8,
              border: '1px solid var(--card-border)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
            }}
          />
        </div>

        <select
          value={selectedEra}
          onChange={(e) => setSelectedEra(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: '0.8rem',
            borderRadius: 8,
            border: '1px solid var(--card-border)',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">Tất cả các năm</option>
          <option value="2020s">Thập niên 2020 (2020 - nay)</option>
          <option value="2010s">Thập niên 2010 (2010 - 2019)</option>
          <option value="2000s">Thập niên 2000 (2000 - 2009)</option>
          <option value="classic">Thế kỷ 20 (Trước năm 2000)</option>
        </select>
      </div>

      {/* Count summary */}
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
        Hiển thị <strong>{filteredAuthors.length}</strong> đại tác giả đoạt giải Nobel Văn học
      </div>

      {/* Authors List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredAuthors.map((item) => (
          <div
            key={item.id}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '14px',
              margin: 0,
              borderRadius: 12,
              border: '1px solid var(--card-border)',
              background: 'var(--card-bg)',
            }}
          >
            {/* Author Header Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Author Avatar */}
              {item.avatarUrl ? (
                <img
                  src={item.avatarUrl}
                  alt={item.author}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--card-border)',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--bg-main)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '1rem',
                    fontWeight: 700,
                    border: '1px solid var(--card-border)',
                    flexShrink: 0,
                  }}
                >
                  {item.author.charAt(0)}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      margin: 0,
                      color: 'var(--text-main)',
                    }}
                  >
                    {item.author}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#f59e0b',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Award size={12} /> Nobel {item.year}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {item.flag} {item.country}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: 'var(--text-muted)',
                    marginTop: 2,
                    lineHeight: 1.35,
                  }}
                >
                  {item.bio}
                </div>
              </div>
            </div>

            {/* Official Nobel Citation */}
            <div
              style={{
                fontSize: '0.76rem',
                lineHeight: 1.4,
                color: 'var(--text-main)',
                fontStyle: 'italic',
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--bg-main)',
                borderLeft: '3px solid #f59e0b',
              }}
            >
              “{item.citation}”
            </div>

            {/* Masterpieces Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Tác phẩm tiêu biểu ({item.masterpieces.length}):
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.masterpieces.map((book) => {
                  const hasBook = existingBookNames.has(book.title.toLowerCase().trim())
                  const isAdding = addingTitle === book.title

                  return (
                    <div
                      key={book.title}
                      style={{
                        display: 'flex',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'var(--bg-main)',
                        border: '1px solid var(--card-border)',
                        alignItems: 'flex-start',
                      }}
                    >
                      {/* Book Cover */}
                      <div
                        style={{
                          width: 42,
                          height: 60,
                          borderRadius: 4,
                          overflow: 'hidden',
                          background: 'var(--card-bg)',
                          border: '1px solid var(--card-border)',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {book.coverUrl ? (
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            loading="lazy"
                          />
                        ) : (
                          <BookOpen size={16} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>

                      {/* Book Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                            {book.title}
                          </strong>
                          {book.year && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              ({book.year})
                            </span>
                          )}
                          {book.genre && (
                            <span
                              style={{
                                fontSize: '0.66rem',
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: 'var(--card-bg)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--card-border)',
                              }}
                            >
                              {book.genre}
                            </span>
                          )}
                        </div>

                        <p
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--text-muted)',
                            margin: '3px 0 0',
                            lineHeight: 1.35,
                          }}
                        >
                          {book.summary}
                        </p>
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={() => handleAddMasterpiece(item, book)}
                        disabled={hasBook || isAdding}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--card-border)',
                          background: hasBook ? 'var(--card-bg)' : 'var(--primary)',
                          color: hasBook ? 'var(--text-muted)' : '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: hasBook || isAdding ? 'default' : 'pointer',
                          flexShrink: 0,
                          alignSelf: 'center',
                          opacity: hasBook ? 0.75 : 1,
                        }}
                      >
                        {hasBook ? (
                          <>
                            <Check size={11} /> Đã có
                          </>
                        ) : (
                          <>
                            <Plus size={11} /> + Đọc
                          </>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
