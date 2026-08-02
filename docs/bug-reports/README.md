# Bug Reports

JIRA-style defect reports raised while testing OWASP Juice Shop `v17.1.1`
(Docker). Each demonstrates manual-QA reporting alongside the automation and,
where applicable, links to the automated test that covers it.

> Note: OWASP Juice Shop is intentionally vulnerable software. The security
> findings (BUG-003/004/005) are reported here as a QA exercise; they are
> confirmed against a locally-run instance, not any third-party system.

> 📘 Muốn hiểu cách các test bảo mật này hoạt động & cách viết thêm (defensive):
> [docs/setup/security-testing.md](../setup/security-testing.md).

| ID                                                       | Title                                                  | Type       | Severity | Priority | Automated  |
| -------------------------------------------------------- | ------------------------------------------------------ | ---------- | -------- | -------- | ---------- |
| [BUG-001](BUG-001-registration-drops-security-answer.md) | Registration API silently discards the security answer | Functional | High     | P2       | ✅         |
| [BUG-002](BUG-002-card-expiry-year-min.md)               | Payment card rejected for any expiry year below 2080   | Functional | Medium   | P3       | ✅         |
| [BUG-003](BUG-003-idor-basket.md)                        | IDOR: a user can read another user's basket            | Security   | Critical | P1       | ✅         |
| [BUG-004](BUG-004-sqli-login.md)                         | SQL injection in login bypasses authentication         | Security   | Critical | P1       | ✅         |
| [BUG-005](BUG-005-dom-xss-search.md)                     | DOM XSS via the product search query                   | Security   | High     | P1       | ✅         |
| [BUG-006](BUG-006-captcha-answer-leak.md)                | CAPTCHA answer leaked in the challenge response        | Security   | Medium   | P2       | ⚠️ partial |

**Severity** = technical impact · **Priority** = fix urgency.
