# Xuanhuan Modular Genre Template

## Tổng quan

Genre template này sử dụng cấu trúc modular từ webnovel-writer, chia nhỏ thành các files chuyên biệt để dễ maintain và reuse.

## Cấu trúc

```
xuanhuan_modular/
├── index.md (file này)
├── power-systems.md (hệ thống sức mạnh)
├── plot-patterns.md (mẫu cốt truyện)
└── cool-points.md (điểm hấp dẫn)
```

## Cách sử dụng

### 1. Đọc tổng quan
Đọc file `index.md` này để hiểu cấu trúc tổng thể.

### 2. Xem chi tiết từng phần
- **power-systems.md**: Xem hệ thống sức mạnh, cấp bậc, tài nguyên
- **plot-patterns.md**: Xem mẫu cốt truyện, tình tiết, nhân vật
- **cool-points.md**: Xem điểm hấp dẫn, cách tạo điểm hấp dẫn

### 3. Áp dụng vào project
Khi tạo project mới, có thể:
1. Chọn genre template này
2. Đọc các files để hiểu cấu trúc
3. Tùy chỉnh theo nhu cầu project
4. Sử dụng thông tin để xây dựng worldbuilding

## Lợi ích của cấu trúc modular

1. **Dễ maintain**: Mỗi file tập trung vào một chủ đề, dễ sửa đổi
2. **Dễ reuse**: Các components có thể được share giữa genres
3. **Dễ mở rộng**: Có thể thêm mới files mà không ảnh hưởng files khác
4. **Dễ tìm kiếm**: Tìm thông tin nhanh hơn nhờ chia nhỏ

## So sánh với cấu trúc cũ

### Cấu trúc cũ (single file)
- Tất cả thông tin trong một file
- Khó maintain khi file lớn
- Khó reuse components
- Khó mở rộng

### Cấu trúc mới (modular)
- Chia nhỏ thành nhiều files
- Dễ maintain từng file
- Dễ reuse components
- Dễ mở rộng bằng cách thêm files mới

## Tích hợp với VietTruyen

Genre template này có thể được tích hợp vào VietTruyen thông qua:

1. **Genre selection**: Khi tạo project mới, chọn genre template này
2. **Worldbuilding**: Sử dụng thông tin từ power-systems.md để xây dựng world
3. **Plot planning**: Sử dụng plot-patterns.md để lập kế hoạch cốt truyện
4. **Quality check**: Sử dụng cool-points.md để kiểm tra chất lượng

## Kế hoạch mở rộng

Có thể thêm các files mới trong tương lai:
- `character-archetypes.md`: Mẫu nhân vật
- `world-building.md`: Xây dựng thế giới
- `anti-patterns.md`: Các pattern cần tránh
- `dialogue-patterns.md`: Mẫu đối thoại
- `scene-templates.md`: Mẫu cảnh

## Feedback

Nếu có ý kiến đóng góp, hãy tạo issue hoặc pull request.