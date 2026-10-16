# Mo về quê

Trang đặt đặc sản xứ Thanh theo từng đợt Mo về quê: nem chua, bánh lá răng bừa, bánh bột lọc.
Giao tận nơi nội thành Hà Nội, miễn phí. Khách chuyển khoản trước qua VietQR.

- **Trang:** HTML/CSS/JS thuần, chạy trên GitHub Pages, không cần build.
- **Đơn hàng:** Google Apps Script ghi thẳng vào Google Sheet và báo đơn mới qua Gmail.
- **Chi phí:** 0đ.

```
index.html                 trang chính
assets/js/site-config.js   ← chỗ duy nhất cần sửa phía trang (URL API, Messenger, Zalo)
assets/data/               nội dung món + danh sách ảnh feedback
assets/images/             ảnh món, ảnh feedback, QR Zalo, ảnh xem trước khi share link
apps-script/               code dán vào Google Apps Script
tests/                     test logic đơn hàng (npm test)
```

**Thứ tự làm lần đầu (khoảng 30 phút):** 1 Sheet + script → 2 Deploy → 3 Email báo đơn → 4 Link liên hệ → 5 GitHub Pages → 6 Đặt thử 1 đơn → bắt đầu đăng story.

## 1. Tạo Google Sheet + script (khoảng 10 phút)

1. Vào [sheets.new](https://sheets.new), đặt tên ví dụ `Mo về quê – Đơn hàng`.
2. Trong Sheet, mở menu **Tiện ích mở rộng → Apps Script**.
3. Tạo 7 file script (nút **+** cạnh "Tệp" → **Tập lệnh**), đặt tên và dán nội dung tương ứng từ thư mục `apps-script/`. Không cần gõ đuôi `.gs`.
   - `main-web-app-handlers`
   - `owner-menu-open-close`
   - `order-formatting-helpers`
   - `order-validation-and-pricing`
   - `sheet-repository`
   - `email-new-order-notify`
   - `setup-sheets-one-time`

   Tạo xong thì xoá file `Code.gs` mặc định, rồi bấm 💾 **Lưu**.
4. Vào **Cài đặt dự án** (bánh răng bên trái):
   - tích *Hiển thị tệp kê khai "appsscript.json" trong trình chỉnh sửa*;
   - quay lại phần chỉnh sửa, mở `appsscript.json`, xoá hết rồi dán nội dung `apps-script/appsscript.json`, bấm Lưu.
5. Mở file `setup-sheets-one-time`, chọn hàm `setupSheets` trên thanh công cụ → **Chạy**.
   - Google hỏi cấp quyền: chọn tài khoản → *Nâng cao* → *Đi tới… (không an toàn)* → *Cho phép*.
   - Đây là script của chính bạn nên an toàn.6. Quay lại Sheet và **tải lại trang** (F5).
   - Bạn sẽ thấy 3 tab mới **Config**, **Products**, **Orders**, và menu **Mo về quê** trên thanh menu.
   - Múi giờ của Sheet đã được đặt về GMT+7, để ngày chốt tính đúng giờ Hà Nội.
7. Điền tab **Config**:
   - `bank_bin`: mã BIN ngân hàng nhận tiền, ví dụ `970436` Vietcombank, `970422` MB, `970407` Techcombank, `970418` BIDV, `970415` VietinBank, `970405` Agribank. Ngân hàng khác tra cột `bin` ở [api.vietqr.io/v2/banks](https://api.vietqr.io/v2/banks).
   - `bank_account`: số tài khoản nhận tiền.
   - `bank_account_name`: tên chủ tài khoản, viết IN HOA KHÔNG DẤU.

   STK nhận tiền chỉ nằm trong Sheet, không bao giờ xuất hiện trên trang hay GitHub.
8. Kiểm tra tab **Products**:
   - `setupSheets` đã điền sẵn `stock_limit` là 30 (nem chua) và 20 (bánh răng bừa) **làm ví dụ**. Sửa theo số chục bạn thật sự mang lên, hoặc **xoá trống** nếu không muốn giới hạn.
   - Giá đã điền sẵn 70.000 và 45.000.

## 2. Deploy để có URL API

1. Trong Apps Script bấm **Triển khai → Tác vụ triển khai mới**.
   - Bấm bánh răng cạnh "Chọn loại" → **Ứng dụng web**.
   - *Thực thi với tư cách*: **Tôi**
   - *Người có quyền truy cập*: **Bất kỳ ai**
   - Bấm **Triển khai**.
2. Copy URL dạng `https://script.google.com/macros/s/…/exec`.
3. **Kiểm tra:** dán URL đó vào trình duyệt. Thấy chữ dạng `{"open":false,"batchLabel":"Đợt 1",…,"ok":true}` là API chạy được.
4. Dán URL vào `apiUrl` trong `assets/js/site-config.js` (bước 4 làm cùng lúc).
5. **Sửa code về sau:** dùng **Triển khai → Quản lý các lần triển khai → ✏️ → Phiên bản: Mới** để giữ nguyên URL. Đừng bấm "Tác vụ triển khai mới", vì làm vậy sẽ ra URL khác.

Chỉ đổi dữ liệu trong Sheet (bật/tắt đợt, giá, tồn kho) thì **không cần deploy lại**. Trang sẽ cập nhật sau tối đa khoảng 30 giây.

## 3. Báo đơn mới qua Gmail

Mỗi đơn mới gửi 1 email vào Gmail của tài khoản đã deploy, tiêu đề dạng `🛒 Đơn mới MVQ1611-001 · 185.000đ · Lan`. Miễn phí, giới hạn khoảng 100 email/ngày.

1. Mở file `email-new-order-notify`, chọn hàm `testOrderEmail` → **Chạy**. Google hỏi thêm quyền gửi email: *Nâng cao → Đi tới… → Cho phép*.
2. Mở Gmail, thấy email "🛒 Đơn mới MVQ-TEST" là xong.
3. Trên app Gmail điện thoại, bật thông báo để có đơn là điện thoại báo ngay.

Muốn email về địa chỉ khác: *Cài đặt dự án → Thuộc tính tập lệnh*, thêm `NOTIFY_EMAIL` = địa chỉ email đó.

**Nếu bạn đã deploy trước khi có file này:** code đã đổi, nên phải cập nhật bản deploy, nếu không đơn thật sẽ không có email. Vào **Triển khai → Quản lý các lần triển khai → ✏️ → Phiên bản: Mới → Triển khai**. URL vẫn giữ nguyên.

## 4. Điền link liên hệ trên trang

Mở `assets/js/site-config.js` và điền:

| Ô | Điền gì | Lấy ở đâu |
|---|---|---|
| `apiUrl` | URL `/exec` ở bước 2 | Apps Script |
| `messengerUsername` | username Facebook, ví dụ `mo.thuan` (không phải link đầy đủ) | Phần đuôi của `facebook.com/<username>` |
| `zaloGroupUrl` | link mời nhóm, dạng `https://zalo.me/g/…` | Zalo → nhóm → ⚙️ → Link tham gia nhóm |
| `zaloQrImage` | `assets/images/zalo-qr.png` | Zalo → Cá nhân → bấm vào mã QR → Lưu ảnh. Đặt tên `zalo-qr.png`, bỏ vào `assets/images/` |

Ô nào để trống thì nút tương ứng tự ẩn. Trang không bao giờ hiện số điện thoại của bạn.

## 5. Đưa lên GitHub Pages

1. Tạo repo **public** `mo-ve-que` trên GitHub `bonjourney1011` và push toàn bộ thư mục này lên. Thư mục `_private/` (playbook) không lên git.
2. Repo → **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`** → Save.
3. Đợi 1–2 phút, trang chạy ở `https://bonjourney1011.github.io/mo-ve-que/`.

Mỗi lần sửa file trên trang (`site-config.js`, ảnh, feedback), push lại hoặc sửa trực tiếp trên web GitHub. Trang tự cập nhật sau khoảng 1 phút.

## 6. Đặt thử 1 đơn trước khi đăng story

1. Config: tích `ordering_open`, đặt `order_deadline` là một ngày sắp tới.
2. Mở trang trên điện thoại → đặt 1 chục nem bằng SĐT của bạn.
3. Kiểm tra cả 4 điều:
   - tab **Orders** có dòng mới;
   - Gmail nhận email báo đơn;
   - mã QR hiện đúng số tiền;
   - quét thử QR bằng app ngân hàng thấy đúng tên tài khoản của bạn (không cần chuyển).
4. Chuyển dòng đơn thử sang **Huỷ**, hoặc xoá dòng đó đi.

## 7. Mỗi lần về quê: mở và đóng đợt

| Việc | Làm ở đâu |
|---|---|
| Mở đơn | Config: sửa `batch_label` (VD `Đợt 22/11`), `order_deadline`, `delivery_date`, rồi tích `ordering_open` (hoặc menu **Mo về quê → 🟢 Mở đơn**) |
| Hạn chốt | `order_deadline` chỉ nhập **ngày** (VD `20/11/2026`). Trang hiện "Chốt đơn hết ngày 20/11 · còn 2 ngày", đúng ngày chốt hiện "Hôm nay chốt đơn". **Form tự đóng sau 23:59 ngày đó** |
| Số lượng mang lên (tuỳ chọn) | Products: `stock_limit` (số chục). Trang hiện "Còn X chục" và chỉ chặn **món đó** khi hết; form không đóng. Để trống = không giới hạn |
| Món tạm ngưng hoặc sắp có | Products: bỏ tích `available` |
| Đổi giá | Products: `price` |
| Báo ngày mở lại | Config: `next_open_date` nhập ngày (VD `15/12/2026`). Lúc chưa mở đơn, trang hiện "Dự kiến mở đơn lại ngày 15/12 · còn 12 ngày". Đúng ngày hiện "Hôm nay Mo mở đơn lại"; qua ngày mà chưa mở thì hiện "Mo sắp mở đơn lại", không để ngày cũ. Để trống = không hiện |
| Đóng sớm hơn hạn | Trên máy tính: menu **Mo về quê → 🔴 Đóng đơn ngay** (trang đổi ngay). Trên app Sheets điện thoại: bỏ tích `ordering_open` (trang đổi sau khoảng 30 giây; đơn gửi sau lúc bỏ tích bị chặn ngay) |
| Theo dõi đơn | Orders: cập nhật `payment_status` (Chờ CK / Đã CK / Đã hoàn / Huỷ) và `delivery_status` |

- Đơn **Huỷ** không bị tính vào tồn kho. Gặp đơn ảo hoặc spam, chuyển sang **Huỷ** để trả lại số lượng cho đợt.
- Mỗi đợt dùng `batch_label` mới để tồn kho và giới hạn 3 đơn/SĐT đếm lại từ đầu.
- **Không đổi tên tab, không xoá dòng ở Config, không chèn cột vào giữa.** Script đọc cột theo thứ tự, nên cột mới chỉ thêm ở cuối. Xoá dòng đơn ở Orders thì được.
- Cột `source` cho biết khách đến từ kênh nào. Khi đăng, gắn link dạng `…/mo-ve-que/?src=story`, `?src=post` hoặc `?src=zalo`.

## 8. Thêm ảnh món, ảnh feedback, món mới

- **Ảnh món:**
  1. Bỏ ảnh vào `assets/images/products/`, ví dụ `nem-chua.jpg`. Ảnh ngang tỉ lệ 4:3, rộng khoảng 1200px, dưới 300KB.
  2. Điền đường dẫn vào ô `"image"` của món đó trong `assets/data/products-content.json`, ví dụ `"image": "assets/images/products/nem-chua.jpg"`.
- **Feedback:** bỏ ảnh chụp màn hình vào `assets/images/feedback/`, rồi thêm một dòng vào `assets/data/feedback-list.json`:
  ```json
  [{ "image": "assets/images/feedback/feedback-01.jpg", "caption": "Chị Lan · đợt 22/11" }]
  ```
  Nhớ che tên hoặc ảnh đại diện của khách nếu họ chưa đồng ý.
- **Mở bán bánh bột lọc:** ở tab Products, điền `price` và tích `available`. Nội dung mô tả đã viết sẵn.
- **Thêm món mới:** thêm một dòng ở Products, và một mục cùng `sku` trong `products-content.json`.
- **Ảnh xem trước khi share link:** `assets/images/og-cover.png` (1200×630) có ghi giá. Đổi giá thì nên thay ảnh này, hoặc dùng ảnh thật của món.
- Có thể làm tất cả qua giao diện web của GitHub: **Add file → Upload files**.

### Checklist chụp ảnh chuyến về
- [ ] Bó nem nguyên chục còn lá chuối và lạt, cùng một chiếc đã bóc thấy màu hồng và bì
- [ ] Nem cắt đôi cạnh lá đinh lăng, tỏi, tương ớt
- [ ] Bánh răng bừa nguyên lá, cùng một chiếc đã bóc, chụp lúc còn bốc khói
- [ ] Đôi tay đang gói ở cơ sở (không cần lộ mặt hay tên cơ sở)
- [ ] Ánh sáng tự nhiên cạnh cửa sổ, nền gỗ, mẹt tre hoặc lá chuối; tránh đèn vàng

**Trước khi chạy thật:** hỏi cơ sở để xác nhận số ngày bảo quản trong `products-content.json` và phần "Hỏi nhanh" ở `index.html`.

## Phát triển

```bash
npm test        # test logic đơn hàng (chạy đúng file .gs thật bằng Node)
npm run serve   # xem trang ở http://localhost:4173
```

Chưa điền `apiUrl` thì trang hiện trạng thái "Chưa mở đơn" và các nút liên hệ.

**Server tự kiểm tra lại mọi thứ, không tin số liệu từ trình duyệt:**
- tính lại giá và tổng tiền;
- kiểm tra đợt còn mở (ô tích + ngày chốt) và tồn kho;
- khoá ghi đơn (`LockService`) để hai đơn cùng lúc không vượt tồn kho;
- chống spam: ô bẫy, chặn gửi quá nhanh, tối đa 3 đơn mỗi SĐT trong một đợt, tối đa 20 đơn/10 phút cho cả trang;
- gửi lại cùng một form (mạng chậm) không tạo đơn trùng;
- mã đơn không bao giờ lặp, kể cả khi xoá dòng thử;
- chống chèn công thức vào Sheet.
