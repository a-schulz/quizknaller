# Netcup Webhosting Deployment Guide

## Prerequisites
- Netcup Webhosting 4000 or 8000 (Python support required)
- Domain configured with Name.com
- FTP access to your Netcup webhosting

## Step-by-Step Deployment Instructions

### 1. Configure Your Domain

#### At Name.com:
1. Log in to your Name.com account
2. Go to your domain management
3. Update DNS settings:
   - **A Record**: Point to your Netcup server IP (found in Netcup control panel)
   - Or use **CNAME**: Point to your Netcup hosting domain

#### At Netcup:
1. Log in to Webhosting Control Panel (WCP)
2. Go to "Domains" → "Externe Domain hinzufügen"
3. Add your Name.com domain
4. Wait for DNS propagation (can take up to 24 hours)

### 2. Prepare Your Files

Create the following directory structure on your local machine:

```
/
├── quizknaller/          (App Root - outside Document Root!)
│   ├── main.py
│   ├── database.py
│   ├── passenger_wsgi.py (startup file)
│   ├── quizzes.json
│   ├── requirements.txt
│   ├── static/
│   │   ├── host.html
│   │   ├── host.css
│   │   ├── host.js
│   │   ├── player.html
│   │   ├── player.css
│   │   └── player.js
│   └── tmp/              (create empty directory)
```

**Important**: The `quizknaller` directory should be at the root level of your webspace, NOT inside the public_html/htdocs folder!

### 3. Upload Files via FTP

1. Connect to your Netcup webhosting via FTP:
   - Host: Your domain or Netcup FTP server
   - Username: Your FTP username (from WCP)
   - Password: Your FTP password
   - Port: 21 (or 22 for SFTP)

2. Upload the entire `quizknaller` folder to the root of your webspace

3. Set correct permissions:
   - `quizknaller/` → 755
   - `quizknaller/tmp/` → 777 (writable)
   - `passenger_wsgi.py` → 644
   - All `.py` files → 644

### 4. Install Python Dependencies

1. Go to WCP → "Entwicklertools" → "SSH-Zugang"
2. Enable SSH access (if available) or use the file manager
3. Connect via SSH and run:
   ```bash
   cd quizknaller
   pip3 install --user -r requirements.txt
   ```

**Note**: If SSH is not available, you may need to contact Netcup support or use their Python package manager in WCP.

### 5. Configure Python Module in WCP

1. Go to WCP Dashboard → "Entwicklertools" → "Python"
2. Select your domain
3. Configure settings:
   - **Einschalten**: Click to activate Python
   - **App Root**: `quizknaller` (relative to webspace root)
   - **Startup Datei**: `passenger_wsgi.py`
   - **Python Version**: Select latest available (3.9+ recommended)
   - **Modus**: 
     - "Entwicklung" for testing (shows errors)
     - "Produktiv" for production (hides errors)
4. Click "Konfiguration neu schreiben"
5. Click "Anwendung Neuladen"

### 6. Configure Domain Document Root

1. In WCP, go to "Domains" → Select your domain
2. Make sure the Document Root is empty or points to a different directory
3. **Important**: Do NOT place index.html or index.php in Document Root
4. The Python app will handle all requests

### 7. Set Up SSL Certificate

1. Go to WCP → "SSL/TLS"
2. Select your domain
3. Enable "Let's Encrypt" SSL certificate (free)
4. Wait for certificate generation (~5 minutes)
5. Force HTTPS redirection in domain settings

### 8. Test Your Application

1. Visit your domain: `https://yourdomain.com`
2. You should see the QuizKnaller player interface
3. Visit: `https://yourdomain.com/host` for the host interface
4. Check for errors in WCP → "Entwicklertools" → "Python" → "Logs"

### 9. Troubleshooting

#### App not loading:
- Check Python is enabled for your domain
- Verify `passenger_wsgi.py` is in the App Root
- Check file permissions (755 for directories, 644 for files)
- Review error logs in WCP

#### WebSocket not working:
- Ensure `asgiref` is installed
- Check if Netcup supports WebSocket connections
- May need to contact Netcup support for WebSocket enablement

#### Database issues:
- Create `tmp/` directory with 777 permissions
- SQLite database will be created automatically
- Ensure write permissions on App Root directory

#### Static files not loading:
- Verify `static/` folder is in App Root
- Check file paths in HTML files
- Ensure CSS/JS files have correct permissions

### 10. Restart Application

When you make changes:
1. Go to WCP → "Python" → Your domain
2. Click "Anwendung Neuladen"
3. Or create/touch the file: `quizknaller/tmp/restart.txt`
   ```bash
   touch ~/quizknaller/tmp/restart.txt
   ```

### 11. Monitoring and Maintenance

- **View Logs**: WCP → "Entwicklertools" → "Python" → "Logs"
- **Database Backups**: Enable automatic backups in WCP
- **Update Application**: Upload new files via FTP and reload
- **Clean old games**: Database auto-cleanup runs on startup (24h old games)

## Important Notes

### Limitations on Shared Hosting:
- WebSocket support may be limited on shared hosting
- Long-running connections might timeout
- Consider upgrading to VPS if you need guaranteed WebSocket support

### Performance Optimization:
- Use Production mode (`Produktiv`) for better performance
- Enable gzip compression in domain settings
- Consider using CDN for static files

### Security:
- Keep your App Root outside Document Root (security best practice)
- Use strong FTP/SSH passwords
- Enable HTTPS (Let's Encrypt)
- Regularly update Python packages

## Quick Reference Commands

```bash
# Connect via SSH
ssh username@yourdomain.com

# Install dependencies
cd quizknaller
pip3 install --user -r requirements.txt

# Restart application
touch tmp/restart.txt

# Check Python version
python3 --version

# View running processes
ps aux | grep python
```

## Support

If you encounter issues:
1. Check Netcup Wiki: https://www.netcup-wiki.de/
2. Contact Netcup Support: support@netcup.de
3. Check Python/Passenger logs in WCP
4. Verify Name.com DNS settings

## Alternative: If WebSockets Don't Work

If Netcup shared hosting doesn't support WebSockets properly, consider:
1. **Upgrade to Netcup VPS**: Full control, guaranteed WebSocket support
2. **Use Render/Railway**: Deploy there and point your domain via CNAME
3. **Hybrid approach**: Host static files on Netcup, WebSocket app on VPS

---

Your QuizKnaller should now be live at your Name.com domain hosted on Netcup! 🎉
