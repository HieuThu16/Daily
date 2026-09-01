import { useMemo, useState } from 'react'
import { Award, BookOpen, Check, Clapperboard, Film, Plus, Search, Sparkles, Star } from 'lucide-react'
import type { Media } from '../../types'
import { localDate } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ToastContext'

export interface BookAdaptation {
  id: string
  bookTitle: string
  movieTitle: string
  originalTitle?: string
  author: string
  director: string
  movieYear: number
  bookYear?: number
  genre: string
  rating: string // e.g. "IMDb 9.2"
  awards?: string
  summary: string
  adaptationNote: string
  coverUrl?: string
}

export interface NobelAuthor {
  id: string
  year: number
  author: string
  country: string
  flag: string
  citation: string
  bio: string
  masterpieces: {
    title: string
    originalTitle?: string
    year?: number
    summary: string
    genre?: string
  }[]
}

export const BOOK_ADAPTATIONS_DATA: BookAdaptation[] = [
  {
    id: 'adp-1',
    bookTitle: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh',
    movieTitle: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh (Yellow Flowers on the Green Grass)',
    author: 'Nguyễn Nhật Ánh',
    director: 'Victor Vũ',
    movieYear: 2015,
    bookYear: 2010,
    genre: 'Tâm lý, Tuổi thơ, Việt Nam',
    rating: 'IMDb 7.5',
    awards: 'Giải Bông Sen Vàng 2015, Đại diện VN dự Oscar 2017',
    summary: 'Câu chuyện tuổi thơ miền quê nghèo Phú Yên thập niên 1980 qua góc nhìn hai anh em Thiều và Tường với những rung động đầu đời và tình anh em sâu sắc.',
    adaptationNote: 'Bản phim điện ảnh xuất sắc với những khung hình thiên nhiên Phú Yên tuyệt mỹ, âm nhạc da diết và diễn xuất tự nhiên của dàn diễn viên nhí.',
  },
  {
    id: 'adp-2',
    bookTitle: 'Mắt Biếc',
    movieTitle: 'Mắt Biếc (Dreamy Eyes)',
    author: 'Nguyễn Nhật Ánh',
    director: 'Victor Vũ',
    movieYear: 2019,
    bookYear: 1990,
    genre: 'Lãng mạn, Thanh xuân, Việt Nam',
    rating: 'IMDb 7.6',
    awards: 'Giải Bông Sen Vàng 2021, Kỷ lục phòng vé VN',
    summary: 'Mối tình đơn phương trọn đời của Ngạn dành cho cô bạn thanh mai trúc mã Hà Lan mang đôi mắt biếc, từ làng Đo Đo đến thị thành đầy cám dỗ.',
    adaptationNote: 'Gây bão phòng vé với nhạc phim của Phan Mạnh Quỳnh và tái hiện hoàn hảo không gian làng quê Việt Nam thập niên 70-80.',
  },
  {
    id: 'adp-3',
    bookTitle: 'Bố Già (The Godfather)',
    movieTitle: 'The Godfather (1972) & The Godfather Part II (1974)',
    originalTitle: 'The Godfather',
    author: 'Mario Puzo',
    director: 'Francis Ford Coppola',
    movieYear: 1972,
    bookYear: 1969,
    genre: 'Tội phạm, Kịch tính, Kinh điển',
    rating: 'IMDb 9.2',
    awards: '3 Giải Oscar (Phim hay nhất, Kịch bản hay nhất, Nam chính)',
    summary: 'Gia đình mafia Corleone đứng đầu là Don Vito Corleone và hành trình kế vị đầy máu lửa và bi kịch của người con trai Michael Corleone.',
    adaptationNote: 'Được tôn vinh là một trong những tác phẩm chuyển thể điện ảnh vĩ đại nhất lịch sử điện ảnh thế giới.',
  },
  {
    id: 'adp-4',
    bookTitle: 'Chúa Tể Những Chiếc Nhẫn (The Lord of the Rings)',
    movieTitle: 'The Lord of the Rings Trilogy (The Fellowship of the Ring, The Two Towers, The Return of the King)',
    originalTitle: 'The Lord of the Rings',
    author: 'J.R.R. Tolkien',
    director: 'Peter Jackson',
    movieYear: 2001,
    bookYear: 1954,
    genre: 'Kỳ ảo, Sử thi, Phiêu lưu',
    rating: 'IMDb 9.0',
    awards: '17 Giải Oscar (Phần 3 thắng kỷ lục 11/11 đề cử)',
    summary: 'Hành trình của người Hobbit Frodo Baggins cùng Hội đồng Hành tới ngọn núi Doom để tiêu hủy Chiếc Nhẫn Quyền Năng của Chúa tể Hắc ám Sauron.',
    adaptationNote: 'Kiệt tác chuyển thể sử thi kỳ ảo đồ sộ nhất, đặt ra chuẩn mực kỹ xảo và thế giới hư cấu cho toàn bộ ngành điện ảnh.',
  },
  {
    id: 'adp-5',
    bookTitle: 'Rừng Na Uy (Norwegian Wood)',
    movieTitle: 'Norwegian Wood (Rừng Na Uy)',
    originalTitle: 'Noruwei no Mori',
    author: 'Haruki Murakami',
    director: 'Trần Anh Hùng',
    movieYear: 2010,
    bookYear: 1987,
    genre: 'Tâm lý, Tình cảm, Nhật Bản',
    rating: 'IMDb 6.3',
    awards: 'Đề cử Sư Tử Vàng tại LHP Venice 2010',
    summary: 'Những hồi tưởng của Toru Watanabe về tuổi trẻ những năm 1960 ở Tokyo, về hai cô gái Naoko mong manh u uất và Midori tràn đầy sức sống.',
    adaptationNote: 'Đạo diễn người Pháp gốc Việt Trần Anh Hùng mang đến chất thơ thị giác u buồn, âm nhạc của Jonny Greenwood (Radiohead).',
  },
  {
    id: 'adp-6',
    bookTitle: 'Phía Sau Nghi Can X (The Devotion of Suspect X)',
    movieTitle: 'Suspect X (2008 Nhật Bản, 2012 Hàn Quốc, 2017 Trung Quốc)',
    originalTitle: 'Yōgisha Ekkusu no Kenshin',
    author: 'Higashino Keigo',
    director: 'Hiroshi Nishitani',
    movieYear: 2008,
    bookYear: 2005,
    genre: 'Trinh thám, Tâm lý, Trí tuệ',
    rating: 'IMDb 7.5',
    awards: 'Giải Viện Hàn Lâm Nhật Bản, Naoki Prize',
    summary: 'Cuộc đấu trí đỉnh cao giữa thiên tài toán học Ishigami - người tạo ra chứng cứ ngoại phạm hoàn hảo để bảo vệ người phụ nữ mình yêu, và giáo sư vật lý Yukawa.',
    adaptationNote: 'Chuyển thể trung thành đến nghẹt thở với cốt truyện trinh thám logic bậc thầy và cái kết lay động tâm can.',
  },
  {
    id: 'adp-7',
    bookTitle: 'Xứ Cát (Dune)',
    movieTitle: 'Dune: Part One (2021) & Dune: Part Two (2024)',
    originalTitle: 'Dune',
    author: 'Frank Herbert',
    director: 'Denis Villeneuve',
    movieYear: 2021,
    bookYear: 1965,
    genre: 'Khoa học viễn tưởng, Sử thi',
    rating: 'IMDb 8.6',
    awards: '6 Giải Oscar, Doanh thu toàn cầu trên 1 tỷ USD',
    summary: 'Paul Atreides và gia tộc tiếp quản hành tinh sa mạc nguy hiểm Arrakis - nguồn duy nhất của hương dược quý giá nhất vũ trụ.',
    adaptationNote: 'Denis Villeneuve hiện thực hóa thế giới sa mạc khổng lồ với âm thanh và hình ảnh choáng ngợp chưa từng có.',
  },
  {
    id: 'adp-8',
    bookTitle: 'Người Về Từ Sao Hỏa (The Martian)',
    movieTitle: 'The Martian (Người Về Từ Sao Hỏa)',
    originalTitle: 'The Martian',
    author: 'Andy Weir',
    director: 'Ridley Scott',
    movieYear: 2015,
    bookYear: 2011,
    genre: 'Khoa học viễn tưởng, Sinh tồn',
    rating: 'IMDb 8.0',
    awards: '2 Giải Quả Cầu Vàng, 7 Đề cử Oscar',
    summary: 'Phi hành gia kiêm nhà thực vật học Mark Watney bị bỏ lại một mình trên Sao Hỏa sau cơn bão cát và phải tìm cách sống sót trồng trọt chờ giải cứu.',
    adaptationNote: 'Matt Damon thể hiện sự lạc quan hài hước và trí tuệ khoa học thực tế, giữ trọn tinh thần cuốn sách bán chạy toàn cầu.',
  },
  {
    id: 'adp-9',
    bookTitle: 'Cuộc Đời Của Pi (Life of Pi)',
    movieTitle: 'Life of Pi (Cuộc Đời Của Pi)',
    originalTitle: 'Life of Pi',
    author: 'Yann Martel',
    director: 'Lý An (Ang Lee)',
    movieYear: 2012,
    bookYear: 2001,
    genre: 'Kỳ ảo, Sinh tồn, Triết lý',
    rating: 'IMDb 7.9',
    awards: '4 Giải Oscar (Đạo diễn xuất sắc nhất cho Lý An)',
    summary: 'Chàng trai Ấn Độ Pi Patel sống sót sau vụ đắm tàu trên chiếc xuồng cứu sinh cùng với một con hổ Bengal dữ tợn mang tên Richard Parker.',
    adaptationNote: 'Tác phẩm hình ảnh mãn nhãn với kỹ xảo 3D đỉnh cao của Lý An, chạm tới câu hỏi triết lý về niềm tin và sự sống.',
  },
  {
    id: 'adp-10',
    bookTitle: 'Kẻ Trộm Sách (The Book Thief)',
    movieTitle: 'The Book Thief (Kẻ Trộm Sách)',
    originalTitle: 'The Book Thief',
    author: 'Markus Zusak',
    director: 'Brian Percival',
    movieYear: 2013,
    bookYear: 2005,
    genre: 'Lịch sử, Tâm lý, Nhân văn',
    rating: 'IMDb 7.5',
    awards: 'Đề cử Oscar và Quả Cầu Vàng âm nhạc',
    summary: 'Dưới lời kể của Thần Chết, câu chuyện về cô bé Liesel Meminger tại nước Đức thời Thế chiến II tìm thấy sự cứu rỗi qua những cuốn sách đánh cắp.',
    adaptationNote: 'Tác phẩm xúc động tôn vinh sức mạnh của ngôn từ, tình người và hy vọng giữa thời kỳ đen tối nhất của lịch sử.',
  },
  {
    id: 'adp-11',
    bookTitle: 'Sự Im Lặng Của Bầy Cừu (The Silence of the Lambs)',
    movieTitle: 'The Silence of the Lambs',
    originalTitle: 'The Silence of the Lambs',
    author: 'Thomas Harris',
    director: 'Jonathan Demme',
    movieYear: 1991,
    bookYear: 1988,
    genre: 'Tâm lý, Tội phạm kinh dị',
    rating: 'IMDb 8.6',
    awards: 'Thắng trọn vẹn "Big Five" 5 Giải Oscar danh giá nhất',
    summary: 'Học viên FBI Clarice Starling phải tìm đến sự trợ giúp của bác sĩ tâm thần ăn thịt người Hannibal Lecter để truy bắt kẻ giết người hàng loạt Buffalo Bill.',
    adaptationNote: 'Diễn xuất huyền thoại của Anthony Hopkins và Jodie Foster tạo nên tác phẩm kinh dị tâm lý kinh điển mẫu mực.',
  },
  {
    id: 'adp-12',
    bookTitle: 'Triệu Phú Khu Ổ Chuột (Q & A)',
    movieTitle: 'Slumdog Millionaire (Triệu Phú Ổ Chuột)',
    originalTitle: 'Q & A',
    author: 'Vikas Swarup',
    director: 'Danny Boyle',
    movieYear: 2008,
    bookYear: 2005,
    genre: 'Kịch tính, Tình cảm, Xã hội',
    rating: 'IMDb 8.0',
    awards: '8 Giải Oscar (Bao gồm Phim hay nhất và Đạo diễn xuất sắc)',
    summary: 'Chàng trai nghèo Jamal Malik từ khu ổ chuột Mumbai trả lời chính xác tất cả các câu hỏi trong chương trình "Ai là triệu phú" nhờ những biến cố cuộc đời.',
    adaptationNote: 'Nhịp phim dồn dập, âm nhạc sôi động Jai Ho cùng câu chuyện tình yêu vượt qua định kiến xã hội Ấn Độ.',
  },
  {
    id: 'adp-13',
    bookTitle: 'Chuộc Tội (Atonement)',
    movieTitle: 'Atonement (Chuộc Tội)',
    originalTitle: 'Atonement',
    author: 'Ian McEwan',
    director: 'Joe Wright',
    movieYear: 2007,
    bookYear: 2001,
    genre: 'Tâm lý, Lãng mạn, Chiến tranh',
    rating: 'IMDb 7.8',
    awards: 'Giải Oscar cho Nhạc phim hay nhất, 7 Đề cử Oscar',
    summary: 'Một lời nói dối vô thức của cô bé 13 tuổi Briony đã xé nát mối tình đẹp giữa chị gái Cecilia và người yêu Robbie, đẩy họ vào bi kịch chiến tranh.',
    adaptationNote: 'Khung hình tuyệt đẹp và trường đoạn Dunkirk dài 5 phút không cắt kinh điển, cùng nỗi day dứt khôn nguôi về sự chuộc tội.',
  },
  {
    id: 'adp-14',
    bookTitle: 'Đấu Trường Sinh Tử (The Hunger Games)',
    movieTitle: 'The Hunger Games Series (2012 - 2015)',
    originalTitle: 'The Hunger Games',
    author: 'Suzanne Collins',
    director: 'Gary Ross / Francis Lawrence',
    movieYear: 2012,
    bookYear: 2008,
    genre: 'Dystopia, Hành động, Sinh tồn',
    rating: 'IMDb 7.2',
    awards: 'Doanh thu gần 3 tỷ USD toàn cầu',
    summary: 'Tại đất nước Panem tương lai độc tài, cô gái 16 tuổi Katniss Everdeen tình nguyện thế chỗ em gái tham gia trò chơi sinh tử tàn khốc phát sóng trực tiếp.',
    adaptationNote: 'Jennifer Lawrence tỏa sáng với biểu tượng Chim Húng Nhại, khơi nguồn trào lưu văn học phiêu lưu Dystopia toàn cầu.',
  },
  {
    id: 'adp-15',
    bookTitle: 'Cô Gái Có Hình Xăm Rồng (The Girl with the Dragon Tattoo)',
    movieTitle: 'The Girl with the Dragon Tattoo (2009 Thụy Điển & 2011 Hollywood)',
    originalTitle: 'Män som hatar kvinnor',
    author: 'Stieg Larsson',
    director: 'David Fincher / Niels Arden Oplev',
    movieYear: 2011,
    bookYear: 2005,
    genre: 'Trinh thám, Tội phạm đen',
    rating: 'IMDb 7.8',
    awards: 'Giải Oscar dựng phim xuất sắc nhất',
    summary: 'Nhà báo điều tra Mikael Blomkvist hợp tác cùng nữ hacker cá tính Lisbeth Salander để điều tra vụ mất tích bí ẩn 40 năm trước của một tiểu thư quyền thế.',
    adaptationNote: 'Phong cách u tối lạnh lẽo đậm chất Bắc Âu của David Fincher và diễn xuất ấn tượng của Rooney Mara.',
  },
]

export const NOBEL_AUTHORS_DATA: NobelAuthor[] = [
  {
    id: 'nobel-2024',
    year: 2024,
    author: 'Han Kang (한강)',
    country: 'Hàn Quốc',
    flag: '🇰🇷',
    citation: 'Vì văn xuôi thi vị mãnh liệt đối diện với những tổn thương lịch sử và phơi bày sự mong manh của đời sống con người.',
    bio: 'Nhà văn nữ đầu tiên của châu Á và Hàn Quốc đoạt giải Nobel Văn học, nổi tiếng với ngòi bút siêu thực, sắc sảo và chạm sâu vào tâm lý con người.',
    masterpieces: [
      {
        title: 'Người Ăn Chay (The Vegetarian)',
        year: 2007,
        summary: 'Người phụ nữ Yeong-hye quyết định từ bỏ ăn thịt sau những cơn ác mộng máu me, dẫn đến sự phản kháng âm thầm chống lại bạo lực gia đình và xã hội gia trưởng.',
        genre: 'Tâm lý, Siêu thực',
      },
      {
        title: 'Bản Chất Của Người (Human Acts)',
        year: 2014,
        summary: 'Tái hiện cuộc biểu tình đẫm máu tại Gwangju năm 1980 qua góc nhìn của những nạn nhân và linh hồn người đã khuất, khám phá giới hạn của nhân tính.',
        genre: 'Lịch sử, Nhân văn',
      },
      {
        title: 'Trắng (The White Book)',
        year: 2016,
        summary: 'Tác phẩm tự sự thi vị suy ngẫm về sự mất mát, cái chết và sự tái sinh thông qua những vật thể mang sắc trắng tinh khôi.',
        genre: 'Tùy bút, Thơ văn xuôi',
      },
    ],
  },
  {
    id: 'nobel-2023',
    year: 2023,
    author: 'Jon Fosse',
    country: 'Na Uy',
    flag: '🇳🇴',
    citation: 'Vì những vở kịch và văn xuôi đầy tính đổi mới đã lên tiếng cho những điều không thể nói ra.',
    bio: 'Một trong những nhà viết kịch và tiểu thuyết gia đương đại có ảnh hưởng nhất châu Âu, với phong cách tối giản giàu nhạc tính và chiều sâu nội tâm.',
    masterpieces: [
      {
        title: 'Bộ Ba (Trilogy: Wakefulness, Olav’s Dreams, Weariness)',
        year: 2014,
        summary: 'Câu chuyện tình yêu và sự cô đơn trôi dạt của đôi tình nhân trẻ Asle và Alida giữa mùa đông lạnh giá miền duyên hải Na Uy.',
        genre: 'Tiểu thuyết ngắn, Hiện sinh',
      },
      {
        title: 'Tiếng Đàn Khác (Septology: A New Name)',
        year: 2021,
        summary: 'Kiệt tác gồm 7 phần viết bằng dòng ý thức tuôn chảy không ngừng không dấu chấm, suy ngẫm về nghệ thuật, đức tin và số phận con người.',
        genre: 'Dòng ý thức, Triết học',
      },
    ],
  },
  {
    id: 'nobel-2022',
    year: 2022,
    author: 'Annie Ernaux',
    country: 'Pháp',
    flag: '🇫🇷',
    citation: 'Vì lòng can đảm và sự sắc sảo lạnh lùng mà bà dùng để bóc trần những nguồn gốc, sự ghẻ lạnh và những kiềm tỏa tập thể của ký ức cá nhân.',
    bio: 'Bậc thầy thể loại hồi ký xã hội học tự thân (Autofiction), người biến những trải nghiệm cá nhân đau đớn nhất thành bức tranh chân thực về xã hội.',
    masterpieces: [
      {
        title: 'Những Năm Tháng (The Years / Les Années)',
        year: 2008,
        summary: 'Tự truyện tập thể đồ sộ ghi lại 6 thập kỷ biến động của nước Pháp và thế giới từ sau Thế chiến II đến đầu thế kỷ 21 qua lăng kính ký ức.',
        genre: 'Hồi ký xã hội học',
      },
      {
        title: 'Nỗi Tủi Hổ (La Honte)',
        year: 1997,
        summary: 'Hồi tưởng về khoảnh khắc tuổi thơ chứng kiến người cha bộc phát bạo lực, khắc họa cảm giác xấu hổ giai cấp và sự trưởng thành.',
        genre: 'Tự truyện',
      },
      {
        title: 'Cơn Say Đắm (Simple Passion)',
        year: 1991,
        summary: 'Ghi chép trần trụi và chân thực đến nghẹt thở về nỗi ám ảnh si tình mù quáng dành cho một người đàn ông đã có gia đình.',
        genre: 'Tự sự tâm lý',
      },
    ],
  },
  {
    id: 'nobel-2021',
    year: 2021,
    author: 'Abdulrazak Gurnah',
    country: 'Tanzania / Anh',
    flag: '🇹🇿',
    citation: 'Vì sự thấu hiểu kiên định và giàu lòng trắc ẩn về những tác động của chủ nghĩa thực dân và số phận người tị nạn giữa các nền văn hóa.',
    bio: 'Nhà văn gốc Zanzibar, chuyên viết về thân phận di cư, mất mát cội nguồn và di chứng của thời kỳ thực dân tại Đông Phi.',
    masterpieces: [
      {
        title: 'Thiên Đường (Paradise)',
        year: 1994,
        summary: 'Hành trình trưởng thành của cậu bé Yusuf bị đem gán nợ cho một thương nhân Ả Rập, khắc họa bức tranh Đông Phi phức tạp trước Thế chiến I.',
        genre: 'Lịch sử, Trưởng thành',
      },
      {
        title: 'Bên Bờ Biển (By the Sea)',
        year: 2001,
        summary: 'Cuộc hội ngộ bất ngờ giữa hai người tị nạn Zanzibar tại một thị trấn ven biển nước Anh, mở lại những thù hận và bí mật quá khứ.',
        genre: 'Di cư, Tâm lý',
      },
    ],
  },
  {
    id: 'nobel-2017',
    year: 2017,
    author: 'Kazuo Ishiguro',
    country: 'Anh / Nhật Bản',
    flag: '🇬🇧',
    citation: 'Người trong những tiểu thuyết giàu sức mạnh cảm xúc vĩ đại, đã hé mở hố sâu bên dưới cảm giác ảo tưởng về sự kết nối của chúng ta với thế giới.',
    bio: 'Một trong những tiểu thuyết gia lừng danh nhất thế giới, phong cách điềm tĩnh tinh tế ẩn chứa nỗi buồn hoài niệm mênh mang.',
    masterpieces: [
      {
        title: 'Mãi Đừng Xa Tôi (Never Let Me Go)',
        year: 2005,
        summary: 'Tại ngôi trường nội trú Hailsham tưởng chừng bình yên, ba người bạn Kathy, Tommy và Ruth dần phát hiện ra sự thật nghiệt ngã về số phận nhân bản vô tính của mình.',
        genre: 'Dystopia, Tâm lý, Lãng mạn',
      },
      {
        title: 'Tàn Ngày Để Lại (The Remains of the Day)',
        year: 1989,
        summary: 'Hồi ức cuối đời của người quản gia mẫu mực Stevens về sự tận tụy nghề nghiệp và nỗi hối tiếc muộn màng về tình yêu đã bỏ lỡ.',
        genre: 'Hiện thực tâm lý (Giải Booker 1989)',
      },
      {
        title: 'Người Khổng Lồ Ngủ Quên (The Buried Giant)',
        year: 2015,
        summary: 'Câu chuyện kỳ ảo thời hậu vua Arthur, nơi một màn sương lãng quên bao phủ khắp xứ sở và chuyến đi tìm con trai của đôi vợ chồng già.',
        genre: 'Kỳ ảo lịch sử',
      },
    ],
  },
  {
    id: 'nobel-2015',
    year: 2015,
    author: 'Svetlana Alexievich',
    country: 'Belarus',
    flag: '🇧🇾',
    citation: 'Vì những tác phẩm đa thanh của bà, một tượng đài về nỗi đau khổ và lòng quả cảm trong thời đại của chúng ta.',
    bio: 'Nhà báo điều tra kiệt xuất, người sáng tạo thể loại tiểu thuyết tài liệu hợp xướng từ hàng nghìn cuộc phỏng vấn nhân chứng có thật.',
    masterpieces: [
      {
        title: 'Chiến Tranh Không Có Một Khuôn Mặt Phụ Nữ',
        year: 1985,
        summary: 'Tập hợp lời kể chân thực đến xé lòng của hàng trăm nữ chiến sĩ Liên Xô trong Thế chiến II: xạ thủ, phi công, y tá, lính tăng.',
        genre: 'Văn học tư liệu phi hư cấu',
      },
      {
        title: 'Lời Nguyện Cầu Chernobyl (Chernobyl Prayer)',
        year: 1997,
        summary: 'Tiếng nói của những nạn nhân thảm họa hạt nhân Chernobyl: những người lính cứu hỏa, người vợ góa phụ và cư dân vùng đất nhiễm xạ.',
        genre: 'Ký sự lịch sử',
      },
      {
        title: 'Thời Second-hand (Secondhand Time)',
        year: 2013,
        summary: 'Bi kịch tâm lý và sự sụp đổ lý tưởng của con người thời hậu Xô Viết khi đối mặt với chủ nghĩa tư bản hoang dã thập niên 90.',
        genre: 'Tư liệu xã hội',
      },
    ],
  },
  {
    id: 'nobel-2012',
    year: 2012,
    author: 'Mạc Ngôn (莫言 - Mo Yan)',
    country: 'Trung Quốc',
    flag: '🇨🇳',
    citation: 'Người với chủ nghĩa hiện thực huyền ảo đã kết hợp truyện kể dân gian, lịch sử và đương đại.',
    bio: 'Nhà văn Trung Quốc đầu tiên đoạt giải Nobel Văn học, nổi tiếng với vùng đất Cao Mật và ngôn ngữ giàu sức tưởng tượng, trần trụi và kỳ ảo.',
    masterpieces: [
      {
        title: 'Cao Lương Đỏ (Red Sorghum)',
        year: 1986,
        summary: 'Bản anh hùng ca phóng khoáng về gia tộc họ Dư và cuộc kháng chiến chống phát xít Nhật trên cánh đồng cao lương đỏ rực máu và rượu.',
        genre: 'Hiện thực huyền ảo (Phim Trương Nghệ Mưu)',
      },
      {
        title: 'Sống Chết Mặc Bay (Life and Death Are Wearing Me Out)',
        year: 2006,
        summary: 'Địa chủ Tây Môn Náo bị xử tử oan được Diêm Vương cho luân hồi 6 kiếp thành lừa, bò, lợn, chó, khỉ rồi lại thành người qua 50 năm biến động.',
        genre: 'Châm biếm, Hiện thực huyền ảo',
      },
      {
        title: 'Đàn Hương Hình (Sandalwood Death)',
        year: 2001,
        summary: 'Bức tranh bi tráng về cuộc khởi nghĩa Nghĩa Hòa Đoàn cuối thời Mãn Thanh và hình phạt đóng cọc gỗ đàn hương rùng rợn.',
        genre: 'Lịch sử, Bi kịch',
      },
    ],
  },
  {
    id: 'nobel-2006',
    year: 2006,
    author: 'Orhan Pamuk',
    country: 'Thổ Nhĩ Kỳ',
    flag: '🇹🇷',
    citation: 'Người trong khi tìm kiếm linh hồn u uất của thành phố quê hương đã phát hiện ra những biểu tượng mới cho sự giao thoa và xung đột giữa các nền văn hóa.',
    bio: 'Nhà văn hàng đầu Thổ Nhĩ Kỳ, bậc thầy về kỹ thuật kể chuyện đa điểm nhìn và không gian thành phố Istanbul giao thoa Đông - Tây.',
    masterpieces: [
      {
        title: 'Tên Tôi Là Đỏ (My Name Is Red)',
        year: 1998,
        summary: 'Vụ án mạng bí ẩn trong giới họa sĩ vẽ tiểu họa hoàng gia Ottoman thế kỷ 16, đan xen giữa trinh thám, triết lý nghệ thuật và tình yêu.',
        genre: 'Trinh thám lịch sử, Hậu hiện đại',
      },
      {
        title: 'Bảo Tàng Của Sự Ngây Thơ (The Museum of Innocence)',
        year: 2008,
        summary: 'Mối tình si mê kéo dài hàng chục năm của chàng trai thượng lưu Kemal dành cho cô gái nghèo Fusun và bảo tàng lưu giữ từng kỷ vật vụn vặt.',
        genre: 'Lãng mạn, Tâm lý',
      },
    ],
  },
  {
    id: 'nobel-1982',
    year: 1982,
    author: 'Gabriel García Márquez',
    country: 'Colombia',
    flag: '🇨🇴',
    citation: 'Vì những tiểu thuyết và truyện ngắn trong đó cái kỳ ảo và hiện thực kết hợp trong một thế giới phong phú của trí tưởng tượng.',
    bio: 'Đại thụ của nền văn học Mỹ Latinh, người đưa chủ nghĩa hiện thực huyền ảo lên đỉnh cao rực rỡ nhất thế giới.',
    masterpieces: [
      {
        title: 'Trăm Năm Cô Đơn (One Hundred Years of Solitude)',
        year: 1967,
        summary: 'Lịch sử 7 thế hệ gia tộc Buendía tại ngôi làng huyền thoại Macondo, phản chiếu sự thăng trầm và nỗi cô đơn truyền kiếp của nhân loại.',
        genre: 'Kiệt tác Hiện thực huyền ảo thế giới',
      },
      {
        title: 'Tình Yêu Thời Thổ Tả (Love in the Time of Cholera)',
        year: 1985,
        summary: 'Tình yêu bền bỉ vượt qua 51 năm 9 tháng 4 ngày của Florentino Ariza dành cho người con gái Fermina Daza đến tận tuổi xế chiều.',
        genre: 'Lãng mạn, Kinh điển',
      },
    ],
  },
  {
    id: 'nobel-1968',
    year: 1968,
    author: 'Yasunari Kawabata (川端 康成)',
    country: 'Nhật Bản',
    flag: '🇯🇵',
    citation: 'Vì bậc thầy tự sự của ông, với sự nhạy cảm tuyệt vời, đã thể hiện bản chất của tâm hồn Nhật Bản.',
    bio: 'Nhà văn Nhật Bản đầu tiên đoạt giải Nobel Văn học, đại diện cho mỹ học duy mỹ, nỗi buồn u huyền (Yūgen) và sự vô thường.',
    masterpieces: [
      {
        title: 'Xứ Tuyết (Snow Country / Yukiguni)',
        year: 1937,
        summary: 'Mối tình hư ảo, trong trẻo và tuyệt vọng giữa chàng quý tộc Shimamura và nàng geisha Komako tại suối nước nóng miền bắc phủ tuyết trắng xóa.',
        genre: 'Duy mỹ, Lãng mạn',
      },
      {
        title: 'Ngàn Cánh Hạc (Thousand Cranes)',
        year: 1952,
        summary: 'Nghi lễ Trà đạo truyền thống đan xen với những dục vọng và mặc cảm tội lỗi qua nhiều thế hệ gia đình.',
        genre: 'Tâm lý, Văn hóa Nhật',
      },
      {
        title: 'Cố Đô (The Old Capital / Koto)',
        year: 1962,
        summary: 'Bức tranh Kyoto cổ kính bốn mùa lễ hội và số phận của hai chị em sinh đôi thất lạc Chieko và Naeko.',
        genre: 'Nhân văn, Mỹ học',
      },
    ],
  },
  {
    id: 'nobel-1957',
    year: 1957,
    author: 'Albert Camus',
    country: 'Pháp / Algeria',
    flag: '🇫🇷',
    citation: 'Vì những sáng tác văn học quan trọng của ông đã đưa ra ánh sáng với sự sáng suốt thấu đáo những vấn đề đặt ra cho lương tâm con người thời đại.',
    bio: 'Nhà văn, nhà triết học phi lý vĩ đại của thế kỷ 20, người khẳng định ý nghĩa cuộc sống nằm ở sự phản kháng không ngừng nghỉ.',
    masterpieces: [
      {
        title: 'Người Xa Lạ (The Stranger / L’Étranger)',
        year: 1942,
        summary: 'Chàng trai Meursault thờ ơ trước đám tang của mẹ và vô tình bắn chết một người Ả Rập dưới ánh mặt trời chói lọi của bãi biển Algiers.',
        genre: 'Triết học Phi lý, Hiện sinh',
      },
      {
        title: 'Dịch Hạch (The Plague / La Peste)',
        year: 1947,
        summary: 'Thành phố Oran bị phong tỏa vì đại dịch chuột chết, bác sĩ Rieux cùng những người bạn kiên cường chiến đấu vì lương tâm và tình người.',
        genre: 'Ngụ ngôn triết học, Nhân văn',
      },
    ],
  },
  {
    id: 'nobel-1954',
    year: 1954,
    author: 'Ernest Hemingway',
    country: 'Mỹ',
    flag: '🇺🇸',
    citation: 'Vì sự tinh thông nghệ thuật tự sự, thể hiện gần đây nhất trong Ông Già Và Biển Cả, và vì ảnh hưởng mà ông đã tạo ra đối với phong cách đương đại.',
    bio: 'Tác gia vĩ đại của văn học Mỹ thế kỷ 20 với nguyên lý "Tảng băng trôi" (Iceberg Theory) súc tích, gãy gọn và giàu sức gợi.',
    masterpieces: [
      {
        title: 'Ông Già Và Biển Cả (The Old Man and the Sea)',
        year: 1952,
        summary: 'Cuộc chiến đơn độc kéo dài 3 ngày đêm giữa lão ngư Santiago và con cá kiếm khổng lồ ngoài khơi vịnh Mexico: "Con người có thể bị hủy diệt, nhưng không thể bị đánh bại".',
        genre: 'Kinh điển thế giới (Giải Pulitzer 1953)',
      },
      {
        title: 'Chuông Nguyện Hồn Ai (For Whom the Bell Tolls)',
        year: 1940,
        summary: 'Chàng thanh niên Mỹ Robert Jordan tham gia đội du kích quốc tế chiến đấu chống phát xít trong cuộc Nội chiến Tây Ban Nha.',
        genre: 'Sử thi chiến tranh',
      },
      {
        title: 'Giã Từ Vũ Khí (A Farewell to Arms)',
        year: 1929,
        summary: 'Tình yêu đầy bi kịch giữa người lính cứu thương Frederic Henry và cô y tá Catherine Barkley giữa bối cảnh Thế chiến I tàn khốc.',
        genre: 'Chiến tranh, Bi kịch',
      },
    ],
  },
]

export function BookAdaptationsAndNobelView({
  existingBooks = [],
  onAdded,
}: {
  existingBooks?: Media[]
  onAdded?: () => void
}) {
  const { showToast } = useToast()
  const [tab, setTab] = useState<'ADAPTATIONS' | 'NOBEL'>('ADAPTATIONS')
  const [search, setSearch] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  // Tên sách đã có trong thư viện
  const existingBookTitles = useMemo(() => {
    const set = new Set<string>()
    existingBooks.forEach((b) => {
      set.add(b.name.trim().toLowerCase())
    })
    return set
  }, [existingBooks])

  const filteredAdaptations = useMemo(() => {
    const q = search.trim().toLowerCase()
    return BOOK_ADAPTATIONS_DATA.filter((item) => {
      if (!q) return true
      return (
        item.bookTitle.toLowerCase().includes(q) ||
        item.movieTitle.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.director.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.genre.toLowerCase().includes(q)
      )
    })
  }, [search])

  const filteredNobel = useMemo(() => {
    const q = search.trim().toLowerCase()
    return NOBEL_AUTHORS_DATA.filter((item) => {
      if (!q) return true
      const matchAuthor =
        item.author.toLowerCase().includes(q) ||
        item.country.toLowerCase().includes(q) ||
        String(item.year).includes(q) ||
        item.citation.toLowerCase().includes(q)
      const matchBook = item.masterpieces.some(
        (m) => m.title.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q),
      )
      return matchAuthor || matchBook
    })
  }, [search])

  const handleAddBookToLibrary = async (title: string, author: string, genre: string) => {
    const key = `${title}-${author}`
    setAddingId(key)
    try {
      if (supabase) {
        await supabase.from('media_items').insert({
          type: 'BOOK',
          name: title,
          author,
          genre,
          status: 'PLANNED',
          log_date: localDate(),
          book_format: 'READ',
        })
      }
      setAddedIds((prev) => new Set([...prev, key, title.trim().toLowerCase()]))
      showToast(`📚 Đã thêm "${title}" vào mục Sẽ đọc!`, 'success')
      onAdded?.()
    } catch (err) {
      console.error(err)
      showToast('⚠️ Không thể thêm sách', 'delete')
    } finally {
      setAddingId(null)
    }
  }

  const handleAddMovieToLibrary = async (title: string, director: string, genre: string) => {
    const key = `movie-${title}`
    setAddingId(key)
    try {
      if (supabase) {
        await supabase.from('media_items').insert({
          type: 'MOVIE',
          name: title,
          author: director,
          genre,
          status: 'PLANNED',
          log_date: localDate(),
        })
      }
      setAddedIds((prev) => new Set([...prev, key]))
      showToast(`🎬 Đã thêm phim "${title}" vào mục Sẽ xem!`, 'success')
      onAdded?.()
    } catch (err) {
      console.error(err)
      showToast('⚠️ Không thể thêm phim', 'delete')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* HERO BANNER */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(168, 85, 247, 0.12))',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 16,
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Tuyển Tập Sách Phim & Nobel Văn Học
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Khám phá các kiệt tác văn học chuyển thể điện ảnh kinh điển và tác giả đạt giải Nobel qua các thời kỳ.
            </p>
          </div>
        </div>

        {/* 2 MAIN TOGGLE TABS */}
        <div
          style={{
            display: 'flex',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 3,
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setTab('ADAPTATIONS')}
            style={{
              padding: '7px 14px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: tab === 'ADAPTATIONS' ? 'linear-gradient(135deg, #f43f5e, #be123c)' : 'transparent',
              color: tab === 'ADAPTATIONS' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <Clapperboard size={15} /> Sách Chuyển Thể Phim ({BOOK_ADAPTATIONS_DATA.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('NOBEL')}
            style={{
              padding: '7px 14px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: tab === 'NOBEL' ? 'linear-gradient(135deg, #f59e0b, #b45309)' : 'transparent',
              color: tab === 'NOBEL' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <Award size={15} /> Nobel Văn Học ({NOBEL_AUTHORS_DATA.length})
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="library-search" style={{ flex: 1, position: 'relative' }}>
          <Search size={15} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === 'ADAPTATIONS'
                ? 'Tìm tên sách, tên phim, tác giả, đạo diễn…'
                : 'Tìm tác giả Nobel, năm đạt giải, quốc gia, tác phẩm…'
            }
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: BOOK-TO-MOVIE ADAPTATIONS */}
      {tab === 'ADAPTATIONS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filteredAdaptations.map((item) => {
            const hasInLibrary =
              existingBookTitles.has(item.bookTitle.trim().toLowerCase()) ||
              addedIds.has(item.bookTitle.trim().toLowerCase())
            const isAddingThis = addingId === `${item.bookTitle}-${item.author}`

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                {/* Header: Book Title & Movie Title */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(168, 85, 247, 0.12)',
                        color: 'var(--purple)',
                      }}
                    >
                      📖 Sách {item.bookYear ? `(${item.bookYear})` : ''}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Star size={11} fill="currentColor" /> {item.rating}
                    </span>
                  </div>

                  <h4 style={{ margin: '6px 0 2px', fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {item.bookTitle}
                  </h4>
                  <div style={{ fontSize: '0.82rem', color: 'var(--purple)', fontWeight: 700 }}>
                    ✍️ Tác giả: {item.author}
                  </div>
                </div>

                {/* Movie Info Box */}
                <div
                  style={{
                    background: 'rgba(244, 63, 94, 0.06)',
                    border: '1px solid rgba(244, 63, 94, 0.18)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Film size={14} /> Phim: {item.movieTitle}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    🎬 Đạo diễn: <strong>{item.director}</strong> ({item.movieYear})
                  </div>
                  {item.awards && (
                    <div style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 700 }}>
                      🏆 {item.awards}
                    </div>
                  )}
                </div>

                {/* Summary & Adaptation Note */}
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                  {item.summary}
                </p>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-main)', padding: '6px 8px', borderRadius: 8 }}>
                  💡 {item.adaptationNote}
                </div>

                {/* Quick Add Buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                  <button
                    type="button"
                    disabled={hasInLibrary || isAddingThis}
                    onClick={() => void handleAddBookToLibrary(item.bookTitle, item.author, item.genre)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--purple)',
                      background: hasInLibrary ? 'rgba(168, 85, 247, 0.12)' : 'var(--purple-bg)',
                      color: 'var(--purple)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      cursor: hasInLibrary ? 'default' : 'pointer',
                    }}
                  >
                    {hasInLibrary ? <Check size={13} /> : <Plus size={13} />}
                    <span>{hasInLibrary ? 'Đã có trong Sách' : '+ Đọc Sách'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleAddMovieToLibrary(item.movieTitle, item.director, item.genre)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--rose)',
                      background: 'var(--rose-bg)',
                      color: 'var(--rose)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <Film size={13} />
                    <span>+ Xem Phim</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* SECTION 2: NOBEL LITERATURE LAUREATES */}
      {tab === 'NOBEL' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filteredNobel.map((author) => (
            <div
              key={author.id}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Top Accent Strip */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: 'linear-gradient(90deg, #f59e0b, #eab308, #fbbf24)',
                }}
              />

              {/* Author Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span
                      style={{
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '0.74rem',
                        padding: '2px 8px',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Award size={12} /> Nobel {author.year}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {author.flag} {author.country}
                    </span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {author.author}
                  </h4>
                </div>
              </div>

              {/* Swedish Academy Citation */}
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  borderLeft: '3px solid #f59e0b',
                  padding: '8px 12px',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.78rem',
                  color: 'var(--text-main)',
                  fontStyle: 'italic',
                  lineHeight: 1.45,
                }}
              >
                "{author.citation}"
              </div>

              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {author.bio}
              </p>

              {/* Masterpieces List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--purple)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <BookOpen size={14} /> Các tác phẩm kinh điển tiêu biểu:
                </div>

                {author.masterpieces.map((book, idx) => {
                  const hasBook =
                    existingBookTitles.has(book.title.trim().toLowerCase()) ||
                    addedIds.has(book.title.trim().toLowerCase())

                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>
                          {idx + 1}. {book.title} {book.year ? `(${book.year})` : ''}
                        </strong>

                        <button
                          type="button"
                          disabled={hasBook}
                          onClick={() => void handleAddBookToLibrary(book.title, author.author, book.genre || 'Nobel Văn Học')}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--purple)',
                            background: hasBook ? 'rgba(168, 85, 247, 0.12)' : 'var(--purple-bg)',
                            color: 'var(--purple)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: hasBook ? 'default' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            flexShrink: 0,
                          }}
                          title="Thêm vào danh sách Sẽ đọc"
                        >
                          {hasBook ? <Check size={11} /> : <Plus size={11} />}
                          <span>{hasBook ? 'Đã thêm' : '+ Thêm'}</span>
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {book.summary}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
