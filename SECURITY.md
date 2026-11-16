# Security Policy

## Supported versions

GH-ListRollup is pre-1.0. Security fixes go into the latest release, and into `main` until the first
release.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Report it privately through GitHub's
[private vulnerability reporting](https://github.com/doublegate/GH-ListRollup/security/advisories/new).

Include the browser and version, the extension version, the steps to reproduce, and the impact you
observed. Expect an acknowledgement within 7 days.

## Scope

These are in scope:

- Script or HTML injection through repository-controlled names (files, folders, branches) rendered
  by the extension.
- Leakage of the optional GitHub token, or of private repository names or paths, to any party other
  than GitHub.
- The extension contacting any origin other than `github.com` and `api.github.com`.
- Message-passing flaws that let a web page drive the background script.

These are out of scope: vulnerabilities in GitHub itself, in the browsers, or in other extensions.

## For maintainers: CI on a self-hosted runner

The Antigravity PR reviewer runs on a self-hosted runner on the maintainer's machine. Workflows
from pull requests opened from forks need manual approval for every outside contributor. **Do not
approve them until you have read every change the pull request makes under `.github/`.** A pull
request controls the workflow files that run for it, so approving one runs its code on that
machine. See `docs/build-and-tooling.md` §4.

The design rules the extension follows are in [`docs/security-privacy.md`](docs/security-privacy.md).
