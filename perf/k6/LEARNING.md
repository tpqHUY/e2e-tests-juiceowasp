# Học Performance Testing từ đầu — Khái niệm, thuật ngữ & kỹ thuật phân tích

Tài liệu này tổng hợp lại toàn bộ khái niệm nền tảng đứng sau 2 kịch bản k6
trong thư mục này ([get-products.js](get-products.js) và
[stress-products.js](stress-products.js)), viết cho người chưa có kiến thức
về performance testing. Đọc xong tài liệu này, quay lại đọc code sẽ hiểu vì
sao mỗi dòng lại được viết như vậy.

---

## 1. Vì sao cần load test?

Test chức năng (functional test — như Playwright bạn đang dùng cho Juice
Shop) trả lời câu hỏi **"tính năng có đúng không?"** — 1 user, 1 lần thao
tác. Load test trả lời câu hỏi khác hẳn: **"hệ thống có đứng vững khi nhiều
người dùng cùng lúc không?"**

Một API có thể đúng 100% khi test với 1 user, nhưng sập hoặc chậm không thể
dùng được khi có 100 user cùng gọi — đó là loại lỗi mà chỉ load test mới
phát hiện ra được.

---

## 2. Các loại test hiệu năng (phân biệt để dùng đúng lúc)

| Loại                      | Mục đích                                                                     | Đặc điểm tải                           | Ví dụ trong repo này                                  |
| ------------------------- | ---------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| **Load test** (baseline)  | Đo hiệu năng ở mức tải kỳ vọng bình thường                                   | Tải vừa phải, ổn định, có "think time" | [get-products.js](get-products.js) — 5 VU             |
| **Stress test**           | Tìm giới hạn chịu tải, xem hệ thống hỏng thế nào                             | Tải tăng dần vượt xa mức bình thường   | [stress-products.js](stress-products.js) — tới 100 VU |
| **Spike test**            | Xem hệ thống phản ứng ra sao khi tải tăng đột ngột (không tăng từ từ)        | Nhảy vọt VU trong vài giây             | (chưa có trong repo, có thể thêm sau)                 |
| **Soak test** (endurance) | Tìm lỗi chỉ lộ ra khi chạy lâu (leak bộ nhớ, connection không giải phóng...) | Tải vừa phải nhưng kéo dài hàng giờ    | (chưa có trong repo)                                  |
| **Smoke test**            | Kiểm tra nhanh script/pipeline chạy được, không phải đo hiệu năng thật       | 1-2 VU, vài giây                       | `k6 run --vus 2 --duration 10s ...`                   |

Baseline và stress test không mâu thuẫn — chúng bổ sung cho nhau: baseline
cho biết "bình thường trông như thế nào", stress cho biết "giới hạn nằm ở
đâu". Không có baseline thì không biết stress test đang lệch bao nhiêu.

---

## 3. Thuật ngữ cốt lõi trong k6

### Virtual User (VU)

Một "luồng" giả lập 1 người dùng, chạy lặp lại hàm `default function()`
liên tục cho đến khi hết thời gian test. VU **không** là số request/giây —
1 VU có thể gửi nhiều hay ít request tuỳ vào `sleep()` trong script.

### Iteration

Một lần chạy trọn vẹn hàm `default function()` (từ đầu đến cuối, kể cả
`sleep()`). `iterations` trong report = tổng số vòng lặp mà tất cả VU đã
hoàn thành.

### Stages / Ramping

Cách tăng/giảm số VU theo thời gian thay vì giữ cố định ngay từ đầu.

```js
stages: [
  { duration: '10s', target: 5 }, // ramp-up: từ 0 lên 5 VU trong 10s
  { duration: '30s', target: 5 }, // giữ ổn định (plateau) ở 5 VU
  { duration: '10s', target: 0 }, // ramp-down: từ 5 về 0 VU
];
```

Ramp-up/down giúp tránh "cú sốc" tải đột ngột làm méo số liệu (server cần
thời gian "khởi động" connection pool, cache, JIT warm-up...) — trừ khi bạn
đang cố tình làm spike test.

### Think time (`sleep()`)

Thời gian VU "nghỉ" giữa 2 iteration, mô phỏng việc người dùng thật cần thời
gian đọc trang, gõ phím... trước khi thao tác tiếp. Baseline test nên có
think time để mô phỏng hành vi thật; stress test có thể bỏ hoặc rút ngắn để
ép tải cao nhất có thể trên số VU hiện có.

### Threshold

Điều kiện pass/fail tự động cho cả bài test, khai báo trong `options.thresholds`.
Nếu vi phạm, k6 thoát với exit code khác 0 — cơ chế này để gắn vào CI/CD
(tự động fail pipeline khi hiệu năng suy giảm so với kỳ vọng).

### Check

Một assertion đơn lẻ trong `default function()`, ghi nhận tỉ lệ pass/fail
nhưng **không dừng test** khi fail (khác với `assert` trong unit test) —
vì mục đích là đo lường xu hướng, không phải chặn ngay khi có 1 lỗi.

---

## 4. Các chỉ số (metrics) quan trọng cần đọc

### `http_req_duration` — thời gian phản hồi

Đây là chỉ số **quan trọng nhất**. Đọc theo percentile, KHÔNG chỉ nhìn
trung bình (avg):

- **avg** — trung bình cộng, dễ bị vài request chậm bất thường (outlier)
  kéo lệch, ít phản ánh trải nghiệm thật.
- **p(50) / med** — trung vị, 50% request nhanh hơn giá trị này.
- **p(90)** — 90% request nhanh hơn giá trị này (10% chậm hơn).
- **p(95)** — 95% request nhanh hơn giá trị này. Đây là con số hay dùng
  làm threshold nhất, vì nó bắt được "đuôi chậm" (tail latency) mà vẫn
  không quá nhạy cảm với 1-2 outlier cực đoan.
- **max** — request chậm nhất ghi nhận được, dùng để phát hiện bất thường
  nhưng không nên đặt threshold trực tiếp trên nó (quá dễ bị nhiễu bởi
  1 request bị timeout mạng ngẫu nhiên).

**Vì sao dùng percentile mà không dùng avg?** Ví dụ 100 request: 95 request
mất 10ms, 5 request mất 2000ms (do đang nghẽn). Avg ≈ 109ms — nghe có vẻ ổn.
Nhưng p(95) = 10ms và p(100)/max = 2000ms mới cho biết thật sự có 5% người
dùng đang chờ 2 giây — đó là vấn đề thật cần fix mà avg che giấu mất.

### `http_req_failed` — tỉ lệ lỗi

Tỉ lệ request có status không phải 2xx/3xx (theo mặc định của k6, có thể
tuỳ chỉnh logic "thế nào là lỗi"). Tách biệt với `http_req_duration` vì
1 hệ thống có thể **chậm nhưng không lỗi** (nghẽn/saturation — xem mục 6)
hoặc **nhanh nhưng lỗi ngay** (bug logic, hết kết nối DB...).

### `checks` — tỉ lệ assertion pass

Tổng hợp tất cả `check()` trong script. Nên là chỉ số đầu tiên nhìn vào khi
debug — nếu có check nào fail nhiều, vào đúng dòng `check()` đó để biết
logic nào đang sai (ví dụ: sai endpoint, sai field JSON...).

### `iterations` / `http_reqs` — throughput

Số vòng lặp / số request hoàn thành trên giây. Đây là chỉ số "hệ thống xử
lý được bao nhiêu việc mỗi giây", đối lập và bổ sung cho `http_req_duration`
("mỗi việc mất bao lâu"). Hai chỉ số này thường đánh đổi nhau ở gần giới
hạn tải (xem mục 6).

### `vus` / `vus_max`

Số VU đang hoạt động tại 1 thời điểm / số VU tối đa từng được cấp phát.
Không phải chỉ số hiệu năng của hệ thống đích — chỉ là "công suất tải" mà
k6 đang tạo ra.

---

## 5. Cách đọc 1 report k6 theo thứ tự (checklist)

Khi nhìn vào report dài, đọc theo thứ tự này để không bị ngợp:

1. **`THRESHOLDS`** — pass hết chưa? Đây là kết luận tổng quát nhanh nhất.
2. **`checks`** — logic test có đúng không (không phải hiệu năng, mà là
   "mình đang test đúng thứ cần test không"). Nếu fail, thường là do sai
   route/dữ liệu/assertion — sửa trước khi tin bất kỳ số liệu nào khác.
3. **`http_req_duration` → nhìn p(95)** — hệ thống nhanh hay chậm.
4. **`http_req_failed`** — hệ thống có lỗi không.
5. So sánh với 1 baseline trước đó (nếu có) — số liệu đơn lẻ không có ý
   nghĩa nếu không so sánh được với "bình thường trông như thế nào".

---

## 6. Khái niệm quan trọng nhất khi phân tích: Saturation (bão hoà)

Đây là bài học rút ra từ thí nghiệm baseline vs stress đã làm:

|            | Baseline (5 VU) | Stress (100 VU)          |
| ---------- | --------------- | ------------------------ |
| p(95)      | 15.8ms          | 913-986ms (tăng ~60 lần) |
| error rate | 0%              | 0%                       |
| throughput | ~4 req/s        | ~90 req/s (bị "trần")    |

**Hệ thống không lỗi — nó chỉ chậm dần đi.** Đây là dấu hiệu **saturation**:
tài nguyên xử lý (ở đây là CPU của tiến trình Node.js đơn luồng bên trong
container) đã dùng gần hết công suất, nên request mới phải **xếp hàng chờ**
thay vì được xử lý ngay — độ trễ tăng theo hàng đợi, không phải vì có bug.

Ta xác nhận giả thuyết này bằng `docker stats juice-shop` chạy song song lúc
stress test: CPU tăng dần theo tải và đạt 75-135% khi giữ ở đỉnh 100 VU,
trong khi RAM gần như không đổi (dư thừa). Điều đó cho biết **nút thắt cổ
chai (bottleneck) là CPU, không phải RAM/mạng/Docker**.

### Vì sao biết chỗ nghẽn lại quan trọng?

Vì hướng fix khác nhau hoàn toàn tuỳ vào loại nghẽn:

- **CPU-bound** (trường hợp này) → cần tối ưu code, scale ra nhiều instance/
  worker process (Node.js cluster mode), hoặc tăng CPU limit của container.
- **Memory-bound** (RAM đầy, GC liên tục) → tìm memory leak, tăng RAM.
- **I/O-bound** (chờ database, disk, network) → tối ưu query, thêm cache,
  connection pooling.
- **Connection-bound** (hết socket/connection pool) → tăng pool size, dùng
  keep-alive.

Nếu không đo `docker stats` (hoặc metric CPU/RAM tương đương ở production —
Prometheus, CloudWatch...) song song với load test, bạn chỉ biết "nó chậm"
mà không biết "chậm vì cái gì" — không đủ để đưa ra hướng fix đúng.

---

## 7. Quy trình điều tra hiệu năng (áp dụng lại được cho mọi bài toán khác)

Đây là quy trình đã áp dụng trong buổi học này, có thể lặp lại cho bất kỳ
endpoint/hệ thống nào khác:

1. **Chạy baseline** ở tải nhẹ, ổn định → có số liệu "bình thường" để so
   sánh sau này.
2. **Chạy stress test** với tải tăng dần vượt xa baseline → quan sát
   `http_req_duration` và `http_req_failed` thay đổi ra sao theo VU.
3. **Đặt giả thuyết** dựa trên hiện tượng quan sát được (VD: latency tăng
   nhưng không lỗi → nghi ngờ saturation, không phải bug).
4. **Xác minh giả thuyết** bằng dữ liệu tài nguyên hệ thống thật (CPU/RAM/
   connection count...) đo song song lúc chạy test — không đoán mò.
5. **Kết luận có căn cứ** và đề xuất hướng fix tương ứng với đúng loại
   nghẽn tìm được (mục 6).

---

## 8. Cách thiết kế 1 bài performance test

Viết script k6 chỉ là phần "gõ code" — phần khó hơn nhiều là **quyết định
nên test cái gì, với tải bao nhiêu, và dừng lúc nào là đủ**. Đây là khung
suy nghĩ để thiết kế 1 bài test có ý nghĩa, thay vì random chọn số VU.

### Bước 1 — Xác định mục tiêu trước khi viết dòng code nào

Luôn trả lời được câu hỏi: **"Test này để trả lời câu hỏi gì?"** Vài mục
tiêu điển hình, mỗi mục tiêu dẫn tới thiết kế test khác nhau:

| Mục tiêu                   | Câu hỏi cần trả lời                               | Loại test phù hợp                                           |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Xác nhận SLA               | "Ở tải X, p95 có dưới Yms không?"                 | Load test với tải cố định = tải kỳ vọng thật                |
| Tìm giới hạn capacity      | "Hệ thống chịu được tối đa bao nhiêu user?"       | Stress test, tăng dần tới khi lỗi/chậm không chấp nhận được |
| Kiểm tra khả năng phục hồi | "Traffic tăng đột biến (sale, viral...) thì sao?" | Spike test                                                  |
| Tìm lỗi dài hạn            | "Chạy 8 tiếng có bị leak không?"                  | Soak test                                                   |
| So sánh trước/sau          | "Bản deploy mới có làm chậm đi không?"            | Load test lặp lại, so với baseline đã lưu                   |

Nếu không xác định được mục tiêu, rất dễ rơi vào bẫy chạy test cho "có số
liệu" nhưng không biết số liệu đó dùng để làm gì.

### Bước 2 — Xác định tải mục tiêu dựa trên số liệu thật, không đoán

Câu hỏi sai: "thử với 100 VU xem sao". Câu hỏi đúng: "**mức tải thật của hệ
thống là bao nhiêu, và mình đang test ở bội số nào của nó**?"

Cách ước lượng tải thật (không cần công cụ phức tạp):

- Nếu đã có production: lấy số liệu từ access log/APM (request/giây ở giờ
  cao điểm) làm mốc **tải bình thường**.
- Nếu chưa có production (dự án mới): ước lượng từ số user dự kiến ×
  tần suất thao tác dự kiến. VD: 1000 user online, mỗi người gọi API trung
  bình 1 lần / 10 giây → tải bình thường ≈ 100 req/s.
- Từ tải bình thường, nhân lên các mốc kiểm tra: 1× (baseline), 2-3× (tải
  cao điểm dự kiến, VD Black Friday), 5-10× (stress, tìm giới hạn).

Trong bài học vừa làm, ta đã bỏ qua bước này (chọn 5 VU và 100 VU khá tuỳ
ý) — chấp nhận được vì mục đích là học công cụ, nhưng với 1 hệ thống thật,
luôn cần gắn con số VU với 1 lý do cụ thể.

### Bước 3 — Chọn kịch bản (scenario) phản ánh đúng hành vi thật

Sai lầm phổ biến của người mới: test 1 endpoint đơn lẻ lặp lại liên tục
(như [get-products.js](get-products.js) đang làm) và coi đó là "đại diện"
cho cả hệ thống. Thực tế người dùng thật thực hiện **chuỗi hành động** với
tỉ lệ khác nhau, VD trên 1 trang thương mại điện tử:

- 70% user chỉ duyệt/tìm kiếm sản phẩm (đọc, rẻ tài nguyên)
- 20% user thêm vào giỏ hàng nhưng không mua
- 10% user hoàn tất checkout (ghi, tốn tài nguyên hơn — DB transaction,
  tính giá, gọi payment...)

Nếu chỉ test riêng endpoint tìm kiếm, bạn sẽ đánh giá quá lạc quan về khả
năng chịu tải thật, vì bỏ sót phần "ghi" thường nặng hơn nhiều. Đây chính
là lý do Giai đoạn 3 trong [PLAN.md](PLAN.md) giới thiệu `options.scenarios`
— để mô phỏng đúng tỉ lệ hành vi này trong 1 lần chạy.

### Bước 4 — Chọn điều kiện pass/fail (threshold) TRƯỚC khi chạy, không phải sau

Đặt threshold sau khi đã thấy kết quả là "gian lận không chủ ý" — dễ vô
thức chọn con số khớp với kết quả đã có thay vì khớp với yêu cầu nghiệp vụ
thật. Nên hỏi trước: "**người dùng thật chấp nhận chờ tối đa bao lâu, và tỉ
lệ lỗi bao nhiêu% là chấp nhận được?**" rồi mới viết vào `thresholds`.

Vài mốc tham khảo thường dùng trong ngành (không phải luật cứng, tuỳ loại
sản phẩm):

- Trang web thông thường: p95 < 500ms–1s được coi là "nhanh"; > 3s bắt đầu
  gây khó chịu rõ rệt.
- API nội bộ (service-to-service): thường yêu cầu chặt hơn, p95 < 100-200ms.
- `http_req_failed` < 1% thường là mốc khởi điểm hợp lý cho hầu hết hệ
  thống production.

### Bước 5 — Chạy có kiểm soát, không chỉ chạy 1 lần rồi kết luận

- Chạy baseline **nhiều lần** ở cùng điều kiện trước khi tin vào 1 con số —
  hệ thống thật có nhiễu (background job, GC, network jitter...), 1 lần
  chạy có thể không đại diện.
- Luôn có **1 baseline lưu lại** để so sánh — số liệu đơn lẻ ("p95 = 200ms")
  vô nghĩa nếu không biết trước đó là bao nhiêu.
- Stress test nên ramp **dần dần** (như mục 3 trong LEARNING này) để nhìn
  được đường cong suy giảm, không nhảy thẳng lên đỉnh — nhảy thẳng lên đỉnh
  không cho biết hệ thống bắt đầu "rạn" ở mức nào.

---

## 9. Case study thực tế (rút ra bài học chung, không cần đúng số liệu tuyệt đối)

Các case dưới đây là dạng vấn đề load testing hay gặp trong thực tế ngành,
trình bày lại theo hướng "hiện tượng → cách chẩn đoán → bài học", để bạn có
mẫu hình khi tự phân tích sau này (giống cách bạn vừa tự làm với Juice Shop
ở mục 6).

### Case 1 — "Test pass nhưng production vẫn sập" (thiếu tính đại diện của kịch bản)

**Hiện tượng:** Team test 1 endpoint riêng lẻ, tải nhẹ, mọi threshold pass.
Khi launch thật, hệ thống sập ở tải thấp hơn nhiều so với số đã test.

**Nguyên nhân thường gặp:** Kịch bản test không phản ánh hành vi thật —
thiếu bước ghi dữ liệu (checkout, upload...), thiếu tỉ lệ user đăng nhập
(request có auth luôn nặng hơn do bcrypt/JWT/session lookup), hoặc test với
dữ liệu quá "sạch" (VD DB trống, không có index bị chậm dần theo dữ liệu
thật tích luỹ).

**Bài học:** Test phải mô phỏng **đúng tỉ lệ hành vi** (Bước 3 ở mục 8) và
**dữ liệu thực tế** (kích thước DB, cache đã "bẩn" chưa), không chỉ 1
endpoint cô lập trên dữ liệu sạch.

### Case 2 — "Càng nhiều VU, throughput càng giảm" (không phải tăng chậm dần mà tụt hẳn)

**Hiện tượng:** Throughput tăng đều theo VU tới 1 điểm, sau đó **giảm** khi
tăng VU tiếp — khác với hiện tượng "trần" phẳng đã thấy ở Juice Shop (nơi
throughput chỉ đi ngang, không giảm).

**Nguyên nhân thường gặp:** Hết connection pool tới database, khiến request
mới phải chờ rồi timeout thay vì xếp hàng gọn gàng; hoặc retry logic ở
client/gateway làm tăng tải giả tạo khi hệ thống đã chậm (request timeout →
tự động retry → tải tăng gấp đôi → càng chậm hơn — vòng lặp tự khuếch đại).

**Bài học:** Cần phân biệt 2 dạng nghẽn — "bão hoà êm" (latency tăng,
throughput đi ngang, như Juice Shop) và "sụp đổ" (throughput tụt hẳn, thường
do hết resource pool hoặc retry storm). Dạng thứ 2 nguy hiểm hơn nhiều vì
có thể tự khuếch đại tới khi hệ thống hoàn toàn không phản hồi.

### Case 3 — "Hiệu năng tốt lúc đầu, tệ dần sau vài giờ" (soak test mới phát hiện được)

**Hiện tượng:** Load test 10 phút đầu hoàn toàn ổn, nhưng chạy soak test 4-8
tiếng thì latency tăng dần đều, cuối cùng service phải restart.

**Nguyên nhân thường gặp:** Memory leak (object không được giải phóng —
event listener không gỡ, cache không có giới hạn kích thước), connection
tới DB/Redis không đóng đúng cách (rò rỉ dần theo thời gian), hoặc log file/
temp file tích luỹ làm đầy disk.

**Bài học:** Load test ngắn hạn **không phát hiện được** loại lỗi này —
đây là lý do soak test tồn tại như 1 loại test riêng (mục 2). Nếu hệ thống
chạy liên tục nhiều ngày trong thực tế, cần ít nhất 1 lần chạy soak test dài
hơi trước khi tin vào kết quả load test ngắn.

### Case 4 — "Test trên staging pass, production vẫn chậm" (khác biệt môi trường)

**Hiện tượng:** Cùng 1 kịch bản, cùng tải, staging cho kết quả tốt nhưng
production chậm hơn hẳn dù phần cứng "tương đương".

**Nguyên nhân thường gặp:** Staging thường có ít dữ liệu hơn nhiều so với
production (query chậm dần theo kích thước bảng nếu thiếu index phù hợp);
network topology khác (staging test trong cùng datacenter, production có
thêm CDN/load balancer/firewall thêm độ trễ); hoặc production chạy chung
tài nguyên với nhiều service khác (noisy neighbor) mà staging không có.

**Bài học:** Kết quả load test chỉ đáng tin trong phạm vi **môi trường đã
test** — không tự động suy ra production sẽ giống hệt, đặc biệt là quy mô
dữ liệu. Đây cũng là lý do nhiều team duy trì 1 "shadow production" hoặc
seed dữ liệu staging cho gần với quy mô thật trước khi tin kết quả.

### Case 5 (liên hệ trực tiếp) — Juice Shop local: bão hoà CPU đơn luồng

**Hiện tượng:** (đã tự làm ở mục 6) — 100 VU làm p95 tăng từ 15ms lên
~900ms, error rate vẫn 0%, throughput cắm trần ~90 req/s.

**Chẩn đoán đã xác nhận:** `docker stats` cho thấy CPU tăng theo tải, RAM
gần như không đổi → CPU-bound, khớp với đặc tính Node.js xử lý JS trên 1
luồng chính.

**Bài học liên hệ:** Đây chính là ví dụ sống của "bão hoà êm" (Case 2, dạng

1. — hệ thống không sập, chỉ chậm dần vì hết công suất xử lý. Hướng fix
   thật (nếu đây là production) sẽ là: scale ngang (chạy nhiều instance Node.js
   sau load balancer), dùng cluster mode của Node.js để tận dụng nhiều core,
   hoặc tối ưu code đường xử lý request nếu có phần tính toán nặng không cần
   thiết.

---

## 10. Thuật ngữ tham khảo nhanh (glossary)

| Thuật ngữ                  | Nghĩa                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Latency                    | Thời gian từ lúc gửi request đến lúc nhận được phản hồi (≈ `http_req_duration`)               |
| Throughput                 | Số request/iteration xử lý được trên 1 đơn vị thời gian (req/s)                               |
| Percentile (p90, p95, p99) | Ngưỡng mà N% dữ liệu nằm dưới đó — cách đọc latency chống nhiễu bởi outlier                   |
| Tail latency               | Độ trễ của nhóm request chậm nhất (p95, p99...) — thường là trải nghiệm tệ nhất của user thật |
| Ramp-up / Ramp-down        | Tăng/giảm tải dần theo thời gian thay vì đột ngột                                             |
| Saturation                 | Trạng thái tài nguyên xử lý gần hết công suất, request phải xếp hàng chờ                      |
| Bottleneck                 | Tài nguyên giới hạn hiệu năng toàn hệ thống (CPU/RAM/I/O/connection...)                       |
| SLA / SLO                  | Ngưỡng hiệu năng cam kết (VD: "p95 < 500ms") — nguồn gốc của `thresholds` trong k6            |
| Think time                 | Thời gian mô phỏng user "nghỉ" giữa các thao tác (`sleep()`)                                  |
| Warm-up                    | Giai đoạn đầu hệ thống chưa đạt hiệu năng ổn định (cache lạnh, JIT chưa tối ưu...)            |

---

## 11. Đọc tiếp — nguồn tham khảo

- Tài liệu chính thức k6: https://grafana.com/docs/k6/latest/
- k6 metrics reference (danh sách đầy đủ metric mặc định): https://grafana.com/docs/k6/latest/using-k6/metrics/
- Test types theo phân loại chính thức của k6 (load/stress/spike/soak): https://grafana.com/docs/k6/latest/testing-guides/test-types/

Xem thêm [README.md](README.md) trong thư mục này để biết cách cài đặt và
chạy 2 script mẫu, và mục 5 trong đó ("Stress test") để chạy lại thí nghiệm
đã mô tả ở mục 6 của tài liệu này.
