# Contributing to MenuMaker

Thank you for your interest in contributing to MenuMaker! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

### Expected Behavior

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Ensure you have the following installed:
- Node.js 20+ and npm 10+
- Docker and Docker Compose
- Git

### Setup Development Environment

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/menumaker.git
   cd menumaker
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ameedanxari/menumaker.git
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

5. **Start local services**
   ```bash
   docker-compose up -d
   ```

6. **Run migrations**
   ```bash
   cd backend && npm run migrate
   ```

7. **Start development servers**
   ```bash
   npm run dev
   ```

## Development Workflow

### Creating a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications
- `chore/` - Maintenance tasks

Examples:
- `feature/add-payment-integration`
- `fix/order-calculation-bug`
- `docs/update-api-documentation`

### Making Changes

1. Make your changes in your feature branch
2. Write or update tests as needed
3. Ensure all tests pass
4. Update documentation if needed
5. Commit your changes with a descriptive commit message

### Syncing with Upstream

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your branch
git rebase upstream/main
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Provide explicit types for function parameters and return values
- Avoid using `any` type unless absolutely necessary
- Use interfaces for object shapes

**Example:**
```typescript
// Good
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

async function createUser(email: string, password: string): Promise<User> {
  // Implementation
}

// Avoid
function createUser(email: any, password: any): any {
  // Implementation
}
```

### Backend (Fastify)

- Follow RESTful API conventions
- Use async/await for asynchronous operations
- Implement proper error handling
- Validate input using Zod schemas
- Use dependency injection where appropriate

**Example:**
```typescript
// routes/users.ts
export async function userRoutes(app: FastifyInstance) {
  app.post('/users', async (request, reply) => {
    try {
      const userData = validateUserInput(request.body);
      const user = await userService.createUser(userData);
      return reply.code(201).send({ user });
    } catch (error) {
      handleError(error, reply);
    }
  });
}
```

### Frontend (React)

- Use functional components with hooks
- Follow React best practices
- Implement proper error boundaries
- Use TypeScript interfaces for props
- Keep components small and focused

**Example:**
```typescript
interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Button({ onClick, disabled = false, children }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      {children}
    </button>
  );
}
```

### Styling

- Use TailwindCSS utility classes
- Follow mobile-first responsive design
- Maintain consistent spacing and colors
- Ensure accessibility (ARIA labels, keyboard navigation)

### Code Formatting

The project uses Prettier and ESLint:

```bash
# Backend
cd backend
npm run lint
npm run lint:fix

# Frontend
cd frontend
npm run lint
npm run lint:fix
```

## Testing Guidelines

### Unit Tests

Write unit tests for:
- Service layer business logic
- Utility functions
- Complex calculations
- Error handling

**Backend example:**
```typescript
describe('OrderService', () => {
  it('should calculate order total correctly', async () => {
    const order = await orderService.createOrder({
      items: [
        { dishId: 'dish1', quantity: 2, price: 1000 },
        { dishId: 'dish2', quantity: 1, price: 1500 },
      ],
    });

    expect(order.totalCents).toBe(3500);
  });
});
```

### E2E Tests

Write E2E tests for:
- Critical user flows
- Happy path scenarios
- Error handling
- Edge cases

**Example:**
```typescript
test('should complete order checkout', async ({ page }) => {
  await page.goto('/menu/test-restaurant');
  await page.click('button:has-text("Add to Cart")');
  await page.click('button:has-text("Checkout")');

  await page.fill('input[name="name"]', 'John Doe');
  await page.fill('input[name="email"]', 'john@example.com');

  await page.click('button[type="submit"]');

  await expect(page.locator('text=Order Confirmed')).toBeVisible();
});
```

### Test Coverage

- Aim for 70%+ test coverage
- Focus on critical business logic
- Don't test framework code
- Prioritize meaningful tests over coverage numbers

### Running Tests

```bash
# Backend unit tests
cd backend
npm test
npm run test:watch
npm run test:coverage

# Frontend E2E tests
cd frontend
npm run test:e2e
npm run test:e2e:ui
```

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples

```
feat(orders): add order cancellation functionality

Implement order cancellation with status validation
and automatic refund calculation. Sellers can now
cancel orders with pending or confirmed status.

Closes #123
```

```
fix(auth): resolve JWT token expiration issue

Fixed bug where tokens were expiring prematurely
due to incorrect time calculation. Updated token
generation to use consistent UTC timestamps.

Fixes #456
```

```
docs(readme): update deployment instructions

Add detailed steps for AWS deployment including
environment variables and database migration.
```

## Pull Request Process

### Before Submitting

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests**
   ```bash
   npm test
   ```

3. **Lint your code**
   ```bash
   npm run lint
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

### Creating a Pull Request

1. Push your branch to your fork
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a pull request on GitHub

3. Fill out the PR template:
   - Clear title following commit message format
   - Description of changes
   - Related issues
   - Screenshots (if UI changes)
   - Testing instructions

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
How to test these changes

## Screenshots
If applicable

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code follows style guidelines
- [ ] All tests passing
```

### Review Process

- At least one approval required
- All CI checks must pass
- Address review comments
- Keep PR focused and small (< 500 lines when possible)

## Issue Reporting

### Bug Reports

Include:
- Clear descriptive title
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or error messages
- Environment details (OS, Node version, browser)
- Possible solution (if you have one)

**Template:**
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., macOS 14]
- Node version: [e.g., 20.10.0]
- Browser: [e.g., Chrome 120]

**Additional context**
Any other context about the problem.
```

### Feature Requests

Include:
- Clear use case
- Expected behavior
- Why this feature is valuable
- Possible implementation approach

## Development Tips

### Hot Reload

Both backend and frontend support hot reload:
- Backend: Changes reload automatically with nodemon
- Frontend: Changes update instantly with Vite HMR

### Database Changes

When modifying database schema:
1. Update TypeORM entities
2. Generate migration: `npm run migrate:create -- MigrationName`
3. Review generated migration
4. Test migration up and down
5. Update seed data if needed

### Debugging

**Backend:**
```bash
# With Node debugger
cd backend
node --inspect src/index.ts

# With VS Code, add to launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/src/index.ts",
  "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
}
```

**Frontend:**
- Use React DevTools extension
- Use browser debugger
- Check Vite console for build issues

### Useful Commands

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Reset database
docker-compose down -v
docker-compose up -d
npm run migrate

# Check TypeScript
npx tsc --noEmit

# Find unused dependencies
npx depcheck
```

## Getting Help

- Check existing issues and documentation
- Ask in GitHub Discussions
- Join community chat (if available)
- Tag maintainers for urgent issues

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project README

Thank you for contributing to MenuMaker! 🎉
