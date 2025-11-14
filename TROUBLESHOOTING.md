# Troubleshooting Guide

Common issues and solutions for MenuMaker development and deployment.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Database Issues](#database-issues)
- [Backend Issues](#backend-issues)
- [Frontend Issues](#frontend-issues)
- [Docker Issues](#docker-issues)
- [Testing Issues](#testing-issues)
- [Production Issues](#production-issues)

## Installation Issues

### npm install fails with permission errors

**Error:**
```
EACCES: permission denied
```

**Solutions:**
```bash
# Don't use sudo! Instead, fix npm permissions:
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then retry
npm install
```

### Node version mismatch

**Error:**
```
The engine "node" is incompatible with this module
```

**Solution:**
```bash
# Install Node.js 20.x
# Using nvm (recommended):
nvm install 20
nvm use 20

# Verify version
node --version  # Should be v20.x.x
```

### Module not found after install

**Error:**
```
Cannot find module '@fastify/cors'
```

**Solutions:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# If in monorepo, install from root
cd /path/to/menumaker
npm install
```

## Database Issues

### Cannot connect to PostgreSQL

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

1. **Check Docker is running**
   ```bash
   docker ps
   # Should show postgres container

   # If not running
   docker-compose up -d
   ```

2. **Verify database credentials**
   ```bash
   # Check .env file
   cat backend/.env | grep DB_

   # Test connection
   psql postgresql://menumaker:password@localhost:5432/menumaker_dev
   ```

3. **Check PostgreSQL logs**
   ```bash
   docker-compose logs postgres
   ```

4. **Reset database**
   ```bash
   docker-compose down -v
   docker-compose up -d
   # Wait 10 seconds for startup
   cd backend && npm run migrate
   ```

### Migration fails

**Error:**
```
QueryFailedError: relation "users" already exists
```

**Solutions:**

1. **Check migration status**
   ```bash
   cd backend
   npm run migrate:status
   ```

2. **Revert and re-run**
   ```bash
   npm run migrate:revert
   npm run migrate
   ```

3. **Fresh database**
   ```bash
   # WARNING: This deletes all data
   docker-compose down -v
   docker-compose up -d
   sleep 10
   npm run migrate
   ```

### Database connection pool exhausted

**Error:**
```
TimeoutError: ResourceRequest timed out
```

**Solutions:**

1. **Check for unclosed connections**
   ```typescript
   // Always close connections
   const result = await repository.find();
   // ... use result
   ```

2. **Increase pool size**
   ```typescript
   // database.ts
   extra: {
     max: 20, // Increase from default 10
   }
   ```

3. **Check for long-running queries**
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY duration DESC;
   ```

## Backend Issues

### Server won't start

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solutions:**

1. **Kill process on port**
   ```bash
   # Find process
   lsof -i :3001

   # Kill it
   kill -9 <PID>

   # Or use killall
   killall node
   ```

2. **Use different port**
   ```bash
   PORT=3002 npm run dev
   ```

### JWT token errors

**Error:**
```
JsonWebTokenError: invalid signature
```

**Solutions:**

1. **Check JWT_SECRET is set**
   ```bash
   echo $JWT_SECRET
   # Should output your secret
   ```

2. **Regenerate secret**
   ```bash
   openssl rand -base64 32
   # Copy to .env as JWT_SECRET
   ```

3. **Clear old tokens**
   - Clear browser localStorage
   - Clear cookies
   - Try login again

### TypeORM entity not found

**Error:**
```
EntityMetadataNotFoundError: No metadata for "User" was found
```

**Solutions:**

1. **Check entity is exported**
   ```typescript
   // models/index.ts
   export { User } from './User';
   export { Business } from './Business';
   // ... all entities
   ```

2. **Check database config**
   ```typescript
   // database.ts
   entities: [User, Business, ...],  // Direct import
   // OR
   entities: ['src/models/**/*.ts'],  // Pattern
   ```

3. **Rebuild**
   ```bash
   rm -rf dist
   npm run build
   npm run dev
   ```

### S3/MinIO upload fails

**Error:**
```
Error: Failed to upload to S3
```

**Solutions:**

1. **Check MinIO is running**
   ```bash
   docker-compose ps
   curl http://localhost:9000/minio/health/live
   ```

2. **Verify S3 credentials**
   ```bash
   # Check .env
   cat backend/.env | grep S3_
   ```

3. **Check bucket exists**
   ```bash
   # Access MinIO console: http://localhost:9001
   # Login: minioadmin / minioadmin
   # Verify bucket 'menumaker-dev' exists
   ```

4. **Create bucket manually**
   ```bash
   # Using AWS CLI with MinIO
   aws --endpoint-url http://localhost:9000 \
       s3 mb s3://menumaker-dev
   ```

## Frontend Issues

### Vite server won't start

**Error:**
```
Error: Cannot find module 'vite'
```

**Solutions:**

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Clear Vite cache**
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

### API requests fail with CORS

**Error (in browser console):**
```
Access to fetch at 'http://localhost:3001/api/v1/...' has been blocked by CORS
```

**Solutions:**

1. **Check backend CORS configuration**
   ```typescript
   // backend/src/index.ts
   await app.register(cors, {
     origin: 'http://localhost:3000',  // Frontend URL
     credentials: true,
   });
   ```

2. **Verify API URL**
   ```bash
   # frontend/.env
   VITE_API_URL=http://localhost:3001/api/v1
   ```

3. **Restart both servers**
   ```bash
   # Terminal 1
   cd backend && npm run dev

   # Terminal 2
   cd frontend && npm run dev
   ```

### Component not rendering

**Common causes:**

1. **Check browser console for errors**
   ```
   F12 → Console tab
   ```

2. **Verify API response**
   ```
   F12 → Network tab → Check API calls
   ```

3. **Check React DevTools**
   ```
   F12 → Components tab → Inspect component state
   ```

4. **Common fixes:**
   ```typescript
   // Loading state not handled
   if (isLoading) return <LoadingSpinner />;
   if (error) return <ErrorMessage error={error} />;
   if (!data) return null;

   // Conditional rendering
   {items && items.length > 0 && (
     <ItemList items={items} />
   )}
   ```

### State not updating

**Solutions:**

1. **Check Zustand store**
   ```typescript
   // Use set correctly
   set({ items: [...get().items, newItem] });  // ✓
   get().items.push(newItem);  // ✗ Don't mutate
   ```

2. **Verify React Query cache**
   ```typescript
   // Invalidate queries after mutation
   await queryClient.invalidateQueries(['orders']);
   ```

3. **Check useEffect dependencies**
   ```typescript
   useEffect(() => {
     fetchData();
   }, [id]);  // Add all dependencies
   ```

### Build fails

**Error:**
```
Transform failed with 1 error
```

**Solutions:**

1. **Check TypeScript errors**
   ```bash
   npx tsc --noEmit
   ```

2. **Clear cache and rebuild**
   ```bash
   rm -rf node_modules/.vite dist
   npm run build
   ```

3. **Check for circular dependencies**
   ```bash
   npx madge --circular src/
   ```

## Docker Issues

### Docker daemon not running

**Error:**
```
Cannot connect to the Docker daemon
```

**Solutions:**

1. **Start Docker Desktop** (macOS/Windows)
2. **Start Docker service** (Linux)
   ```bash
   sudo systemctl start docker
   ```

### Containers won't start

**Error:**
```
Error response from daemon: Ports are not available
```

**Solutions:**

1. **Check port conflicts**
   ```bash
   # Check what's using the port
   lsof -i :5432
   lsof -i :9000

   # Stop conflicting services
   sudo systemctl stop postgresql  # If you have local PostgreSQL
   ```

2. **Use different ports**
   ```yaml
   # docker-compose.yml
   services:
     postgres:
       ports:
         - "5433:5432"  # Changed from 5432
   ```

### Container keeps restarting

**Solutions:**

1. **Check container logs**
   ```bash
   docker-compose logs postgres
   docker-compose logs minio
   ```

2. **Check resources**
   ```bash
   docker stats
   # Ensure enough memory/CPU allocated
   ```

3. **Remove and recreate**
   ```bash
   docker-compose down
   docker-compose up -d --force-recreate
   ```

### Volume issues

**Error:**
```
Error: EACCES: permission denied
```

**Solutions:**

1. **Fix permissions**
   ```bash
   sudo chown -R $USER:$USER ./data
   ```

2. **Remove volumes**
   ```bash
   docker-compose down -v  # WARNING: Deletes data
   docker-compose up -d
   ```

## Testing Issues

### Jest tests fail

**Error:**
```
Cannot find module '../src/...'
```

**Solutions:**

1. **Check jest.config.js**
   ```javascript
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     moduleNameMapper: {
       '^@/(.*)$': '<rootDir>/src/$1',
     },
   };
   ```

2. **Clear Jest cache**
   ```bash
   npm test -- --clearCache
   npm test
   ```

### Playwright tests timeout

**Error:**
```
Test timeout of 30000ms exceeded
```

**Solutions:**

1. **Increase timeout**
   ```typescript
   test('my test', async ({ page }) => {
     test.setTimeout(60000);  // 60 seconds
     // ... test code
   });
   ```

2. **Check servers are running**
   ```bash
   # Backend should be on :3001
   curl http://localhost:3001/health

   # Frontend should be on :3000
   curl http://localhost:3000
   ```

3. **Use explicit waits**
   ```typescript
   // Bad
   await page.waitForTimeout(5000);

   // Good
   await page.waitForSelector('button:has-text("Submit")');
   await expect(page.locator('.success')).toBeVisible();
   ```

### Playwright can't find elements

**Solutions:**

1. **Use better selectors**
   ```typescript
   // Bad - brittle
   await page.click('.css-123abc');

   // Good - semantic
   await page.click('button:has-text("Login")');
   await page.click('[data-testid="submit-button"]');
   ```

2. **Wait for element**
   ```typescript
   await page.waitForSelector('button:has-text("Login")');
   await page.click('button:has-text("Login")');
   ```

3. **Check page loaded**
   ```typescript
   await page.goto('/login');
   await page.waitForLoadState('networkidle');
   ```

## Production Issues

### 502 Bad Gateway

**Causes:**
- Backend server not running
- Backend crashed
- Wrong port configuration

**Solutions:**

1. **Check backend logs**
   ```bash
   # Heroku
   heroku logs --tail -a menumaker-api

   # PM2
   pm2 logs menumaker-api

   # Docker
   docker logs container-name
   ```

2. **Restart backend**
   ```bash
   # Heroku
   heroku restart -a menumaker-api

   # PM2
   pm2 restart menumaker-api
   ```

3. **Check health endpoint**
   ```bash
   curl https://api.yourdomain.com/health
   ```

### Database connection pool exhausted

**Solutions:**

1. **Increase pool size**
   ```typescript
   // database.ts
   extra: {
     max: 50,  // Increase based on load
     connectionTimeoutMillis: 2000,
   }
   ```

2. **Implement connection pooling**
   - Use PgBouncer for PostgreSQL
   - Configure appropriate pool sizes

3. **Optimize queries**
   - Add indexes
   - Reduce N+1 queries
   - Implement caching

### Memory leaks

**Symptoms:**
- Gradual memory increase
- Server crashes
- Slow performance

**Solutions:**

1. **Monitor memory**
   ```bash
   # Node.js
   node --inspect your-app.js

   # Check process memory
   ps aux | grep node
   ```

2. **Common causes:**
   ```typescript
   // Unclosed event listeners
   useEffect(() => {
     const handler = () => {};
     window.addEventListener('resize', handler);
     return () => window.removeEventListener('resize', handler);
   }, []);

   // Uncleared intervals
   useEffect(() => {
     const interval = setInterval(() => {}, 1000);
     return () => clearInterval(interval);
   }, []);

   // Database connections not closed
   // Use connection pooling and proper cleanup
   ```

3. **Use profiling tools**
   - Chrome DevTools Memory Profiler
   - Node.js heap snapshots
   - clinic.js

### High CPU usage

**Solutions:**

1. **Identify bottleneck**
   ```bash
   # Check what's using CPU
   top
   htop

   # Profile Node.js
   node --prof your-app.js
   ```

2. **Common causes:**
   - Inefficient algorithms
   - Unnecessary re-renders (React)
   - Synchronous operations
   - Large payload processing

3. **Optimizations:**
   - Use async/await properly
   - Implement pagination
   - Add caching
   - Use worker threads for heavy tasks

## Getting Help

If you can't resolve an issue:

1. **Check existing issues** on GitHub
2. **Search documentation** at docs.menumaker.app
3. **Create detailed bug report** with:
   - Error message
   - Steps to reproduce
   - Environment details
   - Logs
4. **Join community** chat/forum

## Useful Commands

```bash
# System info
node --version
npm --version
docker --version

# Check ports
lsof -i :3000
lsof -i :3001
lsof -i :5432

# Process management
ps aux | grep node
killall node

# Docker
docker ps
docker-compose logs
docker-compose restart

# Database
psql $DATABASE_URL
\dt  # List tables
\d users  # Describe table

# Logs
# Backend
npm run dev | tee backend.log

# View logs
tail -f backend.log
```

## Additional Resources

- [Node.js Debugging Guide](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [PostgreSQL Wiki](https://wiki.postgresql.org/)
- [Docker Documentation](https://docs.docker.com/)
- [Playwright Debugging](https://playwright.dev/docs/debug)
