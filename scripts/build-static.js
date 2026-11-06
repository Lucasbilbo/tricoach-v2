// Copia al directorio de publicación (dist/) las páginas estáticas del sitio público.
// Vite solo emite la app en dist/app (base '/app/'); todo lo demás se copia aquí.
// Para añadir una guía nueva: crear <slug>.html en la raíz, añadirla a sitemap.xml y a netlify.toml.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

// Las guías son todos los .html de la raíz salvo index.html (la app) y landing.html (va a dist/index.html)
const guias = fs.readdirSync(root).filter((f) => f.endsWith('.html') && f !== 'index.html' && f !== 'landing.html');
fs.copyFileSync(path.join(root, 'landing.html'), path.join(dist, 'index.html'));
guias.forEach((f) => fs.copyFileSync(path.join(root, f), path.join(dist, f)));
fs.copyFileSync(path.join(root, 'sitemap.xml'), path.join(dist, 'sitemap.xml'));

// static/: robots.txt, llms.txt, clave IndexNow... se publican en la raíz del sitio
const staticDir = path.join(root, 'static');
if (fs.existsSync(staticDir)) {
  fs.readdirSync(staticDir).forEach((f) => fs.copyFileSync(path.join(staticDir, f), path.join(dist, f)));
}
process.stdout.write(`build-static: landing + ${guias.length} guías + ${fs.existsSync(staticDir) ? fs.readdirSync(staticDir).length : 0} ficheros estáticos\n`);
