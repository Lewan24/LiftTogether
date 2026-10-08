# Workspace design skills

These instruction packages are installed only under .agents/skills and will be available on the next Codex turn. Existing global skills are unchanged. Exact sources, commits and verification checks are recorded in skill-installation.json. No app files or npm dependencies were changed during this installation.

| Skill | Documented agent support | Setup, dependencies and permissions | License |
| --- | --- | --- | --- |
| web-design-guidelines | Agent Skills format; named-agent support unknown | Reads selected source files; must fetch fresh public guidelines from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md before every review. No executable runtime shipped. API-key and paid-service requirements are undocumented (unknown). | Upstream README declares MIT; no complete license file/notice found. |
| design-taste-frontend | Codex, Cursor, Claude documented in README | No executable runtime shipped. React or Next.js and Tailwind are default implementation choices; Motion, GSAP, icon libraries and design systems depend on the brief. Image generation and external assets may require services; keys, costs and licenses must be checked before choosing them. The Shopify example uses a Shopify API key, but is not applicable to this app. Reads and edits frontend source; may use web, screenshots and image generation. | MIT; LICENSE retained. |
| frontend-design | Claude documented; upstream Codex support unknown | No executable runtime shipped or fixed framework dependency. Reads and edits UI source; optional screenshots. API-key and paid-service requirements are undocumented (unknown). Valid Agent Skills frontmatter is verified locally; functional Codex behavior is not tested. | Apache-2.0; LICENSE.txt retained. |

The Taste package is currently experimental v2. It excludes dashboards, admin panels, data tables and multistep product UI; apply it only to an appropriate marketing or landing surface. Its blocks directory is described as a future library and is not shipped upstream. No missing block files were invented.

Repository text was reviewed as untrusted instructions. It does not authorize credential access, purchases, publishing or external service calls. User instructions and platform permissions remain controlling. No credentials or paid services were activated. The explicitly requested install-outcome reports contain only the provided fields and unique event IDs, with no project source or user data.

Installation verification checks source identity, metadata and file scope. It is not evidence that a UI review or redesign succeeded. No design skill has yet been applied to this app as part of this installation.

Proposed first task, awaiting user approval: read-only review of src/pages/LoginScreen.tsx, src/components/ui.tsx and src/index.css using Web Design Guidelines. Inputs: these three files and freshly fetched public guidelines. Expected output: a prioritized list of accessibility, form interaction and responsive-layout issues with file:line references and concrete fixes. No code changes.
