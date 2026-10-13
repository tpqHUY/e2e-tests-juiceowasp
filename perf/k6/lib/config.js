// perf/k6/lib/config.js
//
// Cấu hình + helper dùng chung cho mọi scenario k6 trong thư mục này.
//
// Vì sao cần file này (việc 2.1 trong PLAN.md): 2 script đầu tiên
// (get-products.js, stress-products.js) mỗi file tự khai báo lại BASE_URL và
// tự lặp lại cùng 1 đoạn `__ENV.BASE_URL || 'http://localhost:3000'`. Khi lên
// 4-5 file và thêm logic login (dài hơn, dễ sai hơn), copy-paste sẽ làm các
// file lệch nhau — sửa 1 chỗ quên 4 chỗ còn lại. Tập trung về 1 nơi.
//
// LƯU Ý: file này KHÔNG chạy trực tiếp được bằng `k6 run` — nó không có
// `export default function()`, tức là không có kịch bản nào để chạy. Đây là
// "thư viện" cho các file trong ../scenarios/ import vào. k6 hỗ trợ `import`
// giữa các file local bình thường (đường dẫn tương đối, phải có đuôi .js).

import http from 'k6/http';
import { check } from 'k6';

// ---------------------------------------------------------------------------
// 1. BASE_URL — địa chỉ app đang test
// ---------------------------------------------------------------------------
// Override khi chạy: k6 run -e BASE_URL=http://localhost:3001 <file>
// Mặc định trỏ vào Juice Shop local dựng bằng `npm run app:up`.
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// 2. Các mốc tải (VU tier)
// ---------------------------------------------------------------------------
// 4 mốc này là thang đo dùng chung cho cả bộ test, để số liệu giữa các
// scenario so sánh được với nhau (cùng 1 mốc tải mới so sánh có nghĩa).
// Giải thích chi tiết từng mốc dùng khi nào: xem TEST-DESIGN.md §3.
//
// Lý do tách thành hằng số thay vì gõ số trực tiếp vào từng file: khi muốn
// hạ mốc "load" từ 25 xuống 20 (VD máy yếu hơn), chỉ sửa 1 chỗ và toàn bộ
// scenario đổi theo — số liệu vẫn nhất quán giữa các file.
export const VUS = {
  smoke: 2, // chỉ kiểm tra script chạy đúng, KHÔNG dùng để đo hiệu năng
  baseline: 5, // tải nhẹ, ổn định — mốc "bình thường" để so sánh về sau
  load: 25, // tải vừa, hệ thống còn chạy ổn — mốc dùng để báo cáo số liệu
  stress: 100, // ép tới giới hạn, để tìm điểm hệ thống bắt đầu rạn nứt
};

// Think time mặc định (giây) giữa các bước trong 1 iteration — mô phỏng người
// dùng thật có thời gian đọc/suy nghĩ, không bấm liên tục. Bài stress test
// chủ động KHÔNG dùng giá trị này (mục tiêu là ép tải, không mô phỏng user).
export const THINK_TIME = 1;

// ---------------------------------------------------------------------------
// 3. Endpoint
// ---------------------------------------------------------------------------
// Nguồn chuẩn (source of truth) của các path này là src/data/constants.ts
// (phần `ENDPOINTS`). k6 chạy trên runtime Go riêng, KHÔNG đọc được file
// TypeScript, nên buộc phải khai lại ở đây — nhưng khai 1 lần cho cả thư mục
// k6, không rải rác từng file.
//
// Bẫy đã gặp thật: Juice Shop dùng REST API tự sinh bởi `finale-rest` ở
// `/api/Products` (viết hoa), KHÔNG phải `/rest/products` — gọi sai route trả
// về lỗi 500 "Unexpected path". Giữ path ở 1 chỗ để không lặp lại lỗi này.
export const ENDPOINTS = {
  login: '/rest/user/login',
  users: '/api/Users',
  products: '/api/Products',
  productSearch: '/rest/products/search',
  basket: (id) => `/rest/basket/${id}`,
  basketItems: '/api/BasketItems',
};

// ---------------------------------------------------------------------------
// 4. Tài khoản dùng để test luồng cần đăng nhập
// ---------------------------------------------------------------------------
// Đây là tài khoản demo công khai của Juice Shop, được seed lại mỗi lần
// container khởi động — không phải secret, nên hardcode ở đây là an toàn
// (giống cách src/data/constants.ts đang làm với hằng số `ADMIN`).
//
// ponytail: dùng 1 tài khoản seeded sẵn cho mọi VU, thay vì mỗi VU tự đăng ký
// tài khoản riêng. Đủ cho mục tiêu "đo độ chậm của endpoint có auth", và
// tránh việc mỗi lần chạy test lại để lại hàng trăm user rác trong DB.
// Hạn chế phải biết: mọi VU dùng chung 1 basket id, nên KHÔNG dùng tài khoản
// này cho scenario ghi vào giỏ hàng nếu muốn số liệu sạch (các VU sẽ tranh
// nhau cùng 1 row trong DB — xem lại khi làm việc 2.8).
// Nâng cấp khi: cần đo luồng ghi dữ liệu per-user → đổi sang đăng ký user
// riêng theo `${__VU}-${__ITER}` (việc 2.6 trong PLAN.md).
export const TEST_ACCOUNT = {
  email: 'admin@juice-sh.op',
  password: 'admin123',
};

// ---------------------------------------------------------------------------
// 5. Helper: header
// ---------------------------------------------------------------------------

/**
 * Header cho request JSON có kèm token xác thực.
 *
 * Gọi không truyền token (hoặc token rỗng) thì chỉ trả Content-Type — tiện cho
 * các endpoint public, không cần viết 2 hàm riêng.
 *
 * @param {string} [token] JWT lấy từ login()
 * @param {string} [name] nhãn gắn vào request (`tags.name`) để lọc số liệu
 *   riêng cho từng loại request trong report, và để đặt threshold theo tag
 *   (xem việc 2.7 trong PLAN.md). Không truyền thì k6 gộp chung theo URL.
 */
export function jsonParams(token, name) {
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) {
    params.headers.Authorization = `Bearer ${token}`;
  }
  if (name) {
    params.tags = { name };
  }
  return params;
}

// ---------------------------------------------------------------------------
// 6. Helper: login
// ---------------------------------------------------------------------------

/**
 * Đăng nhập và trả về session để các request sau dùng.
 *
 * Đây là kỹ thuật "correlation" — lấy dữ liệu từ response của request trước
 * (token) để dùng cho request sau. Giống cách đã làm với CAPTCHA ở
 * search-and-feedback.js, nhưng token là trường hợp hay gặp nhất khi mô phỏng
 * user thật.
 *
 * Trả về `null` (chứ không throw) khi login fail, để caller tự quyết định:
 * thường là dừng iteration đó lại. Lý do KHÔNG throw: trong k6, exception làm
 * cả iteration bị huỷ và ghi nhận là lỗi hệ thống, làm nhiễu số liệu — còn
 * login fail là tình huống bình thường cần đo, không phải lỗi script.
 *
 * Luôn phải check trước khi dùng token, nếu không các bước sau sẽ gửi
 * `Authorization: Bearer undefined` và nhận 401 — số liệu vẫn "chạy" nhưng
 * đo sai hoàn toàn (đo đường lỗi thay vì đường thành công).
 *
 * @param {string} [email]
 * @param {string} [password]
 * @returns {{token: string, bid: number, email: string} | null}
 */
export function login(email = TEST_ACCOUNT.email, password = TEST_ACCOUNT.password) {
  const res = http.post(
    `${BASE_URL}${ENDPOINTS.login}`,
    JSON.stringify({ email, password }),
    // Gắn tag riêng cho request login: endpoint này chậm hơn hẳn các endpoint
    // đọc vì bcrypt hash password tốn CPU, nên cần tách số liệu ra để không
    // kéo p95 chung của cả scenario lên.
    jsonParams(undefined, 'Login')
  );

  const ok = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login trả về token': (r) => {
      try {
        // Juice Shop trả token trong `authentication.token`, cùng với `bid`
        // (basket id) — khớp với LoginResponseSchema ở src/api/schemas.ts.
        return typeof r.json('authentication.token') === 'string';
      } catch {
        // response không phải JSON (VD app trả HTML lỗi 502) → r.json() throw
        return false;
      }
    },
  });

  if (!ok) {
    return null;
  }

  const auth = res.json('authentication');
  return { token: auth.token, bid: auth.bid, email };
}
