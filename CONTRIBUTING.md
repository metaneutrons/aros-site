# Contributing

Keep the site static, dependency-light, accessible, and honest about release
status. Do not add analytics, remote fonts, cookies, runtime API calls, or an R2
binding without an explicit design review.

Before opening a pull request, run:

```sh
npm ci --ignore-scripts
npm audit --audit-level=high
npm run check
```

Use Conventional Commit messages. Pull requests must pass the credential-free
site gate before merge. Production routing and credentials are configured
outside the repository and are never accepted in source, fixtures, logs, or
issue content.
