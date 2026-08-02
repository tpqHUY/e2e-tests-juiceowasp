// perf/k6/search-and-feedback.js
//
// Bài học Giai đoạn 1 (xem PLAN.md): request có dữ liệu động — query param,
// POST với JSON body, và lấy dữ liệu từ response của request TRƯỚC để dùng
// cho request SAU (gọi là "correlation" — kỹ thuật cốt lõi khi mô phỏng
// luồng nhiều bước, ví dụ login rồi mới thao tác tiếp).
//
// Kịch bản: mỗi VU làm 2 việc trong 1 iteration:
//   1. Tìm kiếm sản phẩm bằng query param (GET, không cần dữ liệu động)
//   2. Gửi feedback — nhưng Juice Shop bắt phải giải CAPTCHA trước, nên
//      phải: gọi GET /rest/captcha lấy đề + đáp án, rồi gửi đáp án đó kèm
//      comment/rating vào POST /api/Feedbacks. Đáp án đổi mỗi lần gọi nên
//      KHÔNG thể hardcode — đây chính là lý do bài học này tồn tại.
//
// Chạy: k6 run perf/k6/search-and-feedback.js

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
  // ---- 1. GET với query param ----
  // http.get() nhận thẳng URL đầy đủ kèm query string — không có API riêng
  // để build query param, chỉ cần nối chuỗi (hoặc dùng template literal).
  const searchRes = http.get(`${BASE_URL}/rest/products/search?q=juice`);
  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
  });

  // ---- 2a. GET để lấy dữ liệu động (đề CAPTCHA + đáp án) ----
  const captchaRes = http.get(`${BASE_URL}/rest/captcha`);
  const captchaOk = check(captchaRes, {
    'captcha status is 200': (r) => r.status === 200,
  });

  // Nếu bước lấy CAPTCHA fail, dừng iteration này tại đây — không có gì để
  // gửi ở bước tiếp theo. Đây là lý do luôn check() trước khi dùng dữ liệu
  // từ 1 response cho bước sau, tránh lỗi "Cannot read property of undefined".
  if (!captchaOk) {
    sleep(1);
    return;
  }

  // res.json() parse JSON body thành object JS bình thường, truy cập field
  // giống như đọc 1 object thường — đây là cách "lấy dữ liệu động" từ response.
  const captchaBody = captchaRes.json();
  const captchaId = captchaBody.captchaId;
  const captchaAnswer = captchaBody.answer; // Juice Shop trả thẳng đáp án trong response

  // ---- 2b. POST với JSON body, dùng lại dữ liệu vừa lấy được ----
  // http.post() cần: URL, BODY (bắt buộc phải JSON.stringify() — k6 không tự
  // serialize object thành JSON như một số HTTP client khác), và params
  // (object thứ 3, chứa headers/tags/... — xem giải thích bên dưới).
  const feedbackPayload = JSON.stringify({
    comment: `k6 load test feedback - VU ${__VU} iter ${__ITER}`, // __VU/__ITER: biến có sẵn của k6, ID của VU hiện tại và số iteration hiện tại — dùng để tránh dữ liệu trùng nhau giữa các VU
    rating: 5,
    captchaId,
    captcha: captchaAnswer,
  });

  // "params" (tham số thứ 3) là nơi khai báo header, tag... cho riêng request
  // này. Không truyền params thì k6 tự đặt Content-Type mặc định — nhưng
  // API JSON như thế này cần khai báo rõ để server hiểu đúng định dạng body.
  const feedbackParams = {
    headers: { 'Content-Type': 'application/json' },
    // tags: gắn nhãn cho request để lọc/threshold riêng trong report (VD:
    // dùng khi 1 script có nhiều loại request khác nhau, muốn tách số liệu).
    tags: { name: 'PostFeedback' },
  };

  const feedbackRes = http.post(`${BASE_URL}/api/Feedbacks`, feedbackPayload, feedbackParams);

  check(feedbackRes, {
    'feedback status is 201': (r) => r.status === 201,
  });

  sleep(1);
}
