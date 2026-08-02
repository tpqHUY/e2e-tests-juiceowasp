# BUG-006 — CAPTCHA answer leaked in the challenge response

| Field       | Value                                       |
| ----------- | ------------------------------------------- |
| ID          | BUG-006                                     |
| Type        | Security (Insecure Design / CAPTCHA Bypass) |
| Severity    | Medium                                      |
| Priority    | P2                                          |
| Component   | Feedback / CAPTCHA                          |
| Environment | OWASP Juice Shop v17.1.1 (Docker), REST API |
| Status      | Open (intentional in Juice Shop)            |

## Summary

`GET /rest/captcha` returns the correct solved `answer` alongside the
question (`captcha`) and `captchaId` in the same JSON response. A client
never has to solve the arithmetic expression — it can read `answer` directly
from the response and submit it back in `POST /api/Feedbacks`, defeating the
purpose of the CAPTCHA (distinguishing a human from an automated client).

## Preconditions

- Juice Shop reachable at `http://localhost:3000`.

## Steps to Reproduce

**API:**

```bash
curl -s http://localhost:3000/rest/captcha
# => {"captchaId":45,"captcha":"4*9+3","answer":"39"}

curl -s -X POST http://localhost:3000/api/Feedbacks \
  -H "Content-Type: application/json" \
  -d '{"comment":"automated","rating":5,"captchaId":45,"captcha":"39"}'
# => 201 Created — feedback accepted, no human ever solved "4*9+3"
```

Discovered while writing a k6 load test for the feedback flow
([perf/k6/search-and-feedback.js](../../perf/k6/search-and-feedback.js)):
the script only works because it reads `answer` straight from the captcha
response — there was never a need to evaluate the expression client-side.

## Expected Result

The captcha response should only expose `captchaId` and the question
(`captcha`); `answer` should be kept server-side and checked against the
value submitted with the feedback.

## Actual Result

The solved `answer` is returned in the same response as the question,
letting any scripted client bypass the CAPTCHA with zero effort — no OCR,
no arithmetic parsing, no retries needed.

## Impact

The feedback form's anti-spam/anti-automation control provides no real
protection: a trivial script can flood `POST /api/Feedbacks` at whatever
rate the server allows, same as if no CAPTCHA existed at all. Severity is
Medium rather than Critical because the endpoint it protects (feedback
comments) is low-value compared to e.g. auth (BUG-004).

## Suggested Fix

Never return the solved `answer` to the client. Store it server-side keyed
by `captchaId` (already the case — see `CaptchaModel`), and only return
`captchaId` + the question string from `GET /rest/captcha`.

## Automated coverage

`perf/k6/search-and-feedback.js` exercises this path for load testing
purposes (it depends on reading `answer` to reach `POST /api/Feedbacks`
successfully) but does not assert on the leak itself. No dedicated
functional/security test asserts `answer` is absent from the response yet —
candidate for a follow-up test in `tests/security/security.spec.ts`.
