/**
 * File: genre_descriptions.ts
 * Purpose: Detailed genre/tag/style descriptions for AI prompt context
 * Layer: Data (Constants)
 * Domain: AI → [genre guidance]
 * Deps: none
 * Source: Extracted from tinix-ai/tinix-story
 */

/** Genre descriptions — AI uses these to adapt vocabulary, pacing, and tone */
export const GENRE_DESCRIPTIONS: Record<string, string> = {
  'Huyền huyễn tiên hiệp': 'Thế giới tu tiên rộng lớn, sức mạnh siêu phàm, phân chia nhiều cảnh giới rõ rệt. Cốt truyện thường xoay quanh hành trình thăng cấp, cướp đoạt cơ duyên, phi thăng tiên giới. Văn phong cần kỳ ảo, chú trọng miêu tả công pháp, pháp bảo, linh thú.',
  'Đô thị ngôn tình': 'Bối cảnh hiện đại, đời sống thành thị, xoay quanh các mối quan hệ tình cảm, gia đình, công sở. Tập trung vào tâm lý nhân vật, tình huống đời thường, lãng mạn hoặc ngược luyến.',
  'Khoa học viễn tưởng': 'Bối cảnh tương lai, vũ trụ, hoặc thế giới công nghệ vượt bậc. Đòi hỏi sự logic, xây dựng hệ thống quy tắc chặt chẽ mang tính thuyết phục cao.',
  'Võ hiệp': 'Thế giới giang hồ, ân oán tình thù, võ công cái thế. Nhấn mạnh tinh thần trượng nghĩa, môn phái, chiêu thức võ thuật. Văn phong cổ trang, tiết tấu nhanh.',
  'Trinh thám': 'Xoay quanh vụ án bí ẩn, tội phạm và quá trình phá án. Yêu cầu tính logic cực cao, chuỗi manh mối đan xen, gây cấn, hồi hộp, tạo bất ngờ (plot twist).',
  'Lịch sử': 'Bối cảnh triều đại lịch sử. Xoay quanh quyền mưu, tranh đoạt thiên hạ, chiến tranh. Đòi hỏi kiến thức lịch sử, văn phong trang trọng, tính sử thi.',
  'Quân sự': 'Tập trung vào chiến tranh, quân đội, vũ khí, chiến dịch quân sự. Yêu cầu tính logic, am hiểu chiến thuật, miêu tả trận đánh hoành tráng, khốc liệt.',
  'Game': 'Bối cảnh game thực tế ảo (Võng du). Đánh quái, thăng cấp, cày đồ, lập guild. Cần hệ thống chỉ số, kỹ năng rõ ràng, nhịp độ giải trí nhanh.',
  'Kinh dị': 'Cốt truyện rùng rợn, khai thác siêu nhiên, tâm linh, quái vật hoặc tâm lý. Bầu không khí tăm tối, u ám, gây rùng mình cho người đọc.',
  'Xuyên không - Trọng sinh': 'Nhân vật du hành thời gian/không gian hoặc sống lại kiếp trước. Mang kiến thức hiện đại để thay đổi số phận, vả mặt kẻ thù.',
  'Hệ thống': 'Nhân vật sở hữu "Hệ thống" giao nhiệm vụ, thưởng phạt, cung cấp cửa hàng đổi vật phẩm. Giải trí cao, nhịp nhanh, tập trung thăng cấp.',
  'Đồng nhân': 'Truyện dựa trên bối cảnh tác phẩm gốc (Naruto, Harry Potter...). Nhân vật xuyên vào thế giới gốc, thay đổi cốt truyện.',
  'Mạt thế': 'Bối cảnh tận thế, zombie, thiên tai, biến dị sinh học. Đấu tranh sinh tồn, nhấn mạnh nhân tính, thiếu thốn vật tư, xây dựng căn cứ.',
  'Điền văn - Hài hước': 'Cuộc sống thường nhật, trồng trọt, chăn nuôi, làm giàu. Nhịp chậm rãi (slow-burn), nhẹ nhàng, thư giãn, hài hước.',
  'Cổ đại ngôn tình': 'Bối cảnh phong kiến, tình yêu nam nữ. Khai thác gia đấu, cung đấu, quyền mưu. Lời thoại cổ kính, trang nhã.',
  'Kỳ ảo phương Tây': 'Bối cảnh Trung Cổ phương Tây, hiệp sĩ, phép thuật, elf, rồng. Hệ thống ma pháp đậm nét thần thoại/fantasy.',
  'Nữ cường': 'Nữ chính kiên cường, thông minh, độc lập. Tập trung vào quá trình tự vươn lên, phá bỏ định kiến.',
  'Tổng tài': 'Nam chính là chủ tịch giàu có, lạnh lùng, quyền lực. Yếu tố sủng ngọt hoặc ngược luyến tình thâm.',
  'Thanh xuân vườn trường': 'Bối cảnh trường học, thanh xuân rực rỡ. Tình yêu tuổi học trò, tình bạn, rung động đầu đời.',
  'Cung đấu': 'Mưu mô chốn hậu cung phong kiến. Phi tần, hoàng hậu dùng trí tuệ triệt hạ nhau tranh giành quyền lực.',
  'Gia đấu': 'Gia tộc lớn thời phong kiến. Đấu tranh giữa mẹ chồng nàng dâu, các phòng, chị em gái. Logic trị gia cao.',
  'Hồng hoang': 'Thần thoại Trung Hoa cổ đại (Bàn Cổ, Nữ Oa...). Sức mạnh khổng lồ, bối cảnh thần thánh quy mô vũ trụ.',
  'Ngôn tình võng du': 'Game online kết hợp tình cảm đời thực. Tuyến tình cảm phát triển song song ảo và thực.',
  'Đô thị dị năng': 'Bối cảnh hiện đại đan xen năng lực đặc biệt, tổ chức ngầm, yêu quái ẩn mình.',
  'Linh dị - Bí ẩn': 'Tà ma, phong thủy, đạo sĩ trừ tà, hiện tượng tâm linh. Huyền bí, hồi hộp khám phá sự thật.',
  'Đam mỹ': 'Tình cảm sâu sắc giữa hai nhân vật nam. Văn phong trau chuốt, chú trọng tâm lý.',
  'Bách hợp': 'Tình cảm nhẹ nhàng hoặc mãnh liệt giữa hai nhân vật nữ. Khai phá cảm xúc tinh tế.',
  'Thám hiểm lăng mộ': 'Trộm mộ, săn bảo vật ở di tích cổ. Cạm bẫy, cương thi, phong thủy, địa lý sống động.',
  'Dị giới đại lục': 'Thế giới hư cấu rộng lớn, kiếm thuật, ma pháp, đấu khí. Luật rừng kẻ mạnh làm vua.',
  'Cổ đại làm ruộng': 'Bối cảnh cổ đại nghèo khó. Làm giàu chậm rãi từ hai bàn tay trắng, kinh doanh, gia đình no ấm.',
  'Không gian Tùy thân': 'Nhân vật sở hữu không gian bí mật để trồng trọt, chứa đồ, trốn kẻ thù. Bàn đạp thăng cấp.',
  'ABO': 'Omegaverse (Alpha, Beta, Omega). Đặc điểm sinh học đặc thù, bản năng, đánh dấu, tình cảm gai góc.',
  'Ma cà rồng': 'Vampire, Người sói, Thợ săn. Đấu tranh bản năng khát máu và nhân tính, Dark Romance.',
  'Cạnh kỹ - Thể thao': 'E-sports hoặc thể thao truyền thống. Tinh thần đồng đội, chiến thuật đối kháng kịch tính.',
  'Đồng nhân Anime': 'Dựa theo Manga/Anime (One Piece, Pokemon, Bleach...). Tương tác nhân vật yêu thích.',
  'Vô hạn lưu': 'Nhân vật bị kéo vào "Không gian Chủ Thần", xuyên qua nhiều thế giới để làm nhiệm vụ sinh tử.',
  'Truyện ma Việt Nam': 'Linh dị dân gian, bùa ngải, tâm linh, luật nhân quả mang đậm văn hóa Việt.',
  'Huyền sử Việt Nam': 'Lịch sử Việt kết hợp thần thoại, cổ tích, tiên hiệp. Vận nước, hào khí Đông A.',
  'Khác': 'Thể loại pha trộn hoặc không nằm trong phân loại chính. AI linh hoạt kết hợp theo yêu cầu tác giả.',
};

/** Tag descriptions — AI uses these to enrich story with sub-genre elements */
export const TAG_DESCRIPTIONS: Record<string, string> = {
  'Hậu cung': 'Nhân vật chính có mối quan hệ tình cảm với nhiều nhân vật khác giới. Quản lý mối quan hệ phức tạp.',
  '1v1': 'Chỉ một cặp đôi duy nhất xuyên suốt, cam kết chung thủy.',
  'NP': 'Nhiều người yêu đồng thời, không theo mô hình một vợ một chồng.',
  'Nữ phẫn nam trang': 'Nhân vật nữ cải trang thành nam giới. Tạo tình huống hiểu lầm kịch tính.',
  'Nam phẫn nữ trang': 'Nhân vật nam cải trang thành nữ. Tình huống hài hước, dở khóc dở cười.',
  'Xuyên không': 'Vượt qua không gian/thời gian đến thế giới khác. Tận dụng kiến thức hiện đại.',
  'Xuyên sách': 'Xuyên vào tiểu thuyết đã biết trước cốt truyện, cố thay đổi kết cục bi thảm.',
  'Trọng sinh': 'Chết và sống lại ở quá khứ, mang theo ký ức kiếp trước để sửa chữa sai lầm.',
  'Hệ thống': 'Thực thể trí tuệ cung cấp nhiệm vụ, phần thưởng và khả năng đặc biệt.',
  'Bàn tay vàng': 'May mắn cực lớn giúp nhân vật vượt qua mọi nghịch cảnh áp đảo đối thủ.',
  'Không gian tùy thân': 'Không gian bí mật lưu trữ vật phẩm, trồng trọt, tu luyện.',
  'Vô địch lưu': 'Nhân vật sức mạnh tuyệt đối từ đầu, không có đối thủ xứng tầm.',
  'Cẩu đạo': 'Nhân vật cực kỳ cẩn trọng, ẩn mình, chỉ hành động khi nắm chắc phần thắng.',
  'Nhiệt huyết': 'Nỗ lực không ngừng, tình bạn, lòng dũng cảm, chiến đấu đầy cảm xúc.',
  'Hài hước': 'Tình huống trớ trêu, lời thoại hóm hỉnh, nhân vật kỳ lạ tạo tiếng cười.',
  'Sảng văn': 'Nhân vật liên tục thành công, tát mặt đối thủ, nhận thưởng hậu hĩnh.',
  'Ngọt sủng': 'Tình cảm vô cùng ngọt ngào, ít mâu thuẫn, luôn được yêu thương hết mực.',
  'Ngược luyến': 'Đau khổ, dằn vặt, hiểu lầm trong tình yêu, lấy nước mắt độc giả.',
  'Gương vỡ lại lành': 'Chia tay rồi gặp lại, quyết định hàn gắn mối quan hệ cũ.',
  'Cưới trước yêu sau': 'Kết hôn vì thỏa thuận, dần hiểu nhau và phát sinh tình cảm.',
  'Oan gia ngõ hẹp': 'Ban đầu ác cảm, tranh cãi, qua biến cố lại yêu nhau.',
  'Thanh mai trúc mã': 'Bạn thân từ nhỏ, cùng lớn lên, phát triển từ tình bạn thành tình yêu.',
  'Giả heo ăn hổ': 'Cố tình che giấu thực lực, giả yếu đuối để lừa đối thủ.',
  'Phế Sài': 'Ban đầu bị coi vô dụng, bị khinh, sau gặp kỳ ngộ vươn lên thành kẻ mạnh.',
  'Thiên tài': 'Tiềm năng bẩm sinh cực lớn, học một hiểu mười, vượt xa cùng trang lứa.',
  'Từ hôn': 'Bị hủy hôn ước công khai, tạo động lực nỗ lực chứng minh giá trị bản thân.',
  'Mau xuyên': 'Xuyên qua nhiều thế giới nhỏ nhanh chóng để thực hiện nhiệm vụ chuyên biệt.',
  'Quy tắc quái đàm': 'Phải tuân thủ nghiêm ngặt quy tắc kỳ lạ để sống sót, kinh dị căng thẳng.',
  'Đa nhân cách': 'Một cơ thể nhiều danh tính khác nhau, ký ức và tính cách riêng biệt.',
  'Tâm thần phân liệt': 'Chia tách tâm trí, ảo giác, hành vi không kiểm soát.',
  'Biển sao': 'Bối cảnh vũ trụ bao la, hành trình khám phá thiên hà xa xôi.',
  'Truyền thuyết đô thị': 'Kinh dị bí ẩn xảy ra trong lòng thành phố hiện đại, gắn tin đồn địa danh.',
  'Thực dân': 'Khai phá miền đất mới, xây dựng thuộc địa hoặc đấu tranh giành độc lập.',
  'Bộ lạc': 'Cuộc sống cộng đồng nguyên thủy, săn bắn hái lượm, tín ngưỡng thần linh.',
  'Nguyên thủy': 'Giai đoạn khai sinh loài người, tìm ra lửa, công cụ đá.',
  'Thập niên 70': 'Cuộc sống khó khăn nhưng chân thành của những năm 1970.',
  'Thập niên 80': 'Giai đoạn cải cách mở cửa, khởi đầu năng động kinh tế.',
  'Thập niên 90': 'Bùng nổ công nghệ sơ khai, nhạc pop, khẳng định bản thân.',
};

/** Writing style descriptions — AI uses these to tune prose style */
export const STYLE_DESCRIPTIONS: Record<string, string> = {
  'Mượt mà tự nhiên, cốt truyện chặt chẽ, nhân vật tinh tế': 'Văn phong trơn tru, dễ đọc, mạch truyện logic xuyên suốt. Tâm lý và hành động nhân vật sâu sắc, nhất quán.',
  'Văn phong đẹp, ý cảnh sâu xa': 'Từ ngữ trau chuốt, giàu hình ảnh và phép tu từ. Tập trung miêu tả cảnh vật, nội tâm nhân vật.',
  'Nhịp nhanh, cốt truyện kịch tính': 'Tập trung hành động, xung đột, diễn biến. Cắt giảm miêu tả thừa, bất ngờ liên tục.',
  'Mô tả tinh tế, cảm xúc phong phú': 'Chú trọng thể hiện cảm xúc, rung động tinh vi. Chi tiết nhỏ tô đậm không khí truyện.',
  'Hài hước thú vị, nhẹ nhàng vui vẻ': 'Ngôn ngữ hóm hỉnh, tình huống hài hước dở khóc dở cười. Giải trí cao.',
  'Cổ phong nhã vận cổ điển': 'Ngôn từ trang nghiêm, Hán Việt dày (thiên địa, đạo hữu, tiên tử...), câu dài, triết lý Đạo/Phật nặng.',
  'Sảng khoái cực độ (Sảng văn)': 'Câu ngắn gọn, nhịp nhanh, "một chưởng phá thiên", đối thoại mạnh mẽ, đánh mặt liên tục.',
  'Hắc ám u ám': 'Văn lạnh lẽo, tàn nhẫn, miêu tả tâm lý đen tối, thế giới bi quan.',
  'Hài hước lầy lội': 'Đối thoại troll, main mặt dày, pha meme + cổ phong, tình huống "lầy".',
  'Miêu tả chi tiết chậm rãi': 'Xây dựng cực kỹ (luyện đan, trận pháp, bí cảnh), câu dài, slow burn.',
  'Triết lý nội tâm sâu sắc': 'Đoạn độc thoại dài về đạo tâm, nhân quả, nhân sinh, văn trầm lắng suy tư.',
  'Hỗn hợp hiện đại cổ phong': 'Pha từ hiện đại (level up, cheat, vibe), đối thoại hơi Gen Z nhưng giữ khung cổ.',
  'Ngọt sủng rắc đường (甜宠文)': 'Văn phong mềm mại, ấm áp, tương tác cực "ngọt", mọi hiểu lầm giải quyết nhanh.',
  'Hồi hộp giật gân (Huyền nghi)': 'Câu văn ngắn gọn, không khí u ám, dẫn dắt rùng rợn, plot twist liên tục.',
  'Điền văn sinh hoạt (Chậm nhiệt / Slice of Life)': 'Nhịp cực chậm rãi. Nấu ăn, trồng trọt, gia đình ấm cúng, bình dị, "chữa lành".',
  'Trang bức vả mặt (Hệ thống / Đô thị sảng văn)': 'Kết cấu "bị khinh → thể hiện tài năng → mọi người khiếp sợ". Phóng đại cảm xúc đám đông.',
  'Thế giới tinh tế / Sci-fi (Cơ giáp)': 'Thuật ngữ khoa học viễn tưởng, không gian, thiết bị công nghệ cao. Câu văn logic, chiến thuật vĩ mô.',
  'Quan trường quyền mưu (Cung đấu / Gia đấu)': 'Từ ngữ hoa mỹ, vòng vèo, nhiều tầng ý nghĩa ẩn dụ. Đối thoại đầy tính toán, đấu trí ngôn từ.',
  'Thanh xuân vườn trường': 'Câu văn trong sáng, nhẹ nhàng, suy nghĩ ngây ngô bồng bột tuổi trẻ.',
  'Ngược luyến tàn tâm (Ngược văn)': 'Hiểu lầm, bi kịch dồn dập. Xoáy sâu nỗi đau, tuyệt vọng, giằng xé nội tâm.',
  'Vô hạn lưu (Nhiệm vụ sinh tử)': 'Nhịp cực nhanh, chuyển cảnh giữa các thế giới, giải đố sinh tử, áp lực thời gian.',
  'Quần tượng liệt truyện (Nhiều nhân vật chính)': 'Không tập trung một cá nhân, đan xen nhiều POV. Bối cảnh rộng lớn, sử thi.',
  'Quân sự chiến tranh': 'Thuật ngữ quân sự, chiến lược chiến thuật. Văn trầm hùng, khốc liệt, tinh thần đồng đội.',
  'Đam mỹ/Bách hợp tinh tế': 'Đào sâu cảm xúc, phát triển tình cảm tự nhiên giữa đồng giới. Rung động nhỏ nhất.',
  'Đồng nhân (Fanfiction)': 'Bắt chước sát giọng văn và tính cách nhân vật tác phẩm gốc. Kết hợp nguyên tác + sáng tạo mới.',
  'Võng du eSports': 'Ngôn ngữ game thủ (combat, gank, loot...). Tốc độ trận đấu nhanh, tâm sinh lý thi đấu đỉnh cao.',
};

/** Lookup helper — returns description for a genre, tag, or style name */
export function getGenreDescription(name: string): string {
  return GENRE_DESCRIPTIONS[name] ?? '';
}

export function getTagDescription(name: string): string {
  return TAG_DESCRIPTIONS[name] ?? '';
}

export function getStyleDescription(name: string): string {
  return STYLE_DESCRIPTIONS[name] ?? '';
}
