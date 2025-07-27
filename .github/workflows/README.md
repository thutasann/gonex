# GitHub Actions Workflows

This repository uses GitHub Actions for continuous integration and deployment. Here's an overview of the workflows:

## Workflows

### 1. CI (`ci.yml`)

**Triggers:** Push to `master` or `develop`, Pull requests to `master` or `develop`

Runs on every push and pull request to ensure code quality:

- **Test Matrix:** Runs tests on Node.js 16.x, 18.x, and 20.x
- **Linting:** ESLint checks
- **Tests:** Jest unit tests with coverage
- **Build:** TypeScript compilation
- **Security:** npm audit and dependency checks
- **Type Check:** TypeScript type checking
- **Integration:** Tests built package and runs benchmarks

### 2. Release (`release.yml`)

**Triggers:** Push to `master` with version tag (e.g., `v1.0.0`)

Automates the release process:

- Runs tests and builds
- Publishes to npm (requires `NPM_TOKEN` secret)
- Creates GitHub release

### 3. Pull Request Checks (`pr.yml`)

**Triggers:** Pull requests to `master` or `develop`

Additional quality checks for PRs:

- **Dependency Review:** Security analysis of dependencies
- **Bundle Size:** Checks the size of built artifacts
- **Code Quality:** Prettier formatting, TODO checks, console.log detection

### 4. Develop Branch (`develop.yml`)

**Triggers:** Push to `develop` branch

Extended testing for the development branch:

- **Multi-platform Testing:** Ubuntu, Windows, macOS
- **Integration Tests:** Package import testing
- **Benchmarks:** Performance testing
- **Documentation:** Auto-generates docs
- **Artifacts:** Uploads build artifacts

## Setup Requirements

### Repository Secrets

Add these secrets to your GitHub repository:

1. **NPM_TOKEN** (for publishing to npm)
   - Generate from npm: `npm token create`
   - Required for the release workflow

2. **GITHUB_TOKEN** (automatically provided)
   - Used for creating releases

### Branch Protection Rules

Recommended branch protection for `master`:

- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require pull request reviews before merging
- Include administrators in restrictions

## Usage

### Development Workflow

1. Create feature branch from `develop`
2. Make changes and push
3. Create PR to `develop`
4. CI runs automatically
5. Merge to `develop` when CI passes
6. Create PR from `develop` to `master` when ready for release

### Release Workflow

1. Ensure all tests pass on `develop`
2. Merge `develop` to `master`
3. Create and push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. Release workflow automatically publishes to npm and creates GitHub release

### Manual Workflow Triggers

You can manually trigger workflows from the Actions tab:

- **Re-run jobs:** Useful for debugging
- **Workflow dispatch:** Trigger workflows manually

## Troubleshooting

### Common Issues

1. **Tests failing:** Check the test output in the Actions tab
2. **Build failing:** Ensure TypeScript compiles locally
3. **Linting errors:** Run `npm run lint:fix` locally
4. **Coverage issues:** Check that tests are properly configured

### Local Testing

Before pushing, run these commands locally:

```bash
npm ci
npm run lint
npm test
npm run test:coverage
npm run build
```

### Workflow Debugging

- Check the Actions tab for detailed logs
- Use `echo` statements in workflow files for debugging
- Enable debug logging by setting `ACTIONS_STEP_DEBUG=true` in repository secrets
