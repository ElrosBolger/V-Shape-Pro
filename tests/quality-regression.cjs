'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
assert.ok(scripts.length>=2,'Expected splash and application scripts');
for(const [i,script] of scripts.entries())new vm.Script(script,{filename:'inline-'+i+'.js'});
const checks=[
 ['persistent storage key',/const STORE='vshape_final_v1'/],
 ['pre-restore backup',/V-Shape-Pro-prima-del-ripristino-/],
 ['set persistence rollback',/if\(!save\(\)\)\{state=JSON\.parse\(beforeSet\);return\}/],
 ['completed workout rollback',/if\(!save\(\)\)\{state=JSON\.parse\(beforeComplete\);return\}/],
 ['start persistence guard',/if\(!save\(\)\)\{state\.active=null;return\}resume\(\)/],
 ['rest persistence guard',/function endRest\(\)[\s\S]*?if\(!save\(\)\)/],
 ['undo last set action',/function undoLastSet\(\)/],
 ['undo confirmation',/Rifare l’ultima serie\?/],
 ['undo persistence rollback',/state=JSON\.parse\(before\);return/],
 ['redo set values',/a\.redoSet=\{ex,set,kg:entry\.kg,reps:entry\.reps,rir:entry\.rir\}/],
 ['statistics page',/function statsView\(\)/],
 ['Spotify integration',/const SPOTIFY_CLIENT_ID=/],
 ['launch splash',/launchIntro\(\)/]
];
for(const [name,pattern] of checks){assert.match(html,pattern,name);process.stdout.write('PASS '+name+'\n')}
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
assert.equal(manifest.display,'standalone');
assert.ok(manifest.icons.some(x=>x.purpose==='maskable'));
const sw=fs.readFileSync('sw.js','utf8');
new vm.Script(sw,{filename:'sw.js'});
assert.match(sw,/splash-system-ascension\.jpg/);
console.log('Static regression checks passed. Browser/device acceptance tests remain required.');
