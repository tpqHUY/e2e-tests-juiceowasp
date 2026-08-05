# Giải thích Quy trình làm việc QA — từ lý thuyết tới project này

> Tài liệu này dành cho người muốn **hiểu quy trình QA chuẩn** chứ không chỉ làm theo checklist. Cặp đôi với [framework-flow-explained.md](../framework-flow-explained.md): file kia dạy **framework chạy ra sao (kỹ thuật)**, file này dạy **công việc QA vận hành ra sao (quy trình)**.
>
> Cùng phong cách: mỗi mục có **(1) là gì**, **(2) ở project này trông ra sao**, **(3) vì sao làm vậy**, **(4) bỏ qua thì hỏng gì**.
>
> 🔗 [workflow/README.md](./README.md) là **bản tra cứu ngắn** của cùng nội dung — đọc file này để _hiểu_, đọc file kia để _tra nhanh khi làm_.

---

## 1. Bức tranh tổng thể — hai trục lồng nhau

Người mới hay nhầm "quy trình QA" là một danh sách bước duy nhất. Thực tế có **hai trục khác nhau chạy đồng thời**, và bạn phải phân biệt được:

|          | **Trục dọc — STLC**                                 | **Trục ngang — nhịp Agile**            |
| -------- | --------------------------------------------------- | -------------------------------------- |
| Trả lời  | "Một **việc kiểm thử** đi qua những giai đoạn nào?" | "**Nhóm** phối hợp theo nhịp nào?"     |
| Đơn vị   | Một tính năng / một ticket                          | Một sprint (2 tuần)                    |
| Thuộc về | Nghề QA (không đổi dù công ty nào)                  | Cách tổ chức làm việc (Scrum/Kanban/…) |
| Ví dụ    | plan → design → implement → execute → report        | planning → build → review → retro      |

**STLC (Software Testing Life Cycle)** — vòng đời kiểm thử, 6 giai đoạn:

```
1. Test planning      → phạm vi, rủi ro, nguồn lực, tiêu chí        (docs/test-strategy.md)
2. Test analysis      → đọc yêu cầu, tìm cái gì cần kiểm            (điều kiện kiểm thử)
3. Test design        → biến điều kiện thành test case cụ thể       (docs/test-cases.md)
4. Test implementation→ viết code automation, dựng dữ liệu/môi trường (tests/, src/)
5. Test execution     → chạy, ghi kết quả, báo lỗi                  (CI + Allure)
6. Test closure       → tổng kết, số liệu, bài học                  (docs/workflow/metrics.md)
```

**Vì sao phải tách hai trục:** khi phỏng vấn hỏi _"quy trình test của bạn thế nào?"_, câu trả lời yếu là kể lể "tôi nhận task, viết test, chạy, báo bug". Câu trả lời mạnh là chỉ ra bạn biết **giai đoạn nào tạo ra artifact nào** và **ai duyệt nó** — tức là bạn hiểu STLC, chứ không chỉ hiểu thao tác.

**Bỏ qua thì hỏng gì:** nhảy thẳng từ "có yêu cầu" sang "viết code test" là bỏ mất giai đoạn 2–3. Hậu quả điển hình: test viết ra bám vào cái _dễ automate_ thay vì cái _rủi ro cao_, và không ai truy được vì sao lại có test đó.

---

## 2. Từ điển thuật ngữ — giải thích bằng chính repo này

Đây là những từ [README.md](./README.md) dùng luôn mà không định nghĩa. Học thuộc nghĩa **và** ví dụ tương ứng:

| Thuật ngữ                                 | Nghĩa                                                                             | Ở project này                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Backlog**                               | Kho việc chưa làm, đã xếp ưu tiên                                                 | [backlog.md](./backlog.md) — danh sách flow chưa test        |
| **Refinement** (grooming)                 | Buổi làm rõ ticket _trước khi_ đưa vào sprint                                     | Chưa có (một mình) — thay bằng tự viết acceptance criteria   |
| **Sprint**                                | Chu kỳ làm việc cố định, có mục tiêu                                              | 2 tuần, là một GitHub **Milestone**                          |
| **Milestone**                             | Nhãn nhóm các issue thuộc cùng một mốc                                            | Ánh xạ 1–1 với sprint                                        |
| **WIP** (Work In Progress)                | Số việc đang làm dở cùng lúc                                                      | Nguyên tắc: xong cái đang làm rồi mới bắt cái mới            |
| **DoR** (Definition of Ready)             | Điều kiện để ticket _được phép_ bắt đầu                                           | Có acceptance criteria + priority + biết phụ thuộc           |
| **DoD** (Definition of Done)              | Điều kiện để ticket _được coi là xong_                                            | [README.md §4](./README.md) — CI xanh, traceability updated… |
| **Acceptance criteria**                   | Điều kiện nghiệm thu, viết dạng kiểm được                                         | "Đăng ký thiếu security question → nút Register disabled"    |
| **Triage**                                | Buổi/động tác phân loại bug mới: thật không, nghiêm trọng cỡ nào, ai làm, bao giờ | Ở đây là lúc gán Severity + Priority + label                 |
| **Quarantine**                            | Cách ly test bất ổn khỏi cổng CI, nhưng vẫn chạy để theo dõi                      | Tag `@flaky`, CI gate dùng `--grep-invert @flaky`            |
| **Flaky**                                 | Test lúc xanh lúc đỏ dù code không đổi                                            | [flaky-policy.md](./flaky-policy.md)                         |
| **RCA** (Root Cause Analysis)             | Truy nguyên nhân gốc, không dừng ở triệu chứng                                    | Bảng 5 nhóm nguyên nhân trong flaky-policy                   |
| **Branch protection**                     | Luật GitHub chặn push thẳng vào `main`                                            | Bắt buộc PR + check `checks` và `smoke` xanh                 |
| **Squash-merge**                          | Gộp mọi commit của nhánh thành **một** commit khi merge                           | Giữ lịch sử `main` sạch: 1 ticket = 1 commit                 |
| **RTM** (Requirement Traceability Matrix) | Bảng nối yêu cầu ↔ test case ↔ code test                                          | [test-cases.md](../test-cases.md) chính là RTM               |
| **Entry / Exit criteria**                 | Điều kiện để _bắt đầu_ / _kết thúc_ một đợt test                                  | Xem §7 bên dưới                                              |
| **Shift-left**                            | Kiểm thử sớm nhất có thể trong vòng đời                                           | Ở đây: lint/typecheck/unit chạy trước cả E2E                 |
| **Test pyramid**                          | Nhiều unit, vừa API, ít UI — vì càng lên cao càng chậm & giòn                     | Repo này: 9 unit → 32 API → còn lại UI                       |

> 💡 **Mẹo học:** mỗi lần gặp thuật ngữ lạ khi đi làm, hỏi ngay 2 câu — _"nó tạo ra artifact gì?"_ và _"ai là người duyệt?"_. Trả lời được là hiểu, không phải học vẹt.

---

## 3. Hành trình một ticket — xương sống của cả quy trình

Đây là phần quan trọng nhất. Bám theo **một** ticket từ lúc sinh ra tới lúc đóng, bạn sẽ thấy mọi mảnh rời rạc ở `README.md` ráp vào đâu.

Lấy ví dụ thật từ [backlog.md](./backlog.md): _"Contact / complaint form (rating + captcha) chưa được test"_.

```
[1] Sinh ra      → [2] Refinement  → [3] Ready      → [4] Nhận việc
      ↓                                                     ↓
[8] Đóng ticket ← [7] Merge        ← [6] Review     ← [5] Làm việc
      ↓
[9] Vào metrics
```

### Bước 1 — Ticket sinh ra

**Là gì:** một nhu cầu được ghi lại thành issue. Nguồn có thể là: backlog có sẵn, bug vừa phát hiện, dev báo đổi API, Dependabot mở PR, hoặc test bị flaky.

**Ở project này:** tạo GitHub Issue từ 1 trong 4 template trong `.github/ISSUE_TEMPLATE/` → gắn label `type/feature-test` + `priority/P1` + `area/*`. Vào cột **Backlog**.

**Vì sao phải là ticket, không phải "nhớ trong đầu":** ticket là **đơn vị kế toán** của công việc. Không có ticket thì không đo được throughput, không truy được vì sao code này tồn tại, và công sức bạn bỏ ra trở nên vô hình khi review hiệu suất.

**Bỏ qua thì hỏng gì:** cuối sprint không ai trả lời được "chúng ta đã làm gì" ngoài việc mở git log ra đọc — mà git log chỉ ghi _cái gì đã đổi_, không ghi _vì sao_.

### Bước 2 — Refinement: làm rõ trước khi làm

**Là gì:** biến một câu mơ hồ thành thứ kiểm được. Đây là **test analysis** (STLC giai đoạn 2) diễn ra sớm.

**Ở project này (một mình):** tự trả lời 4 câu và ghi vào ticket:

1. **Phạm vi:** test những gì, _không_ test những gì?
2. **Acceptance criteria:** điều kiện nào chứng minh là xong?
3. **Rủi ro:** hỏng ở đây thì ảnh hưởng gì? (quyết định priority)
4. **Phụ thuộc:** cần fixture/dữ liệu/quyền gì chưa có?

**Vì sao đây là giá trị lớn nhất của QA:** ở công ty thật, refinement là lúc QA **hỏi những câu làm lộ lỗ hổng trong yêu cầu** — trước khi dev viết một dòng code nào. _"Nếu user gửi form 2 lần liên tiếp thì sao?"_, _"rating để trống có hợp lệ không?"_. Một bug chặn ở đây rẻ hơn bug tìm thấy sau khi lên production hàng chục lần. **Đây chính là shift-left.**

**Bỏ qua thì hỏng gì:** làm xong mới phát hiện hiểu sai yêu cầu → viết lại từ đầu. Hoặc tệ hơn: test xanh nhưng test sai thứ.

### Bước 3 — Ready

**Là gì:** cổng chất lượng đầu vào. Ticket chỉ được kéo vào sprint khi thoả **DoR**.

**Ở project này:** cột `Ready` trên board. Điều kiện: có acceptance criteria rõ, có priority, biết phụ thuộc.

**Vì sao cần cổng này:** không có nó, người ta bắt tay vào ticket mơ hồ rồi kẹt giữa chừng chờ câu trả lời — công việc dở dang chất đống (WIP cao) mà không có gì hoàn thành.

### Bước 4 — Nhận việc

**Ở project này:** kéo issue sang `In progress`, tạo nhánh theo quy ước:

```bash
git switch -c feat/12-contact-form-coverage    # feat/ fix/ flaky/ chore/
```

**Vì sao tên nhánh có số ticket:** 6 tháng sau nhìn lại nhánh/commit, bạn lần ngược được về ticket → về lý do. Đây là **traceability** ở mức thấp nhất.

### Bước 5 — Làm việc: test design → implementation

Đây là nơi STLC giai đoạn 3–4 diễn ra. **Thứ tự đúng là design trước, code sau** (chi tiết kỹ thuật thiết kế ở §5):

1. **Viết test case trước** (dạng bảng, vào [test-cases.md](../test-cases.md)) — nghĩ bằng đầu, chưa cần IDE.
2. **Probe app thật** nếu chưa rõ selector/endpoint — ghi phát hiện vào [exploratory-notes.md](../exploratory-notes.md).
3. **Code test** theo kiến trúc sẵn có (POM + fixture + API client).
4. **Gắn tag** đúng: `@smoke` / `@regression` / `@security`… — tag quyết định test chạy ở CI nào.
5. **Chạy local**: `npm run typecheck && npm run lint && npm run test:unit` + suite liên quan.

**Vì sao viết test case trước khi code:** viết code trước thì bạn sẽ vô thức chỉ test **cái mà framework hiện tại dễ làm**. Viết case trước ép bạn nghĩ theo **rủi ro của nghiệp vụ**, rồi mới hỏi "framework có đủ sức làm không" — nếu không thì đó là một ticket tech-debt mới, hoàn toàn hợp lệ.

### Bước 6 — Pull Request & review

**Ở project này:** mở PR, điền `.github/pull_request_template.md`, link `Closes #12`. CI tự chạy `checks` + `smoke`.

**Self-review trước khi nhờ người khác:** đọc lại diff của chính mình **như thể bạn là người review**. Kinh nghiệm thực tế: 30–50% góp ý bạn tự bắt được, và uy tín của bạn tăng lên vì reviewer không phải nhặt lỗi vặt.

**Vì sao 1 ticket = 1 PR nhỏ:** PR 50 dòng được review kỹ trong 10 phút; PR 800 dòng nhận về "LGTM 👍" — tức là **không ai thật sự đọc**. PR nhỏ cũng dễ revert khi có sự cố.

**Bỏ qua thì hỏng gì:** PR gộp 5 việc, CI đỏ, không biết việc nào gây ra; revert thì mất luôn 4 việc kia.

### Bước 7 — Merge

**Ở project này:** CI xanh → **squash-merge** → xoá nhánh. Branch protection không cho bỏ qua bước nào.

**Vì sao squash:** `main` giữ đúng 1 commit cho 1 ticket, đọc `git log` là đọc được lịch sử _quyết định_, không phải lịch sử _lần mò_ ("fix typo", "thử lại", "wip").

### Bước 8 — Đóng ticket & kiểm DoD

Trước khi đóng, đối chiếu checklist DoD ở [README.md §4](./README.md). Điểm hay bị quên nhất: **cập nhật traceability** (`test-cases.md`) và **ADR nếu là quyết định cấu trúc**.

### Bước 9 — Vào số liệu

Cuối sprint, ticket này thành một dòng trong [metrics.md](./metrics.md): coverage added, bug found/fixed, flake rate. **Test closure** (STLC giai đoạn 6) chính là đây.

**Vì sao giai đoạn này hay bị bỏ và vì sao đừng bỏ:** nó không tạo ra code nên cảm giác "vô ích". Nhưng đây là thứ duy nhất trả lời được câu hỏi của sếp: _"chất lượng đang tốt lên hay xấu đi?"_ — một snapshot không trả lời được, chỉ có **xu hướng theo thời gian** mới trả lời được.

---

## 4. Vòng đời một bug — chi tiết hơn ticket thường

Bug có vòng đời riêng, phức tạp hơn feature vì có thêm **tranh luận** và **xác minh**.

```
phát hiện → tái hiện → report → triage → (dev fix) → verify → regression test → close
                ↑                  │
                └── không tái hiện ─┘  hoặc  ↓ rejected → bug advocacy
```

### 4.1 Tái hiện trước khi report

Một bug không tái hiện được là một bug **sẽ bị đóng** với lý do "cannot reproduce". Trước khi viết report, xác định:

- **Các bước tối thiểu** — bỏ hết bước thừa. 3 bước tốt hơn 10 bước.
- **Điều kiện cần** — tài khoản mới hay cũ? trình duyệt nào? dữ liệu gì?
- **Tần suất** — luôn luôn, hay 1/5 lần? (nếu ngẫu nhiên → cân nhắc đây là _flaky_, xem §4.6)

### 4.2 Report — cấu trúc chuẩn

Xem mẫu thật: [BUG-002](../bug-reports/BUG-002-card-expiry-year-min.md). Một bug report tốt luôn có:

| Phần                    | Vì sao cần                                                                 |
| ----------------------- | -------------------------------------------------------------------------- |
| **Tiêu đề**             | Mô tả _triệu chứng_, không phải _phỏng đoán nguyên nhân_                   |
| **Môi trường**          | Juice Shop `v17.1.1` / Docker / chromium — bug thường phụ thuộc môi trường |
| **Steps to reproduce**  | Tối thiểu, đánh số, ai đọc cũng làm lại được                               |
| **Expected vs Actual**  | **Bắt buộc tách đôi.** Thiếu "expected" thì dev sẽ cãi "nó vốn thế"        |
| **Evidence**            | Screenshot / response body / trace — bằng chứng, không phải lời kể         |
| **Severity + Priority** | Hai trường tách biệt (xem [README.md §1](./README.md))                     |

**Nguyên tắc vàng:** report mô tả **cái quan sát được**, không phải **cái bạn đoán**. Viết "API trả 200 kèm JWT hợp lệ" thay vì "chắc là thiếu validate ở backend" — vì phỏng đoán sai làm mất uy tín của cả report đúng.

### 4.3 Triage — gán Severity và Priority

Đây là lúc **hai trục tách nhau** (bảng đầy đủ ở [README.md §1](./README.md)). Ví dụ thật trong repo:

| Bug                                                                     | Severity | Priority | Vì sao lệch nhau                                            |
| ----------------------------------------------------------------------- | -------- | -------- | ----------------------------------------------------------- |
| [BUG-004](../bug-reports/BUG-004-sqli-login.md) SQLi                    | Critical | P1       | Bypass xác thực — nghiêm trọng _và_ gấp                     |
| [BUG-001](../bug-reports/BUG-001-registration-drops-security-answer.md) | High     | P2       | Mất dữ liệu thật, nhưng ở luồng khôi phục tài khoản ít dùng |
| [BUG-002](../bug-reports/BUG-002-card-expiry-year-min.md) expiry ≥ 2080 | Medium   | P3       | Chặn thanh toán thật, nhưng có workaround hiển nhiên        |

### 4.4 Khi dev từ chối bug — "bug advocacy"

**Là gì:** kỹ năng **bảo vệ** một bug đáng sửa, khi phản hồi là _"works as designed"_ / _"edge case thôi"_ / _"user không làm thế đâu"_.

**Cách làm đúng — chuyển từ tranh luận đúng-sai sang trình bày tác động:**

1. **Đừng cãi về nguyên nhân** — đó là sân của dev. Cãi về **hậu quả** — đó là sân của bạn.
2. **Quy ra người dùng và tiền:** "form này nằm trên luồng thanh toán, ~X% đơn đi qua đây".
3. **Đưa bằng chứng mới** thay vì lặp lại lập luận cũ: log, số liệu, hoặc một kịch bản tái hiện thực tế hơn.
4. **Chấp nhận "sẽ không sửa" một cách chuyên nghiệp** — nhưng yêu cầu ghi lại quyết định (dạng _known issue_). Bug bị đóng có chủ đích ≠ bug bị lãng quên.

**Bỏ qua thì hỏng gì:** QA im lặng khi bị bác → bug quay lại ở production → lúc đó câu hỏi là "sao QA không phát hiện?" trong khi bạn đã phát hiện rồi. **Không có ghi chép = không có phát hiện.**

### 4.5 Verify và khoá lại bằng regression test

Bug được fix **chưa phải là xong**. Hai việc bắt buộc:

1. **Verify** trên đúng môi trường/bản build đã fix, bằng đúng steps trong report.
2. **Viết regression test khoá lại** — để bug không sống lại lần nữa.

**Ở project này có một biến thể đặc biệt đáng học:** Juice Shop **cố tình có lỗ hổng**, không ai fix cả. Nên các test security assert **hành vi hiện tại (đang lỗi)** kèm comment `// FINDING:` ghi rõ hành vi an toàn _đúng ra_ phải là gì — xem [ADR-0005](../adr/0005-security-tests-assert-current-behaviour.md). Ở app thật đã vá, bạn chỉ cần **đảo assert** là test biến thành regression guard.

### 4.6 Phân biệt: bug thật hay test flaky?

Rất nhiều người mới báo nhầm hai loại này. Phân biệt:

|             | Bug thật                     | Flaky test                                                       |
| ----------- | ---------------------------- | ---------------------------------------------------------------- |
| Tái hiện    | Ổn định theo steps           | Ngẫu nhiên, cùng input khác kết quả                              |
| Nguyên nhân | Ở **app**                    | Thường ở **test** (race, dữ liệu dùng chung, thiếu wait)         |
| Xử lý       | Bug report + regression test | [flaky-policy.md](./flaky-policy.md): quarantine → RCA → fix gốc |

Hai ca thật trong repo (ghi ở week-5 log): **Firefox account-menu race** — test chứ không phải app; và **WebKit stock depletion** — môi trường (Juice Shop hết hàng do chạy nhiều), giải bằng `npm run app:reset`.

> ⚠️ **Cấm kỵ:** "sửa" flaky bằng cách tăng retry hoặc thêm `waitForTimeout`. Đó là che triệu chứng — và một pipeline mà mọi người quen với chuyện đỏ là một pipeline đã chết.

---

## 5. Kỹ thuật thiết kế test — soi vào test có sẵn

Đây là STLC giai đoạn 3, và là phần **hay bị hỏi nhất khi phỏng vấn**. Bốn kỹ thuật cơ bản, mỗi cái kèm ví dụ thật trong repo:

### 5.1 Equivalence Partitioning (phân vùng tương đương)

**Là gì:** chia miền đầu vào thành các **nhóm mà mọi giá trị trong nhóm cho cùng kết quả**. Test 1 đại diện mỗi nhóm là đủ — không cần test 1000 giá trị.

**Ví dụ trong repo** — `tests/ui/catalog/search.spec.ts`:

- Nhóm hợp lệ → `searching for a known keyword shows matching products`
- Nhóm không khớp → `searching for a nonsense term shows no products`

Hai test, phủ hai vùng. Test thêm 50 từ khoá hợp lệ nữa **không tăng thêm thông tin gì**.

**Vì sao mạnh:** đây là lập luận để bạn trả lời câu "sao không test nhiều case hơn?" — không phải vì lười, mà vì **các case đó tương đương nhau**.

### 5.2 Boundary Value Analysis (phân tích giá trị biên)

**Là gì:** lỗi hay nằm ở **ranh giới** giữa hai vùng, không nằm ở giữa vùng. Nên test tại biên và sát biên.

**Ví dụ trong repo** — chính là [BUG-002](../bug-reports/BUG-002-card-expiry-year-min.md): validator thẻ chỉ chấp nhận `expYear >= 2080`. Biên ở đây là **2080**:

| Giá trị | Vùng           | Kết quả       |
| ------- | -------------- | ------------- |
| 2079    | ngay dưới biên | ❌ bị từ chối |
| 2080    | tại biên       | ✅ chấp nhận  |

Chính vì test tại biên mà phát hiện được rằng biên **đặt sai chỗ** — năm hết hạn thẻ thực tế là 2026–2035, không ai có thẻ hết hạn 2080.

### 5.3 Decision Table (bảng quyết định)

**Là gì:** khi kết quả phụ thuộc **tổ hợp nhiều điều kiện**, lập bảng mọi tổ hợp để không sót.

**Ví dụ trong repo** — `the review step cannot be reached until a payment card is selected`:

| Địa chỉ | Phương thức giao | Thẻ | → Sang bước Review?       |
| ------- | ---------------- | --- | ------------------------- |
| ✅      | ✅               | ✅  | Được                      |
| ✅      | ✅               | ❌  | **Không** ← test này khoá |
| ✅      | ❌               | –   | Không                     |
| ❌      | –                | –   | Không                     |

### 5.4 State Transition (chuyển trạng thái)

**Là gì:** đối tượng có nhiều trạng thái và các phép chuyển giữa chúng — test các phép chuyển, kể cả chuyển không hợp lệ.

**Ví dụ trong repo** — `tests/ui/basket/basket.spec.ts` phủ đúng vòng đời giỏ hàng:

```
rỗng ──add──▶ 1 dòng ──add lại──▶ vẫn 1 dòng, qty=2   (không tạo dòng thứ 2)
                 │                      │
              remove                 increase/decrease
                 ▼                      ▼
               rỗng                 tổng tiền cập nhật
```

Cộng thêm một phép chuyển đặc biệt: `the basket survives a page reload` — trạng thái phải **bền qua reload**.

### 5.5 Error Guessing & Exploratory

**Là gì:** dùng kinh nghiệm đoán chỗ dễ hỏng, không theo công thức. Không thay thế 4 kỹ thuật trên — **bổ sung** cho chúng.

**Ví dụ trong repo:** toàn bộ [exploratory-notes.md](../exploratory-notes.md) sinh ra từ giai đoạn này — trong đó có phát hiện quý: endpoint thật là `/api/Addresss` (ba chữ `s`, lỗi chính tả của app). Không kỹ thuật formal nào tìm ra được thứ đó; chỉ có **mở DevTools và nhìn** mới thấy.

---

## 6. Ai quyết cái gì — và các buổi họp

Ở project cá nhân bạn đóng mọi vai. Nhưng phải biết **ranh giới vai trò**, vì đi làm là bước vào một bàn cờ có sẵn người.

| Quyết định              | Người quyết                 | QA đóng vai gì                                  |
| ----------------------- | --------------------------- | ----------------------------------------------- |
| Làm tính năng nào trước | PO / PM                     | Cung cấp **thông tin rủi ro** để họ quyết       |
| **Severity** của bug    | **QA**                      | Chủ trì — dựa trên bằng chứng kỹ thuật          |
| **Priority** của bug    | PO (đôi khi cùng tech lead) | Tư vấn, phản biện — nhưng không phải người chốt |
| Sửa bug thế nào         | Dev                         | Xác minh kết quả, không chỉ đạo cách sửa        |
| Release được chưa       | PO / release manager        | Cung cấp **exit criteria + known issues**       |
| Test cái gì, ở tầng nào | **QA**                      | Chủ trì hoàn toàn — đây là chuyên môn của bạn   |

**Các nghi thức và mục đích thật của chúng:**

| Buổi              | Mục đích thật                | QA đóng góp gì                                            |
| ----------------- | ---------------------------- | --------------------------------------------------------- |
| **Planning**      | Chốt sprint làm gì           | Cảnh báo việc nào rủi ro/tốn test hơn vẻ ngoài            |
| **Refinement**    | Làm rõ ticket trước khi làm  | **Đặt câu hỏi làm lộ lỗ hổng yêu cầu** — giá trị lớn nhất |
| **Daily standup** | Đồng bộ + phát hiện blocker  | Nêu sớm cái đang chặn, không phải báo cáo thành tích      |
| **Bug triage**    | Phân loại bug mới            | Trình bày severity kèm bằng chứng                         |
| **Review / demo** | Cho stakeholder thấy kết quả | Trình bày trạng thái chất lượng, không chỉ "test pass"    |
| **Retro**         | Cải thiện **cách làm việc**  | Nêu ma sát trong quy trình (vd: môi trường test hay chết) |

> 💡 **Điều người mới hay vỡ mộng:** phần lớn thời gian QA ở công ty **không phải viết code test** — mà là đọc yêu cầu, đặt câu hỏi, thương lượng phạm vi, giải thích rủi ro. Code chỉ là công cụ thi hành. Repo này rèn phần công cụ; §6 này là phần bạn phải học ngoài repo.

---

## 7. Entry / Exit criteria — cổng vào và cổng ra

Khái niệm chuẩn hay bị bỏ qua, nhưng hỏi phỏng vấn rất nhiều.

**Entry criteria** — đủ điều kiện để _bắt đầu_ một đợt test:

- Build đã deploy được lên môi trường test và chạy được (ở đây: `docker compose up` + `wait-for-app` xanh)
- Smoke test cơ bản qua — nếu login còn hỏng thì test sâu hơn là vô nghĩa
- Test case đã sẵn sàng, dữ liệu/tài khoản đã có

**Vì sao cần:** không có entry criteria, QA nhận một build vỡ và tốn cả ngày báo 30 bug đều xuất phát từ **một** nguyên nhân. Gọi là _"smoke test gate"_ — đây chính là lý do repo này tách suite `@smoke` chạy mỗi push.

**Exit criteria** — đủ điều kiện để _kết thúc_ và nói "test xong":

- Toàn bộ test case đã lập kế hoạch đã chạy (không phải "đã pass" — đã **chạy**)
- Không còn bug `Critical`/`High` mở, hoặc đã có quyết định chấp nhận có ghi chép
- Danh sách **known issues** đã lập
- Pass rate và flake rate đạt ngưỡng đã thoả thuận

**Điểm tinh tế đáng nhớ:** exit criteria **không bao giờ** là "không còn bug nào". Không thể chứng minh phần mềm không còn bug — chỉ có thể chứng minh **đã tìm đủ kỹ theo mức rủi ro chấp nhận được**. Nói được ý này khi phỏng vấn là dấu hiệu của người hiểu nghề.

---

## 8. Khác biệt: project cá nhân vs công ty thật

Học repo này rất tốt, nhưng phải biết **cái gì không có ở đây** để khỏi bỡ ngỡ:

|                     | Project này                                | Công ty thật                                                                        |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| **Nguồn công việc** | Tự tạo issue từ backlog tự seed            | PO/khách hàng/support/production incident đẩy vào — **bạn không kiểm soát đầu vào** |
| **Áp lực**          | Không deadline → luôn làm chuẩn được       | Deadline ép cắt scope; kỹ năng thật là **thương lượng cái gì bỏ được**              |
| **App under test**  | Pin `v17.1.1`, ổn định, cố tình có lỗ hổng | Đổi mỗi ngày; test hỏng vì dev đổi UI chứ không phải vì bug                         |
| **Môi trường**      | Docker local, sạch, reset được             | Staging dùng chung, dữ liệu bẩn, service phụ thuộc chết — **nguồn flake số 1**      |
| **Review**          | Self-review                                | Người khác review, phản biện thiết kế test                                          |
| **Bug**             | Tự tìm, tự report, tự "verify"             | Dev có thể **từ chối** — phải biết bug advocacy (§4.4)                              |
| **Vai trò**         | Một mình đóng hết                          | Tách bạch; phần lớn thời gian là **giao tiếp**                                      |
| **Metrics**         | Để trưng bày                               | Bị dùng để đánh giá con người → có động cơ bóp méo số liệu                          |

> **Cách nói khi phỏng vấn:** đừng trình bày repo này như "quy trình tôi đã vận hành trong team". Hãy nói: _"tôi tự dựng lại toàn bộ vòng đời QA để hiểu từng mắt xích — tôi biết rõ cái gì mình đã thực hành thật và cái gì mới ở mức mô phỏng."_ Trung thực hơn, và người phỏng vấn có kinh nghiệm sẽ đánh giá cao chính sự phân định đó.

---

## 9. Q&A phỏng vấn

**Q: Quy trình test của bạn thế nào?**
Trả lời theo **STLC**, không kể thao tác: planning (chiến lược + rủi ro) → analysis (làm rõ yêu cầu, đặt câu hỏi) → design (test case bằng kỹ thuật formal) → implementation → execution (CI) → closure (metrics). Rồi nói nó lồng vào nhịp sprint 2 tuần ra sao.

**Q: Severity và Priority khác nhau thế nào?**
Severity = mức độ tác động kỹ thuật, **QA** quyết dựa trên bằng chứng. Priority = mức độ gấp phải sửa, **PO** quyết dựa trên bối cảnh kinh doanh. Cho ví dụ lệch nhau: BUG-001 trong repo là `High` nhưng chỉ `P2` vì nằm ở luồng khôi phục tài khoản ít dùng.

**Q: Test bị flaky thì làm gì?**
Quarantine ngay (tag `@flaky`, ra khỏi cổng CI nhưng vẫn chạy để theo dõi) → RCA theo nhóm nguyên nhân → fix ở gốc → chạy lại 3 lần xanh mới gỡ quarantine. **Không bao giờ** tăng retry để chữa. Lý do: pipeline đỏ mà mọi người quen bỏ qua thì tệ hơn không có pipeline.

**Q: Khi nào thì dừng test?**
Khi đạt exit criteria đã thoả thuận trước — không phải khi hết bug (không thể chứng minh hết bug). Nêu: đã chạy hết case theo kế hoạch, không còn Critical/High mở hoặc đã được chấp nhận có ghi chép, đã lập known issues.

**Q: Dev bảo "đây không phải bug" thì sao?**
Chuyển từ tranh luận nguyên nhân sang trình bày **tác động** lên người dùng; đưa bằng chứng mới thay vì lặp lại lập luận cũ; nếu vẫn quyết định không sửa thì yêu cầu **ghi lại thành known issue**. Bug bị đóng có chủ đích khác hoàn toàn bug bị lãng quên.

**Q: Làm sao chọn test ở tầng nào (unit/API/UI)?**
Theo **test pyramid**: đẩy xuống tầng thấp nhất còn trả lời được câu hỏi. Logic thuần → unit. Quy tắc nghiệp vụ/quyền → API. Chỉ những gì thật sự cần con mắt người dùng mới lên UI. Repo này minh hoạ luôn: giỏ hàng thao tác trên UI nhưng **xác minh bằng API** — vừa đúng ý nghĩa người dùng, vừa ổn định.

**Q: Bạn đo chất lượng bằng gì?**
Pass rate, flake rate, số `@flaky` đang quarantine, bug found/fixed, MTTR, coverage added, thời lượng suite — xem [metrics.md](./metrics.md). Nhấn mạnh: giá trị nằm ở **xu hướng theo thời gian**, không phải con số một lần.

---

## 10. Tóm tắt — 7 nguyên tắc mang đi được

Bỏ hết GitHub/Playwright đi, còn lại đây là thứ dùng được ở mọi công ty:

1. **Truy vết được** — mọi thay đổi lần ngược được về một lý do: yêu cầu → test case → code → CI → ticket. Không có việc "mồ côi".
2. **Một nguồn sự thật** — mỗi thông tin sống ở đúng một chỗ; chỗ khác chỉ link tới.
3. **Cổng chất lượng thay vì thiện chí** — Ready/Done là checklist máy kiểm được. Cái gì không tự động chặn được thì sớm muộn cũng bị bỏ qua.
4. **Ưu tiên theo rủi ro** — không test đều tay; dồn vào chỗ hỏng thì đau nhất.
5. **Phản hồi nhanh trước, đầy đủ sau** — smoke mỗi push, regression đầy đủ ban đêm. Feedback chậm là feedback không ai đọc.
6. **Sửa gốc, không che triệu chứng** — flaky thì RCA, bug thì khoá bằng regression test.
7. **Bằng chứng, không cảm tính** — và số liệu phải trung thực kể cả khi xấu.

Ba nguyên tắc đầu là **cấu trúc**, ba tiếp theo là **kinh tế của việc test** (thời gian và rủi ro luôn hữu hạn), nguyên tắc cuối là **đạo đức nghề**.

---

## Đọc tiếp

| Muốn hiểu                          | Đọc                                                           |
| ---------------------------------- | ------------------------------------------------------------- |
| Framework chạy ra sao (kỹ thuật)   | [framework-flow-explained.md](../framework-flow-explained.md) |
| Bản tra cứu ngắn của quy trình này | [workflow/README.md](./README.md)                             |
| Chiến lược & phạm vi test          | [test-strategy.md](../test-strategy.md)                       |
| Ma trận truy vết (RTM)             | [test-cases.md](../test-cases.md)                             |
| Xử lý test bất ổn                  | [flaky-policy.md](./flaky-policy.md)                          |
| Vì sao kiến trúc lại thế           | [ADRs](../adr/)                                               |
