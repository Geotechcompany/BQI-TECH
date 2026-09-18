# User dashboard product tours

Applicant-facing guides powered by the same `PlatformTourProvider` / driver.js stack as admin.

## Registered tours

| Page | `tourId` | Guide control |
|------|---------|---------------|
| Overview / home | `user-overview` | Welcome banner |
| My applications | `user-applications` | Dashboard header |
| Open positions | `user-jobs` | Dashboard header |
| Settings / profile | `user-settings` | Dashboard header |
| Apply form | `user-apply` | Dashboard header |

All tours use `autoStart: false`. Start them with **Guide**.

Intro heroes use `heroImageSrc` on each definition (portal cover or existing guide images under `public/images/`).
