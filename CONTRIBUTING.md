# Contributing to Claude Code Monitor

Thank you for your interest in contributing to Claude Code Monitor! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Be respectful and constructive in all interactions. Treat fellow contributors and users with kindness and understanding.

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template if available
3. Include:
   - VSCode version
   - Extension version
   - OS and version
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

### Suggesting Features

1. Check existing feature requests
2. Use the feature request template if available
3. Clearly describe the feature and its use case
4. Explain how it would benefit users

### Submitting Pull Requests

#### Before You Start

1. Fork the repository
2. Create a new branch for your changes: `git checkout -b feature/your-feature-name`
3. Make sure you have the latest code: `git pull upstream main`

#### Development Setup

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run in watch mode for development
npm run watch
```

#### Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small

#### Commit Messages

Follow conventional commits format:

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(quota): Add support for new API provider
fix(parser): Correct tool call regex pattern
docs(readme): Update installation instructions
```

#### Testing

Before submitting:

1. Test your changes manually
2. Run the linter: `npm run lint`
3. Ensure tests pass: `npm run test`
4. Test on different OS if possible (Windows, macOS, Linux)

#### Pull Request Process

1. Ensure your branch is up to date
2. Push your branch: `git push origin feature/your-feature-name`
3. Create a pull request from the GitHub UI
4. Fill in the PR template
5. Link related issues
6. Wait for review

## Development Guidelines

### Project Structure

```
src/
├── extension.ts          # Entry point
├── quota/               # Quota monitoring
├── monitor/             # Terminal monitoring
├── panels/              # UI components
└── types/               # TypeScript types
```

### Adding New Features

1. Consider existing patterns in the codebase
2. Follow the module structure
3. Add type definitions in `types/`
4. Update documentation

### Adding New API Providers

1. Extend `BaseQuotaProvider` or `TokenBasedProvider`
2. Implement required methods
3. Register in `src/quota/providers/index.ts`
4. Add tests

### Adding New Parsers

1. Create parser class
2. Register with `TerminalListener`
3. Add tests for various edge cases

## Documentation

- Keep README.md up to date
- Update CHANGELOG.md for significant changes
- Add inline comments for complex logic
- Update architecture docs if structure changes

## Questions?

Feel free to:
- Open an issue for questions
- Start a discussion for ideas
- Contact maintainers directly

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
