# Security Testing (Defensive QA) — học từ suite `@security` của project

> Note cho người **chưa từng test security**. Mục tiêu: đọc hiểu 5 test `@security` hiện có, biết **mỗi test kiểm điều gì trong thực tế**, **phát hiện rủi ro gì**, và **cách viết thêm test an toàn** để tăng coverage.
>
> ⚠️ **Khung phòng thủ (defensive):** đây là **QA security testing** — tự động hoá việc **phát hiện & canh gác (regression guard)** các lớp lỗ hổng phổ biến, chạy trên **app training chạy local mà ta sở hữu** (OWASP Juice Shop). Không phải tấn công hệ thống của người khác; không "vũ khí hoá" payload. Chỉ chạy trên môi trường bạn được phép.
>
> 🔗 Các lỗ hổng cụ thể được test có bug report riêng ở [docs/bug-reports/](../bug-reports/) (BUG-003 IDOR, BUG-004 SQLi, BUG-005 XSS, BUG-006 CAPTCHA leak); lý do thiết kế "assert hành vi hiện tại" xem [ADR-0005](../adr/0005-security-tests-assert-current-behaviour.md).

---

## 0. QA security testing khác pentest thế nào?

|           | Pentester                       | **QA security testing (cái ta làm)**                                                                 |
| --------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Mục tiêu  | Tìm & khai thác lỗ hổng **mới** | **Phát hiện lại** các lớp lỗ hổng **đã biết** (OWASP Top 10) và **canh gác** để chúng không tái xuất |
| Đầu ra    | Báo cáo khai thác               | **Test tự động** chạy trong CI + bug report                                                          |
| Tính chất | Tấn công (được uỷ quyền)        | **Phòng thủ** — như "test hồi quy" cho bảo mật                                                       |

Với QA, một security test về bản chất **giống test thường**, chỉ khác **đầu vào** và **kỳ vọng** xoay quanh bảo mật.

---

## 1. Bộ khung chung: một security test gồm gì

Mọi test trong `tests/security/security.spec.ts` đều theo mẫu:

1. **Tạo một điều kiện đặc biệt** — gửi input bất thường (payload chuẩn), hoặc truy cập tài nguyên **thiếu quyền**, hoặc gọi một endpoint nhạy cảm.
2. **ASSERT phản hồi** so với **kỳ vọng an toàn** (status code / DOM / body).

> 🔑 **Điểm cốt lõi phải hiểu (đọc comment trong code):** Juice Shop **CỐ Ý có lỗ hổng**. Nên các test này assert **hành vi HIỆN TẠI (đang lỗi)** để **xanh** + comment `// FINDING:` ghi rõ **kỳ vọng an toàn đúng ra phải là gì**. Trong một app **thật đã vá**, bạn chỉ cần **đảo assert** (ví dụ `toBe(401)` thay vì `toBe(200)`) → test biến thành **regression guard**: nếu lỗ hổng tái xuất, test **đỏ** ngay. Đây chính là "security-minded test design".

---

## 2. Phân tích từng test (5 test)

### 2.1 SQLi ở login endpoint (API) — kiểm **status code + cấu trúc token**

```ts
const res = await request.post('/rest/user/login', {
  headers: { 'Content-Type': 'application/json' },
  data: { email: "' OR 1=1--", password: 'anything' },
});
expect(res.status()).toBe(200); // FINDING: app an toàn phải là 401
expect(body.authentication?.token?.split('.')).toHaveLength(3); // token JWT = 3 phần
```

- **Kiểm gì:** gửi input `' OR 1=1--` vào ô email rồi kiểm **HTTP status code** (`200`?) và **hình dạng response** (có JWT hợp lệ không).
- **Rủi ro phát hiện:** **Authentication bypass** — nếu server ghép chuỗi input vào câu SQL, input này khiến điều kiện luôn đúng → đăng nhập **không cần mật khẩu**.
- **OWASP:** A03 – Injection.
- **App an toàn → sửa assert:** `expect(res.status()).toBe(401)`.

### 2.2 SQLi ở login form (UI) — kiểm **trạng thái đăng nhập qua DOM**

```ts
await login.login("' OR 1=1--", 'anything');
await login.navbar.openAccountMenu();
await expect(login.navbar.logoutMenuButton).toBeVisible(); // đã đăng nhập = có nút Logout
```

- **Kiểm gì:** cùng payload nhưng qua **giao diện thật**; xác nhận đã đăng nhập bằng cách kiểm **DOM** (menu account hiện nút **Logout**).
- **Rủi ro:** cùng lỗ hổng A03, nhưng chứng minh nó khai thác được **end-to-end qua UI** (không chỉ API).
- **App an toàn → sửa assert:** kỳ vọng thấy **thông báo lỗi** / nút Logout **không** hiện.

### 2.3 IDOR — kiểm **phân quyền (authorization) qua status code**

```ts
const sessionB = await authApi.createAndLogin(userB); // user B có giỏ hàng
basketApi.setToken(session.token); // dùng token của user A
const res = await basketApi.getRaw(sessionB.bid); // A đọc giỏ của B
expect(res.status()).toBe(200); // FINDING: app an toàn phải là 401/403
```

- **Kiểm gì:** dùng token của **user A** để truy cập **tài nguyên của user B** (giỏ hàng, định danh bằng `bid`), rồi kiểm **status code**.
- **Rủi ro:** **IDOR / Broken Object-Level Authorization** — chỉ cần đổi số `id`, xem được dữ liệu người khác. `bid` là số tuần tự nên đoán rất dễ.
- **OWASP:** A01 – Broken Access Control.
- **App an toàn → sửa assert:** `expect([401, 403]).toContain(res.status())`.

### 2.4 DOM XSS ở search — kiểm **DOM sau khi render đầu vào**

```ts
const payload = '<iframe src="javascript:alert(`xss`)">';
await page.goto(`/#/search?q=${encodeURIComponent(payload)}`);
await expect(page.locator('iframe[src^="javascript:"]')).toHaveCount(1); // FINDING: an toàn phải là 0
```

- **Kiểm gì:** đưa một chuỗi HTML vào ô search, rồi kiểm **DOM** xem chuỗi đó có bị chèn **nguyên dạng** (thành thẻ `<iframe>` thật) hay đã được **escape** thành text.
- **Rủi ro:** **XSS (Cross-Site Scripting)** — input không được sanitize → chèn được HTML/script chạy trong trình duyệt nạn nhân.
- **OWASP:** A03 – Injection (XSS).
- **App an toàn → sửa assert:** `toHaveCount(0)` (payload bị escape, không có iframe độc).

### 2.5 Lộ thư mục `/ftp` — kiểm **body/dir-listing của một endpoint**

```ts
const res = await request.get('/ftp');
expect(res.status()).toBe(200); // FINDING: an toàn phải là 403/404
expect(await res.text()).toContain('.bak'); // có file backup bị lộ
```

- **Kiểm gì:** gọi thẳng đường dẫn nội bộ `/ftp` và kiểm **status** + **nội dung body** (có liệt kê file `.bak` không).
- **Rủi ro:** **Information disclosure / Security misconfiguration** — thư mục nội bộ bị liệt kê công khai, lộ file nhạy cảm/backup.
- **OWASP:** A05 – Security Misconfiguration.
- **App an toàn → sửa assert:** `expect([403, 404]).toContain(res.status())`.

> Ba loại "công cụ kiểm tra" bạn vừa học, dùng lại được cho mọi security test:
> **(1) status code** (`res.status()`) · **(2) response body** (`res.text()`/`.json()`) · **(3) DOM** (`page.locator(...)`).

---

## 3. Bản đồ OWASP Top 10 — đang cover đâu, còn thiếu đâu

| OWASP 2021                         | Đã có? | Test                                                     |
| ---------------------------------- | ------ | -------------------------------------------------------- |
| A01 Broken Access Control          | ✅     | IDOR (2.3); 401-no-token (trong `basket.api.spec.ts`)    |
| A02 Cryptographic Failures         | ⬜     | _gợi ý: cookie flags, dữ liệu nhạy cảm trong response_   |
| A03 Injection                      | ✅     | SQLi (2.1, 2.2), XSS (2.4)                               |
| A04 Insecure Design                | ⬜     | _khó tự động; review là chính_                           |
| A05 Security Misconfiguration      | 🟡     | `/ftp` (2.5); _thiếu: security headers_                  |
| A06 Vulnerable Components          | ⬜     | _gợi ý: `npm audit` trong CI_                            |
| A07 Identification & Auth Failures | 🟡     | SQLi bypass; _thiếu: JWT tampering, brute-force lockout_ |
| A08 Software/Data Integrity        | ⬜     | —                                                        |
| A09 Logging & Monitoring           | ⬜     | —                                                        |
| A10 SSRF                           | ⬜     | —                                                        |

→ Ô ⬜/🟡 chính là **kế hoạch mở rộng** ở mục 4.

---

## 4. Mở rộng AN TOÀN — vài test nên thêm (template theo đúng style project)

Tất cả đều **defensive**: chỉ **kiểm tra app có phòng thủ đúng không**, không khai thác. Đặt trong `tests/security/security.spec.ts`, tag `@security`.

### 4.1 Security headers (A05) — dễ nhất, không payload

Kiểm app có gửi các header phòng thủ không (CSP, chống clickjacking, chống MIME-sniffing).

```ts
test(
  'response carries defensive security headers',
  { tag: ['@security', '@api', '@regression'] },
  async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    // MẸO: chạy `console.log(h)` một lần để xem app trả gì, rồi chốt assert theo hiện trạng
    //      + comment kỳ vọng an toàn (giống pattern FINDING của các test trên).
    // Kỳ vọng an toàn (app đã vá):
    // expect(h['x-content-type-options']).toBe('nosniff');   // chống MIME-sniffing
    // expect(h['x-frame-options']).toBeDefined();             // chống clickjacking
    // expect(h['content-security-policy']).toBeDefined();     // chống XSS/inject
    expect(res.status()).toBeLessThan(500); // giữ test hợp lệ trong khi bạn khảo sát header
  }
);
```

### 4.2 JWT bị sửa phải bị từ chối (A07/A01) — test này thường **xanh** trên app tốt

Chứng minh server **từ chối token sai chữ ký** (đây là kiểm tra phòng thủ, không phải giả mạo token hợp lệ).

```ts
test(
  'a tampered JWT is rejected',
  { tag: ['@security', '@api', '@regression'] },
  async ({ basketApi, session }) => {
    const tampered = session.token.slice(0, -4) + 'AAAA'; // làm hỏng phần chữ ký
    basketApi.setToken(tampered);
    const res = await basketApi.getRaw(session.bid);
    // Kỳ vọng an toàn: token sai chữ ký PHẢI bị từ chối.
    expect([401, 403]).toContain(res.status());
  }
);
```

### 4.3 Mở rộng "thiếu quyền → từ chối" (A01)

Đã có "đọc giỏ không token → 401" trong `basket.api.spec.ts`. Nhân rộng pattern cho các endpoint cần auth khác (order-history, address, card...): gọi **không kèm token** → assert `401`. Đây là các test **defensive dễ xanh** và tăng coverage nhanh.

### 4.4 Không lộ dữ liệu nhạy cảm trong response (A02/A09) — mức nâng cao

Ý tưởng: sau khi gọi API, kiểm **response body không chứa** trường nhạy cảm (mật khẩu/hash), và **thông báo lỗi không lộ** stack trace/đường dẫn nội bộ.

```ts
test(
  'error responses do not leak internal details',
  { tag: ['@security', '@api', '@regression'] },
  async ({ request }) => {
    const res = await request.get('/rest/products/search'); // gọi thiếu tham số để ép lỗi
    const body = (await res.text()).toLowerCase();
    // Kỳ vọng an toàn: không lộ stack/đường dẫn nội bộ.
    // expect(body).not.toContain('at /juice-shop'); // ví dụ dấu hiệu stack trace
    expect(res.status()).toBeLessThan(600);
  }
);
```

> Quy trình chuẩn khi thêm test loại này: **(1) probe** (chạy thử, `console.log` response) để biết app trả gì → **(2)** viết assert theo hiện trạng + comment kỳ vọng an toàn → **(3)** nếu là lỗ hổng, mở một **bug report** trong `docs/bug-reports/` như [các bug hiện có](../bug-reports/).

---

## 5. Best practices security testing cho QA (nhớ kỹ)

- **Phạm vi & uỷ quyền:** chỉ chạy trên môi trường **bạn sở hữu / được phép** (local Docker, staging của mình). **Không** chạy với site/production của bên thứ ba.
- **Detect + document, không khai thác sâu:** mục tiêu là **phát hiện** lớp lỗ hổng và ghi **bug report**, dùng payload **chuẩn để phát hiện** — không xây chuỗi tấn công thực thụ.
- **Assert hiện trạng + comment kỳ vọng** (app training); với app thật thì **đảo assert** → regression guard.
- **Tách & gắn tag `@security`**, chạy trong `@regression` (nightly), không trộn vào smoke → dễ chọn lọc.
- **QA test không thay pentest/tool chuyên:** đây là lớp **phát hiện nhanh, tự động, hồi quy**. Bổ sung bằng `npm audit` (thành phần), OWASP ZAP (quét động), review thiết kế.
- **Ổn định trước hết:** security test cũng phải deterministic (dữ liệu riêng mỗi test, không phụ thuộc state) như phần còn lại của framework.

---

## 6. Cheat-sheet

- Security test QA = **input đặc biệt / thiếu quyền / endpoint nhạy cảm → ASSERT vs kỳ vọng an toàn**.
- 3 "đầu dò": **status code · response body · DOM**.
- 5 test hiện có: SQLi (API+UI, A03) · IDOR (A01) · DOM XSS (A03) · `/ftp` lộ file (A05).
- App training: assert hành vi lỗi + `// FINDING`; app thật: **đảo assert** thành regression guard.
- Mở rộng dễ & giá trị: **security headers**, **JWT tampering bị từ chối**, **thiếu-token → 401** cho mọi endpoint, **không lộ dữ liệu nhạy cảm**.
- Luôn: **probe trước → assert → bug report**; chỉ chạy nơi được phép; defensive, không khai thác.

> Liên kết: các phát hiện bảo mật được ghi thành [bug reports](../bug-reports/); ánh xạ test→spec trong [test-cases.md](../test-cases.md); chiến lược tổng thể trong [test-strategy.md](../test-strategy.md).
