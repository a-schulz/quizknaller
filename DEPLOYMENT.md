# QuizKnaller Deployment Guide

## Free Hosting Options for Your Quiz Application

Based on the GitHub Student Developer Pack and other free services, here are the best options for hosting your Python FastAPI + WebSocket application:

### 🎓 **GitHub Student Pack Options**

#### 1. **Heroku** (RECOMMENDED for beginners)
- **Free Tier**: $13 USD credit per month for 24 months (Student Pack)
- **Pros**:
  - Dead simple deployment with Git
  - Supports WebSockets perfectly
  - PostgreSQL add-on available
  - Easy environment variables management
- **Cons**:
  - Dynos sleep after 30 min of inactivity (not ideal for real-time apps)
  - Limited to 512 MB RAM on free tier
- **Setup**:
  ```bash
  # Install Heroku CLI
  brew install heroku/brew/heroku
  
  # Login and create app
  heroku login
  heroku create quizknaller
  
  # Add Procfile
  echo "web: uvicorn main:socket_app --host 0.0.0.0 --port \$PORT" > Procfile
  
  # Deploy
  git push heroku main
  ```

#### 2. **Microsoft Azure** (Best for scalability)
- **Free Tier**: $100 credit for first month + free services (Student Pack)
- **Pros**:
  - Azure App Service supports WebSockets
  - Very reliable and scalable
  - SQLite file storage works great
  - 60 minutes of free build time
- **Cons**:
  - More complex setup
  - Credits run out after first month
- **Setup**: Use Azure App Service with Python 3.11+ runtime

#### 3. **DigitalOcean** (Best overall value)
- **Free Tier**: $200 credit for 1 year (Student Pack)
- **Pros**:
  - Full VPS control
  - Excellent for WebSocket apps
  - Can run anything you want
  - Great documentation
- **Cons**:
  - Requires more server management
  - Need to set up reverse proxy (nginx)
- **Setup**: Deploy on App Platform (Platform-as-a-Service)

### 🆓 **Other Free Options (No Student Pack Required)**

#### 4. **Render** (BEST FREE OPTION)
- **Free Tier**: Unlimited (with limitations)
- **Pros**:
  - Native WebSocket support
  - Auto-deploy from GitHub
  - Free PostgreSQL/SQLite
  - No credit card required
  - HTTPS included
- **Cons**:
  - Free tier spins down after 15 min inactivity (50s cold start)
  - 750 hours/month limit
- **Website**: https://render.com
- **Setup**:
  ```yaml
  # render.yaml
  services:
    - type: web
      name: quizknaller
      runtime: python
      buildCommand: pip install -r requirements.txt
      startCommand: uvicorn main:socket_app --host 0.0.0.0 --port $PORT
  ```

#### 5. **Railway** (Developer-friendly)
- **Free Tier**: $5 credit/month (500 hours)
- **Pros**:
  - Excellent for WebSockets
  - Simple deployment from GitHub
  - Great DX (developer experience)
  - Automatic HTTPS
- **Cons**:
  - Limited free hours
  - Will need to upgrade eventually
- **Website**: https://railway.app

#### 6. **Fly.io** (Modern platform)
- **Free Tier**: 3 shared-cpu VMs + 3GB persistent volume
- **Pros**:
  - Real VMs (not containers)
  - Global edge network
  - Perfect for WebSockets
  - Very fast deployments
- **Cons**:
  - Slightly more complex setup
  - Credit card required (but not charged)
- **Website**: https://fly.io

### ❌ **NOT Recommended for WebSockets**

- **Vercel** - No WebSocket support
- **Netlify** - Serverless functions only, no WebSockets
- **GitHub Pages** - Static sites only
- **PythonAnywhere** - Limited WebSocket support on free tier

---

## 🏆 My Recommendations

### For Absolute Beginners:
**Render** - Zero config, just connect GitHub and deploy. Perfect for learning.

### For Student Pack Users:
**DigitalOcean App Platform** - Use your $200 credit wisely. Great performance and reliability.

### For Production/Serious Projects:
**Railway or Fly.io** - Best performance for real-time WebSocket apps.

---

## 📦 Required Files for Deployment

### 1. Create `requirements.txt`:
```txt
fastapi>=0.122.0
uvicorn>=0.38.0
python-socketio>=5.15.0
qrcode>=8.2
pillow>=12.0.0
aiofiles>=25.1.0
```

### 2. Create `Procfile` (for Heroku/Railway):
```
web: uvicorn main:socket_app --host 0.0.0.0 --port $PORT
```

### 3. Create `.gitignore`:
```
*.db
*.db-journal
__pycache__/
.env
venv/
.DS_Store
```

### 4. Update your code for deployment:
- Use environment variable for PORT
- Configure CORS properly
- Set up database backup strategy

---

## 🚀 Deployment Steps (Render Example)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Go to Render Dashboard**
   - Visit https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo

3. **Configure**
   - Name: `quizknaller`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:socket_app --host 0.0.0.0 --port $PORT`

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (~2-3 minutes)
   - Your app will be live at `https://quizknaller.onrender.com`

---

## 💡 Pro Tips

1. **Database Persistence**: SQLite file persists on Render's free tier, but can be wiped. Consider:
   - Upgrading to paid tier for persistent disk
   - Using PostgreSQL add-on (free on most platforms)
   - Regular backups to GitHub/cloud storage

2. **WebSocket Testing**: Test your WebSocket connection:
   ```javascript
   const socket = io('https://your-app.onrender.com');
   ```

3. **Environment Variables**: Set these in your hosting platform:
   - `PORT` (auto-set by most platforms)
   - Any API keys or secrets

4. **Monitoring**: Use the platform's built-in logs to debug issues

5. **Custom Domain**: Most platforms offer free custom domains or integrate with Namecheap (free .me domain in Student Pack)

---

## 🎯 Quick Start: Deploy to Render Now

```bash
# 1. Create requirements.txt
echo "fastapi>=0.122.0
uvicorn>=0.38.0
python-socketio>=5.15.0
qrcode>=8.2
pillow>=12.0.0
aiofiles>=25.1.0" > requirements.txt

# 2. Commit
git add requirements.txt
git commit -m "Add requirements.txt for deployment"
git push

# 3. Go to render.com, connect GitHub, and deploy!
```

Your quiz app will be live in minutes! 🎉
