import { useMemo, useState } from 'react'
import { Check, Clapperboard, Film, Plus, Search, Star } from 'lucide-react'
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
  authorAvatar?: string
  director: string
  movieYear: number
  bookYear?: number
  genre: string
  rating: string
  awards?: string
  summary: string
  adaptationNote: string
  coverUrl?: string
}

export const BOOK_ADAPTATIONS_DATA: BookAdaptation[] = [
  {
    id: 'adp-1',
    bookTitle: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh',
    movieTitle: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh',
    author: 'Nguyễn Nhật Ánh',
    authorAvatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
    director: 'Victor Vũ',
    movieYear: 2015,
    bookYear: 2010,
    genre: 'Tuổi thơ, Tâm lý, Việt Nam',
    rating: 'IMDb 7.5',
    awards: 'Bông Sen Vàng 2015, Đại diện VN dự Oscar 2017',
    summary: 'Tuổi thơ miền quê Phú Yên thập niên 1980 qua góc nhìn của hai anh em Thiều và Tường với những rung động đầu đời trong trẻo.',
    adaptationNote: 'Bản phim điện ảnh gây sốt phòng vé với phong cảnh Phú Yên tuyệt mỹ và âm nhạc Thằng Cuội da diết.',
    coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-2',
    bookTitle: 'Mắt Biếc',
    movieTitle: 'Mắt Biếc (Dreamy Eyes)',
    author: 'Nguyễn Nhật Ánh',
    authorAvatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
    director: 'Victor Vũ',
    movieYear: 2019,
    bookYear: 1990,
    genre: 'Lãng mạn, Thanh xuân, Việt Nam',
    rating: 'IMDb 7.6',
    awards: 'Bông Sen Vàng 2021, Kỷ lục 180 tỷ phòng vé VN',
    summary: 'Mối tình đơn phương cả cuộc đời của thầy giáo Ngạn dành cho cô bạn gái Hà Lan sở hữu đôi mắt biếc biếc.',
    adaptationNote: 'Nhạc phim Phan Mạnh Quỳnh (Có Chàng Trai Viết Lên Cây) tạo nên hiện tượng âm nhạc và điện ảnh rực rỡ.',
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-3',
    bookTitle: 'Cánh Đồng Bất Tận',
    movieTitle: 'Cánh Đồng Bất Tận (The Floating Lives)',
    author: 'Nguyễn Ngọc Tư',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    director: 'Nguyễn Phan Quang Bình',
    movieYear: 2010,
    bookYear: 2005,
    genre: 'Tâm lý, Đời sống sông nước, Việt Nam',
    rating: 'IMDb 7.2',
    awards: 'Giải Cánh Diều Vàng 2010, Chiếu tại LHP Quốc tế Busan',
    summary: 'Cuộc sống lênh đênh chăn vịt trên những cánh đồng miền Tây Nam Bộ của gia đình ông Võ cùng cô gái điếm Sương.',
    adaptationNote: 'Tái hiện chân thực nỗi đau đớn, số phận trôi dạt và tình người nơi sông nước miền Tây.',
    coverUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-4',
    bookTitle: 'Bến Không Chồng',
    movieTitle: 'Bến Không Chồng',
    author: 'Dương Hướng',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    director: 'Lưu Trọng Ninh',
    movieYear: 2001,
    bookYear: 1991,
    genre: 'Chiến tranh, Hậu chiến, Việt Nam',
    rating: 'IMDb 7.4',
    awards: 'Giải A Hội Nhà văn VN 1991, Bông Sen Bạc 2001',
    summary: 'Làng Đông bên dòng sông sau chiến tranh chỉ toàn những người phụ nữ góa bụa, khắc khoải chờ đợi chồng con trong mòn mỏi.',
    adaptationNote: 'Tác phẩm điện ảnh kinh điển tái hiện bi kịch tinh thần và nỗi đau thời hậu chiến của người phụ nữ thôn quê.',
    coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-5',
    bookTitle: 'Bố Già (The Godfather)',
    movieTitle: 'The Godfather (1972) & Part II (1974)',
    originalTitle: 'The Godfather',
    author: 'Mario Puzo',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    director: 'Francis Ford Coppola',
    movieYear: 1972,
    bookYear: 1969,
    genre: 'Tội phạm, Kịch tính, Kinh điển',
    rating: 'IMDb 9.2',
    awards: '3 Giải Oscar, Được công nhận là kiệt tác điện ảnh vĩ đại nhất',
    summary: 'Đế chế gia tộc mafia Corleone tại New York và con đường kế thừa chiếc ghế quyền lực đẫm máu của Michael Corleone.',
    adaptationNote: 'Chuyển thể hoàn hảo vượt bậc với sự tham gia của Marlon Brando và Al Pacino.',
    coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-6',
    bookTitle: 'Chúa Tể Những Chiếc Nhẫn',
    movieTitle: 'The Lord of the Rings Trilogy',
    originalTitle: 'The Lord of the Rings',
    author: 'J.R.R. Tolkien',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    director: 'Peter Jackson',
    movieYear: 2001,
    bookYear: 1954,
    genre: 'Kỳ ảo, Sử thi, Phiêu lưu',
    rating: 'IMDb 9.0',
    awards: '17 Giải Oscar (Phần 3 thắng trọn vẹn 11/11 đề cử)',
    summary: 'Hành trình người Hobbit Frodo Baggins cùng Hội đồng Hành đưa Chiếc Nhẫn Quyền Năng vào ngọn núi Doom để tiêu hủy.',
    adaptationNote: 'Tượng đài bất hủ của dòng phim sử thi kỳ ảo thế giới được quay tại New Zealand.',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-7',
    bookTitle: 'Harry Potter (Trọn bộ 7 phần)',
    movieTitle: 'Harry Potter 8 Film Series (2001 - 2011)',
    originalTitle: "Harry Potter and the Philosopher's Stone",
    author: 'J.K. Rowling',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    director: 'Chris Columbus, Alfonso Cuarón, David Yates',
    movieYear: 2001,
    bookYear: 1997,
    genre: 'Phù thủy, Kỳ ảo, Phiêu lưu',
    rating: 'IMDb 8.1',
    awards: 'Top franchise điện ảnh có doanh thu cao nhất mọi thời đại',
    summary: 'Cậu bé phù thủy mồ côi Harry Potter bước chân vào trường Hogwarts và cuộc chiến chống lại Chúa tể Hắc ám Voldemort.',
    adaptationNote: 'Biểu tượng văn hóa đại chúng toàn cầu gắn liền với tuổi thơ của hàng trăm triệu độc giả và khán giả.',
    coverUrl: 'https://images.unsplash.com/photo-1618609377864-68609b857e90?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-8',
    bookTitle: 'Rừng Na Uy (Norwegian Wood)',
    movieTitle: 'Norwegian Wood (2010)',
    originalTitle: 'Noruwei no Mori',
    author: 'Haruki Murakami',
    authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    director: 'Trần Anh Hùng',
    movieYear: 2010,
    bookYear: 1987,
    genre: 'Tâm lý, Tình cảm, Nhật Bản',
    rating: 'IMDb 6.3',
    awards: 'Tranh giải Sư tử Vàng LHP Venice 2010',
    summary: 'Ký ức của chàng trai Toru Watanabe về mối tình thanh xuân nhiều mất mát, cô đơn giữa Naoko u sầu và Midori căng tràn nhựa sống.',
    adaptationNote: 'Đạo diễn Trần Anh Hùng mang chất thơ thị giác và âm nhạc của Jonny Greenwood vào từng khung hình tuyết trắng.',
    coverUrl: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-9',
    bookTitle: 'Phía Sau Nghi Can X',
    movieTitle: 'The Devotion of Suspect X (2008 & 2017)',
    originalTitle: 'Yōgisha Ekkusu no Kenshin',
    author: 'Higashino Keigo',
    authorAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    director: 'Hiroshi Nishitani',
    movieYear: 2008,
    bookYear: 2005,
    genre: 'Trinh thám, Tâm lý, Nhật Bản',
    rating: 'IMDb 7.5',
    awards: 'Giải Naoki lần thứ 134, Doanh thu phòng vé khủng tại Nhật & Châu Á',
    summary: 'Thầy giáo dạy toán thiên tài Ishigami thiết lập một chứng cứ ngoại phạm hoàn hảo để bảo vệ người mẹ đơn thân anh thầm yêu.',
    adaptationNote: 'Cuộc đấu trí đỉnh cao giữa hai bộ óc thiên tài: Nhà toán học Ishigami và Nhà vật lý học Yukawa.',
    coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-10',
    bookTitle: 'Điều Kỳ Diệu Của Tiệm Tạp Hóa Namiya',
    movieTitle: 'The Miracles of the Namiya General Store (2017)',
    originalTitle: 'Namiya Zakkaten no Kiseki',
    author: 'Higashino Keigo',
    authorAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    director: 'Ryuichi Hiroki',
    movieYear: 2017,
    bookYear: 2012,
    genre: 'Kỳ ảo, Chữa lành, Nhật Bản',
    rating: 'IMDb 7.0',
    awards: 'Giải Viện Hàn Lâm Điện ảnh Nhật Bản, Top sách bán chạy toàn cầu',
    summary: 'Ba tên trộm tình cờ ẩn náu trong tiệm tạp hóa bỏ hoang và nhận được những bức thư xin lời khuyên gửi từ 33 năm trước.',
    adaptationNote: 'Bản phim mang lại cảm giác ấm áp, lay động lòng người về sự kết nối giữa người với người xuyên thời gian.',
    coverUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-11',
    bookTitle: 'Xứ Cát (Dune)',
    movieTitle: 'Dune: Part One (2021) & Part Two (2024)',
    originalTitle: 'Dune',
    author: 'Frank Herbert',
    authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    director: 'Denis Villeneuve',
    movieYear: 2021,
    bookYear: 1965,
    genre: 'Khoa học viễn tưởng, Sử thi, Triết học',
    rating: 'IMDb 8.6',
    awards: '6 Giải Oscar, Kiệt tác Sci-Fi hiện đại',
    summary: 'Hành tinh sa mạc Arrakis nơi sản sinh Hương dược quý giá nhất vũ trụ và sự trỗi dậy của Paul Atreides thành Đấng Cứu Thế.',
    adaptationNote: 'Quy mô hình ảnh sa mạc hoành tráng cùng âm thanh của Hans Zimmer mang tới trải nghiệm choáng ngợp.',
    coverUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-12',
    bookTitle: 'Sự Im Lặng Của Bầy Cừu',
    movieTitle: 'The Silence of the Lambs (1991)',
    originalTitle: 'The Silence of the Lambs',
    author: 'Thomas Harris',
    authorAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    director: 'Jonathan Demme',
    movieYear: 1991,
    bookYear: 1988,
    genre: 'Tội phạm tâm lý, Kinh dị, Giật gân',
    rating: 'IMDb 8.6',
    awards: 'Thắng trọn vẹn Big Five Oscar (Phim, Đạo diễn, Nam/Nữ chính, Kịch bản)',
    summary: 'Nữ tập sự FBI Clarice Starling phải thẩm vấn bác sĩ tâm thần ăn thịt người Hannibal Lecter để bắt kẻ giết người hàng loạt Buffalo Bill.',
    adaptationNote: 'Diễn xuất kinh điển của Anthony Hopkins và Jodie Foster trở thành chuẩn mực của thể loại phim tâm lý tội phạm.',
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-13',
    bookTitle: 'Nhà Tù Shawshank (The Shawshank Redemption)',
    movieTitle: 'The Shawshank Redemption (1994)',
    originalTitle: 'Rita Hayworth and Shawshank Redemption',
    author: 'Stephen King',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    director: 'Frank Darabont',
    movieYear: 1994,
    bookYear: 1982,
    genre: 'Tâm lý, Hy vọng, Tình bạn',
    rating: 'IMDb 9.3',
    awards: 'Top #1 phim hay nhất mọi thời đại trên bảng xếp hạng IMDb',
    summary: 'Nhân viên ngân hàng Andy Dufresne bị kết án oan giết vợ và 19 năm kiên định nuôi hy vọng tự do nơi ngục tù Shawshank.',
    adaptationNote: 'Tác phẩm truyền cảm hứng mạnh mẽ nhất về sức mạnh của niềm hy vọng và sự kiên nhẫn con người.',
    coverUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-14',
    bookTitle: 'Dặm Xanh (The Green Mile)',
    movieTitle: 'The Green Mile (1999)',
    originalTitle: 'The Green Mile',
    author: 'Stephen King',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    director: 'Frank Darabont',
    movieYear: 1999,
    bookYear: 1996,
    genre: 'Kỳ ảo, Tâm lý, Cảm động',
    rating: 'IMDb 8.6',
    awards: '4 Đề cử Oscar, Lấy đi nước mắt hàng triệu khán giả',
    summary: 'Người cai ngục Paul Edgecomb phát hiện người tử tù da đen khổng lồ John Coffey sở hữu năng lực chữa lành thần kỳ và trái tim ngây thơ.',
    adaptationNote: 'Một trong những bộ phim chuyển thể nhân văn và xúc động nhất từng được làm từ truyện của Stephen King.',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-15',
    bookTitle: 'Người Về Từ Sao Hỏa (The Martian)',
    movieTitle: 'The Martian (2015)',
    originalTitle: 'The Martian',
    author: 'Andy Weir',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    director: 'Ridley Scott',
    movieYear: 2015,
    bookYear: 2011,
    genre: 'Khoa học viễn tưởng, Sinh tồn, Hài hước',
    rating: 'IMDb 8.0',
    awards: '7 Đề cử Oscar, Quả Cầu Vàng Phim hay nhất',
    summary: 'Nhà thực vật học Mark Watney bị bỏ lại một mình trên Sao Hỏa và dùng trí tuệ khoa học để trồng khoai tây sinh tồn chờ giải cứu.',
    adaptationNote: 'Matt Damon thể hiện sự dí dỏm, lạc quan và ý chí sinh tồn phi thường một cách thuyết phục.',
    coverUrl: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-16',
    bookTitle: 'Cuộc Đời Của Pi (Life of Pi)',
    movieTitle: 'Life of Pi (2012)',
    originalTitle: 'Life of Pi',
    author: 'Yann Martel',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    director: 'Lý An (Ang Lee)',
    movieYear: 2012,
    bookYear: 2001,
    genre: 'Phiêu lưu, Tâm linh, Triết lý',
    rating: 'IMDb 7.9',
    awards: '4 Giải Oscar (gồm Đạo diễn xuất sắc nhất cho Lý An)',
    summary: 'Cậu bé Ấn Độ Pi Patel sống sót sau vụ đắm tàu và lênh đênh 227 ngày trên Thái Bình Dương cùng chú hổ Bengal Richard Parker.',
    adaptationNote: 'Kỹ xảo 3D và thế giới biển đêm phát quang kỳ ảo đưa người xem vào hành trình đức tin sâu sắc.',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-17',
    bookTitle: 'Đấu Trường Sinh Tử (The Hunger Games)',
    movieTitle: 'The Hunger Games 4 Film Series (2012 - 2015)',
    originalTitle: 'The Hunger Games',
    author: 'Suzanne Collins',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    director: 'Gary Ross, Francis Lawrence',
    movieYear: 2012,
    bookYear: 2008,
    genre: 'Dystopia, Hành động, Nổi dậy',
    rating: 'IMDb 7.6',
    awards: 'Doanh thu gần 3 tỷ USD, Đưa Jennifer Lawrence lên hàng siêu sao',
    summary: 'Katniss Everdeen tình nguyện thay em gái tham gia trò chơi sinh tử tàn bạo thường niên do Capitol độc tài tổ chức.',
    adaptationNote: 'Tác phẩm phản ánh sự chênh lệch giàu nghèo, truyền thông thao túng và ngọn lửa nổi dậy của tuổi trẻ.',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-18',
    bookTitle: 'Kẻ Trộm Sách (The Book Thief)',
    movieTitle: 'The Book Thief (2013)',
    originalTitle: 'The Book Thief',
    author: 'Markus Zusak',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    director: 'Brian Percival',
    movieYear: 2013,
    bookYear: 2005,
    genre: 'Thế chiến II, Nhân văn, Tình yêu sách',
    rating: 'IMDb 7.5',
    awards: 'Đề cử Oscar & Quả Cầu Vàng cho Nhạc phim của John Williams',
    summary: 'Cô bé mồ côi Liesel tìm thấy niềm an ủi trong những trang sách ăn trộm được giữa bối cảnh Đức Quốc Xã tàn khốc.',
    adaptationNote: 'Câu chuyện được kể qua góc nhìn của Thần Chết mang tới thông điệp đẹp đẽ về sức mạnh cứu rỗi của ngôn từ.',
    coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-19',
    bookTitle: 'Chuộc Tội (Atonement)',
    movieTitle: 'Atonement (2007)',
    originalTitle: 'Atonement',
    author: 'Ian McEwan',
    authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    director: 'Joe Wright',
    movieYear: 2007,
    bookYear: 2001,
    genre: 'Lãng mạn, Chiến tranh, Day dứt',
    rating: 'IMDb 7.8',
    awards: '1 Giải Oscar (Nhạc phim), 7 đề cử Oscar, Giải BAFTA Phim hay nhất',
    summary: 'Lời nói dối tai hại của cô bé 13 tuổi Briony đã phá nát tình yêu và cuộc đời của chị gái Cecilia cùng chàng trai Robbie.',
    adaptationNote: 'Trường đoạn cú máy dài (long take) 5 phút tại bãi biển Dunkirk là một trong những kỳ tích quay phim đẹp nhất thế giới.',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-20',
    bookTitle: 'Kiêu Hãnh Và Định Kiến (Pride and Prejudice)',
    movieTitle: 'Pride & Prejudice (2005)',
    originalTitle: 'Pride and Prejudice',
    author: 'Jane Austen',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    director: 'Joe Wright',
    movieYear: 2005,
    bookYear: 1813,
    genre: 'Cổ điển, Lãng mạn, Nước Anh',
    rating: 'IMDb 7.8',
    awards: '4 Đề cử Oscar, Keira Knightley tỏa sáng rực rỡ',
    summary: 'Câu chuyện tình vượt qua định kiến giai cấp và sự kiêu hãnh giữa Elizabeth Bennet thông minh và quý ngài Darcy lạnh lùng.',
    adaptationNote: 'Không gian đồng quê nước Anh thế kỷ 19 thơ mộng và những điệu khiêu vũ quý tộc đầy cuốn hút.',
    coverUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-21',
    bookTitle: 'Cuốn Theo Chiều Gió (Gone with the Wind)',
    movieTitle: 'Gone with the Wind (1939)',
    originalTitle: 'Gone with the Wind',
    author: 'Margaret Mitchell',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    director: 'Victor Fleming',
    movieYear: 1939,
    bookYear: 1936,
    genre: 'Sử thi, Nội chiến Mỹ, Lãng mạn',
    rating: 'IMDb 8.2',
    awards: '8 Giải Oscar, Phim có doanh thu điều chỉnh lạm phát cao nhất mọi thời đại',
    summary: 'Nàng Scarlett O’Hara kiêu hãnh và hành trình kiên cường gìn giữ đồn điền Tara qua khói lửa cuộc Nội chiến miền Nam nước Mỹ.',
    adaptationNote: 'Diễn xuất bất hủ của Vivien Leigh và Clark Gable với câu thoại huyền thoại “After all, tomorrow is another day!”.',
    coverUrl: 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-22',
    bookTitle: 'Cô Gái Có Hình Xăm Rồng',
    movieTitle: 'The Girl with the Dragon Tattoo (2011)',
    originalTitle: 'Män som hatar kvinnor',
    author: 'Stieg Larsson',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    director: 'David Fincher',
    movieYear: 2011,
    bookYear: 2005,
    genre: 'Trinh thám, Bắc Âu, Tội phạm giật gân',
    rating: 'IMDb 7.8',
    awards: '1 Giải Oscar (Dựng phim), Đề cử Nữ chính cho Rooney Mara',
    summary: 'Nhà báo Mikael Blomkvist bắt tay cùng nữ hacker lập dị Lisbeth Salander điều tra vụ mất tích bí ẩn 40 năm trước.',
    adaptationNote: 'Phong cách đạo diễn lạnh lùng, sắc lẹm đặc trưng của David Fincher cùng diễn xuất phi thường của Rooney Mara.',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-23',
    bookTitle: 'Đảo Kinh Hoàng (Shutter Island)',
    movieTitle: 'Shutter Island (2010)',
    originalTitle: 'Shutter Island',
    author: 'Dennis Lehane',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    director: 'Martin Scorsese',
    movieYear: 2010,
    bookYear: 2003,
    genre: 'Tâm lý, Giật gân, Cú lừa (Plot Twist)',
    rating: 'IMDb 8.2',
    awards: 'Top phim giật gân cân não có cái kết bất ngờ nhất',
    summary: 'Đặc vụ Teddy Daniels đến bệnh viện tâm thần biệt lập trên đảo Shutter để tìm một nữ bệnh nhân mất tích bí ẩn.',
    adaptationNote: 'Cái kết gây tranh cãi và ám ảnh suốt nhiều năm của Leonardo DiCaprio: “Sống như một con quái vật, hay chết như một người tử tế?”.',
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-24',
    bookTitle: 'Đại Gia Gatsby (The Great Gatsby)',
    movieTitle: 'The Great Gatsby (2013)',
    originalTitle: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    director: 'Baz Luhrmann',
    movieYear: 2013,
    bookYear: 1925,
    genre: 'Kinh điển, Thời đại Jazz, Nỗi buồn nước Mỹ',
    rating: 'IMDb 7.2',
    awards: '2 Giải Oscar (Thiết kế trang phục & Thiết kế sản xuất)',
    summary: 'Những bữa tiệc xa hoa trụy lạc của triệu phú Jay Gatsby nhằm thu hút lại trái tim người tình cũ Daisy Buchanan.',
    adaptationNote: 'Sự lộng lẫy xa xỉ bậc nhất về mặt hình ảnh kết hợp âm nhạc hip-hop hiện đại cùng Leonardo DiCaprio.',
    coverUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-25',
    bookTitle: 'Triệu Phú Khu Ổ Chuột',
    movieTitle: 'Slumdog Millionaire (2008)',
    originalTitle: 'Q & A',
    author: 'Vikas Swarup',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    director: 'Danny Boyle',
    movieYear: 2008,
    bookYear: 2005,
    genre: 'Kịch tính, Xã hội Ấn Độ, Lãng mạn',
    rating: 'IMDb 8.0',
    awards: '8 Giải Oscar (gồm Phim hay nhất, Đạo diễn, Nhạc phim Jay Ho)',
    summary: 'Chàng trai phục vụ trà mồ côi Jamal Malik trả lời đúng tất cả câu hỏi trong chương trình Ai Là Triệu Phú nhờ những trải nghiệm đường phố đau thương.',
    adaptationNote: 'Năng lượng bùng nổ, nhịp phim dồn dập cùng câu chuyện tình yêu vượt qua số phận nghiệt ngã.',
    coverUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-26',
    bookTitle: 'Mật Mã Da Vinci (The Da Vinci Code)',
    movieTitle: 'The Da Vinci Code (2006)',
    originalTitle: 'The Da Vinci Code',
    author: 'Dan Brown',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    director: 'Ron Howard',
    movieYear: 2006,
    bookYear: 2003,
    genre: 'Trinh thám tôn giáo, Biểu tượng học, Bí ẩn',
    rating: 'IMDb 6.6',
    awards: 'Thu về hơn 760 triệu USD phòng vé toàn cầu',
    summary: 'Giáo sư biểu tượng học Robert Langdon giải mã các mật mã ẩn giấu trong tranh của Leonardo da Vinci để tìm Chén Thánh.',
    adaptationNote: 'Hành trình giải đố nghẹt thở đưa người xem qua bảo tàng Louvre và các nhà thờ cổ kính châu Âu.',
    coverUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-27',
    bookTitle: 'Forrest Gump',
    movieTitle: 'Forrest Gump (1994)',
    originalTitle: 'Forrest Gump',
    author: 'Winston Groom',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    director: 'Robert Zemeckis',
    movieYear: 1994,
    bookYear: 1986,
    genre: 'Hài hước, Cảm động, Lịch sử nước Mỹ',
    rating: 'IMDb 8.8',
    awards: '6 Giải Oscar (Phim hay nhất, Đạo diễn, Nam chính Tom Hanks)',
    summary: 'Chàng trai thiểu năng trí tuệ Forrest Gump với tấm lòng thiện lương đã vô tình trở thành nhân chứng của các sự kiện lịch sử vĩ đại nước Mỹ.',
    adaptationNote: '“Cuộc đời như một hộp kẹo chocolate, bạn không bao giờ biết mình sẽ nhận được thanh nào.”',
    coverUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-28',
    bookTitle: 'Người Máy Có Mơ Về Cừu Điện Không?',
    movieTitle: 'Blade Runner (1982) & Blade Runner 2049 (2017)',
    originalTitle: 'Do Androids Dream of Electric Sheep?',
    author: 'Philip K. Dick',
    authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    director: 'Ridley Scott & Denis Villeneuve',
    movieYear: 1982,
    bookYear: 1968,
    genre: 'Cyberpunk, Khoa học viễn tưởng, Triết học hiện sinh',
    rating: 'IMDb 8.1',
    awards: 'Tượng đài kiến tạo định hình thể loại phim Cyberpunk toàn thế giới',
    summary: 'Thợ săn người máy Rick Deckard nhận nhiệm vụ săn lùng và tiêu hủy các robot Replicant nổi loạn có cảm xúc như con người.',
    adaptationNote: 'Đoạn độc thoại “Tears in Rain” của Roy Batty đi vào lịch sử điện ảnh như một trong những khoảnh khắc đẹp nhất.',
    coverUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-29',
    bookTitle: 'Chuyện Nàng Người Hầu (The Handmaid’s Tale)',
    movieTitle: 'The Handmaid’s Tale (TV Series 2017 - nay)',
    originalTitle: 'The Handmaid’s Tale',
    author: 'Margaret Atwood',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    director: 'Bruce Miller',
    movieYear: 2017,
    bookYear: 1985,
    genre: 'Dystopia, Nữ quyền, Độc tài',
    rating: 'IMDb 8.4',
    awards: '15 Giải Emmy (gồm Phim chính kịch xuất sắc nhất)',
    summary: 'Chế độ độc tài thần quyền Gilead coi phụ nữ có khả năng sinh sản như những cỗ máy đẻ phục vụ giới cầm quyền.',
    adaptationNote: 'Series truyền hình xuất sắc của Hulu cảnh tỉnh sâu sắc về quyền tự do và phẩm giá con người.',
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'adp-30',
    bookTitle: 'Trò Chơi Vương Quyền (A Song of Ice and Fire)',
    movieTitle: 'Game of Thrones (TV Series 2011 - 2019)',
    originalTitle: 'A Game of Thrones',
    author: 'George R.R. Martin',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    director: 'David Benioff, D.B. Weiss',
    movieYear: 2011,
    bookYear: 1996,
    genre: 'Kỳ ảo đen tối, Chính trị, Sử thi',
    rating: 'IMDb 9.2',
    awards: '59 Giải Emmy (Kỷ lục phim truyền hình thắng nhiều giải nhất lịch sử)',
    summary: 'Cuộc chiến tranh giành Ngai Sắt giữa các đại gia tộc xứ Westeros trong khi mối hiểm họa Bóng Trắng đang kéo tới từ phương Bắc.',
    adaptationNote: 'Hiện tượng truyền hình toàn cầu với những mưu đồ chính trị tàn khốc và quy mô sản xuất điện ảnh.',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
  },
]

export function BookAdaptationsView({
  existingBooks,
  onAdded,
}: {
  existingBooks: Media[]
  onAdded?: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL')
  const [addingId, setAddingId] = useState<string | null>(null)
  const { showToast } = useToast()

  const existingBookNames = useMemo(() => {
    return new Set(existingBooks.map((b) => b.name.toLowerCase().trim()))
  }, [existingBooks])

  const genres = useMemo(() => {
    const set = new Set<string>()
    BOOK_ADAPTATIONS_DATA.forEach((item) => {
      item.genre.split(',').forEach((g) => {
        const clean = g.trim()
        if (clean) set.add(clean)
      })
    })
    return ['ALL', ...Array.from(set).sort()]
  }, [])

  const filteredList = useMemo(() => {
    const q = search.toLowerCase().trim()
    return BOOK_ADAPTATIONS_DATA.filter((item) => {
      const matchSearch =
        !q ||
        item.bookTitle.toLowerCase().includes(q) ||
        item.movieTitle.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.director.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.adaptationNote.toLowerCase().includes(q)
      const matchGenre = selectedGenre === 'ALL' || item.genre.includes(selectedGenre)
      return matchSearch && matchGenre
    })
  }, [search, selectedGenre])

  async function handleAddBook(item: BookAdaptation) {
    setAddingId(item.id + '_book')
    try {
      if (supabase) {
        await supabase.from('media_items').insert({
          type: 'BOOK',
          name: item.bookTitle,
          author: item.author,
          genre: item.genre.split(',')[0]?.trim() || 'Văn học',
          status: 'PLANNED',
          cover_url: item.coverUrl || null,
          description: `Tác phẩm được chuyển thể thành phim: ${item.movieTitle} (Đạo diễn: ${item.director}, ${item.movieYear}). ${item.summary}`,
          log_date: localDate(),
        })
      }
      showToast(`📖 Đã thêm sách "${item.bookTitle}" vào Thư viện Sách!`, 'success')
      onAdded?.()
    } catch (e) {
      console.error(e)
      showToast('⚠️ Không thể thêm vào thư viện', 'error')
    } finally {
      setAddingId(null)
    }
  }

  async function handleAddMovie(item: BookAdaptation) {
    setAddingId(item.id + '_movie')
    try {
      if (supabase) {
        await supabase.from('media_items').insert({
          type: 'MOVIE',
          name: item.movieTitle,
          director: item.director,
          genre: item.genre.split(',')[0]?.trim() || 'Điện ảnh',
          status: 'PLANNED',
          cover_url: item.coverUrl || null,
          description: `Phim chuyển thể từ tiểu thuyết "${item.bookTitle}" của tác giả ${item.author}. ${item.adaptationNote}`,
          log_date: localDate(),
        })
      }
      showToast(`🎬 Đã thêm phim "${item.movieTitle}" vào Thư viện Phim!`, 'success')
      onAdded?.()
    } catch (e) {
      console.error(e)
      showToast('⚠️ Không thể thêm vào thư viện', 'error')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
      {/* Search & Filter Bar */}
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
            placeholder="Tìm theo tên sách, phim, tác giả, đạo diễn..."
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

        {/* Filter select */}
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
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
          {genres.map((g) => (
            <option key={g} value={g}>
              {g === 'ALL' ? 'Tất cả thể loại' : g}
            </option>
          ))}
        </select>
      </div>

      {/* Count summary */}
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
        Hiển thị <strong>{filteredList.length}</strong> tác phẩm chuyển thể kinh điển
      </div>

      {/* Adaptations List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredList.map((item) => {
          const hasBook = existingBookNames.has(item.bookTitle.toLowerCase().trim())
          const isAddingBook = addingId === item.id + '_book'
          const isAddingMovie = addingId === item.id + '_movie'

          return (
            <div
              key={item.id}
              className="card"
              style={{
                display: 'flex',
                gap: 14,
                padding: '14px',
                margin: 0,
                borderRadius: 12,
                border: '1px solid var(--card-border)',
                background: 'var(--card-bg)',
                alignItems: 'flex-start',
              }}
            >
              {/* Book Cover Thumbnail */}
              <div
                style={{
                  width: 72,
                  height: 102,
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--card-border)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.bookTitle}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                      textAlign: 'center',
                    }}
                  >
                    <Clapperboard size={24} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {item.bookYear || item.movieYear}
                    </span>
                  </div>
                )}
              </div>

              {/* Info Column */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Book & Movie Titles */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <h3
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        margin: 0,
                        color: 'var(--text-main)',
                      }}
                    >
                      {item.bookTitle}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(245, 158, 11, 0.12)',
                        color: '#f59e0b',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <Star size={10} fill="#f59e0b" /> {item.rating}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Film size={12} style={{ color: 'var(--text-muted)' }} />
                    <span>
                      Phim: <strong style={{ color: 'var(--text-main)' }}>{item.movieTitle}</strong> (
                      {item.movieYear})
                    </span>
                  </div>
                </div>

                {/* Author with Avatar & Director */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: '0.76rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item.authorAvatar ? (
                      <img
                        src={item.authorAvatar}
                        alt={item.author}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid var(--card-border)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: 'var(--bg-main)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                        }}
                      >
                        {item.author.charAt(0)}
                      </div>
                    )}
                    <span>
                      Tác giả: <strong>{item.author}</strong>
                    </span>
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>•</div>

                  <div>
                    Đạo diễn: <strong style={{ color: 'var(--text-main)' }}>{item.director}</strong>
                  </div>
                </div>

                {/* Awards / Genre badge */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'var(--bg-main)',
                      border: '1px solid var(--card-border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {item.genre}
                  </span>
                  {item.awards && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        color: '#10b981',
                        fontWeight: 600,
                      }}
                    >
                      🏆 {item.awards}
                    </span>
                  )}
                </div>

                {/* Summary & Adaptation Note */}
                <p
                  style={{
                    fontSize: '0.78rem',
                    lineHeight: 1.45,
                    color: 'var(--text-main)',
                    margin: '2px 0 0',
                    opacity: 0.9,
                  }}
                >
                  {item.summary}
                </p>
                <div
                  style={{
                    fontSize: '0.74rem',
                    lineHeight: 1.4,
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    borderLeft: '2px solid var(--card-border)',
                    paddingLeft: 8,
                    marginTop: 2,
                  }}
                >
                  🎬 {item.adaptationNote}
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleAddBook(item)}
                    disabled={hasBook || isAddingBook}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--card-border)',
                      background: hasBook ? 'var(--bg-main)' : 'var(--primary)',
                      color: hasBook ? 'var(--text-muted)' : '#fff',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: hasBook || isAddingBook ? 'default' : 'pointer',
                      opacity: hasBook ? 0.75 : 1,
                    }}
                  >
                    {hasBook ? (
                      <>
                        <Check size={12} /> Đã có trong Sách
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> + Đọc Sách
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddMovie(item)}
                    disabled={isAddingMovie}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--card-border)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: isAddingMovie ? 'default' : 'pointer',
                    }}
                  >
                    <Plus size={12} /> + Xem Phim
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
