/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton file: imports/vars are used once the TODOs below are filled in */
// perf/k6/search-and-feedback.exercise.js
//
// BÀI TẬP — Giai đoạn 1 (xem PLAN.md): request có dữ liệu động.
// Tự điền vào các chỗ TODO bên dưới. Khi xong, chạy thử:
//   k6 run perf/k6/search-and-feedback.exercise.js
//
// Nếu bí, xem file đáp án đã có sẵn: search-and-feedback.js (cùng thư mục)
// — nhưng cố tự làm trước khi mở ra nhé.
//
// Mục tiêu bài tập — viết 1 kịch bản mà mỗi VU, trong 1 iteration, làm:
//   1. GET tìm kiếm sản phẩm bằng query param (VD: ?q=juice)
//   2. GET lấy 1 câu hỏi CAPTCHA (endpoint: /rest/captcha) — response trả về
//      dạng { captchaId, captcha, answer }
//   3. POST gửi feedback (endpoint: /api/Feedbacks) với JSON body gồm:
//      comment, rating, captchaId, captcha (= đáp án lấy được ở bước 2)
//
// Đây là bài tập về "correlation" — lấy dữ liệu từ response của 1 request
// để dùng cho request tiếp theo, vì đáp án CAPTCHA đổi mỗi lần gọi nên
// KHÔNG được hardcode.

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 3,
  duration: '15s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // ---- Bước 1: GET tìm kiếm sản phẩm với query param ----
  // TODO: gọi GET tới `${BASE_URL}/rest/products/search?q=juice`
  // TODO: check() status code phải là 200

  // ---- Bước 2: GET lấy đề + đáp án CAPTCHA ----
  // TODO: gọi GET tới `${BASE_URL}/rest/captcha`
  // TODO: check() status code phải là 200
  // Gợi ý: nếu check fail, nên sleep(1) rồi `return` sớm — không có gì để
  // gửi ở bước 3 nếu bước này lỗi (tránh lỗi đọc field trên response rỗng).

  // TODO: parse JSON body bằng res.json(), lấy ra 2 field: captchaId, answer
  // Gợi ý cú pháp: const body = res.json(); const x = body.someField;

  // ---- Bước 3: POST feedback, dùng lại dữ liệu từ bước 2 ----
  // TODO: tạo JSON body bằng JSON.stringify({...}) gồm:
  //   comment  — 1 chuỗi bất kỳ, có thể ghép thêm __VU và __ITER cho khác nhau mỗi lần
  //   rating   — số từ 1-5
  //   captchaId — lấy từ bước 2
  //   captcha   — chính là "answer" lấy được ở bước 2 (tên field POST là "captcha", không phải "answer")

  // TODO: tạo object params (tham số thứ 3 của http.post) gồm:
  //   headers: { 'Content-Type': 'application/json' }
  //   tags: { name: 'PostFeedback' }  (tuỳ chọn, để lọc theo tên trong report)

  // TODO: gọi http.post(url, body, params)
  // TODO: check() status code phải là 201 (Created)

  sleep(1);
}
