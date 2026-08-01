// perf/k6/stress-products.js
//
// Phiên bản "stress test" của get-products.js: cùng gọi GET /api/Products,
// nhưng đẩy tải cao hơn nhiều (tới 100 VU) và bỏ sleep giữa các request để
// mỗi VU spam liên tục — mục tiêu là ép hệ thống bắt đầu chậm lại hoặc lỗi,
// để bạn "thấy" được ý nghĩa thật của load test thay vì chỉ toàn số xanh.
//
// Chạy: k6 run perf/k6/stress-products.js
// Trong lúc chạy, mở thêm 1 terminal khác gõ:
//   docker stats juice-shop
// để xem CPU/RAM của container Juice Shop tăng lên theo tải như thế nào.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const productsDuration = new Trend('products_duration_ms', true);

export const options = {
  // So với get-products.js, ở đây target VU cao hơn nhiều (5 -> 100) và các
  // stage giữa/cuối cũng dài hơn để có đủ thời gian quan sát xu hướng suy
  // giảm hiệu năng (nếu có) khi tải đạt đỉnh, thay vì chỉ thấy một xung ngắn.
  stages: [
    { duration: '15s', target: 20 }, // ramp nhanh lên 20 VU
    { duration: '15s', target: 50 }, // tiếp tục ramp lên 50 VU
    { duration: '15s', target: 100 }, // ramp lên đỉnh 100 VU
    { duration: '30s', target: 100 }, // giữ ở đỉnh 100 VU trong 30s — đây là lúc dễ thấy lỗi/chậm nhất
    { duration: '15s', target: 0 }, // ramp-down về 0
  ],

  // Threshold ở bài stress này KHÔNG nên đặt chặt như baseline — mục đích là
  // để quan sát hệ thống bắt đầu "rạn nứt" ở đâu, không phải để pass/fail CI.
  // Vẫn giữ threshold nhưng nới lỏng hơn, chỉ để cảnh báo nếu lỗi quá nhiều.
  thresholds: {
    http_req_failed: ['rate<0.20'], // chấp nhận tới 20% lỗi trước khi coi là "test tự thất bại"
    http_req_duration: ['p(95)<3000'], // chấp nhận p(95) tới 3s trước khi coi là quá tệ
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/api/Products`);

  productsDuration.add(res.timings.duration);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  errorRate.add(!ok);

  // Không sleep (hoặc sleep rất ngắn): mục tiêu của stress test là ép tải
  // cao nhất có thể trên số VU hiện có, khác với baseline test mô phỏng
  // hành vi người dùng thật (có "think time").
  sleep(0.1);
}
