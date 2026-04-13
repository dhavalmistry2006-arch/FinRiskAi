# 🎯 FinRisk AI

An intelligent financial risk assessment platform powered by AI that evaluates loan applications in real-time and provides comprehensive risk analysis.

![FinRisk AI](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)
![React](https://img.shields.io/badge/React-19-blue)

## ✨ Features

- 🤖 **AI-Powered Risk Assessment** - Advanced algorithm analyzing multiple financial factors
- 📊 **Real-time Analytics Dashboard** - Comprehensive insights and visualizations
- 📈 **Application Tracking** - Monitor all loan applications with detailed status
- 🎨 **Modern UI/UX** - Beautiful, responsive interface built with React and TailwindCSS
- 🔒 **Input Validation** - Robust validation and error handling
- 📱 **Mobile Responsive** - Works seamlessly on all devices
- 🚀 **Fast Performance** - Optimized for speed and efficiency

## 🎬 Demo

Try the live demo: [finrisk-ai.demo.com](#) *(coming soon)*

## 📸 Screenshots

### Dashboard Overview
![Dashboard](screenshots/dashboard.png)

### Risk Analysis
![Risk Analysis](screenshots/risk-analysis.png)

### Application Management
![Applications](screenshots/applications.png)

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│                 │         │                  │         │             │
│  React Frontend │◄────────│  Express Backend │◄────────│   MongoDB   │
│   (TanStack)    │  REST   │     (Node.js)    │  Mongoose│   Database  │
│                 │   API   │                  │         │             │
└─────────────────┘         └──────────────────┘         └─────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 with TanStack Router
- **Styling**: TailwindCSS 4.2
- **UI Components**: Radix UI, shadcn/ui
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod validation
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Custom middleware
- **CORS**: Configured for cross-origin requests

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/finrisk-ai.git
   cd finrisk-ai
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your MongoDB connection string
   npm run seed  # Optional: Populate with sample data
   npm run dev
   ```

3. **Setup Frontend** (in a new terminal)
   ```bash
   cd ..  # Back to root
   npm install
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:5000
   - API Health: http://localhost:5000/health

## 📚 Documentation

- **[API Documentation](backend/README.md)** - Complete backend API reference
- **[Deployment Guide](DEPLOYMENT.md)** - Deploy to Heroku, Railway, Render, AWS, Vercel
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute to the project

## 🎯 Usage

### Creating an Application

1. Navigate to the "New Application" section
2. Fill in the applicant details:
   - Personal Information (Name, Email, Phone)
   - Financial Information (Income, Expenses, Loan Amount)
   - Employment Details (Employer, Years Employed)
   - Credit Score
3. Submit the application
4. View real-time risk assessment

### Risk Assessment Factors

The AI algorithm evaluates:
- **Debt-to-Income Ratio**: Primary risk indicator
- **Credit Score**: Historical creditworthiness (300-850)
- **Employment Stability**: Years with current employer
- **Loan Amount**: Requested loan size
- **Income Level**: Annual income bracket

### Risk Levels

- 🟢 **Low Risk (0-34)**: Automatically Approved
- 🟡 **Medium Risk (35-64)**: Manual Review Required
- 🔴 **High Risk (65-100)**: Automatically Rejected

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
npm test
```

### Seed Database
```bash
cd backend
npm run seed
```

This creates 10 sample applications with various risk profiles.

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

This starts:
- MongoDB on port 27017
- Backend API on port 5000

### Individual Container

```bash
cd backend
docker build -t finrisk-backend .
docker run -p 5000:5000 --env-file .env finrisk-backend
```

## 🌐 Environment Variables

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:5000
```

### Backend (backend/.env)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/finrisk-ai
CORS_ORIGIN=http://localhost:3001
JWT_SECRET=your_secret_key
```

## 📊 API Endpoints

### Applications
- `POST /api/applications` - Create application
- `GET /api/applications` - Get all applications
- `GET /api/applications/:id` - Get single application
- `PATCH /api/applications/:id` - Update application
- `DELETE /api/applications/:id` - Delete application

### Risk Assessment
- `POST /api/predict-risk` - Calculate risk score

### Dashboard
- `GET /api/dashboard/overview` - Dashboard metrics

### Analytics
- `GET /api/analytics` - Analytics data

Full API documentation: [backend/README.md](backend/README.md)

## 🗺️ Roadmap

- [ ] User authentication and authorization
- [ ] Email notifications for application status
- [ ] PDF report generation
- [ ] Advanced ML model integration
- [ ] Batch processing for multiple applications
- [ ] API rate limiting
- [ ] Webhooks for real-time updates
- [ ] Multi-language support

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md).

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Dhaval Mistry** - *Initial work* - [@dhavalmistry2006-arch](https://github.com/dhavalmistry2006-arch)

## 🙏 Acknowledgments

- React and TanStack teams for amazing frameworks
- MongoDB team for excellent database
- All contributors who helped build this project

## 📧 Contact

- GitHub: [@dhavalmistry2006-arch](https://github.com/dhavalmistry2006-arch)
- Email: your.email@example.com
- Project Link: [https://github.com/dhavalmistry2006-arch/finrisk-ai](https://github.com/dhavalmistry2006-arch/finrisk-ai)

## ⭐ Star History

If you find this project useful, please consider giving it a star!

---

**Built with ❤️ using React, Node.js, and MongoDB**
