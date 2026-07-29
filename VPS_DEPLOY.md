# VPS Deployment Guide — LESAVI-SURAMADU

## VPS Credentials
```
Host: 103.183.74.104
User: ivalora
Password: Sura123Baya45
SSH Port: 22
```

## Database Credentials
```
Database: lesavi_db
User: postgres
Password: password
Host: 127.0.0.1:5432
```

## Important: How This Project Works

### Login uses `account_managers` table (NOT `admin_users`)
The login API queries `account_managers` table, so admin users must be inserted there:
```sql
INSERT INTO account_managers (nik, nama, slug, email, password_hash, role, tipe, divisi, witel, aktif)
VALUES ('admin', 'Administrator', 'admin', 'email@example.com', '$2b$10$...', 'ADMIN', 'ADMIN', 'DPS', 'SURAMADU', true)
ON CONFLICT (nik) DO UPDATE SET ...;
```

### Password Hashing
- Uses **bcrypt** via `bcryptjs`
- Prefix must be `$2b$` (Node.js v24 generates `$2y$` by default — use Python `bcrypt` to generate hashes)
- Never generate hashes with `node -e "require('bcryptjs')..."` on this VPS — it produces incompatible `$2y$` hashes

## Deployment Steps

### 1. Git Pull & Build (on VPS)
```bash
cd /home/ivalora/LESAVI-SURAMADU
git fetch origin master
git reset --hard origin/master

# Install deps (allow lockfile mismatch)
pnpm install --no-frozen-lockfile

# Build API
node apps/api/build.mjs

# Build Dashboard
cd apps/dashboard && npx vite build --config vite.config.ts

# Copy frontend
sudo cp -r apps/dashboard/dist/* /var/www/lesavi/
```

### 2. Set Environment Variables
Create `.env` at `/home/ivalora/LESAVI-SURAMADU/.env`:
```
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/lesavi_db
SESSION_SECRET=a_very_long_and_secret_string_for_lesavi_suramadu
PORT=8080
NODE_ENV=production
```

### 3. Create Startup Script
Create `/home/ivalora/LESAVI-SURAMADU/start-api.sh`:
```bash
#!/bin/bash
cd /home/ivalora/LESAVI-SURAMADU
export $(cat .env | grep -v '^#' | grep '=' | xargs) > /dev/null 2>&1
exec node apps/api/dist/index.mjs
```

### 4. Create PM2 Ecosystem Config
Create `/home/ivalora/LESAVI-SURAMADU/ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [{
    name: 'lesavi-suramadu',
    script: './start-api.sh',
    cwd: '/home/ivalora/LESAVI-SURAMADU',
    interpreter: 'bash',
    env: {
      NODE_ENV: 'production',
    }
  }]
};
```

### 5. Restart Service
```bash
pm2 delete lesavi-suramadu 2>/dev/null
pm2 start ecosystem.config.cjs
pm2 save
```

### 6. Fix Nginx (if needed)
Nginx proxies `/api/` to `http://127.0.0.1:PORT/api/`. Current PORT is **8080**.

Check config:
```bash
cat /etc/nginx/sites-available/lesavi
```

Ensure proxy_pass points to correct port:
```
location /api/ {
    proxy_pass http://127.0.0.1:8080/api/;
    ...
}
```

Reload nginx:
```bash
sudo nginx -s reload
```

## NPM/PNPM Issues on VPS

### Lockfile Mismatch
If `pnpm install --frozen-lockfile` fails:
```bash
pnpm install --no-frozen-lockfile
```

### Missing Dependencies
Root `node_modules` may be incomplete. Run:
```bash
pnpm install
```

## Adding Admin User via DB
```bash
# Generate bcrypt hash locally:
python -c "import bcrypt; print(bcrypt.hashpw(b'yourpassword', bcrypt.gensalt(10)).decode())"

# Then on VPS:
sudo -u postgres psql -d lesavi_db -c "INSERT INTO account_managers (...) VALUES (...)"
```

## PM2 Commands
```bash
pm2 list                    # show all processes
pm2 logs lesavi-suramadu    # view logs
pm2 restart lesavi-suramadu # restart
pm2 delete lesavi-suramadu  # remove
pm2 save                    # save process list
```

## File Locations
- Project: `/home/ivalora/LESAVI-SURAMADU/`
- Frontend: `/var/www/lesavi/`
- PM2 logs: `/home/ivalora/.pm2/logs/`
- Nginx config: `/etc/nginx/sites-available/lesavi`
