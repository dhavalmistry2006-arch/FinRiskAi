# FinRisk AI - Quick Start Guide 🚀

Get your FinRisk AI application running in 5 minutes!

## 1️⃣ Install Prerequisites

- **Node.js**: [Download here](https://nodejs.org/) (v14 or higher)
- **MongoDB**: Choose one option:
  - **Local**: [Download MongoDB](https://www.mongodb.com/try/download/community)
  - **Cloud (Recommended for beginners)**: [MongoDB Atlas Free Tier](https://www.mongodb.com/cloud/atlas)

## 2️⃣ Setup MongoDB

### Option A: MongoDB Atlas (Recommended - No installation needed!)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster (Free M0 tier)
4. Click "Connect" → "Connect your application"
5. Copy the connection string (looks like `mongodb+srv://username:password@cluster.mongodb.net/`)
6. Replace `<password>` with your database password

### Option B: Local MongoDB

```bash
# macOS (using Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongod

# Windows
# Download installer from https://www.mongodb.com/try/download/community
# Run as administrator
net start MongoDB
```

## 3️⃣ Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/finrisk-ai.git
cd finrisk-ai
```

## 4️⃣ Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file - add your MongoDB connection string
# For MongoDB Atlas: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/finrisk-ai
# For Local MongoDB: MONGODB_URI=mongodb://localhost:27017/finrisk-ai

# Seed the database with sample data (optional but recommended)
npm run seed

# Start the backend server
npm run dev
```

✅ Backend running at http://localhost:5000

## 5️⃣ Frontend Setup (New Terminal Window)

```bash
# From project root
npm install

# Start the frontend
npm run dev
```

✅ Frontend running at http://localhost:3001

## 6️⃣ Access the Application

Open your browser and go to: **http://localhost:3001**

## 🎉 You're Done!

Try creating a new application:
1. Click "New Application"
2. Fill in the form
3. See the AI risk assessment in real-time!

## 🐛 Troubleshooting

### Backend won't start?
- Check MongoDB is running: `mongosh` (should connect)
- Verify `.env` file has correct MONGODB_URI
- Check port 5000 is not in use

### Frontend won't connect to backend?
- Check backend is running on port 5000
- Visit http://localhost:5000/health (should show `{"status":"ok"}`)
- Verify `.env` has `VITE_API_BASE_URL=http://localhost:5000`

### MongoDB connection failed?
- **Atlas**: Check IP whitelist (add 0.0.0.0/0 for testing)
- **Atlas**: Verify username and password
- **Local**: Check MongoDB is running with `brew services list` or `systemctl status mongod`

### Port already in use?
```bash
# Find what's using the port
lsof -i :5000  # or :3001

# Kill the process
kill -9 <PID>
```

## 📚 Next Steps

- Read the full [README.md](README.md)
- Check out the [API Documentation](backend/README.md)
- Learn about [Deployment Options](DEPLOYMENT.md)

## 💡 Useful Commands

```bash
# Seed database with sample data
cd backend && npm run seed

# Reset database (remove all data)
# In MongoDB shell:
mongosh
use finrisk-ai
db.applications.deleteMany({})

# Check backend health
curl http://localhost:5000/health

# View backend logs (if using PM2)
pm2 logs
```

## 🆘 Need Help?

- Check the [Full Documentation](README.md)
- Open an issue on GitHub
- Contact: your.email@example.com

---

Happy coding! 🎯
