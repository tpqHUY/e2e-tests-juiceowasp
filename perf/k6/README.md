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

## 6. Cấu hình dùng chung (`lib/config.js`)

[lib/config.js](lib/config.js) giữ những thứ mọi kịch bản đều cần, để không
lặp lại ở từng file: `BASE_URL`, các mốc VU (`smoke` 2 / `baseline` 5 /
`load` 25 / `stress` 100), danh sách `ENDPOINTS`, và 2 helper:

- `jsonParams(token, name)` — dựng header JSON, tự gắn `Authorization: Bearer`
  nếu có token, gắn `tags.name` để lọc số liệu riêng trong report.
- `login(email, password)` — đăng nhập, trả `{ token, bid, email }`, hoặc
  `null` nếu login fail (không throw, để iteration không bị huỷ giữa đường).

File này **không chạy trực tiếp được** bằng `k6 run` (không có
`export default function()`) — nó là thư viện cho các kịch bản import vào.

Để kiểm tra helper còn hoạt động đúng (sau khi sửa config, hoặc khi Juice Shop
lên version mới làm đổi response):

```powershell
k6 run perf/k6/lib/config.smoke.js
```

Bài smoke này chạy 1 VU / 1 iteration, không đo hiệu năng — chỉ xác nhận
`login()` lấy được token **dùng được thật** (có gọi thử 1 endpoint cần xác
thực). Nếu nó đỏ, đừng tin số liệu của các kịch bản khác: chúng có thể đang
đo đường lỗi 401 thay vì đường thành công.

> Trong output sẽ thấy 2 dấu ✗ ở `login status is 200` / `login trả về token`
> với tỉ lệ 50% — đây là **đúng thiết kế**: bài smoke cố ý gọi `login()` với
> mật khẩu sai ở bước cuối để xác nhận helper trả `null` chứ không throw.
> Threshold chỉ tính các check của riêng smoke (`checks{kind:smoke}`), nên
> k6 vẫn exit 0 khi mọi thứ đúng.

## 7. Kịch bản theo luồng nghiệp vụ (`scenarios/`)

Khác với 2 script học tập ở mục 3-5 (mỗi script gọi lặp lại 1 endpoint), các
kịch bản trong [scenarios/](scenarios/) mô phỏng **một lượt dùng app thật**:
1 iteration đi qua nhiều endpoint theo đúng thứ tự người dùng bấm.

### `browse-products.js` — luồng duyệt sản phẩm (không cần đăng nhập)

3 bước trong 1 iteration: xem danh sách → tìm kiếm → mở 2 sản phẩm chi tiết.

```powershell
k6 run perf/k6/scenarios/browse-products.js                 # mốc baseline (5 VU, mặc định)
k6 run -e TIER=smoke perf/k6/scenarios/browse-products.js   # chỉ kiểm tra script chạy đúng (vài giây)
k6 run -e TIER=load perf/k6/scenarios/browse-products.js    # 25 VU — mốc dùng để báo cáo số liệu
k6 run -e TIER=stress perf/k6/scenarios/browse-products.js  # 100 VU — ép tới giới hạn
```

Trong summary sẽ thấy 3 metric riêng cho từng bước, bên cạnh
`http_req_duration` gộp chung:

```
step_catalog_ms ...  avg=36.33ms  p(95)=104.93ms
step_search_ms ....  avg=14.92ms  p(95)=47.26ms
step_detail_ms ....  avg=26.12ms  p(95)=61.6ms
```

Vì sao tách: nếu chỉ đọc `http_req_duration` gộp, một bước chậm sẽ bị các bước
nhanh pha loãng và ta không biết nên tối ưu chỗ nào.

Từ khoá tìm kiếm lấy từ [data/search-terms.json](data/search-terms.json) —
trộn cả từ khoá nhiều kết quả (`juice` → 30/37 sản phẩm), ít kết quả
(`lemon` → 1) và không có kết quả (`zzzznotfound` → 0), vì chi phí xử lý của
server khác nhau hẳn giữa 3 nhóm. Gọi lặp lại cùng 1 query sẽ cho số đẹp giả
tạo do cache.

> `TIER=stress` dùng ngưỡng latency nới hơn (3s thay vì 200ms) — mục đích của
> bài stress là *tìm* điểm vỡ, nên chậm là kết quả mong đợi, không phải thất
> bại. Nhưng các `check()` về tính đúng đắn dữ liệu vẫn phải pass 100% ở mọi
> mốc tải: app quá tải được phép chậm, không được phép trả sai dữ liệu.

### `auth-flow.js` — luồng xác thực (đăng ký → đăng nhập → đọc có token)

4 bước: tạo tài khoản mới → đăng nhập lấy token → đọc giỏ hàng + thông tin
tài khoản bằng token → thử đăng nhập sai mật khẩu.

```powershell
k6 run perf/k6/scenarios/auth-flow.js                 # baseline (5 VU)
k6 run -e TIER=smoke perf/k6/scenarios/auth-flow.js   # kiểm tra script chạy đúng
k6 run -e TIER=load perf/k6/scenarios/auth-flow.js    # 25 VU
```

Kỹ thuật chính là **correlation**: lấy `authentication.token` từ response của
login rồi gắn vào request sau. Luôn phải `check()` trước khi dùng token —
không có bước đó, các request sau gửi `Bearer undefined`, nhận 401, và số liệu
vẫn "chạy" bình thường nhưng đo sai hoàn toàn đường code.

Bước 4 đo riêng đường **login thất bại** (`step_login_fail_ms`). Không chỉ để
cho đủ: nếu đường lỗi chậm hơn hẳn đường thành công thì đó là lỗ hổng từ chối
dịch vụ (gửi mật khẩu sai liên tục để ngốn CPU). Số đo thực tế cho thấy đường
lỗi *nhanh hơn*, nên Juice Shop không có vấn đề này.

> **⚠️ Dữ liệu rác:** mỗi iteration tạo 1 user mới trong DB. Chạy mốc stress
> (100 VU) sẽ để lại hàng trăm user. Reset bằng `npm run app:reset`.

> **Hai bẫy đã gặp thật khi viết scenario này** (ghi lại để không mất thời
> gian lần sau):
>
> 1. `GET /rest/user/whoami` đọc token từ **cookie**, không phải header
>    `Authorization` như `/rest/basket/:id`. Gửi sai cách vẫn nhận **200**
>    nhưng body rỗng `{"user":{}}` — nên mọi check status phải đi kèm check
>    nội dung, không thì lỗi lọt.
> 2. Email test phải có thêm `RUN_ID` ngoài `__VU`/`__ITER`: cặp VU+ITER lặp
>    lại giữa các lần chạy, nên chạy lần 2 mà chưa reset DB sẽ toàn 400
>    duplicate email.

## 8. Các bước tiếp theo khi đã quen

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
