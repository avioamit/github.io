# Shree Tahl mata Temple Website

A responsive one-page temple website built with HTML, CSS, and JavaScript.

## Files
- `index.html` — main page structure
- `styles.css` — full visual styling
- `script.js` — mobile nav toggle and footer year

## Preview locally
Open `index.html` in a browser, or serve the folder with any static host tool.

## Deploy to Hostinger
1. Log in to your Hostinger dashboard.
2. Open your website or create a new one.
3. Upload the contents of this folder to the public web root.
4. Ensure the homepage is `index.html`.
5. Publish the site and verify the page loads.

## Admin access
To edit event details, open the admin page:
- URL: `admin.html`
- Default username: `admin`
- Default password: `temple123`

For internet access, set environment variables before starting the app:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `NODE_ENV=production`

Example:
```bash
set ADMIN_USERNAME=admin
set ADMIN_PASSWORD=YourStrongPassword
set NODE_ENV=production
node server.js
```

Run the app behind HTTPS on a public host for admin login to work from anywhere on the internet.

## Notes
This version is a static marketing site suited for temple information, daily schedules, events, and donation/contact calls to action.
