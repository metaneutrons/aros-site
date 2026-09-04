# AROS engineering site

The public landing page for the metaneutrons AROS ecosystem. It presents the
human-facing project map at `https://aros.metaneutrons.cc/` while independently
deployed documentation and artifact services retain their own ownership
boundaries.

## Public architecture

| Public boundary | Owner |
| --- | --- |
| `aros.metaneutrons.cc/*` | this static landing-page Worker |
| `aros.metaneutrons.cc/aros-tools` and `/aros-tools/*` | the more-specific `aros-tools-docs` Worker |
| `deb.metaneutrons.cc` | signed APT repository |
| `aros-toolchains.metaneutrons.cc` | deterministic toolchain artifacts |
| `aros-images.metaneutrons.cc` | future verified system images |

Cloudflare selects the most specific matching Worker route, so the tools
documentation remains independently deployable. This Worker has no R2 binding
and cannot read or mutate release artifacts.

## Local development

Node.js 24 and Python 3.11 or newer are required.

```sh
npm ci --ignore-scripts
npm audit --audit-level=high
npm run check
npm run dev
```

`npm run check` is the local and CI source of truth. It performs Astro type
checking, a production build, output validation, publication-contract
validation, and a Wrangler dry run.

## Deployment

Pull requests receive no credentials and run the complete dry-run gate. A push
to protected `main` uploads the verified `dist` handoff. A separate deployment
job enters the `site-publication` environment and receives exactly one secret:
`CLOUDFLARE_API_TOKEN`.

The token requires Workers Scripts edit on the `lexICT` account and Workers
Routes edit in the `metaneutrons.cc` zone. It requires no R2 permission. Do not
merge a deployment change until the protected environment and credential are
present.

## License

Copyright © 2026 Fabian Schmieder. Licensed under
[GPL-3.0-or-later](LICENSE).
