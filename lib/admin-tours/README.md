# BQI Admin product tours

In-app guides powered by [driver.js](https://driverjs.com) with BQI-branded tooltips.

## Registered tours

| Page | `tourId` | Guide control |
|------|---------|---------------|
| Overview | `overview` | `AdminPageLayout` |
| Pipeline board | `pipeline` | `AdminPageLayout` |
| Pipeline settings | `pipeline-settings` | `AdminPageLayout` |
| Positions list | `job-postings` | `AdminPageLayout` |
| Position wizard | `job-wizard` | Header `TourHelpButton` |
| Applicants | `applicants` | `AdminPageLayout` |
| Candidates | `candidates` | `AdminPageLayout` |
| Archive | `archive` | `AdminPageLayout` |
| Inbox | `inbox` | `AdminPageLayout` |
| Tasks | `tasks` | `AdminPageLayout` |
| Communications | `communications` | `AdminPageLayout` |
| Reports | `reports` | `AdminPageLayout` |
| Calendar | `calendar` | `AdminPageLayout` |
| Documents | `documents` | `AdminPageLayout` |
| Blog | `blog` | `AdminPageLayout` |
| Surveys | `surveys` | `AdminPageLayout` |
| Notifications | `notifications` | `AdminPageLayout` |
| Email broadcast | `email-broadcast` | `AdminPageLayout` |
| Admin activity | `audit-logs` | `AdminPageLayout` |
| Backup | `backup` | `AdminPageLayout` |
| Settings | `settings` | `AdminPageLayout` |
| User management | `user-management` | `AdminPageLayout` |
| Candidate profile | `candidate-profile` | Header `TourHelpButton` |

All tours use `autoStart: false`. Start them with the **Guide** button on the welcome banner when the page has one (`guideInBanner` + `tourId` on the banner); otherwise Guide stays in the page header.

Welcome banners use `AdminPageWelcomeBanner` + `lib/admin-page-banners.ts` (navy gradient strip, no stock photos). Overview keeps `OverviewWelcomeBanner` (greeting + stats) with its original cover image.

Guide intro heroes are unique per `tourId` via `lib/admin-tour-heroes.ts` and files under `public/images/admin-guides/`. Set `brandHero: true` and `illustration: "brand-hero"` on the intro modal (or rely on the hero map + `coverSrc` wiring in `PlatformTour`).

## Add a new tour

1. Create `lib/admin-tours/my-page-tour.ts`:

```ts
import type { TourDefinition } from "./types";

export const myPageTour: TourDefinition = {
  id: "my-page",
  label: "My page",
  autoStart: false,
  steps: [
    {
      target: '[data-tour="my-element"]',
      title: "Step title",
      content: "Helpful copy in context.",
      placement: "bottom",
    },
  ],
};
```

2. Register it in `lib/admin-tours/index.ts`.
3. Add `data-tour="my-element"` to the target DOM node.
4. On the page:

```tsx
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";

<AdminPageLayout title="..." tourId="my-page">
  <TourPageHelper tourId="my-page" />
  <AdminPageWelcomeBanner bannerKey="..." />
  ...
</AdminPageLayout>
```

## Triggers

| Action | Behavior |
|--------|----------|
| First visit | Auto-starts only when `autoStart: true` and tour is not dismissed/snoozed |
| Guide button | Always restarts the tour (header when `tourId` is set on `AdminPageLayout`) |
| Snooze | Hides for 7 days (`bqi-tour-{id}-snoozed`) |
| Complete / Don't show again | Permanent (`bqi-tour-{id}-dismissed`) |
| Close (X) | Ends session; may auto-offer again on next visit if `autoStart` is true |

## Reset during development

```js
localStorage.removeItem("bqi-tour-overview-dismissed");
localStorage.removeItem("bqi-tour-overview-snoozed");
localStorage.removeItem("bqi.welcome.v4.dismissed");
```
