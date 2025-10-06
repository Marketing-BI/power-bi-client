# Security Policy

## Reporting a Vulnerability

We take security issues seriously. If you discover a potential vulnerability in this project, please follow the steps
below to report it responsibly.

### How to Report

1. **Do not open a public issue** for security vulnerabilities, since that may expose the vulnerability to malicious
   actors.
2. Please report via **email** to all the maintainers:
   - petr.volf@mbi.io
   - daniel.maczak@mbi.io
3. When submitting a report, please include:
   - A clear and descriptive title (e.g. “Possible Remote Code Execution in …”)
   - The affected version(s) and components (e.g. `v1.2.3`, module name)
   - A high-level description of the issue (what is wrong, how it can be triggered)
   - Step-by-step instructions or proof-of-concept (PoC) to reproduce
   - Suggested mitigation or patch (if you have one)
   - Any relevant logs, stack traces, or error messages
   - Your PGP / GPG public key or other preferred encryption method (optional but recommended)

We strive to acknowledge all valid reports within **5 business days**. Depending on the severity and fix complexity, we
aim to provide updates on progress and publish fixes or advisories.

## Scope

This policy applies to:

- All code in this repository (source, libraries, scripts, examples)
- Related configuration or build scripts under our control
- Dependency use insofar as our repository relies on or bundles them

This policy does **not** cover:

- Vulnerabilities in third-party dependencies beyond our bundled or integrated versions
- Attacks on users of software that are outside the repository’s scope (e.g. network infrastructure, host OS, DB
  cluster)
- Social engineering attacks that compromise credentials but not the integrity of this code

## What We Do With Reports

Upon receiving a valid report:

1. We will triage and classify severity (e.g. low / medium / high / critical).
2. We may request clarifications or additional information from the reporter.
3. We will work on a fix, test it, and release it as soon as reasonably possible.
4. We will coordinate disclosure:
   - Prefer to release a patch or version update with the fix before public announcement (i.e. responsible disclosure)
   - Once fixed, we may publicly acknowledge the reporter unless they request anonymity
   - Optionally publish a short advisory or “security release notes” summarizing the issue, impact, and
     mitigation/upgrade path

## Policy Updates

We may update this SECURITY.md over time (e.g. adjust contact info, change timelines, refine scope). When doing so,
we’ll note the date of revision.

_Last updated: 2025-10-06_

## Security Practices & Recommendations for Contributors / Reviewers

To help maintain a more secure codebase, contributors and maintainers are encouraged to follow best practices:

- Use **code signing / commit signing** where possible (GPG, S/MIME)
- Enable **branch protection rules** (e.g. require pull request reviews, status checks)
- Use **dependabot alerts / automated dependency scanning** for identifying known vulnerabilities in dependencies
- Enable **static code analysis / code scanning** tools (e.g. CodeQL or others)
- Do not commit secrets, API keys, credentials, or sensitive data into the repository
- Rotate credentials, tokens, and keys periodically
- Review external contributions carefully (especially large diffs, changes in privileged modules)
- Prefer least privilege (e.g. minimal access rights) when integrating services or libraries

## Acknowledgments

We appreciate security researchers and community members who help us improve safety. Thank you for responsibly
disclosing vulnerabilities, so we can improve this project for everyone.
