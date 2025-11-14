# Deployment Guide

This guide provides detailed instructions for deploying MenuMaker to production environments.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Backend Deployment](#backend-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Post-Deployment](#post-deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

MenuMaker consists of three main components:
1. **Backend API** - Node.js/Fastify server
2. **Frontend** - React SPA
3. **Database** - PostgreSQL

Recommended hosting options:
- **Backend**: Heroku, Render, Railway, AWS
- **Frontend**: Vercel, Netlify, Cloudflare Pages, AWS S3+CloudFront
- **Database**: AWS RDS, Heroku Postgres, Supabase
- **Storage**: AWS S3, Cloudflare R2

## Prerequisites

### Required Accounts

- [ ] Cloud hosting account (Heroku/Render/AWS)
- [ ] PostgreSQL database (managed or self-hosted)
- [ ] S3-compatible storage (AWS S3 or compatible)
- [ ] Domain name (optional but recommended)
- [ ] SSL certificate (usually provided by hosting)

### Local Preparation

```bash
# Ensure all tests pass
npm test

# Build and verify
npm run build

# Check for vulnerabilities
npm audit
```

## Environment Variables

### Backend Environment Variables

Create a production `.env` file with the following variables:

```bash
# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=menumaker_prod
DB_USER=menumaker_user
DB_PASSWORD=your-secure-database-password

# JWT Authentication
JWT_SECRET=your-very-long-random-secret-key-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AWS S3 Storage
S3_ENDPOINT=s3.amazonaws.com
S3_PORT=443
S3_USE_SSL=true
S3_ACCESS_KEY=your-aws-access-key
S3_SECRET_KEY=your-aws-secret-key
S3_BUCKET=menumaker-prod-images
S3_REGION=us-east-1

# CORS
CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info
```

**Security Best Practices:**
- Use strong, unique passwords
- Generate JWT_SECRET: `openssl rand -base64 48`
- Never commit `.env` files
- Use secret management systems (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly

### Frontend Environment Variables

```bash
# API Configuration
VITE_API_URL=https://api.yourdomain.com/api/v1

# Optional: Analytics
VITE_ANALYTICS_ID=your-analytics-id

# Optional: Sentry
VITE_SENTRY_DSN=your-sentry-dsn
```

## Database Setup

### Option 1: AWS RDS PostgreSQL

1. **Create RDS Instance**
   ```bash
   # Using AWS CLI
   aws rds create-db-instance \
     --db-instance-identifier menumaker-prod \
     --db-instance-class db.t3.micro \
     --engine postgres \
     --engine-version 15.4 \
     --master-username menumaker \
     --master-user-password YOUR_PASSWORD \
     --allocated-storage 20 \
     --publicly-accessible
   ```

2. **Configure Security Group**
   - Allow inbound on port 5432 from your backend server IPs
   - Use VPC for better security

3. **Create Database**
   ```sql
   CREATE DATABASE menumaker_prod;
   CREATE USER menumaker_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE menumaker_prod TO menumaker_user;
   ```

### Option 2: Heroku Postgres

```bash
# Add Heroku Postgres addon
heroku addons:create heroku-postgresql:mini -a menumaker-api

# Get database URL
heroku config:get DATABASE_URL -a menumaker-api
```

### Option 3: Supabase

1. Create project on Supabase
2. Get connection string from project settings
3. Use connection pooler for better performance

### Run Migrations

```bash
# Set database connection
export DATABASE_URL=postgresql://user:password@host:5432/database

# Run migrations
cd backend
npm run migrate

# Verify
npm run migrate:status
```

## Backend Deployment

### Option 1: Heroku

1. **Install Heroku CLI**
   ```bash
   brew install heroku/brew/heroku  # macOS
   # or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Create Heroku App**
   ```bash
   heroku create menumaker-api
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production -a menumaker-api
   heroku config:set JWT_SECRET=your-secret -a menumaker-api
   # ... set all other variables
   ```

4. **Deploy**
   ```bash
   # From backend directory
   git subtree push --prefix backend heroku main

   # Or use Heroku Git
   cd backend
   git init
   heroku git:remote -a menumaker-api
   git add .
   git commit -m "Deploy"
   git push heroku main
   ```

5. **Run Migrations**
   ```bash
   heroku run npm run migrate -a menumaker-api
   ```

6. **Scale Dynos**
   ```bash
   heroku ps:scale web=1 -a menumaker-api
   ```

### Option 2: Render

1. **Create New Web Service**
   - Connect GitHub repository
   - Set root directory: `backend`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`

2. **Add Environment Variables**
   - Add all production environment variables in Render dashboard

3. **Deploy**
   - Render auto-deploys on push to main branch

### Option 3: AWS EC2

1. **Launch EC2 Instance**
   ```bash
   # Ubuntu 22.04 LTS, t3.small or larger
   ssh ubuntu@your-instance-ip
   ```

2. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install PM2**
   ```bash
   sudo npm install -g pm2
   ```

4. **Deploy Application**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/menumaker.git
   cd menumaker/backend

   # Install dependencies
   npm ci --production

   # Build
   npm run build

   # Create .env file
   nano .env  # Add production variables

   # Start with PM2
   pm2 start dist/index.js --name menumaker-api
   pm2 save
   pm2 startup
   ```

5. **Setup Nginx**
   ```nginx
   # /etc/nginx/sites-available/menumaker
   server {
       listen 80;
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Enable HTTPS with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```

### Option 4: Railway

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Deploy**
   ```bash
   cd backend
   railway init
   railway up
   ```

3. **Add Environment Variables**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set JWT_SECRET=your-secret
   # ... set all variables
   ```

## Frontend Deployment

### Option 1: Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Build**
   ```bash
   cd frontend
   VITE_API_URL=https://api.yourdomain.com/api/v1 npm run build
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Configure Domain**
   - Add custom domain in Vercel dashboard
   - Update DNS records

### Option 2: Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build and Deploy**
   ```bash
   cd frontend
   netlify deploy --prod --dir=dist
   ```

3. **Configure Redirects**
   Create `frontend/dist/_redirects`:
   ```
   /*    /index.html   200
   ```

### Option 3: AWS S3 + CloudFront

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://menumaker-frontend
   aws s3 website s3://menumaker-frontend --index-document index.html
   ```

2. **Build and Upload**
   ```bash
   cd frontend
   VITE_API_URL=https://api.yourdomain.com/api/v1 npm run build
   aws s3 sync dist/ s3://menumaker-frontend --delete
   ```

3. **Create CloudFront Distribution**
   ```bash
   aws cloudfront create-distribution \
     --origin-domain-name menumaker-frontend.s3.amazonaws.com \
     --default-root-object index.html
   ```

4. **Setup Custom Domain**
   - Add CNAME record pointing to CloudFront distribution
   - Request SSL certificate in AWS Certificate Manager
   - Attach certificate to CloudFront distribution

### Option 4: Cloudflare Pages

1. **Connect Repository**
   - Go to Cloudflare Pages dashboard
   - Connect GitHub repository

2. **Configure Build**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `frontend`

3. **Add Environment Variables**
   - `VITE_API_URL`: Your backend API URL

4. **Deploy**
   - Auto-deploys on push to main branch

## Post-Deployment

### Verify Deployment

1. **Backend Health Check**
   ```bash
   curl https://api.yourdomain.com/health
   # Should return 200 OK
   ```

2. **Frontend Check**
   ```bash
   curl https://yourdomain.com
   # Should return HTML
   ```

3. **Test Critical Flows**
   - User signup
   - Business creation
   - Menu creation
   - Order placement

### Setup Database Backups

**AWS RDS:**
```bash
aws rds modify-db-instance \
  --db-instance-identifier menumaker-prod \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00"
```

**Heroku:**
```bash
heroku pg:backups:schedule DATABASE_URL --at '02:00 America/Los_Angeles' -a menumaker-api
```

### Configure CDN

For better performance, use a CDN:
- Cloudflare (recommended for both frontend and API)
- AWS CloudFront
- Fastly

### Setup Monitoring

See [Monitoring](#monitoring) section below.

## Monitoring

### Application Monitoring

**Option 1: Sentry**
```bash
# Install
npm install @sentry/node @sentry/react

# Configure backend
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: process.env.SENTRY_DSN });

# Configure frontend
import * as Sentry from '@sentry/react';
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
```

**Option 2: DataDog**
**Option 3: New Relic**

### Uptime Monitoring

- **UptimeRobot** (free)
- **Pingdom**
- **StatusCake**

Monitor these endpoints:
- `https://api.yourdomain.com/health`
- `https://yourdomain.com`

### Log Aggregation

**Option 1: Papertrail**
```bash
# Heroku
heroku addons:create papertrail -a menumaker-api
```

**Option 2: Logtail**
**Option 3: AWS CloudWatch**

### Performance Monitoring

- **Lighthouse** - Automated performance testing
- **WebPageTest** - Detailed performance analysis
- **Google Analytics** - User behavior

### Database Monitoring

Monitor:
- Connection pool size
- Query performance
- Slow queries
- Database size

**PostgreSQL:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Find slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Troubleshooting

### Common Issues

**1. Database Connection Errors**
```
Error: connect ECONNREFUSED
```
Solution:
- Verify DATABASE_URL is correct
- Check database firewall rules
- Ensure database is running

**2. CORS Errors**
```
Access to fetch at 'https://api...' has been blocked by CORS
```
Solution:
- Add frontend URL to CORS_ORIGIN
- Verify CORS middleware configuration

**3. Build Failures**
```
Module not found: Error: Can't resolve...
```
Solution:
- Check all dependencies are installed
- Verify environment variables are set
- Clear build cache and rebuild

**4. Memory Issues**
```
FATAL ERROR: JavaScript heap out of memory
```
Solution:
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`
- Use production build (smaller size)
- Check for memory leaks

**5. SSL/HTTPS Issues**
```
NET::ERR_CERT_AUTHORITY_INVALID
```
Solution:
- Verify SSL certificate is valid
- Check certificate expiration
- Ensure proper certificate chain

### Performance Issues

**Slow API Responses**
1. Enable database query logging
2. Add database indexes
3. Implement caching (Redis)
4. Use connection pooling
5. Optimize N+1 queries

**Slow Frontend Loading**
1. Enable compression (gzip/brotli)
2. Implement code splitting
3. Optimize images
4. Use CDN
5. Enable browser caching

### Rollback Procedure

**Heroku:**
```bash
heroku releases -a menumaker-api
heroku rollback v123 -a menumaker-api
```

**Vercel:**
```bash
vercel rollback <deployment-url>
```

**Manual (Git):**
```bash
git revert HEAD
git push origin main
```

## Security Checklist

- [ ] HTTPS enabled everywhere
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] JWT secrets are strong and unique
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (React handles most cases)
- [ ] Security headers configured
- [ ] Regular dependency updates
- [ ] Automated security scanning

## Scaling Considerations

### Vertical Scaling
- Upgrade server instance size
- Increase database resources
- More memory for Node.js

### Horizontal Scaling
- Multiple backend instances
- Load balancer (AWS ALB, Nginx)
- Database read replicas
- Redis for session storage

### Database Scaling
- Connection pooling
- Read replicas
- Query optimization
- Sharding (future consideration)

## Cost Optimization

### MVP/Hobby Tier (~$25-50/month)
- Heroku Hobby dyno ($7/month)
- Heroku Postgres Mini ($5/month)
- AWS S3 (~$3/month)
- Vercel Hobby (Free)
- Cloudflare (Free)

### Growth Tier (~$100-200/month)
- Render Standard ($25/month)
- AWS RDS db.t3.small (~$30/month)
- AWS S3 + CloudFront (~$10/month)
- Vercel Pro ($20/month)
- Sentry ($26/month)

### Production Tier (~$500+/month)
- Multiple backend instances
- Production database
- CDN
- Monitoring tools
- Backup solutions

## Support

For deployment issues:
1. Check this guide
2. Review application logs
3. Consult hosting provider docs
4. Create GitHub issue with details

## Additional Resources

- [Heroku Node.js Deployment](https://devcenter.heroku.com/articles/deploying-nodejs)
- [AWS Deployment Best Practices](https://aws.amazon.com/architecture/well-architected/)
- [Vercel Deployment Documentation](https://vercel.com/docs)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
