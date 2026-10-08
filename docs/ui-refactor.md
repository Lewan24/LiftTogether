# UI review and refactor

Reviewed against the installed Web Design Guidelines with fresh upstream rules, plus Frontend Design for preserve-mode visual choices. Taste Skill's landing-page-only scope excludes this app's dashboard and admin tables.

## Changes

- Component layout, spacing, colors, typography, responsive rules and state styles live in Tailwind utility classes in JSX. index.css contains only fonts, semantic theme variables, native element defaults, universal keyboard focus and reduced-motion rules.
- Shared Button resolves utility overrides with tailwind-merge. Shared Field provides stable label IDs, optional helper/error text, accessible descriptions, input limits and visible focus. Names and autocomplete metadata are supplied by consumers.
- Navigation uses real links and hash URLs, browser history events and an explicit main-content skip target. The mobile sidebar supports Escape, trapped keyboard focus, focus restoration and inert background content. Hidden mobile navigation is inert too.
- Verification stays available on small screens. Member and post searches use separate state. Placeholder notification controls are removed; help is an accessible disclosure. Destructive booking and post actions ask for confirmation.
- Bookings are grouped and sorted once per data change for calendar rendering. Week eligibility uses the current clock at both boundaries.
- The formatter that produced invalid TypeScript is replaced with Prettier and a format:check command.

## Validation and limits

Build/typecheck, four booking and safe-link regression tests, and dependency audit pass. Browser automation reports no available browser; no desktop/mobile screenshot or keyboard interaction verification was possible. Domain tests do not prove visual accessibility. Utility CSS and a reusable override helper increase asset size compared with the prior handcrafted stylesheet; no measured Core Web Vitals improvement is claimed. Pages remain lazy loaded.

Authentication and role authority remain in-memory demo behavior. Production security remains dependent on an authenticated, authorized API and deployment headers documented in README.md.

Remaining design review work includes full Polish/English copy coverage, field-level server validation after API integration and browser review at 360px, 768px, 1024px and wide desktop. Page hashes are supported; post IDs, admin filters and calendar dates are not yet encoded in the URL.
