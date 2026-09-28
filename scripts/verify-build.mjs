import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const base='/ever-after-enchanted-garden/';
const html=readFileSync('dist/index.html','utf8');
const urls=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(x=>x[1]).filter(x=>x.startsWith('/'));
for(const url of urls){assert.ok(url.startsWith(base),`Incorrect Pages URL: ${url}`);assert.ok(existsSync(join('dist',url.slice(base.length))),`Missing asset: ${url}`)}
assert.ok(urls.some(x=>x.endsWith('.js')));
assert.ok(existsSync('dist/garden.webp')&&existsSync('dist/couple-illustration.webp'));
for(const file of readdirSync('dist/assets').filter(x=>x.endsWith('.js')||x.endsWith('.css'))){
 const code=readFileSync(join('dist/assets',file),'utf8');
 assert.ok(!code.includes('"/api/rsvp"'),'Static build contains server RSVP call');
 assert.ok(!/["']\/(?:garden|couple-illustration)\.webp/.test(code),'Unprefixed artwork path');
}
console.log('GitHub Pages paths and RSVP delivery checks passed.');
