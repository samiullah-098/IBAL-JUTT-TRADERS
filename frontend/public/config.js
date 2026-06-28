// Runtime backend URL. Local dev uses backend port 5000; Netlify uses same site origin + Netlify Functions.
window.__API_URL__ = window.location.hostname === "localhost" ? "http://localhost:5000" : window.location.origin;
