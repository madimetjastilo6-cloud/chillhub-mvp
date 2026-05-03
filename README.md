# ChillHub Easy Hosted MVP v5

This version is made for easy hosting with HTTPS.

## Local test on PC
```bash
npm install
npm start
```
Open: http://localhost:3000

## Easy host/user links after deployment
After uploading to Render, your links will be:

- User link: `https://YOUR-APP.onrender.com`
- Host link: `https://YOUR-APP.onrender.com/host`

Hosts only need to open `/host`, enter their name, tap Enter, then keep the page open.
Users open the normal link, go to Online Hosts, refresh, and call.

## Deploy on Render
1. Create a GitHub account or use your existing one.
2. Upload this whole folder to a new GitHub repository.
3. Go to Render and create a new Web Service from that repository.
4. Use:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Render gives you an HTTPS link. Use that link for users and `/host` for hosts.

## Important
Phone video needs HTTPS. Render gives HTTPS automatically.
