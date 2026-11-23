import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const site = 'https://sub131120-beep.github.io/game-platform';
const output = path.resolve('dist/sitemap.xml');
let supabaseUrl = process.env.VITE_SUPABASE_URL;
let anonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Local builds can use the existing .env.local; CI receives these as repository variables.
if (!supabaseUrl || !anonKey) {
  try {
    const env = await readFile('.env.local', 'utf8');
    for (const line of env.split(/\r?\n/)) {
      const match = line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^['"]|['"]$/g, '');
      if (match[1] === 'VITE_SUPABASE_URL') supabaseUrl ||= value;
      else anonKey ||= value;
    }
  } catch { /* Base pages can still be indexed without project URLs. */ }
}

const pages = new Map([
  [`${site}/`, new Date().toISOString().slice(0, 10)],
  [`${site}/terms`, null],
  [`${site}/privacy`, null],
  [`${site}/ai`, null],
]);

if (supabaseUrl && anonKey) {
  try {
    const endpoint = new URL('/rest/v1/projects', supabaseUrl);
    endpoint.search = new URLSearchParams({
      select: 'slug,updated_at',
      visibility: 'eq.public',
      moderation_status: 'eq.published',
      order: 'updated_at.desc',
    });
    const response = await fetch(endpoint, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}`);
    const projects = await response.json();
    for (const project of projects) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) continue;
      const date = project.updated_at ? new Date(project.updated_at).toISOString().slice(0, 10) : null;
      pages.set(`${site}/project/${project.slug}`, date);
    }
  } catch (error) {
    console.warn(`Could not add project pages to sitemap: ${error.message}`);
  }
}

const entries = [...pages].map(([url, date]) => `  <url><loc>${url}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`).join('\n');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`, 'utf8');
console.log(`Generated sitemap with ${pages.size} URLs.`);
