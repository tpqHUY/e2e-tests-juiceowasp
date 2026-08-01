// perf/k6/get-products.js
//
// Kịch bản k6 đơn giản nhất: gọi GET /api/Products lặp lại nhiều lần,
// với nhiều "virtual user" (VU) chạy song song, để đo hiệu năng API.
// Đây là bài "baseline" — tải nhẹ (tối đa 5 VU), dùng để có số liệu tham
// chiếu lúc hệ thống chạy bình thường. Muốn xem hệ thống chịu áp lực ra sao
// khi tải tăng mạnh, xem file stress-products.js trong cùng thư mục.
//
// Chạy: k6 run perf/k6/get-products.js
// (Xem README.md trong thư mục này để biết cách cài k6 + các biến thể lệnh chạy.)

// import các hàm/module có sẵn của k6 (không phải npm package — đây là runtime riêng của k6)
import http from 'k6/http'; // client HTTP để gửi request
import { check, sleep } from 'k6'; // check: kiểm tra assertion; sleep: tạm dừng giữa các vòng lặp
import { Rate, Trend } from 'k6/metrics'; // để tự định nghĩa metric riêng ngoài các metric mặc định

// ---- Custom metrics ----
// k6 có sẵn các metric mặc định (http_req_duration, http_req_failed, ...),
// nhưng ta có thể định nghĩa thêm metric riêng để dễ theo dõi trên báo cáo/summary.
const errorRate = new Rate('errors'); // tỉ lệ request bị lỗi (theo logic riêng của mình, không chỉ dựa vào status code)
const productsDuration = new Trend('products_duration_ms', true); // thời gian phản hồi riêng cho endpoint này (true = ghi theo ms)

// ---- Options: cấu hình bài test ----
// "options" là object đặc biệt mà k6 tự đọc để biết cách chạy test (số VU, thời gian, ngưỡng pass/fail...)
export const options = {
  // stages: kịch bản tăng/giảm tải theo thời gian (ramping) thay vì tải cố định ngay từ đầu.
  // Đây là cách an toàn để "khởi động" server local từ từ và quan sát xu hướng khi tải tăng.
  stages: [
    { duration: '10s', target: 5 }, // 10 giây đầu: tăng dần từ 0 lên 5 VU song song
    { duration: '30s', target: 5 }, // giữ ở mức 5 VU trong 30 giây để có dữ liệu ổn định
    { duration: '10s', target: 0 }, // 10 giây cuối: giảm dần về 0 VU (ramp-down)
  ],

  // thresholds: điều kiện pass/fail tự động cho cả bài test.
  // Nếu vi phạm, k6 sẽ thoát với exit code khác 0 (hữu ích khi gắn vào CI).
  thresholds: {
    http_req_failed: ['rate<0.01'], // tỉ lệ lỗi (theo k6 tự tính từ status code) phải dưới 1%
    http_req_duration: ['p(95)<500'], // 95% request phải phản hồi dưới 500ms
    errors: ['rate<0.01'], // tỉ lệ lỗi theo custom check của mình cũng phải dưới 1%
  },
};

// BASE_URL: cho phép override qua biến môi trường khi chạy, ví dụ:
//   k6 run -e BASE_URL=http://localhost:3000 perf/k6/get-products.js
// Nếu không truyền, mặc định trỏ vào Juice Shop chạy local qua `npm run app:up` (cổng 3000).
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// default function: đây là "kịch bản" chính mà mỗi VU sẽ lặp lại liên tục
// trong suốt thời gian test (theo các "stages" khai báo ở trên).
export default function () {
  // gửi GET request tới endpoint public, không cần đăng nhập
  // Lưu ý: Juice Shop dùng REST API tự sinh (finale-rest) tại /api/Products
  // (viết hoa "Products"), KHÔNG phải /rest/products (route đó không tồn tại
  // trong Juice Shop và sẽ trả về lỗi 500 "Unexpected path").
  const res = http.get(`${BASE_URL}/api/Products`);

  // ghi nhận thời gian phản hồi vào custom metric để xem riêng trong summary
  productsDuration.add(res.timings.duration);

  // check(): kiểm tra các điều kiện, trả về true/false cho từng điều kiện.
  // Không làm test "fail" ngay lập tức (không giống assert) — chỉ ghi nhận tỉ lệ pass/fail.
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'body có field products': (r) => {
      try {
        return Array.isArray(r.json('data'));
      } catch {
        return false;
      }
    },
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // nếu bất kỳ check nào ở trên fail, ghi nhận 1 lỗi vào custom metric errorRate
  errorRate.add(!ok);

  // sleep: mô phỏng "think time" — người dùng thật không bấm liên tục không nghỉ.
  // Giá trị 1 giây là tùy chọn hợp lý cho bài học đầu tiên; có thể chỉnh sau.
  sleep(1);
}
