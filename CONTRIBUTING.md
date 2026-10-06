# Contributing to QuadStack

Thank you for considering contributing to QuadStack! We welcome contributions from everyone. This guide will help you get started and ensure a smooth collaboration process.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Working on Issues](#working-on-issues)
- [Development Workflow](#development-workflow)
  - [Fork & Clone](#fork--clone)
  - [Branching Strategy](#branching-strategy)
  - [Making Changes](#making-changes)
  - [Commit Messages](#commit-messages)
  - [Submitting a Pull Request](#submitting-a-pull-request)
- [Code Review Process](#code-review-process)
- [Versioning (SemVer)](#versioning-semver)
- [Style Guidelines](#style-guidelines)
- [Getting Help](#getting-help)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful, inclusive, and harassment-free environment. Please be kind and constructive in all interactions — in issues, pull requests, and discussions.

---

## How to Contribute

### Reporting Bugs

If you find a bug, please [open a new issue](../../issues/new) and include:

- A clear and descriptive title.
- Steps to reproduce the problem.
- Expected behavior vs. actual behavior.
- Screenshots or logs, if applicable.
- Your environment details (OS, browser, version, etc.).

### Suggesting Features

We'd love to hear your ideas! To suggest a feature:

1. Search [existing issues](../../issues) to check if it has already been proposed.
2. If not, [open a new issue](../../issues/new) with the **feature request** label.
3. Describe the feature, its use case, and why it would be valuable.

### Working on Issues

1. Browse the [open issues](../../issues) for something you'd like to work on.
2. Look for issues labeled **`good first issue`** or **`help wanted`** if you're new.
3. Comment on the issue to let others know you're working on it so effort isn't duplicated.
4. Wait for a maintainer to assign the issue to you before starting work.

---

## Development Workflow

### Fork & Clone

1. **Fork** this repository by clicking the "Fork" button on the top right of the repo page.
2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/<your-username>/QuadStack.git
   cd QuadStack
   ```

3. **Add the upstream remote** to keep your fork in sync:

   ```bash
   git remote add upstream https://github.com/PrathamGupta06/QuadStack.git
   ```

### Branching Strategy

Always create a new branch for your work. Never commit directly to `main`.

```bash
git checkout -b <branch-name>
```

Use descriptive branch names following this convention:

| Prefix       | Purpose                     | Example                        |
| ------------ | --------------------------- | ------------------------------ |
| `feature/`   | New feature                 | `feature/user-authentication`  |
| `bugfix/`    | Bug fix                     | `bugfix/fix-login-redirect`    |
| `hotfix/`    | Urgent production fix       | `hotfix/patch-null-error`      |
| `docs/`      | Documentation changes       | `docs/update-readme`           |
| `refactor/`  | Code refactoring            | `refactor/cleanup-api-routes`  |
| `test/`      | Adding or updating tests    | `test/add-unit-tests-auth`     |

### Making Changes

1. Keep your fork up to date before starting work:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Make your changes in small, focused commits.
3. Write or update tests for any new functionality.
4. Make sure all existing tests pass before submitting.

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:**

| Type       | Description                                  |
| ---------- | -------------------------------------------- |
| `feat`     | A new feature                                |
| `fix`      | A bug fix                                    |
| `docs`     | Documentation only changes                   |
| `style`    | Formatting, missing semi colons, etc.        |
| `refactor` | Code change that neither fixes nor adds      |
| `test`     | Adding or correcting tests                   |
| `chore`    | Maintenance tasks (build, CI, dependencies)  |

**Examples:**

```
feat(auth): add Google OAuth login support
fix(api): handle null response from user endpoint
docs(readme): add setup instructions
```

### Submitting a Pull Request

1. Push your branch to your fork:

   ```bash
   git push origin <branch-name>
   ```

2. Go to the original repository and click **"New Pull Request"**.
3. Select your branch and fill in the PR template with:
   - A clear title summarizing the change.
   - A description of **what** was changed and **why**.
   - A reference to the related issue (e.g., `Closes #42`).
4. Ensure all CI checks pass.
5. Request a review from at least one maintainer.

> **Tip:** Keep pull requests small and focused on a single concern. Large PRs are harder to review and more likely to have merge conflicts.

---

## Code Review Process

- All pull requests require **at least one approving review** from a maintainer before merging.
- Reviewers may request changes — please address feedback promptly and push updates to the same branch.
- Once approved and all checks pass, a maintainer will merge the PR.
- We use **squash and merge** to keep the commit history clean on `main`.

---

## Versioning (SemVer)

This project follows [Semantic Versioning (SemVer)](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

| Component | When to Increment                                             | Example         |
| --------- | ------------------------------------------------------------- | --------------- |
| **MAJOR** | Incompatible API changes / breaking changes                   | `1.0.0 → 2.0.0` |
| **MINOR** | New functionality added in a backward-compatible manner       | `1.0.0 → 1.1.0` |
| **PATCH** | Backward-compatible bug fixes                                 | `1.0.0 → 1.0.1` |

### Release Process

1. Version bumps are handled by maintainers.
2. Each release is tagged in Git (e.g., `v1.2.0`) and published via [GitHub Releases](../../releases).
3. A changelog entry is added for every release summarizing the changes.
4. Pre-release versions may use suffixes like `1.0.0-alpha.1` or `1.0.0-beta.2`.

---

## Style Guidelines

- Write clean, readable, and well-documented code.
- Follow the existing coding style and conventions in the repository.
- Use meaningful variable and function names.
- Keep functions small and single-purpose.
- Add comments where the intent isn't immediately obvious — but prefer self-documenting code.
- Remove any debugging artifacts (e.g., `console.log`, `print`) before submitting.

---

## Getting Help

If you have questions or need help at any point:

- Open a [GitHub Discussion](../../discussions) or comment on the relevant issue.
- Reach out to the maintainers — we're happy to help!

---

Thank you for helping make QuadStack better! 🚀
