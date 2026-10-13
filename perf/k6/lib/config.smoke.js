// perf/k6/lib/config.smoke.js
//
// Smoke test cho chính [config.js](config.js) — chạy 1 VU, 1 iteration, chỉ để
// trả lời: "helper trong config.js có hoạt động không?", KHÔNG đo hiệu năng.
//
// Vì sao cần: cả 3 scenario sắp viết (việc 2.2-2.8 trong ../PLAN.md) đều dựng
// trên `login()` của config.js. Nếu helper đó sai (sai path, sai field trong
// response JSON), cả 3 scenario sẽ "chạy được" nhưng đo sai — đo đường lỗi 401
// thay vì đường thành công, mà số liệu vẫn trông bình thường. Chạy file này
// trước mỗi lần sửa config.js sẽ bắt được lỗi đó ngay.
//
// Chạy: k6 run perf/k6/lib/config.smoke.js
// (Cần Juice Shop đang chạy: npm run app:up && npm run app:wait)

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, ENDPOINTS, VUS, TEST_ACCOUNT, jsonParams, login } from './config.js';

// Tag gắn vào mọi check của riêng file smoke này. Cần tách vì bước 5 bên dưới
// CỐ Ý gọi login() sai mật khẩu — các check bên trong login() sẽ fail theo đúng
// thiết kế. Nếu threshold đếm chung tất cả check thì smoke luôn đỏ dù helper
// hoàn toàn đúng. Tag cho phép threshold chỉ tính check của smoke
// (`checks{kind:smoke}`), bỏ qua check nội bộ của helper.
const SMOKE = { kind: 'smoke' };

export const options = {
  vus: 1,
  iterations: 1,
  // Smoke test thì mọi check của nó phải pass 100% — khác với bài đo hiệu năng
  // (nơi threshold đặt theo p95/error rate và chấp nhận sai số nhỏ).
  thresholds: {
    'checks{kind:smoke}': ['rate==1.0'],
  },
};

export default function () {
  // ---- 1. Hằng số có giá trị hợp lệ ----
  // Bắt lỗi kiểu gõ sai tên biến khi import (k6 không có type check, import
  // sai tên chỉ cho `undefined` chứ không báo lỗi).
  check(
    null,
    {
      'BASE_URL có giá trị': () => typeof BASE_URL === 'string' && BASE_URL.startsWith('http'),
      'các mốc VU tăng dần': () =>
        VUS.smoke < VUS.baseline && VUS.baseline < VUS.load && VUS.load < VUS.stress,
      'TEST_ACCOUNT có email + password': () =>
        Boolean(TEST_ACCOUNT.email) && Boolean(TEST_ACCOUNT.password),
    },
    SMOKE
  );

  // ---- 2. jsonParams() dựng header đúng ----
  const withToken = jsonParams('fake-token-123', 'SmokeTag');
  const withoutToken = jsonParams();
  check(
    null,
    {
      'jsonParams(token) gắn Authorization': () =>
        withToken.headers.Authorization === 'Bearer fake-token-123',
      'jsonParams(token, name) gắn tag': () => withToken.tags.name === 'SmokeTag',
      // Quan trọng: không truyền token thì TUYỆT ĐỐI không được có header
      // Authorization — nếu lọt vào, các scenario test endpoint public sẽ vô
      // tình gửi token và đo sai đường code của app.
      'jsonParams() không có Authorization': () => withoutToken.headers.Authorization === undefined,
    },
    SMOKE
  );

  // ---- 3. Endpoint public trả về đúng (xác nhận BASE_URL + path đúng) ----
  const productsRes = http.get(`${BASE_URL}${ENDPOINTS.products}`);
  check(
    productsRes,
    {
      'GET products status 200': (r) => r.status === 200,
      // Nếu path sai (VD /rest/products), Juice Shop trả 500 "Unexpected path"
      // chứ không phải 404 — nên phải check cả body, không chỉ status.
      'GET products trả về mảng data': (r) => {
        try {
          return Array.isArray(r.json('data'));
        } catch {
          return false;
        }
      },
    },
    SMOKE
  );

  // ---- 4. login() chạy được và token dùng được thật ----
  const session = login();
  const loggedIn = check(
    session,
    {
      'login() trả về session (không null)': (s) => s !== null,
      'session có token dạng JWT (3 phần)': (s) => s !== null && s.token.split('.').length === 3,
      'session có bid là số > 0': (s) => s !== null && typeof s.bid === 'number' && s.bid > 0,
    },
    SMOKE
  );

  // Chứng minh token THẬT SỰ dùng được, không chỉ "có đúng định dạng" — gọi 1
  // endpoint cần xác thực. Đây là bước mà nếu bỏ qua, lỗi "token lấy sai
  // field" sẽ không bị phát hiện cho tới khi đã viết xong cả 3 scenario.
  if (loggedIn && session) {
    const basketRes = http.get(
      `${BASE_URL}${ENDPOINTS.basket(session.bid)}`,
      jsonParams(session.token, 'Basket')
    );
    check(
      basketRes,
      {
        'token dùng được: GET basket status 200': (r) => r.status === 200,
      },
      SMOKE
    );
  }

  // ---- 5. login() sai mật khẩu phải trả null, không throw ----
  // Nếu helper throw ở đây, cả iteration bị huỷ giữa đường và các scenario
  // thật sẽ mất số liệu mỗi khi có 1 request login fail.
  const badSession = login(TEST_ACCOUNT.email, 'definitely-not-the-password');
  check(
    badSession,
    {
      'login() sai mật khẩu trả về null': (s) => s === null,
    },
    SMOKE
  );
}
