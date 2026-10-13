# Lộ trình hoàn thiện phần Performance — lấy mục CV làm đích

File này trước đây là lộ trình học k6 thuần. Nay đổi thành **kế hoạch giao
việc có đích cụ thể**: hoàn thành đúng phần trình bày dưới đây cho CV, và mọi
con số trong đó phải là số **đo thật**, không phải số mock.

Kỹ năng k6 vẫn học theo thứ tự tăng dần như cũ (request động → auth →
scenarios → setup/data → output/CI), nhưng mỗi việc giờ gắn với 1 dòng CV cụ
thể để biết làm xong thì được gì.

Phần **thiết kế** (test luồng nào, tải bao nhiêu, threshold bao nhiêu, cấu
trúc thư mục) nằm ở [TEST-DESIGN.md](TEST-DESIGN.md) — file này không lặp lại,
chỉ trỏ tới mục tương ứng. Khái niệm nền tảng ở [LEARNING.md](LEARNING.md).

---

## 0. Đích đến — bản trình bày CV

> **OWASP Juice Shop — UI, API & Performance Automation Framework**
> _Personal Project | Playwright, TypeScript, k6, Zod, Docker, GitHub Actions_
>
> - Built a reusable UI/API automation framework using Playwright and
>   TypeScript, covering authentication, end-to-end workflows, and API
>   contract validation with Zod.
> - Developed **69 UI/API test cases** with **207 test executions** across
>   Chromium, Firefox, and WebKit, implementing isolated parallel execution
>   and automated regression reporting.
> - Extended the framework with k6 performance testing across **3 REST API
>   scenarios**, simulating up to **100 virtual users** and measuring
>   throughput, p95 response time, and request failure rate.
> - Evaluated API performance under load, achieving **185 requests/second,
>   280 ms p95 latency, and 0.35% request failure rate** in a **10-minute
>   load test**.
> - Integrated performance smoke tests into **GitHub Actions**, with
>   threshold-based pass/fail checks and **scheduled performance runs** to
>   detect latency regressions.

### Trạng thái từng dòng

| Dòng CV                            | Trạng thái        | Thiếu gì                                                                                   |
| ---------------------------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| 1. Framework + auth + Zod contract | ✅ **Đã đúng**    | Không thiếu gì — `zod` đã dùng trong API schema, auth flow + e2e đã có                     |
| 2. 69 test cases / 207 executions  | ⚠️ **Cần xác nhận lại số** | Số test đếm bằng grep hiện ra 68 (37 UI + 31 API). Phải chạy `--list` lấy số thật → xem [§1](#1-chốt-số-liệu-cho-dòng-2--ui--api) |
| 3. 3 REST API scenarios, 100 VU    | ⚠️ **Nửa đúng**   | Có 3 file nhưng 2 file cùng gọi `/api/Products` → chưa phải 3 luồng khác nhau → [§2](#2-ba-scenario-thật-cho-dòng-3) |
| 4. 185 req/s, 280ms p95, 0.35% fail, 10 phút | ❌ **Số mock** | Chưa từng chạy sustained 10 phút, chưa export JSON → [§3](#3-số-liệu-thật-cho-dòng-4)      |
| 5. GitHub Actions + scheduled perf run | ❌ **Chưa có** | `.github/workflows/` chưa có workflow nào chạy k6 → [§4](#4-ci-cho-dòng-5)                 |

### Nguyên tắc xuyên suốt (quan trọng hơn cả checklist)

1. **Không ghi số mình chưa đo.** Máy local đã xác nhận CPU-bound
   ([LEARNING.md Case 5](LEARNING.md#case-5-liên-hệ-trực-tiếp--juice-shop-local-bão-hoà-cpu-đơn-luồng)),
   nên số thật có thể **tệ hơn** số mock (throughput thấp hơn 185 req/s, p95
   cao hơn 280ms). Ghi đúng số đo được — số thật kèm giải thích nguyên nhân
   thuyết phục hơn số đẹp không bảo vệ được khi bị hỏi.
2. **Mỗi số liệu phải trả lời được "tại sao".** Fail rate 0.35% là do đâu —
   timeout, 500, hay script sai? Xem breakdown lỗi trong summary, không chỉ
   nhìn % tổng. Dùng quy trình ở
   [LEARNING.md §7](LEARNING.md#7-quy-trình-điều-tra-hiệu-năng-áp-dụng-lại-được-cho-mọi-bài-toán-khác).
3. **Chạy ≥ 3 lần mới lấy số.** 1 lần chạy là 1 mẫu, không phải kết quả
   ([LEARNING.md Bước 5](LEARNING.md#bước-5--chạy-có-kiểm-soát-không-chỉ-chạy-1-lần-rồi-kết-luận)).
   Máy đang chạy việc khác → số lệch hẳn.
4. **Không tối ưu Juice Shop.** Đây là app OWASP dựng sẵn để test, không phải
   code của mình. Việc của bộ test là **đo và giải thích**, không phải sửa app
   cho nhanh hơn.

---

## Đã xong ✅

### Giai đoạn 0 — Nền tảng

- [x] Cài k6, chạy được `k6 version`
- [x] Baseline test (GET, ramping VU nhẹ) — [get-products.js](get-products.js)
- [x] Đọc hiểu report: checks, thresholds, `http_req_duration`, `http_req_failed`
- [x] Stress test, thấy latency tăng theo tải — [stress-products.js](stress-products.js)
- [x] Xác nhận nguyên nhân nghẽn bằng `docker stats` (CPU-bound)
- [x] Nắm khái niệm nền tảng — [LEARNING.md](LEARNING.md)

### Giai đoạn 1 — Request có dữ liệu động

- [x] `POST /api/Feedbacks` với JSON body — [search-and-feedback.js](search-and-feedback.js)
- [x] `http.get()` với query param (`/rest/products/search?q=juice`)
- [x] `params` object (`headers`, `tags`) trong request
- [x] Correlation: lấy dữ liệu động từ response trước (CAPTCHA) dùng cho request sau

---

## 1. Chốt số liệu cho dòng 2 — UI & API

Dòng này **không phụ thuộc k6**, làm được ngay, nhưng phải chốt đúng số.

- [ ] **1.1** `npm ci` (hiện `node_modules/` chưa cài nên không chạy được
      `--list`)
- [ ] **1.2** Đếm số test case thật:
      `npx playwright test tests/ui tests/api --list --project=chromium`
      → dòng cuối in ra tổng số test. Đây là **số test case** (69?).
- [ ] **1.3** Đếm số lần thực thi: `npx playwright test --list` (không giới
      hạn project) → tổng số test × số project áp dụng. Đây là **số
      executions** (207?).
- [ ] **1.4** Nếu số lệch so với 69/207 → sửa CV theo số thật, **không** thêm
      test chỉ để khớp số đã viết.

Tiêu chí xong: 2 con số trong dòng 2 lấy trực tiếp từ output `--list`, có thể
chạy lại để chứng minh bất cứ lúc nào.

> Ghi chú: "isolated parallel execution" đã đúng (`fullyParallel: true`,
> `workers` tách riêng CI/local trong [playwright.config.ts](../../playwright.config.ts)),
> "automated regression reporting" cũng đã đúng (Allure + trend history deploy
> lên GitHub Pages trong [nightly-regression.yml](../../.github/workflows/nightly-regression.yml)).

---

## 2. Ba scenario thật cho dòng 3

Vấn đề hiện tại: `get-products.js` và `stress-products.js` **cùng gọi 1
endpoint** `/api/Products` — chỉ khác mức tải. Nói "3 REST API scenarios" mà 2
cái trùng endpoint thì hụt khi bị hỏi sâu.

Mục tiêu: **3 scenario theo 3 luồng nghiệp vụ khác nhau**, mỗi file chạy độc
lập được. Bám theo cấu trúc đã thiết kế ở
[TEST-DESIGN.md §5](TEST-DESIGN.md#5-cấu-trúc-thư-mục-đề-xuất) và danh sách
luồng ở [§2](TEST-DESIGN.md#2-chọn-luồng-nghiệp-vụ-cần-test-bước-3--tính-đại-diện).

### 2.1 Hạ tầng dùng chung ✅

- [x] **2.1** Tạo [lib/config.js](lib/config.js): `BASE_URL` từ `__ENV`, hằng số
      các mốc VU (smoke 2 / baseline 5 / load 25 / stress 100), `ENDPOINTS`,
      `TEST_ACCOUNT`, helper `jsonParams()` + `login()` trả session
      `{token, bid, email}`. Tránh copy-paste `BASE_URL` và logic login qua
      từng file. _(= việc 6.1 trong TEST-DESIGN.md)_
- [x] **2.1b** [lib/config.smoke.js](lib/config.smoke.js) — smoke test cho
      chính config.js (1 VU, 1 iteration). Verify: hằng số hợp lệ,
      `jsonParams()` dựng header đúng, `login()` lấy được token **dùng được
      thật** (gọi thử `GET /rest/basket/:id`), và login sai mật khẩu trả `null`
      chứ không throw.

      Vì sao cần: cả 3 scenario bên dưới đều dựng trên `login()`. Nếu helper
      lấy sai field token, scenario vẫn "chạy được" nhưng đo đường lỗi 401
      thay vì đường thành công — số liệu trông bình thường mà sai hoàn toàn.
      Đã xác nhận smoke bắt được lỗi thật: đổi `ENDPOINTS.login` thành path
      sai → k6 exit code 99 (đỏ); trả lại đúng → exit 0.

      Chạy: `k6 run perf/k6/lib/config.smoke.js` (cần app đang chạy).

### 2.2 Scenario A — Browse (đọc, không auth) ✅

- [x] **2.2** [scenarios/browse-products.js](scenarios/browse-products.js):
      1 iteration đi qua 3 bước theo đúng thứ tự người thật bấm — xem danh
      sách (`GET /api/Products`) → tìm kiếm (`GET /rest/products/search?q=`)
      → mở 2 sản phẩm chi tiết (`GET /api/Products/:id`). Mỗi bước gói trong
      `group()` và có `Trend` riêng (`step_catalog_ms`, `step_search_ms`,
      `step_detail_ms`) + tag riêng, để biết bước nào chậm thay vì chỉ thấy
      một con số trung bình đã bị pha loãng.

      Id sản phẩm ở bước 3 **lấy từ response của bước 1**, không hardcode —
      Juice Shop reset dữ liệu mỗi lần container khởi động nên id cứng sẽ
      thành 404 âm thầm.

- [x] **2.3** `SharedArray` đọc [data/search-terms.json](data/search-terms.json)
      thay vì hardcode `q=juice`. Danh sách cố ý trộn 3 nhóm vì chi phí xử lý
      của server khác nhau rõ rệt (số đo thật trên máy local):

      | Nhóm từ khoá    | VD              | Kết quả | p95 quan sát (25 VU) |
      | --------------- | --------------- | ------- | -------------------- |
      | nhiều kết quả   | `juice`         | 30/37   | chậm nhất            |
      | ít kết quả      | `lemon`         | 1       | trung bình           |
      | không kết quả   | `zzzznotfound`  | 0       | nhanh nhất           |

      Chỉ test nhóm đầu → đánh giá quá bi quan; chỉ nhóm cuối → quá lạc quan.
      Mỗi từ khoá có `expectedMin` để check app **thật sự tìm được dữ liệu**,
      không chỉ "trả 200 với mảng rỗng" (không có check này, app hỏng index
      vẫn pass toàn bộ bài test).

- [x] **2.3b** Chọn mốc tải bằng `-e TIER=smoke|baseline|load|stress`, lấy số
      từ `VUS` trong `lib/config.js`. TIER sai bị chặn ngay ở init stage
      (`-e TIER=lod` → k6 báo lỗi và dừng) — nếu không, `TARGET_VUS` thành
      `undefined` và k6 âm thầm chạy cấu hình mặc định, ta tưởng đang đo mốc
      load nhưng không phải.

      **Threshold nới theo tier** (`LATENCY_P95_MS`): 200ms cho
      smoke/baseline/load, 3000ms cho stress. Lý do: tier stress cố ý ép quá
      giới hạn để *tìm* điểm vỡ, chậm là kết quả mong đợi — giữ ngưỡng 200ms
      thì tier này luôn exit 99 và con số không còn mang thông tin. Nhưng
      `checks: rate==1.0` giữ nguyên ở **mọi** tier: app quá tải được phép
      chậm, không được phép trả sai dữ liệu.

      Chạy: `k6 run -e TIER=load perf/k6/scenarios/browse-products.js`

**Số liệu quan sát lần đầu** (máy local, Juice Shop 17.1.1 trong Docker — là
mốc tham khảo để biết script hoạt động, **không phải** số chính thức cho CV;
số chính thức sẽ đo ở §3 theo đúng quy trình ≥3 lần):

| Tier         | VU  | req/s | p95 tổng | fail | Ghi chú                       |
| ------------ | --- | ----- | -------- | ---- | ----------------------------- |
| baseline     | 5   | ~5.5  | 29-54ms  | 0%   | **dao động gần 2× giữa 2 lần chạy** |
| load         | 25  | 26.4  | 71.9ms   | 0%   | threshold 200ms vẫn đạt       |
| stress       | 100 | 40-54 | 1.5-2.7s | 0%   | latency tăng ~35×, chưa lỗi   |

Hai điểm rút ra:

1. **Dao động lớn giữa các lần chạy giống nhau** (p95 29ms vs 54ms ở cùng mốc
   baseline) — bằng chứng cụ thể cho nguyên tắc "chạy ≥3 lần mới lấy số" ở
   [§0](#nguyên-tắc-xuyên-suốt-quan-trọng-hơn-cả-checklist). Lấy số từ 1 lần
   chạy là lấy một mẫu ngẫu nhiên.
2. **Ở 100 VU: latency tăng ~35× nhưng fail vẫn 0%** — đúng dấu hiệu *bão hoà*
   (saturation), chưa phải *vỡ* (failure): hệ thống còn xử lý được mọi request,
   chỉ là xếp hàng chờ CPU. Khớp với kết luận CPU-bound đã có ở
   [LEARNING.md Case 5](LEARNING.md#case-5-liên-hệ-trực-tiếp--juice-shop-local-bão-hoà-cpu-đơn-luồng).

### 2.3 Scenario B — Auth flow (ghi + auth) ✅

Kỹ năng chính: login giữ token rồi dùng cho request sau (correlation).

- [x] **2.4** [scenarios/auth-flow.js](scenarios/auth-flow.js): 4 bước —
      đăng ký (`POST /api/Users`) → đăng nhập (`POST /rest/user/login`, lấy
      `authentication.token`) → đọc dữ liệu cần token (`GET /rest/basket/:id`
      + `GET /rest/user/whoami`) → đăng nhập sai mật khẩu (đo đường lỗi).
- [x] **2.5** Check status **trước khi** dùng token, dừng iteration nếu fail —
      cùng pattern đã dùng với CAPTCHA ở `search-and-feedback.js`. Có 2 chốt:
      sau register và sau login.
- [x] **2.6** Email duy nhất theo `k6-${RUN_ID}-v${__VU}i${__ITER}@e2e.local`.
      `RUN_ID` (timestamp) là phần **bắt buộc thêm** ngoài `__VU`/`__ITER`:
      cặp VU+ITER lặp lại giữa các lần chạy, nên chạy lần 2 mà chưa reset DB
      sẽ toàn 400 duplicate. Đã verify: cố ý cho mọi VU dùng chung 1 email →
      exit 99 với check register đỏ.
- [x] **2.7** Threshold riêng theo tag `Register` / `Login` / `AuthedRead`.
      Register nới gấp đôi 2 bước kia vì là bước duy nhất GHI vào DB.

- [x] **2.7b** Đo riêng **đường login thất bại** (`step_login_fail_ms`). Hai
      lý do: (1) sai mật khẩu là traffic thật, không phải ca hiếm; (2) nếu
      đường lỗi *chậm hơn hẳn* đường thành công thì đó là lỗ hổng từ chối dịch
      vụ — kẻ tấn công gửi mật khẩu sai liên tục để ngốn CPU.

      Kết quả đo: **đường lỗi nhanh hơn** (load 25 VU: fail p95 51ms vs
      thành công 60ms) → không có vấn đề này. Request 401 cố ý được loại khỏi
      thống kê lỗi bằng `http.expectedStatuses(401)`, nếu không mỗi iteration
      tự cộng 1 lỗi và ngưỡng `rate<0.01` không bao giờ đạt.

#### ⚠️ Hai giả định sai bị phát hiện khi đo thật

**1. "Auth chậm hơn vì bcrypt" — SAI.** Số đo (10 lần gọi tuần tự):

| Endpoint                | Latency  | Có auth? |
| ----------------------- | -------- | -------- |
| `POST /rest/user/login` | ~13-17ms | ✅        |
| `GET /api/Products`     | ~19-36ms | ❌        |
| `GET /rest/user/whoami` | ~7-11ms  | ✅        |

Juice Shop băm mật khẩu bằng **MD5 không salt**, không phải bcrypt — xác nhận
bằng cách giải payload JWT lấy chuỗi hash rồi so với `md5sum` của mật khẩu,
khớp chính xác. MD5 gần như miễn phí CPU. Endpoint sản phẩm chậm hơn chỉ vì
phải serialize 37 bản ghi JSON.

→ Đã sửa ngưỡng auth từ 800ms (theo
[TEST-DESIGN.md §4](TEST-DESIGN.md#4-threshold-cho-từng-loại-luồng-bước-4) cũ)
xuống 500ms. **Bài học:** ngưỡng đặt theo phỏng đoán về chi phí nội bộ dễ sai,
và nới tay cho chi phí không tồn tại khiến test không bắt được regression —
endpoint chậm đi 50× vẫn "pass".

**2. `whoami` đọc token từ COOKIE, không phải header `Authorization`.** Gửi
bằng header vẫn trả **status 200** nhưng body `{"user":{}}` rỗng. Nếu chỉ
check status, lỗi này lọt hoàn toàn và ta tưởng đang đo endpoint có xác thực
trong khi thực tế đo đường ẩn danh. → Đây là lý do mọi check status đều phải
đi kèm check nội dung.

**Số liệu quan sát** (mốc tham khảo, không phải số chính thức cho CV):

| Tier     | VU  | req/s | Register p95 | Login p95 | AuthedRead p95 | fail |
| -------- | --- | ----- | ------------ | --------- | -------------- | ---- |
| baseline | 5   | 5.8   | 74.5ms       | 33.1ms    | 29.6ms         | 0%   |
| load     | 25  | 28.0  | 132.9ms      | 59.7ms    | 61.1ms         | 0%   |

Register luôn là bước chậm nhất (~2× login) — đúng dự đoán, vì là bước duy
nhất ghi vào DB.

> **Dữ liệu rác:** mỗi iteration tạo 1 user mới. Chạy mốc stress (100 VU) để
> lại hàng trăm user trong DB. Reset bằng `npm run app:reset`.

### 2.4 Scenario C — Purchase journey (hỗn hợp, nhiều scenario song song)

- [ ] **2.8** `scenarios/purchase-journey.js`: login → search → thêm giỏ hàng
      (`POST /api/BasketItems`) → checkout. Endpoint/payload cụ thể lấy từ
      [tests/api/basket.api.spec.ts](../../tests/api/basket.api.spec.ts) và
      [tests/e2e/purchase-journey.spec.ts](../../tests/e2e/purchase-journey.spec.ts)
      — đã có sẵn trong repo, không cần đoán.
- [ ] **2.9** Dùng `options.scenarios` chạy **2 luồng song song**: ~70% VU chỉ
      browse (đọc), ~30% VU đi hết luồng mua hàng — mô phỏng tỉ lệ hành vi
      thật, tránh lỗi "test toàn đọc nên đánh giá quá lạc quan"
      ([LEARNING.md Case 1](LEARNING.md#case-1--test-pass-nhưng-production-vẫn-sập-thiếu-tính-đại-diện-của-kịch-bản)).
- [ ] **2.10** Dùng `setup()` tạo/lấy token user test 1 lần trước khi test
      chạy, truyền vào `default function()` — thay vì mỗi VU tự login (login
      lặp lại làm nhiễu số liệu của chính luồng đang đo).
- [ ] **2.11** Hiểu và giải thích được khác biệt `constant-vus` /
      `ramping-vus` / `constant-arrival-rate` — tại sao arrival-rate mô phỏng
      tải thật chuẩn hơn (throughput không phụ thuộc response time). Câu này
      hay bị hỏi trong interview khi thấy k6 trong CV.

Tiêu chí xong §2: 3 file trong `scenarios/` chạy độc lập được qua `k6 run`,
không trùng endpoint chính, ít nhất 1 file có auth và 1 file có nhiều scenario
song song. Giữ `get-products.js` / `stress-products.js` làm ví dụ học tập, nhưng
**không đếm chúng** vào "3 scenarios" của CV.

---

## 3. Số liệu thật cho dòng 4

Thay toàn bộ số mock (185 req/s, 280ms p95, 0.35% fail) bằng số đo được.

### 3.1 Chuẩn bị chạy được 10 phút

- [ ] **3.1** Thêm 1 stage **sustained load** đủ dài. Hiện `stress-products.js`
      chỉ tổng ~90s (peak 30s) → không thể claim "10-minute load test". Cần
      profile dạng: ramp-up 1 phút → **giữ tải 8 phút** → ramp-down 1 phút.
- [ ] **3.2** Chốt mức tải dùng để báo cáo. CV viết "up to 100 virtual users"
      → mốc stress 100 VU (đã có), nhưng **số đẹp để báo cáo** (throughput,
      p95, fail rate) nên lấy ở mốc **load 25 VU** — tải mà hệ thống còn chạy
      ổn định. Nếu lấy số ở 100 VU trên máy CPU-bound thì p95 sẽ rất tệ.
      → Chạy **cả 2 mốc**, báo cáo cả 2, giải thích vì sao khác nhau.
- [ ] **3.3** `.gitignore` thêm `perf/k6/results/` (chưa có) — JSON output
      không nên commit.
- [ ] **3.4** npm script trong [package.json](../../package.json):
      `perf:smoke`, `perf:baseline`, `perf:load`, `perf:stress` — mỗi cái
      `k6 run --out json=perf/k6/results/<tên>-<ngày>.json <file>`. Để chạy
      nhất quán như các lệnh `test:*` khác trong repo.
      _(= việc 6.6 trong TEST-DESIGN.md)_

### 3.2 Chạy và đo

- [ ] **3.5** Chạy **mỗi scenario ≥ 3 lần** ở mốc load, máy không làm việc
      khác. Ghi lại cả 3 lần, không chỉ lần đẹp nhất.
- [ ] **3.6** Chạy 1 lần sustained **10 phút** đầy đủ (mốc đã chốt ở 3.2) —
      đây là lần chạy dùng cho dòng CV.
- [ ] **3.7** Trong lúc chạy, mở terminal khác: `docker stats juice-shop` —
      xác nhận lại nghẽn ở đâu (CPU? RAM?) để giải thích được số liệu.
- [ ] **3.8** Mở file JSON output, hiểu cấu trúc dữ liệu thô (mỗi dòng 1 data
      point) — để biết số trong summary đến từ đâu, không chỉ tin bảng tổng.

### 3.3 Phân tích (phần tạo ra giá trị thật, không phải chỉ copy số)

- [ ] **3.9** Trích 3 con số cho CV từ summary: `http_reqs` rate (req/s),
      `http_req_duration` p(95), `http_req_failed` rate.
- [ ] **3.10** **Lý giải fail rate**: nếu > 0%, lỗi là gì — status 500?
      timeout? hay script sai (VD CAPTCHA/token)? Lỗi do script thì **phải
      sửa script**, không được tính là lỗi của app.
- [ ] **3.11** **Lý giải p95**: so với baseline 5 VU (p95 ~15ms đã đo) thì
      chậm đi bao nhiêu lần, và vì sao (bão hoà CPU đơn luồng Node.js).
- [ ] **3.12** **Lý giải throughput**: throughput có tăng tuyến tính theo VU
      hay bão hoà/tụt? Nếu tụt → đó là dấu hiệu quan trọng
      ([LEARNING.md Case 2](LEARNING.md#case-2--càng-nhiều-vu-throughput-càng-giảm-không-phải-tăng-chậm-dần-mà-tụt-hẳn)).
- [ ] **3.13** Viết `RESULTS.md` trong `perf/k6/`: bảng số liệu baseline/
      load/stress cho từng scenario + đoạn giải thích ngắn cho mỗi mốc. Đây
      vừa là mốc so sánh về sau, vừa là tài liệu để trả lời khi bị hỏi về con
      số trong CV.
- [ ] **3.14** Cập nhật lại threshold trong các script theo số đo thật (đừng
      để threshold đặt tay từ trước lệch hẳn thực tế), giữ margin hợp lý —
      không đặt sát baseline.

Tiêu chí xong §3: `RESULTS.md` có đủ 3 số cho dòng CV, lấy từ 1 lần chạy 10
phút cụ thể (ghi rõ ngày, mốc VU, scenario nào), và mỗi số có 1-2 câu giải
thích nguyên nhân.

---

## 4. CI cho dòng 5

Hiện `.github/workflows/` có `smoke.yml`, `nightly-regression.yml`,
`codeql.yml`, `labels.yml` — **không có workflow nào chạy k6**. Dòng 5 của CV
chưa đúng cho tới khi làm xong mục này.

- [ ] **4.1** Tạo `.github/workflows/performance.yml`. Copy cấu trúc từ
      [nightly-regression.yml](../../.github/workflows/nightly-regression.yml)
      (đã có sẵn: `schedule` cron, `workflow_dispatch`, `docker compose up -d`,
      `npm run app:wait`, teardown `if: always()`, upload artifact).
- [ ] **4.2** Cài k6 trong workflow (`grafana/setup-k6-action`, hoặc apt
      install theo docs k6).
- [ ] **4.3** **Perf smoke job** — chạy mỗi lần schedule, tải nhẹ (mốc
      smoke/baseline), **gate pass/fail bằng threshold**: k6 tự exit code ≠ 0
      khi vi phạm `thresholds`, nên chỉ cần không `|| true` là CI tự đỏ. Đây
      đúng nghĩa "threshold-based pass/fail checks" trong CV.
- [ ] **4.4** `schedule:` cron chạy định kỳ (VD hàng tuần, hoặc hàng ngày
      lệch giờ với nightly-regression để không tranh runner). **Không** chạy
      mỗi push — load test tốn thời gian và cần môi trường ổn định.
- [ ] **4.5** Upload JSON result làm artifact (`actions/upload-artifact`) để
      so sánh giữa các lần chạy, retention vài ngày.
- [ ] **4.6** ⚠️ Chốt threshold cho CI **theo số đo trên runner GitHub, không
      phải số trên máy local** — runner yếu hơn/khác hẳn máy local, threshold
      local sẽ làm CI đỏ liên tục. Chạy `workflow_dispatch` vài lần lấy
      baseline của runner trước, rồi mới đặt threshold.
      _(Đây là lý do [TEST-DESIGN.md §7](TEST-DESIGN.md#7-việc-không-làm-và-lý-do)
      ban đầu ghi "không gate CI ngay từ đầu" — vẫn đúng: thu baseline runner
      trước, gate sau.)_

Tiêu chí xong §4: workflow chạy được qua `workflow_dispatch`, đỏ khi threshold
bị vi phạm, xanh khi đạt, và có `schedule` cron hoạt động. Chứng minh được
bằng link Actions run.

---

## 5. (Tuỳ chọn) Nâng cấp sau — không cần cho CV hiện tại

- [ ] **5.1** Script so sánh 2 file JSON (baseline cũ vs mới) → cảnh báo nếu
      p95 tệ đi quá X%. Biến bộ test thành performance regression gate thật
      sự. _(= việc 6.7 TEST-DESIGN.md)_
- [ ] **5.2** Xuất qua InfluxDB + Grafana để có dashboard theo thời gian thay
      vì so sánh JSON tay.
- [ ] **5.3** Soak test (chạy nhiều giờ) tìm memory leak — chạy tay 1 lần để
      học kỹ thuật, không đưa vào CI
      ([LEARNING.md Case 3](LEARNING.md#case-3--hiệu-năng-tốt-lúc-đầu-tệ-dần-sau-vài-giờ-soak-test-mới-phát-hiện-được)).
- [ ] **5.4** `teardown()` dọn dữ liệu test đã tạo (user đăng ký, feedback) —
      hiện mỗi lần chạy để lại rác trong DB; `docker compose restart` reset
      được nên chưa gấp.

---

## 6. Thứ tự làm & ước lượng

Làm theo thứ tự này vì mỗi bước tạo tiền đề cho bước sau (không có scenario
thì không có số liệu; không có số liệu thì không chốt được threshold CI).

| Thứ tự | Việc                     | Mục  | Ước lượng  | Chặn việc gì                     |
| ------ | ------------------------ | ---- | ---------- | -------------------------------- |
| 1      | Chốt số UI/API           | §1   | ~20 phút   | Dòng 2 CV (độc lập, làm trước cho xong) |
| 2      | `lib/config.js`          | §2.1 | ~30 phút   | Mọi scenario sau                 |
| 3      | Scenario browse          | §2.2 | ~1 giờ     | —                                |
| 4      | Scenario auth            | §2.3 | ~2 giờ     | Scenario purchase (cần token)    |
| 5      | Scenario purchase        | §2.4 | ~2-3 giờ   | Lần chạy báo cáo                 |
| 6      | npm scripts + results/   | §3.1 | ~30 phút   | Lần chạy báo cáo                 |
| 7      | Chạy + đo (≥3 lần/mốc)   | §3.2 | ~2 giờ (phần lớn là chờ) | Phân tích        |
| 8      | Phân tích + `RESULTS.md` | §3.3 | ~2 giờ     | Threshold CI                     |
| 9      | Workflow CI              | §4   | ~2 giờ     | —                                |

**Tổng ~3-4 ngày làm tập trung**, hoặc 1-2 tuần nếu làm part-time. Phần lâu
nhất không phải viết code mà là bước 7-8: chạy nhiều lần rồi hiểu số liệu.

---

## 7. Checklist cuối — CV đúng khi nào

Trước khi đưa bản CV ở [§0](#0-đích-đến--bản-trình-bày-cv) ra ngoài, tự kiểm:

- [ ] Mọi con số đều **trỏ về được 1 lần chạy/output cụ thể** (ghi trong
      `RESULTS.md` hoặc output `--list`), không có số nào là ước lượng.
- [ ] Bỏ chữ "**mock** benchmark" trong dòng 4 — nếu còn phải để chữ "mock"
      thì nghĩa là chưa làm xong §3.
- [ ] "3 REST API scenarios" trỏ được tới 3 file khác nhau trong
      `scenarios/`, không trùng endpoint chính.
- [ ] "Scheduled performance runs" trỏ được tới 1 link GitHub Actions run thật.
- [ ] Trả lời được 3 câu hay bị hỏi nhất:
      1. Tại sao p95 là con số đó, nghẽn ở đâu, biết bằng cách nào?
      2. Fail rate đến từ lỗi gì?
      3. Vì sao chọn mốc VU đó, không phải mốc khác?

---

## Cách dùng file này

- Đánh dấu `[x]` trực tiếp khi hoàn thành từng mục.
- Không cần làm tuần tự cứng nhắc trong cùng 1 mục, nhưng **nên theo thứ tự
  ở [§6](#6-thứ-tự-làm--ước-lượng) giữa các mục** vì có phụ thuộc.
- Khi xong 1 mục lớn, cập nhật lại [README.md](README.md) và
  [TEST-DESIGN.md](TEST-DESIGN.md) nếu cấu trúc thư mục thật đã khác tài liệu
  — không để tài liệu lệch với code.
