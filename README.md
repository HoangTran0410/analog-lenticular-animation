# Analog Lenticular Animation

Donate? Muốn hỗ trợ mình 1 ly cafe <3 [Donate here](https://github.com/HoangTran0410/HoangTran0410/blob/main/DONATE.md)

Live Demo [here](https://hoangtran0410.github.io/analog-lenticular-animation/)

## What's this?

![preview](assets/preview.gif)

Kéo ngang để trượt lưới che. Mỗi khe hở chỉ để lọt một frame, nên trượt lưới
là chuyển frame — chính là nguyên lý của ảnh lenticular in giấy.

## Hai chế độ nguồn

**Sheet** — tấm barrier-grid. Các tấm trong `assets/` có chu kỳ lược đã đo sẵn
trong `SHEETS` nên mở lên là đúng ngay; thả ảnh bất kỳ vào thì tự dò chu kỳ
(`detectPeriod`). Sai thì sửa thẳng ở ô **chu kỳ (px)** hoặc bấm **Dò lại từ
ảnh**.

**GIF** — thả một file `.gif` nhiều frame vào trang. Frame được tách ra, lấy mẫu, rồi
interlace lại ngay trong browser. Ở chế độ này chu kỳ lưới và chu kỳ ảnh lấy từ
cùng một biến nên luôn khớp, không phải dò. Thử với `assets/orbit-demo.gif`.

Từ đó xuất được file PNG để in: nhập DPI và LPI của tấm lưới thật, trang tính
độ rộng strip (bo về số nguyên pixel, vì lẻ pixel thì mỗi chu kỳ lệch một chút
rồi tích luỹ thành moiré) và báo lại LPI thật đạt được.

## Điều khiển

| | |
|---|---|
| kéo ngang | trượt lưới |
| `←` `→` | zoom (sheet) / độ rộng strip (GIF) |
| `↑` `↓` | số khe (sheet) / số frame (GIF) |
| `space` | ẩn/hiện lưới, để xem ảnh gốc bên dưới |
| lăn chuột | như `←→` |

## Chọn tham số

Số frame `n` có hai lực kéo ngược nhau: lưới che mất `(n-1)/n` diện tích nên `n`
lớn thì ảnh tối và mỗi frame chỉ còn `1/n` chi tiết ngang; ngược lại `n` nhỏ thì
chu kỳ kéo chỉ `n × strip` pixel, kéo một chút đã nhảy nguyên frame. Vùng dùng
được thực tế là 4–8.

GIF dài đừng rải đều toàn bộ — hai frame cách nhau quá xa thì mắt không nối
thành chuyển động, chỉ thấy nhấp nháy. Chọn một đoạn ngắn bằng thanh range.

GIF không cần loop sẵn. Nội dung loop (xoay, nhịp tim) thì kéo một chiều liên
tục sẽ mượt; nội dung A→B thì kéo qua lại trong một chu kỳ — đó là kiểu "flip"
kinh điển. Bật ping-pong để biến nội dung không loop thành loop nhân tạo.

## Sheet khớp lưới thế nào

Sheet không phải "N frame xen kẽ" — tách ngược theo mọi cách chia đều đều ra
nhiễu. Chúng là **barrier-grid**: mực được vẽ theo một lược tuần hoàn, và cái
duy nhất phải khớp là

```
chu kỳ mask trên màn hình  =  chu kỳ sheet (px file gốc) × tỉ lệ hiển thị
```

Ba đại lượng (chu kỳ mask, độ rộng khe, tỉ lệ hiển thị), một phương trình, nên
còn hai bậc tự do. Đại lượng được **lưu** là chu kỳ mask — nó chính là nút zoom;
khe và tỉ lệ đều suy ra:

```
scale = maskPeriod / sheetPeriod     ← chỉ phụ thuộc zoom
strip = round(maskPeriod / n)        ← n chỉ đổi độ rộng khe
```

Chọn như vậy vì nếu lưu `strip` và suy `scale` (`scale = n × strip / period`) thì
tăng số khe sẽ phình luôn kích thước ảnh — hai thứ đáng lẽ độc lập lại dính vào
nhau. Có một test giữ tính chất này.

Hệ quả: zoom nhảy theo bậc chu kỳ nguyên chứ không trượt liên tục, vì trượt liên
tục phá vỡ đẳng thức trên. Và đổi kích thước cửa sổ thì phải chọn lại chu kỳ mask
mới refit được.

Chu kỳ đo bằng autocorrelation 2D (lấy sai khác theo từng hàng rồi mới cộng —
gộp các hàng về một hàng sẽ triệt tiêu pha), chạy độc lập trên 5 băng ngang và
chỉ nhận khi các băng có nội dung cho cùng đáp số:

| sheet | chu kỳ |
|---|---|
| ball-rotate, minecraft, skull | 60px |
| woman | 19.75px |
| hourse | 7px |
| cat, wow | 6.5px |
| heart-rotate | 6.25px |

Kiểm chéo: `scaleForSheet(60, 3, 3) = 0.15` tái tạo đúng config hand-tuned trong
commit đầu tiên của repo (`img_scale = 0.15, frame = 3, d = 3`). Có một test giữ
đẳng thức này.

## Cấu trúc

| File | Việc |
|---|---|
| `interlace.js` | Toàn bộ phần số học, thuần, không đụng canvas |
| `frames.js` | Cầu nối ImageData ↔ canvas, dựng lưới, tải file |
| `ui.js` | Panel điều khiển |
| `main.js` | Sketch p5, hai chế độ nguồn, tương tác |

## Test

```bash
node --test test/
```

`interlace.js` chạy được cả trong node lẫn browser nên phần số học test được
trực tiếp, không cần trình duyệt hay thư viện ngoài.
