# k6 Load Testing — Skeleton học tập

Thư mục này chứa kịch bản k6 đầu tiên để làm quen với load testing, target là
OWASP Juice Shop chạy local qua Docker (`npm run app:up`, mặc định port `3000`).

k6 là công cụ độc lập (viết script bằng JS nhưng chạy trên runtime Go riêng của
k6, không phải Node.js) — nên cần cài đặt riêng, không qua `npm install`.

## 1. Cài đặt k6

**Windows (khuyên dùng winget hoặc choco):**

```powershell
winget install k6 --source winget
# hoặc
choco install k6
```

Kiểm tra đã cài xong:

```powershell
k6 version
```

Tài liệu cài đặt đầy đủ (macOS/Linux/Docker): https://grafana.com/docs/k6/latest/set-up/install-k6/

## 2. Khởi động Juice Shop local

Từ thư mục gốc của project:

```powershell
npm run app:up      # docker compose up -d
npm run app:wait     # đợi tới khi app sẵn sàng (khuyến nghị trước khi chạy k6)
```

App sẽ chạy tại `http://localhost:3000`.

## 3. Chạy kịch bản k6

Kịch bản mẫu: [get-products.js](get-products.js) — gọi `GET /api/Products`
lặp lại với tải tăng dần (ramping), có comment giải thích từng dòng.

> Lưu ý: Juice Shop dùng REST API tự sinh bởi `finale-rest`, nằm ở
> `/api/Products` (viết hoa) — không phải `/rest/products`. Nếu gọi sai
> route sẽ nhận về lỗi 500 "Unexpected path".

```powershell
k6 run perf/k6/get-products.js
```

Nếu Juice Shop chạy ở địa chỉ khác (VD: cổng khác, hoặc host khác), override
bằng biến môi trường `BASE_URL`:

```powershell
k6 run -e BASE_URL=http://localhost:3000 perf/k6/get-products.js
```

### Chạy nhanh để thử (smoke test)

Muốn thử nhanh không cần đợi đủ 50 giây (10s ramp-up + 30s hold + 10s
ramp-down) như định nghĩa trong `options.stages`, có thể override trực tiếp
qua CLI (các flag này sẽ ghi đè `options` trong file):

```powershell
k6 run --vus 2 --duration 10s perf/k6/get-products.js
```

## 4. Đọc kết quả (output mặc định của k6)

Sau khi chạy xong, k6 in ra một bảng summary trong terminal. Các chỉ số quan
trọng cần để ý khi mới học:

- `http_req_duration` — thời gian phản hồi của request (avg, min, max, và
  các percentile như `p(90)`, `p(95)`). Đây là chỉ số quan trọng nhất để
  đánh giá hiệu năng.
- `http_req_failed` — tỉ lệ request lỗi (status code không phải 2xx/3xx theo
  logic mặc định của k6).
- `checks` — tỉ lệ các điều kiện trong `check()` (định nghĩa trong script)
  pass hay fail. Ví dụ: `status is 200`, `response time < 500ms`.
- `errors` — custom metric tự định nghĩa trong script, đo tỉ lệ lỗi theo logic
  riêng (kết hợp cả check status lẫn thời gian phản hồi).
- `iterations` — số vòng lặp `default function()` đã chạy xong.
- `vus` / `vus_max` — số virtual user đang chạy / số tối đa từng đạt được.

Nếu bất kỳ điều kiện nào trong `thresholds` (khai báo trong `options`) bị vi
phạm, k6 sẽ báo `thresholds` failed và exit code khác 0 — hữu ích để gắn vào
CI/CD sau này (fail pipeline khi hiệu năng suy giảm).

## 5. Stress test — thấy hệ thống bắt đầu chịu áp lực

[get-products.js](get-products.js) là bài "baseline" (tối đa 5 VU, có sleep
mô phỏng người dùng thật) — ở tải này Juice Shop local gần như không có áp
lực gì (p95 ~15ms), nên khó thấy được ý nghĩa thật của load test.

[stress-products.js](stress-products.js) đẩy tải lên tới 100 VU liên tục,
không sleep, để ép hệ thống bộc lộ giới hạn:

```powershell
k6 run perf/k6/stress-products.js
```

Muốn quan sát tài nguyên container trong lúc chạy, mở thêm 1 terminal:

```powershell
docker stats juice-shop
```

Kết quả thường thấy: `http_req_failed` vẫn 0% nhưng `http_req_duration`
tăng vọt (p95 có thể lên hàng trăm ms — hàng chục lần so với baseline). Đây
là dấu hiệu hệ thống đang **bão hoà (saturation)**: chưa lỗi hẳn nhưng mỗi
request phải chờ lâu hơn vì tài nguyên (CPU/event loop của Node.js trong
container) không đủ xử lý đồng thời. Muốn tìm điểm hệ thống thật sự bắt đầu
trả lỗi (không chỉ chậm), thử tăng `target` trong `options.stages` của file
này lên cao hơn (VD 300–500 VU) và xem `http_req_failed` bắt đầu > 0%.

## 6. Các bước tiếp theo khi đã quen

Một vài hướng để mở rộng khi đã hiểu 2 kịch bản trên (không làm ngay, chỉ để
tham khảo khi sẵn sàng):

- Thêm kịch bản đăng nhập (`POST /rest/user/login`) và dùng token cho các
  request cần xác thực.
- Tách nhiều "scenario" trong cùng 1 file (`options.scenarios`) để mô phỏng
  nhiều luồng người dùng khác nhau chạy song song.
- Xuất kết quả ra JSON/InfluxDB/Grafana để trực quan hoá thay vì chỉ đọc
  summary trên terminal (`k6 run --out json=result.json ...`).
- Viết `setup()`/`teardown()` để chuẩn bị dữ liệu trước khi test và dọn dẹp
  sau khi test xong.
