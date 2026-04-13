# FinRisk AI - Complete Deployment Guide

This guide covers multiple deployment options for your FinRisk AI application.

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Docker Deployment](#docker-deployment)
3. [Cloud Deployment Options](#cloud-deployment-options)
   - [Heroku](#heroku-deployment)
   - [Railway](#railway-deployment)
   - [Render](#render-deployment)
   - [AWS](#aws-deployment)
   - [Vercel (Frontend) + MongoDB Atlas (Backend)](#vercel--mongodb-atlas)
4. [GitHub Repository Setup](#github-repository-setup)

---

## Local Development Setup

### Prerequisites
- Node.js (v14+)
- MongoDB (local or Atlas)
- Git

### Frontend Setup
```bash
# Navigate to project root
cd finrisk-ai-complete

# Install frontend dependencies
npm install

# Create frontend .env file
echo "VITE_API_BASE_URL=http://localhost:5000" > .env

# Start frontend development server
npm run dev
```
Frontend will run on `http://localhost:3001`

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install backend dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB connection string

# Seed database with sample data
npm run seed

# Start backend server
npm run dev
```
Backend will run on `http://localhost:5000`

---

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

This will start:
- MongoDB on port 27017
- Backend API on port 5000

### Build Backend Only
```bash
cd backend
docker build -t finrisk-backend .
docker run -p 5000:5000 --env-file .env finrisk-backend
```

---

## Cloud Deployment Options

### Heroku Deployment

#### Backend Deployment

1. **Install Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login and Create App**
   ```bash
   heroku login
   cd backend
   heroku create finrisk-ai-backend
   ```

3. **Add MongoDB**
   ```bash
   heroku addons:create mongolab:sandbox
   # Or use MongoDB Atlas connection string
   heroku config:set MONGODB_URI="your_mongodb_atlas_uri"
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set CORS_ORIGIN="https://your-frontend-url.com"
   ```

5. **Deploy**
   ```bash
   git init
   git add .
   git commit -m "Initial backend deploy"
   git push heroku main
   ```

6. **Seed Database**
   ```bash
   heroku run npm run seed
   ```

#### Frontend Deployment

```bash
cd ..  # Back to root
heroku create finrisk-ai-frontend
heroku config:set VITE_API_BASE_URL="https://finrisk-ai-backend.herokuapp.com"

# Add Node.js buildpack
heroku buildpacks:add heroku/nodejs

git push heroku main
```

---

### Railway Deployment

1. **Go to [Railway.app](https://railway.app/)**
2. **Sign up/Login with GitHub**
3. **Click "New Project"**

#### Backend:
- Select "Deploy from GitHub repo"
- Choose your repository
- Railway auto-detects Node.js
- Add environment variables in Railway dashboard:
  ```
  MONGODB_URI=your_connection_string
  NODE_ENV=production
  CORS_ORIGIN=your_frontend_url
  ```
- Set root directory to `/backend`
- Deploy!

#### Database:
- Click "New" → "Database" → "Add MongoDB"
- Copy connection string to backend environment variables

#### Frontend:
- Create new service from same repo
- Set build command: `npm run build`
- Set start command: `npm run preview`
- Add environment variable:
  ```
  VITE_API_BASE_URL=your_backend_url
  ```

---

### Render Deployment

1. **Go to [Render.com](https://render.com/)**
2. **Sign up/Login**

#### Backend (Web Service):
- New → Web Service
- Connect GitHub repository
- Settings:
  - Name: `finrisk-backend`
  - Root Directory: `backend`
  - Environment: `Node`
  - Build Command: `npm install`
  - Start Command: `npm start`
- Environment Variables:
  ```
  MONGODB_URI=your_connection_string
  NODE_ENV=production
  CORS_ORIGIN=your_frontend_url
  ```

#### Database:
- New → PostgreSQL/MongoDB
- Or use MongoDB Atlas
- Copy connection string to backend env vars

#### Frontend (Static Site):
- New → Static Site
- Settings:
  - Build Command: `npm run build`
  - Publish Directory: `dist`
- Environment Variables:
  ```
  VITE_API_BASE_URL=your_backend_url
  ```

---

### AWS Deployment

#### Using Elastic Beanstalk

1. **Install EB CLI**
   ```bash
   pip install awsebcli
   ```

2. **Initialize Backend**
   ```bash
   cd backend
   eb init -p node.js finrisk-backend
   ```

3. **Create Environment**
   ```bash
   eb create finrisk-production
   ```

4. **Set Environment Variables**
   ```bash
   eb setenv MONGODB_URI="your_connection" NODE_ENV=production
   ```

5. **Deploy**
   ```bash
   eb deploy
   ```

#### Using EC2 (Manual)

1. **Launch EC2 Instance** (Ubuntu 22.04)
2. **SSH into instance**
3. **Install Node.js and MongoDB**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs mongodb
   ```

4. **Clone repository**
   ```bash
   git clone your-repo-url
   cd finrisk-ai-complete/backend
   ```

5. **Install dependencies**
   ```bash
   npm install
   ```

6. **Setup environment**
   ```bash
   nano .env  # Add your configuration
   ```

7. **Use PM2 for process management**
   ```bash
   sudo npm install -g pm2
   pm2 start src/server.js --name finrisk-backend
   pm2 startup
   pm2 save
   ```

8. **Setup Nginx as reverse proxy**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/finrisk
   ```

   Add configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/finrisk /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

### Vercel + MongoDB Atlas

This is the recommended approach for beginners!

#### Setup MongoDB Atlas (Free Tier)

1. **Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)**
2. **Create free account**
3. **Create a cluster** (Free M0 tier)
4. **Database Access**: Create a database user
5. **Network Access**: Add IP (0.0.0.0/0 for development)
6. **Get connection string**:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/finrisk-ai
   ```

#### Deploy Backend to Vercel

1. **Create `vercel.json` in backend directory**:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "src/server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "src/server.js"
       }
     ]
   }
   ```

2. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

3. **Deploy backend**:
   ```bash
   cd backend
   vercel
   # Follow prompts
   ```

4. **Set environment variables in Vercel dashboard**:
   - MONGODB_URI
   - NODE_ENV=production
   - CORS_ORIGIN

#### Deploy Frontend to Vercel

1. **Deploy frontend**:
   ```bash
   cd ..  # Back to root
   vercel
   ```

2. **Add environment variable**:
   - VITE_API_BASE_URL=your_backend_url

---

## GitHub Repository Setup

### Initial Setup

```bash
cd finrisk-ai-complete

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Complete FinRisk AI application"

# Create repository on GitHub, then:
git remote add origin https://github.com/yourusername/finrisk-ai.git
git branch -M main
git push -u origin main
```

### Repository Structure

```
finrisk-ai/
├── backend/              # Backend API
│   ├── src/
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
├── src/                  # Frontend source
├── public/               # Frontend public assets
├── docker-compose.yml    # Docker orchestration
├── package.json          # Frontend dependencies
├── DEPLOYMENT.md         # This file
└── README.md            # Project README
```

---

## Post-Deployment Steps

### 1. Seed the Database
```bash
# Local
npm run seed

# Heroku
heroku run npm run seed

# Railway/Render
Use their console/terminal feature
```

### 2. Test the API
```bash
# Health check
curl https://your-backend-url.com/health

# Create application
curl -X POST https://your-backend-url.com/api/applications \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","loanAmount":50000,"income":75000,"expenses":30000,"creditScore":700,"yearsEmployed":3}'
```

### 3. Update Frontend API URL
Make sure your frontend `.env` has the correct backend URL:
```env
VITE_API_BASE_URL=https://your-backend-url.com
```

### 4. Enable CORS
Update backend CORS_ORIGIN to match your frontend URL:
```env
CORS_ORIGIN=https://your-frontend-url.com
```

---

## Monitoring and Logs

### Heroku
```bash
heroku logs --tail
```

### Railway
- Dashboard → Logs tab

### Render
- Dashboard → Logs

### PM2 (EC2)
```bash
pm2 logs
pm2 monit
```

---

## Troubleshooting

### Common Issues

1. **CORS errors**: Check CORS_ORIGIN matches frontend URL
2. **MongoDB connection**: Verify connection string and IP whitelist
3. **Environment variables**: Ensure all required vars are set
4. **Build failures**: Check Node.js version compatibility

### Debug Commands
```bash
# Check environment variables
env | grep VITE
env | grep MONGODB

# Test MongoDB connection
mongosh "your_connection_string"

# Check port availability
lsof -i :5000
```

---

## Security Checklist

- [ ] Change default JWT_SECRET
- [ ] Use strong MongoDB password
- [ ] Enable MongoDB authentication
- [ ] Use HTTPS in production
- [ ] Restrict CORS to specific domains
- [ ] Keep dependencies updated
- [ ] Use environment variables for secrets
- [ ] Enable rate limiting (future enhancement)

---

## Support

For deployment issues:
1. Check the logs
2. Verify environment variables
3. Test API endpoints individually
4. Check database connectivity

---

**Good luck with your deployment! 🚀**
