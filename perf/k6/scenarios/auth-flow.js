// perf/k6/scenarios/auth-flow.js
//
// Scenario B — luồng XÁC THỰC: đăng ký → đăng nhập → đọc dữ liệu cần token.
// Việc 2.4 - 2.7 trong ../PLAN.md.
//
// Mô phỏng một người dùng mới hoàn toàn: tạo tài khoản, đăng nhập, rồi đọc
// dữ liệu riêng của mình (giỏ hàng, thông tin tài khoản). Khác scenario
// browse-products.js (đọc thuần, không auth), luồng này có GHI dữ liệu vào DB
// và có token — hai thứ làm hiệu năng khác hẳn.
//
// Kỹ thuật chính: "correlation" qua 2 bước liên tiếp — lấy token từ response
// của login để dùng cho các request sau. Đây là kỹ thuật phải có khi mô phỏng
// bất kỳ luồng đăng nhập nào.
//
// Chạy:
//   k6 run perf/k6/scenarios/auth-flow.js                  # mốc baseline (mặc định)
//   k6 run -e TIER=smoke perf/k6/scenarios/auth-flow.js    # kiểm tra script chạy đúng
//   k6 run -e TIER=load perf/k6/scenarios/auth-flow.js     # mốc dùng để báo cáo số liệu
//
// LƯU Ý VỀ DỮ LIỆU: mỗi iteration tạo 1 user mới trong DB. Chạy mốc stress
// (100 VU) sẽ để lại hàng trăm user rác. Reset bằng:
//   npm run app:reset     (docker compose restart + đợi app sẵn sàng)

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, ENDPOINTS, VUS, THINK_TIME, jsonParams } from '../lib/config.js';

// ---------------------------------------------------------------------------
// 1. Custom metric — tách thời gian theo từng bước
// ---------------------------------------------------------------------------
// Ba bước này có chi phí xử lý khác nhau về bản chất:
//   - register: validate + INSERT vào DB (ghi)
//   - login: tra user + so sánh hash mật khẩu + sinh JWT
//   - authed read: verify JWT + SELECT (đọc, nhưng có thêm bước xác thực)
// Gộp chung vào http_req_duration sẽ không thấy bước nào là nút cổ chai.
const registerDuration = new Trend('step_register_ms', true);
const loginDuration = new Trend('step_login_ms', true);
const authedReadDuration = new Trend('step_authed_read_ms', true);
// Đo riêng đường login THẤT BẠI (sai mật khẩu). Xem lý do ở bước 4 bên dưới.
const loginFailDuration = new Trend('step_login_fail_ms', true);

// ---------------------------------------------------------------------------
// 2. Mức tải
// ---------------------------------------------------------------------------
const TIER = __ENV.TIER || 'baseline';
const TARGET_VUS = VUS[TIER];

if (!TARGET_VUS) {
  throw new Error(`TIER không hợp lệ: "${TIER}". Chọn một trong: ${Object.keys(VUS).join(', ')}`);
}

const isSmoke = TIER === 'smoke';

// Ngưỡng nới ở tier stress — cùng lý do đã giải thích trong
// browse-products.js: stress cố ý ép quá giới hạn nên chậm là kết quả mong
// đợi, không phải thất bại cần làm CI đỏ.
const LATENCY_P95_MS = TIER === 'stress' ? 3000 : 500;
const MAX_FAIL_RATE = TIER === 'stress' ? 0.2 : 0.01;

export const options = {
  stages: isSmoke
    ? [{ duration: '5s', target: TARGET_VUS }]
    : [
        { duration: '15s', target: TARGET_VUS },
        { duration: '45s', target: TARGET_VUS },
        { duration: '10s', target: 0 },
      ],

  thresholds: {
    http_req_failed: [`rate<${MAX_FAIL_RATE}`],

    // ---- Ngưỡng riêng theo nhóm request (việc 2.7) ----
    // TEST-DESIGN.md §4 ban đầu đặt nhóm auth ở p95 < 800ms với lý do "bcrypt
    // hash password tốn CPU đáng kể". Đo thật thì giả định đó SAI với Juice
    // Shop (xem phần ghi chú cuối file): băm mật khẩu ở đây là MD5 không
    // salt — gần như miễn phí về CPU. Vì vậy ngưỡng ở đây đặt 500ms, không
    // phải 800ms: nới tay cho một chi phí không tồn tại sẽ làm bài test không
    // bắt được regression thật.
    //
    // Register nới hơn 2 bước kia vì nó GHI vào DB (INSERT + validate), là
    // bước duy nhất trong luồng này phải chờ I/O ghi.
    'http_req_duration{name:Register}': [`p(95)<${LATENCY_P95_MS * 2}`],
    'http_req_duration{name:Login}': [`p(95)<${LATENCY_P95_MS}`],
    'http_req_duration{name:AuthedRead}': [`p(95)<${LATENCY_P95_MS}`],

    checks: ['rate==1.0'],
  },

  tags: { scenario: 'auth-flow', tier: TIER },
};

// ---------------------------------------------------------------------------
// 3. Dữ liệu test — email phải duy nhất cho từng VU/iteration (việc 2.6)
// ---------------------------------------------------------------------------
// Juice Shop trả 400 khi email đã tồn tại (đã xác nhận bằng probe). Nếu mọi
// VU dùng chung 1 email thì: VU đầu tiên tạo thành công, TẤT CẢ các VU sau
// nhận 400 — và ta sẽ vô tình đo hiệu năng của đường lỗi validate thay vì
// đường INSERT thật.
//
// __VU (id của VU) + __ITER (số vòng lặp) là cặp duy nhất trong 1 lần chạy.
// Thêm RUN_ID vì các lần chạy khác nhau trên cùng container sẽ lặp lại cặp
// (__VU, __ITER) — không có nó, chạy lần 2 mà chưa reset DB sẽ toàn 400.
const RUN_ID = __ENV.RUN_ID || `${Date.now()}`;

function makeEmail() {
  return `k6-${RUN_ID}-v${__VU}i${__ITER}@e2e.local`;
}

// Mật khẩu dùng chung cho mọi user test — không cần ngẫu nhiên vì đây là dữ
// liệu test dùng một lần, không phải tài khoản thật.
const PASSWORD = 'k6LoadTest123';

// Câu hỏi bảo mật id 1 được Juice Shop seed sẵn mỗi lần khởi động (khớp
// SECURITY_QUESTION trong src/data/constants.ts).
const SECURITY_QUESTION_ID = 1;

// ---------------------------------------------------------------------------
// 4. Kịch bản
// ---------------------------------------------------------------------------
export default function () {
  const email = makeEmail();

  // ---- Bước 1: Đăng ký ----
  let registered = false;

  group('1. Đăng ký tài khoản mới', function () {
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.users}`,
      JSON.stringify({
        email,
        password: PASSWORD,
        passwordRepeat: PASSWORD,
        securityQuestion: { id: SECURITY_QUESTION_ID },
        securityAnswer: 'k6',
      }),
      jsonParams(undefined, 'Register')
    );
    registerDuration.add(res.timings.duration);

    registered = check(res, {
      'register: status 201': (r) => r.status === 201,
      'register: trả về đúng email đã gửi': (r) => {
        try {
          return r.json('data.email') === email;
        } catch {
          return false;
        }
      },
    });
  });

  if (!registered) {
    // Không đăng ký được thì không có gì để đăng nhập. Dừng iteration tại đây
    // thay vì chạy tiếp với dữ liệu không tồn tại — các bước sau sẽ nhận 401
    // và làm nhiễu số liệu (đo đường lỗi thay vì đường thành công).
    sleep(THINK_TIME);
    return;
  }

  sleep(THINK_TIME); // người thật mất vài giây điền form rồi mới bấm đăng nhập

  // ---- Bước 2: Đăng nhập (correlation — lấy token) ----
  let session = null;

  group('2. Đăng nhập', function () {
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.login}`,
      JSON.stringify({ email, password: PASSWORD }),
      jsonParams(undefined, 'Login')
    );
    loginDuration.add(res.timings.duration);

    const ok = check(res, {
      'login: status 200': (r) => r.status === 200,
      'login: trả về token': (r) => {
        try {
          return typeof r.json('authentication.token') === 'string';
        } catch {
          // response không phải JSON (VD app trả HTML lỗi 502) → json() throw
          return false;
        }
      },
    });

    if (ok) {
      const auth = res.json('authentication');
      session = { token: auth.token, bid: auth.bid };
    }
  });

  // Phải check trước khi dùng token (việc 2.5). Không có nhánh này, các bước
  // sau sẽ gửi `Authorization: Bearer undefined`, nhận 401, và số liệu vẫn
  // "chạy" bình thường — nhưng đo hoàn toàn sai đường code.
  if (!session) {
    sleep(THINK_TIME);
    return;
  }

  sleep(THINK_TIME);

  // ---- Bước 3: Đọc dữ liệu cần xác thực ----
  group('3. Đọc dữ liệu cần xác thực', function () {
    // Giỏ hàng — dữ liệu riêng của user, bắt buộc có token (đã xác nhận bằng
    // probe: gọi không token trả 401).
    const basketRes = http.get(
      `${BASE_URL}${ENDPOINTS.basket(session.bid)}`,
      jsonParams(session.token, 'AuthedRead')
    );
    authedReadDuration.add(basketRes.timings.duration);

    check(basketRes, {
      'basket: status 200': (r) => r.status === 200,
      'basket: trả về đúng giỏ hàng của user': (r) => {
        try {
          return r.json('data.id') === session.bid;
        } catch {
          return false;
        }
      },
    });

    sleep(THINK_TIME / 2);

    // whoami — xác nhận token thật sự đại diện đúng user vừa đăng nhập, không
    // chỉ là "một token hợp lệ nào đó". Nếu thiếu check này, lỗi kiểu trả sai
    // user (lẫn session giữa các VU) sẽ không bị phát hiện.
    //
    // ⚠️ BẪY ĐÃ GẶP THẬT: endpoint này đọc token từ COOKIE, không phải từ
    // header `Authorization` như /rest/basket/:id. Gửi bằng header thì vẫn
    // nhận status **200** nhưng body là `{"user":{}}` rỗng — tức là "thành
    // công" mà không có dữ liệu. Nếu bài test chỉ check status 200, lỗi này
    // lọt hoàn toàn và ta tưởng đang đo một endpoint có xác thực, trong khi
    // thực tế đang đo đường ẩn danh (nhanh hơn, không phản ánh đúng chi phí).
    //
    // Đây chính là lý do mỗi check status luôn đi kèm một check nội dung.
    const whoamiParams = jsonParams(undefined, 'AuthedRead');
    whoamiParams.headers.Cookie = `token=${session.token}`;

    const whoamiRes = http.get(`${BASE_URL}${ENDPOINTS.whoami}`, whoamiParams);
    authedReadDuration.add(whoamiRes.timings.duration);

    check(whoamiRes, {
      'whoami: status 200': (r) => r.status === 200,
      'whoami: trả về đúng user đang đăng nhập': (r) => {
        try {
          return r.json('user.email') === email;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(THINK_TIME);

  // ---- Bước 4: Đăng nhập sai mật khẩu (đo đường lỗi) ----
  // Vì sao đo cả đường thất bại, không chỉ đường thành công:
  //
  // 1. Thực tế luôn có: người dùng gõ sai mật khẩu, bot thử mật khẩu — đây là
  //    traffic thật mà hệ thống phải chịu, không phải trường hợp hiếm.
  // 2. Nếu đường lỗi CHẬM HƠN HẲN đường thành công, đó là một lỗ hổng từ chối
  //    dịch vụ: kẻ tấn công chỉ cần gửi mật khẩu sai liên tục để ngốn CPU gấp
  //    nhiều lần so với chi phí họ bỏ ra. So sánh step_login_ms với
  //    step_login_fail_ms trong summary sẽ thấy ngay.
  //
  // Request này CỐ Ý trả 401, nên phải loại khỏi thống kê lỗi — nếu không,
  // mỗi iteration sẽ tự cộng 1 lỗi vào http_req_failed và ngưỡng
  // `rate<0.01` không bao giờ đạt. Cách loại: khai báo mã 401 là "phản hồi
  // mong đợi" cho riêng request này.
  group('4. Đăng nhập sai mật khẩu (đường lỗi)', function () {
    const params = jsonParams(undefined, 'LoginFail');
    params.responseCallback = http.expectedStatuses(401);

    const res = http.post(
      `${BASE_URL}${ENDPOINTS.login}`,
      JSON.stringify({ email, password: 'definitely-not-the-password' }),
      params
    );
    loginFailDuration.add(res.timings.duration);

    check(res, {
      // 401 là hành vi ĐÚNG ở đây. Nếu nhận 200 nghĩa là app cho đăng nhập
      // bằng mật khẩu sai — lỗi bảo mật nghiêm trọng, phải làm test đỏ.
      'login sai mật khẩu: status 401': (r) => r.status === 401,
    });
  });
}

// ---------------------------------------------------------------------------
// GHI CHÚ: giả định "auth chậm vì bcrypt" KHÔNG đúng với Juice Shop
// ---------------------------------------------------------------------------
// TEST-DESIGN.md §4 ban đầu dự đoán nhóm endpoint có auth sẽ chậm nhất vì
// "bcrypt hash password tốn CPU đáng kể". Đo thật trên máy local (10 lần gọi
// tuần tự mỗi endpoint) cho kết quả ngược lại:
//
//   POST /rest/user/login   ~13-17ms   ← có xác thực
//   GET  /api/Products      ~19-36ms   ← công khai, không xác thực
//   GET  /rest/user/whoami   ~7-11ms   ← có xác thực
//
// Nguyên nhân: Juice Shop băm mật khẩu bằng MD5 KHÔNG salt, không phải bcrypt
// (xác nhận bằng cách giải mã payload JWT lấy chuỗi hash rồi so với
// `echo -n "<password>" | md5sum` — khớp chính xác). MD5 gần như miễn phí về
// CPU, nên bước băm mật khẩu không hề là nút cổ chai. Endpoint sản phẩm chậm
// hơn chỉ vì phải serialize 37 bản ghi JSON — nhiều việc hơn hẳn.
//
// Bài học chung, quan trọng hơn con số: ngưỡng đặt theo PHỎNG ĐOÁN về chi phí
// nội bộ của hệ thống dễ sai. Nới tay cho một chi phí không tồn tại (800ms
// cho một endpoint thực tế chạy 15ms) sẽ khiến bài test không bao giờ bắt
// được regression — nó đã chậm đi 50 lần mà vẫn "pass".
//
// (Ngoài lề nhưng đáng biết: MD5 không salt là một lỗ hổng CỐ Ý của Juice
// Shop — đây là app được thiết kế để dạy bảo mật. Không phải bug cần báo.)
