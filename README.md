# Axioma

Website of the Axioma web studio: https://axioma.codes

- `/` and `/en/` — home page (Russian and English): portfolio, services, process, FAQ and a request form.
  Built by `python build_home.py` (run in this folder) from one template; styles in `css/home.css`, script in `js/home.js`.
- `/space/` — the 3D version of the site (three.js), kept as a portfolio piece. Its scripts are in `space/js/`
  and are bundled into `space/app-<hash>.js` by `python bundle.py` (run in `space/`).
- `/privacy/`, `/en/privacy/` — privacy policy.
- `/services/` — old address, redirects to the home page.

Static site on GitHub Pages, no server and no database. Requests go through Web3Forms.
