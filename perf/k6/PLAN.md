# Lộ trình học k6 — từ beginner đến áp dụng thực tế vào Juice Shop

Lộ trình 6 giai đoạn, đi từ những gì đã làm (baseline + stress test cơ bản)
tới mức có thể tự viết bộ load test đầy đủ cho 1 dự án thật. Mỗi giai đoạn
có: mục tiêu, việc cần làm, và tiêu chí để biết đã xong.

Không có deadline cứng — đi theo tốc độ của bạn, đánh dấu `[x]` khi hoàn
thành từng mục.

---

## Giai đoạn 0 — Đã xong ✅

- [x] Cài k6, chạy được `k6 version`
- [x] Chạy baseline test đơn giản (GET, ramping VU nhẹ) — [get-products.js](get-products.js)
- [x] Đọc hiểu report: checks, THRESHOLDS, http_req_duration, http_req_failed
- [x] Chạy stress test, thấy latency tăng theo tải — [stress-products.js](stress-products.js)
- [x] Xác nhận nguyên nhân bằng `docker stats` (CPU-bound)
- [x] Nắm khái niệm nền tảng — [LEARNING.md](LEARNING.md)

---

## Giai đoạn 1 — Request có dữ liệu động (params, body, header)

**Mục tiêu:** viết được request phức tạp hơn GET đơn giản — POST với JSON
body, custom header, query param.

Việc cần làm:

- [ ] Viết script gọi `POST /api/Feedbacks` gửi JSON body (comment, rating)
- [ ] Dùng `http.get()` với query param, VD `/rest/products/search?q=juice`
- [ ] Thử `params` object của k6 (`headers`, `tags`) trong request

Tiêu chí xong: viết được 1 request POST có body JSON và kiểm tra response
bằng `check()`, không cần xem tài liệu để nhớ cú pháp cơ bản.

Tài liệu: https://grafana.com/docs/k6/latest/using-k6/http-requests/

---

## Giai đoạn 2 — Auth flow (login, giữ token, dùng lại)

**Mục tiêu:** mô phỏng 1 user thật: login 1 lần, dùng token cho các request
tiếp theo trong cùng iteration.

Việc cần làm:

- [ ] Viết script `POST /rest/user/login` với email/password, lấy `authentication.token` từ response JSON
- [ ] Gắn token vào header `Authorization: Bearer <token>` cho request kế tiếp (VD lấy giỏ hàng `/rest/basket/:id`)
- [ ] Xử lý trường hợp login fail (check status trước khi dùng token) — tránh lỗi `undefined` lan sang các bước sau

Tiêu chí xong: 1 script chạy được chuỗi login → gọi API cần xác thực, có
check ở cả 2 bước.

Kiến thức mới: JSON parsing (`res.json()`), biến trong scope của 1 iteration
(khác với biến global — token không dùng chung giữa các VU).

---

## Giai đoạn 3 — Nhiều luồng người dùng cùng lúc (scenarios)

**Mục tiêu:** hiểu và dùng được `options.scenarios` để mô phỏng nhiều hành
vi người dùng khác nhau chạy song song trong cùng 1 lần test (thay vì 1
kịch bản `default function()` cho tất cả).

Việc cần làm:

- [ ] Đọc về các executor: `constant-vus`, `ramping-vus`, `constant-arrival-rate`
- [ ] Viết 1 file có 2 scenario chạy song song: VD 70% VU chỉ duyệt sản phẩm (đọc), 30% VU login + thêm giỏ hàng (ghi) — mô phỏng tỉ lệ hành vi thật của user
- [ ] Hiểu sự khác biệt giữa "VU-based" (constant-vus/ramping-vus) và "rate-based" (constant-arrival-rate) — cái nào phù hợp khi nào

Tiêu chí xong: giải thích được (bằng lời của mình) tại sao
`constant-arrival-rate` mô phỏng tải thực tế chuẩn hơn `constant-vus` trong
nhiều trường hợp (vì throughput không phụ thuộc vào response time).

Tài liệu: https://grafana.com/docs/k6/latest/using-k6/scenarios/

---

## Giai đoạn 4 — Thiết lập bài test đúng chuẩn (setup/teardown, data, thresholds theo tag)

**Mục tiêu:** viết bài test có chuẩn bị dữ liệu đầu vào và dọn dẹp sau khi
chạy — gần với cách viết test thật trong CI, không chỉ script học tập.

Việc cần làm:

- [ ] Dùng `setup()` để tạo user test (hoặc lấy token) 1 lần trước khi test chạy, truyền dữ liệu đó vào `default function()`
- [ ] Dùng `teardown()` để dọn dữ liệu test đã tạo (nếu cần)
- [ ] Threshold theo từng nhóm request riêng bằng `tags` (VD: threshold riêng cho endpoint login khác với endpoint search)
- [ ] Test với dữ liệu ngẫu nhiên/đa dạng thay vì hardcode 1 giá trị (dùng `SharedArray` đọc từ file CSV/JSON danh sách sản phẩm, user...)

Tiêu chí xong: viết được 1 bài test có setup tạo dữ liệu, chạy nhiều VU với
dữ liệu khác nhau (không phải tất cả VU gọi y hệt 1 request).

---

## Giai đoạn 5 — Xuất kết quả & tích hợp CI

**Mục tiêu:** kết quả test không chỉ nằm trên terminal — lưu lại để so sánh
qua thời gian, và tự động hoá trong pipeline.

Việc cần làm:

- [ ] Xuất kết quả ra JSON: `k6 run --out json=result.json ...`, thử đọc lại file để hiểu cấu trúc dữ liệu thô
- [ ] (Tuỳ chọn, nếu muốn học sâu hơn) Thử k6 Cloud hoặc xuất qua InfluxDB + Grafana để có dashboard trực quan theo thời gian
- [ ] Thêm 1 npm script trong `package.json` của project này, VD `"perf:baseline"` và `"perf:stress"`, để chạy k6 nhất quán như các lệnh test khác trong repo
- [ ] (Tuỳ chọn) Thêm 1 job load test riêng vào CI (không chạy mỗi lần push — chỉ chạy theo lịch hoặc thủ công, vì load test tốn thời gian và cần môi trường ổn định)

Tiêu chí xong: có thể chạy `npm run perf:baseline` từ project root, kết quả
được lưu lại thành file để so sánh giữa các lần chạy.

---

## Giai đoạn 6 — Áp dụng thực tế lên toàn bộ Juice Shop

**Mục tiêu:** không chỉ 1 endpoint đơn lẻ nữa — có bộ test hiệu năng phủ các
luồng chính của app, giống cách bạn đã làm E2E functional test.

Gợi ý các luồng đáng test (ưu tiên theo mức độ quan trọng với người dùng
thật):

- [ ] Luồng duyệt sản phẩm: search, xem chi tiết sản phẩm
- [ ] Luồng mua hàng: login → thêm giỏ hàng → checkout
- [ ] Luồng đăng ký user mới
- [ ] So sánh hiệu năng endpoint có auth vs không auth (auth thường chậm hơn do bcrypt/JWT)

Tiêu chí xong: có thư mục `perf/k6/scenarios/` với vài file test theo luồng
nghiệp vụ thật, không chỉ theo endpoint đơn lẻ — và 1 báo cáo ngắn (có thể
là README riêng) tóm tắt hiệu năng baseline của Juice Shop local trên máy
bạn, để dùng làm mốc so sánh sau này.

---

## Cách dùng file này

- Đánh dấu `[x]` trực tiếp trong file này khi hoàn thành từng mục.
- Không cần làm tuần tự cứng nhắc — nếu 1 mục ở giai đoạn sau tò mò trước,
  cứ thử, miễn đã nắm giai đoạn 0-1 (nền tảng request cơ bản).
- Khi làm xong 1 giai đoạn, có thể quay lại hỏi để cùng thực hành trực tiếp
  (giống cách đã làm giai đoạn 0) thay vì tự đọc lý thuyết suông.
