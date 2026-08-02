# Thiết kế bộ Performance Test đầy đủ cho Juice Shop (k6)

Tài liệu này là bản thiết kế — trả lời "test cái gì, tải bao nhiêu, đo bằng
gì, tổ chức file ra sao" — trước khi viết thêm bất kỳ script k6 nào ngoài
2 file baseline/stress đã có. Áp dụng đúng khung 5 bước đã học ở
[LEARNING.md § 8](LEARNING.md#8-cách-thiết-kế-1-bài-performance-test).

Không làm hết 1 lúc — đây là bản đồ để đi dần theo [PLAN.md](PLAN.md)
(lộ trình học kỹ năng k6). Tài liệu này tập trung vào **thiết kế**, PLAN.md
tập trung vào **học từng kỹ thuật**.

---

## 1. Mục tiêu của bộ test này (Bước 1 trong khung thiết kế)

Vì đây là project portfolio/CV chạy trên Docker local (không có traffic
production thật, không có SLA khách hàng cam kết), mục tiêu thực tế nhất
là:

1. **Có baseline hiệu năng** cho các luồng nghiệp vụ chính — để nếu sau này
   sửa code Juice Shop hoặc đổi cấu hình Docker, biết ngay có bị chậm đi
   không (regression detection).
2. **Biết giới hạn chịu tải** của môi trường local hiện tại (đã làm 1 phần
   ở [stress-products.js](stress-products.js) — CPU-bound ở ~90 req/s cho
   1 endpoint đơn giản).
3. **Thể hiện được năng lực thiết kế performance test có hệ thống** trong
   CV — tức là bộ test cần có cấu trúc rõ ràng, không phải vài script rời
   rạc.

Mục tiêu **không phải**: tìm SLA "chuẩn ngành" (không có traffic thật để so
sánh) hay chạy soak test nhiều giờ (tốn thời gian, giá trị thấp cho 1 app
demo chạy local).

---

## 2. Chọn luồng nghiệp vụ cần test (Bước 3 — tính đại diện)

Dựa theo cấu trúc test hiện có trong `tests/api/` và `tests/e2e/`, đây là
các luồng đáng test hiệu năng, xếp theo mức độ ưu tiên (luồng càng nhiều
người dùng chạm tới, càng đáng test trước):

| #   | Luồng                  | Endpoint chính                            | Loại (đọc/ghi) | Có auth?            | Độ ưu tiên                                    |
| --- | ---------------------- | ----------------------------------------- | -------------- | ------------------- | --------------------------------------------- |
| 1   | Xem danh sách sản phẩm | `GET /api/Products`                       | Đọc            | Không               | Đã có ✅ ([get-products.js](get-products.js)) |
| 2   | Tìm kiếm sản phẩm      | `GET /rest/products/search?q=`            | Đọc            | Không               | Cao                                           |
| 3   | Đăng nhập              | `POST /rest/user/login`                   | Ghi (nhẹ)      | Không (tạo ra auth) | Cao                                           |
| 4   | Đăng ký user mới       | `POST /api/Users`                         | Ghi            | Không               | Trung bình                                    |
| 5   | Xem giỏ hàng           | `GET /rest/basket/:id`                    | Đọc            | Có                  | Trung bình                                    |
| 6   | Thêm sản phẩm vào giỏ  | `POST /api/BasketItems`                   | Ghi            | Có                  | Trung bình                                    |
| 7   | Luồng mua hàng đầy đủ  | login → search → add to basket → checkout | Hỗn hợp        | Có                  | Cao (mô phỏng user thật)                      |

Endpoint cụ thể cho #4-6 cần xác nhận lại bằng cách xem qua
`tests/api/basket.api.spec.ts` và `tests/e2e/purchase-journey.spec.ts` khi
bắt đầu viết (path báo ở đây lấy từ REST API chuẩn của Juice Shop, có thể
lệch chi tiết param).

**Nguyên tắc chọn:** ưu tiên luồng có cả "đọc" lẫn "ghi", và ít nhất 1 luồng
có auth — vì như đã học ở Case 1 (LEARNING.md), test toàn "đọc" trên dữ
liệu sạch sẽ đánh giá quá lạc quan về hiệu năng thật.

---

## 3. Mức tải mục tiêu cho từng loại test (Bước 2)

Vì không có số liệu production thật, mốc tải dùng ở đây được ước lượng dựa
trên **khả năng của máy chạy Docker local**, không phải nhu cầu nghiệp vụ
thật — mục đích là có 1 thang đo nhất quán để so sánh qua thời gian, không
phải để dự đoán tải production.

| Mốc          | VU                      | Ý nghĩa                                                | Dùng khi nào                                             |
| ------------ | ----------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| **Smoke**    | 1-2                     | Chỉ kiểm tra script chạy đúng, không đo hiệu năng thật | Local dev, trước khi commit script mới                   |
| **Baseline** | 5                       | Tải nhẹ, ổn định — mốc "bình thường" để so sánh        | Sau mỗi lần đổi code Juice Shop hoặc cấu hình Docker     |
| **Load**     | 20-30                   | Tải vừa, gần với "nhiều user cùng lúc" hợp lý cho demo | Kiểm tra định kỳ, trước khi ghi hiệu năng vào CV/báo cáo |
| **Stress**   | 100+ (ramp tới khi lỗi) | Tìm giới hạn thật của môi trường                       | Khi muốn biết "tối đa chịu được bao nhiêu"               |

Baseline (5 VU) và Stress (100 VU) đã có sẵn cho endpoint sản phẩm. Việc
còn lại là áp dụng cùng 4 mốc này cho các luồng ở mục 2.

---

## 4. Threshold cho từng loại luồng (Bước 4)

Không dùng 1 threshold chung cho tất cả — endpoint có auth (bcrypt/JWT) và
endpoint ghi dữ liệu (DB write) vốn chậm hơn endpoint đọc thuần, nên
threshold cần tách theo nhóm bằng `tags` (xem Giai đoạn 4 trong
[PLAN.md](PLAN.md)):

| Nhóm                               | p(95) mục tiêu | error rate mục tiêu | Lý do                                                    |
| ---------------------------------- | -------------- | ------------------- | -------------------------------------------------------- |
| Đọc, không auth (products, search) | < 200ms        | < 1%                | Đơn giản nhất, chỉ query + serialize JSON                |
| Ghi, không auth (register)         | < 500ms        | < 1%                | Có validate + DB insert                                  |
| Có auth (login, basket, checkout)  | < 800ms        | < 1%                | bcrypt hash password tốn CPU đáng kể, cộng thêm DB write |

Các con số này là **mốc khởi điểm để bắt đầu đo**, không phải chuẩn tuyệt
đối — sau khi chạy baseline thật lần đầu, nên điều chỉnh threshold theo số
liệu thực tế đo được (không đặt threshold sát 0% margin so với baseline).

---

## 5. Cấu trúc thư mục đề xuất

Mở rộng dần từ cấu trúc hiện tại, đi theo luồng nghiệp vụ thay vì 1 file
phẳng cho mỗi endpoint:

```
perf/k6/
├── README.md                 # cài đặt + cách chạy (đã có)
├── LEARNING.md                # khái niệm nền tảng (đã có)
├── PLAN.md                    # lộ trình học kỹ năng k6 (đã có)
├── TEST-DESIGN.md             # file này — thiết kế bộ test
├── get-products.js            # baseline demo ban đầu (đã có, giữ làm ví dụ học tập)
├── stress-products.js         # stress demo ban đầu (đã có, giữ làm ví dụ học tập)
├── lib/
│   └── config.js               # BASE_URL, các mốc VU dùng chung, helper login lấy token
├── scenarios/
│   ├── browse-products.js      # luồng đọc: list + search (không auth)
│   ├── auth-flow.js            # luồng login + đăng ký
│   ├── basket-flow.js          # luồng login → thêm giỏ hàng → xem giỏ
│   └── purchase-journey.js     # luồng đầy đủ: login → search → basket → checkout
└── results/                    # (gitignore) JSON output lưu lại mỗi lần chạy để so sánh
```

`lib/config.js` tránh lặp lại `BASE_URL`, hàm login lấy token ở nhiều file
— nguyên tắc dùng chung logic thay vì copy-paste giữa các scenario.

---

## 6. Danh sách công việc theo thứ tự triển khai

Thứ tự này bám theo mức độ phức tạp kỹ thuật tăng dần, khớp với các giai
đoạn trong [PLAN.md](PLAN.md):

- [ ] **6.1** Tạo `lib/config.js`: `BASE_URL` từ `__ENV`, hằng số các mốc VU
      (smoke/baseline/load/stress) để không hardcode rải rác từng file.
- [ ] **6.2** `scenarios/browse-products.js`: gộp GET Products + GET search
      vào 1 kịch bản (VU luân phiên gọi cả 2 endpoint, mô phỏng user duyệt
      sản phẩm). Tận dụng lại logic đã có ở `get-products.js`.
- [ ] **6.3** `scenarios/auth-flow.js`: login lấy token (Giai đoạn 2 trong
      PLAN.md), thêm nhánh đăng ký user mới với email ngẫu nhiên (tránh lỗi
      "duplicate email" khi chạy nhiều VU — dùng `${__VU}-${__ITER}` làm
      hậu tố email).
- [ ] **6.4** `scenarios/basket-flow.js`: login → thêm sản phẩm vào giỏ →
      xem giỏ hàng, threshold riêng cho nhóm "có auth".
- [ ] **6.5** `scenarios/purchase-journey.js`: nối các bước ở 6.2-6.4 thành
      1 luồng hoàn chỉnh bằng `options.scenarios` (Giai đoạn 3 PLAN.md),
      với tỉ lệ hành vi khác nhau nếu muốn nâng cao (VD 70% chỉ browse, 30%
      đi hết luồng mua hàng).
- [ ] **6.6** Thêm npm script (`perf:baseline`, `perf:load`, `perf:stress`)
      trong `package.json`, xuất kết quả JSON vào `perf/k6/results/` (đã
      gitignore) để so sánh giữa các lần chạy (Giai đoạn 5 PLAN.md).
- [ ] **6.7** (Tuỳ chọn, làm sau) Viết 1 script so sánh 2 file JSON kết quả
      (baseline cũ vs mới) để tự động cảnh báo nếu p95 tệ đi quá X% —
      biến bộ test này thành "performance regression gate" thật sự dùng
      được trong CI.

---

## 7. Việc KHÔNG làm (và lý do)

Ghi rõ để tránh lan man ngoài phạm vi hợp lý của 1 project demo local:

- **Không chạy soak test dài hạn (nhiều giờ)** trong CI tự động — tốn thời
  gian runner, giá trị thấp khi app chỉ chạy local, không phục vụ traffic
  thật liên tục. Có thể chạy tay 1 lần nếu muốn học kỹ thuật (Giai đoạn học
  riêng, không phải quy trình định kỳ).
- **Không tự động gate CI trên performance threshold ngay từ đầu** — số
  liệu baseline chưa đủ ổn định (mới đo vài lần) để tin tưởng đặt làm điều
  kiện fail pipeline; nên thu thập baseline qua vài lần chạy tay trước, rồi
  mới cân nhắc bước 6.7.
- **Không test trên môi trường staging riêng** — project chỉ có 1 môi
  trường Docker local, nên bỏ qua vấn đề "khác biệt môi trường" (Case 4 ở
  LEARNING.md) — ghi chú lại để nếu sau này có môi trường thật, nhớ đo lại
  từ đầu chứ không tái dùng số liệu local.

---

## 8. Định nghĩa "xong" cho bộ test này

Bộ test được coi là hoàn chỉnh (đủ để đưa vào CV/báo cáo) khi:

- Có ít nhất 4 scenario file theo luồng nghiệp vụ (mục 5), mỗi file chạy
  được độc lập qua `k6 run`.
- Có 1 lần chạy baseline đầy đủ (5 VU) cho từng scenario, kết quả JSON được
  lưu lại làm mốc tham chiếu.
- Có 1 lần chạy stress test tìm ra điểm giới hạn thật (không chỉ latency
  tăng, mà tới khi error rate > 0%) cho ít nhất luồng "purchase journey".
- README/LEARNING đã phản ánh đúng cấu trúc thư mục mới (cập nhật lại khi
  hoàn thành, không để tài liệu lệch với code thật).
