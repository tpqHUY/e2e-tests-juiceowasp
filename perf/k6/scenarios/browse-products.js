// perf/k6/scenarios/browse-products.js
//
// Scenario A — luồng DUYỆT SẢN PHẨM (đọc, không cần đăng nhập).
// Việc 2.2 + 2.3 trong ../PLAN.md.
//
// Mô phỏng hành vi của khách chưa đăng nhập — nhóm người dùng đông nhất của
// một shop online: vào trang chủ xem danh sách, tìm kiếm, mở vài sản phẩm xem
// chi tiết, rồi đi. Khác với 2 script học tập ban đầu (get-products.js chỉ gọi
// 1 endpoint lặp lại), ở đây 1 iteration đi qua NHIỀU endpoint theo đúng thứ
// tự một người thật sẽ bấm.
//
// Vì sao luồng này quan trọng nhất để test trước: không cần auth nên lượng
// truy cập lớn nhất, và nếu nó chậm thì người dùng rời đi trước cả khi kịp
// đăng nhập.
//
// Chạy:
//   k6 run perf/k6/scenarios/browse-products.js                  # mốc baseline (mặc định)
//   k6 run -e TIER=smoke perf/k6/scenarios/browse-products.js    # chỉ kiểm tra script chạy đúng
//   k6 run -e TIER=load perf/k6/scenarios/browse-products.js     # mốc dùng để báo cáo số liệu
//   k6 run -e TIER=stress perf/k6/scenarios/browse-products.js   # ép tới giới hạn

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { BASE_URL, ENDPOINTS, VUS, THINK_TIME, jsonParams } from '../lib/config.js';

// ---------------------------------------------------------------------------
// 1. Dữ liệu test — từ khoá tìm kiếm (việc 2.3)
// ---------------------------------------------------------------------------
// SharedArray: mảng chỉ đọc, k6 nạp MỘT lần rồi chia sẻ cho mọi VU, thay vì
// mỗi VU giữ một bản copy riêng trong RAM. Ở 100 VU, mảng thường sẽ bị nhân
// 100 lần — SharedArray tránh chuyện đó.
//
// Hàm khởi tạo chỉ chạy đúng 1 lần trong "init stage" (giai đoạn k6 nạp script,
// trước khi bất kỳ VU nào bắt đầu). Đây cũng là lý do open() chỉ được gọi ở
// đây: k6 KHÔNG cho đọc file trong lúc test đang chạy.
const searchTerms = new SharedArray('searchTerms', function () {
  return JSON.parse(open('../data/search-terms.json')).terms;
});

// Vì sao phải đa dạng từ khoá, không hardcode `q=juice` (bài học của việc 2.3):
// gọi lặp lại CÙNG một query sẽ làm số liệu đẹp giả tạo — tầng cache của
// DB/app chỉ phải làm việc thật ở lần đầu, các lần sau trả từ bộ nhớ. Dữ liệu
// trong search-terms.json cố ý trộn cả 3 nhóm, vì chi phí xử lý của server
// khác nhau rõ rệt:
//   - từ khoá nhiều kết quả ("juice" → 30/37 sản phẩm): server phải serialize
//     nhiều JSON nhất → chậm nhất
//   - từ khoá ít kết quả ("lemon" → 1)
//   - từ khoá không có kết quả ("zzzznotfound" → 0): vẫn phải quét bảng nhưng
//     trả về rỗng
// Nếu chỉ test nhóm đầu thì đánh giá quá bi quan, chỉ test nhóm cuối thì quá
// lạc quan. Trộn cả 3 mới ra số gần thực tế.

// ---------------------------------------------------------------------------
// 2. Custom metric
// ---------------------------------------------------------------------------
// Tách thời gian phản hồi theo từng BƯỚC trong luồng. Metric mặc định
// http_req_duration gộp chung mọi request, nên nếu riêng search chậm thì con
// số trung bình sẽ bị 2 bước nhanh kia pha loãng và ta không thấy vấn đề.
//
// `true` ở tham số thứ 2 = hiển thị theo đơn vị thời gian (ms) trong summary.
const catalogDuration = new Trend('step_catalog_ms', true);
const searchDuration = new Trend('step_search_ms', true);
const detailDuration = new Trend('step_detail_ms', true);

// ---------------------------------------------------------------------------
// 3. Mức tải — chọn bằng -e TIER=...
// ---------------------------------------------------------------------------
// Dùng hằng số VUS từ lib/config.js (không gõ số trực tiếp ở đây) để mọi
// scenario trong bộ test đều chạy ở cùng thang đo — điều kiện bắt buộc để số
// liệu giữa các scenario so sánh được với nhau.
const TIER = __ENV.TIER || 'baseline';
const TARGET_VUS = VUS[TIER];

if (!TARGET_VUS) {
  // Chặn ngay ở init stage, trước khi test chạy. Nếu không có nhánh này,
  // TIER viết sai (VD `-e TIER=lod`) sẽ cho TARGET_VUS = undefined và k6 chạy
  // với cấu hình mặc định — ta tưởng đang đo mốc load nhưng thực tế không.
  throw new Error(`TIER không hợp lệ: "${TIER}". Chọn một trong: ${Object.keys(VUS).join(', ')}`);
}

// Bài smoke chỉ cần xác nhận script chạy đúng, không cần ramp — chạy đủ số
// iteration rồi thoát, mất vài giây thay vì gần 1 phút.
const isSmoke = TIER === 'smoke';

// Ngưỡng latency nới theo tier. Vì sao KHÔNG dùng một ngưỡng cho mọi mốc tải:
// mục đích của 2 nhóm tier khác nhau hoàn toàn.
//   - smoke/baseline/load: kiểm tra "hệ thống có đạt yêu cầu không" → ngưỡng
//     chặt, vi phạm là tín hiệu thật (regression) và nên làm CI đỏ.
//   - stress: cố ý ép quá giới hạn để TÌM điểm vỡ → chậm là kết quả mong đợi,
//     không phải thất bại. Nếu giữ ngưỡng 200ms thì tier này luôn exit 99 và
//     con số đó không còn mang thông tin gì.
// Ngưỡng stress vẫn giữ (3s) chứ không bỏ hẳn, để biết khi nào hệ thống tệ
// hơn cả mức "đã biết là tệ" — cùng cách stress-products.js đang làm.
const LATENCY_P95_MS = TIER === 'stress' ? 3000 : 200;

// Tỉ lệ lỗi: ở stress chấp nhận tới 20% (hệ thống bắt đầu từ chối request là
// thông tin cần đo), các tier còn lại gần như không được lỗi.
const MAX_FAIL_RATE = TIER === 'stress' ? 0.2 : 0.01;

export const options = {
  stages: isSmoke
    ? [{ duration: '5s', target: TARGET_VUS }]
    : [
        // Ramp-up có chủ đích, không nhảy thẳng lên đỉnh: app Node.js cần vài
        // giây "khởi động nóng" (JIT, pool kết nối DB). Đo ngay lúc lạnh sẽ ra
        // số tệ hơn thực tế vận hành.
        { duration: '15s', target: TARGET_VUS },
        { duration: '45s', target: TARGET_VUS }, // giữ tải — phần dữ liệu đáng tin nhất
        { duration: '10s', target: 0 },
      ],

  thresholds: {
    // ---- Ngưỡng chung cho cả scenario ----
    http_req_failed: [`rate<${MAX_FAIL_RATE}`],

    // ---- Ngưỡng riêng theo từng loại request (dùng tag `name`) ----
    // Vì sao tách: 3 bước này có chi phí xử lý khác nhau hẳn, một ngưỡng chung
    // sẽ hoặc quá lỏng với bước nhanh, hoặc quá chặt với bước chậm. Mốc lấy từ
    // TEST-DESIGN.md §4 (nhóm "đọc, không auth": p95 < 200ms).
    //
    // LƯU Ý: các số này là mốc KHỞI ĐIỂM, chưa phải baseline đo được. Việc
    // 3.14 trong PLAN.md sẽ chỉnh lại theo số thật sau khi chạy đủ 3 lần.
    'http_req_duration{name:Catalog}': [`p(95)<${LATENCY_P95_MS}`],
    'http_req_duration{name:Search}': [`p(95)<${LATENCY_P95_MS}`],
    'http_req_duration{name:ProductDetail}': [`p(95)<${LATENCY_P95_MS}`],

    // Mọi assertion phải pass, ở MỌI tier kể cả stress: check ở đây kiểm tra
    // tính đúng đắn của dữ liệu (status 200, trả về đúng sản phẩm đã yêu cầu),
    // không phải tốc độ. App quá tải thì được phép chậm, nhưng không được
    // phép trả sai dữ liệu — đó là bug, không phải vấn đề hiệu năng.
    checks: ['rate==1.0'],
  },

  // Gắn tag cho toàn bộ metric của lần chạy này, để khi so sánh nhiều file
  // JSON kết quả (việc 5.1) biết ngay số nào thuộc mốc tải nào.
  tags: { scenario: 'browse-products', tier: TIER },
};

// ---------------------------------------------------------------------------
// 4. Kịch bản
// ---------------------------------------------------------------------------
// Số sản phẩm chi tiết mỗi "khách" mở xem trong 1 lượt duyệt. 2 là phỏng đoán
// hợp lý cho hành vi xem-rồi-đi, không phải số đo từ analytics thật.
const PRODUCTS_VIEWED_PER_VISIT = 2;

export default function () {
  // group(): gộp các request thành từng bước có tên trong report, để đọc kết
  // quả theo luồng nghiệp vụ ("bước search chậm") thay vì theo URL rời rạc.
  let products = [];

  group('1. Xem danh sách sản phẩm', function () {
    const res = http.get(
      `${BASE_URL}${ENDPOINTS.products}`,
      jsonParams(undefined, 'Catalog') // không truyền token: endpoint public
    );
    catalogDuration.add(res.timings.duration);

    check(res, {
      'catalog: status 200': (r) => r.status === 200,
      'catalog: trả về mảng sản phẩm': (r) => {
        try {
          return Array.isArray(r.json('data'));
        } catch {
          // response không phải JSON (VD app trả HTML lỗi 502) → json() throw
          return false;
        }
      },
    });

    // Lấy danh sách id thật từ response để bước 3 dùng — KHÔNG hardcode id.
    // Juice Shop reset dữ liệu mỗi lần container khởi động lại, nên id cứng
    // trong script sẽ thành 404 âm thầm nếu dữ liệu seed thay đổi.
    if (res.status === 200) {
      try {
        products = res.json('data') || [];
      } catch {
        products = [];
      }
    }
  });

  sleep(THINK_TIME); // người thật cần vài giây đọc danh sách trước khi tìm kiếm

  group('2. Tìm kiếm sản phẩm', function () {
    // Mỗi VU ở mỗi vòng lặp lấy một từ khoá khác nhau trong SharedArray.
    // __VU và __ITER là biến có sẵn của k6 (id của VU hiện tại, số vòng lặp
    // hiện tại) — cộng lại rồi chia lấy dư để trải đều qua danh sách, tránh
    // trường hợp mọi VU cùng gọi một query.
    const term = searchTerms[(__VU + __ITER) % searchTerms.length];

    const res = http.get(
      `${BASE_URL}${ENDPOINTS.productSearch}?q=${encodeURIComponent(term.q)}`,
      // Tag là 'Search' cho MỌI từ khoá, không tách theo từng từ: tag động sẽ
      // làm phình số lượng metric k6 phải giữ trong RAM (vấn đề "high
      // cardinality"), và ta muốn một ngưỡng p95 cho cả bước search.
      jsonParams(undefined, 'Search')
    );
    searchDuration.add(res.timings.duration);

    check(res, {
      // Lưu ý: từ khoá không có kết quả vẫn phải trả 200 với mảng rỗng, KHÔNG
      // phải 404 — "không tìm thấy gì" là kết quả hợp lệ của một phép tìm kiếm.
      'search: status 200': (r) => r.status === 200,
      'search: trả về mảng data': (r) => {
        try {
          return Array.isArray(r.json('data'));
        } catch {
          return false;
        }
      },
      // Kiểm tra app thật sự tìm được dữ liệu, không chỉ "trả về 200 rỗng".
      // Không có check này, app hỏng index/DB vẫn pass toàn bộ bài test vì
      // mảng rỗng vẫn là mảng hợp lệ.
      'search: từ khoá có hàng trả về đủ kết quả': (r) => {
        if (term.expectedMin === 0) return true;
        try {
          return (r.json('data') || []).length >= term.expectedMin;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(THINK_TIME);

  group('3. Xem chi tiết sản phẩm', function () {
    if (products.length === 0) {
      // Bước 1 fail thì không có id nào để mở — bỏ qua bước này thay vì gọi
      // với id undefined (sẽ tạo ra lỗi 404 giả, làm nhiễu số liệu thật).
      return;
    }

    for (let i = 0; i < PRODUCTS_VIEWED_PER_VISIT; i++) {
      const product = products[(__VU + __ITER + i) % products.length];
      const res = http.get(
        `${BASE_URL}${ENDPOINTS.product(product.id)}`,
        jsonParams(undefined, 'ProductDetail')
      );
      detailDuration.add(res.timings.duration);

      check(res, {
        'detail: status 200': (r) => r.status === 200,
        'detail: trả về đúng sản phẩm đã yêu cầu': (r) => {
          try {
            return r.json('data.id') === product.id;
          } catch {
            return false;
          }
        },
      });

      // Think time ngắn hơn giữa 2 sản phẩm: bấm từ danh sách sang chi tiết
      // nhanh hơn thao tác gõ tìm kiếm.
      sleep(THINK_TIME / 2);
    }
  });
}
