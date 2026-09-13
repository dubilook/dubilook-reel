/* Sharded frame renderer: each worker owns an interleaved slice of the timeline.
   Usage: NSHARDS=2 SHARD=0 node render_par.js                                  */
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');

const CHROME  = process.env.CHROME_PATH ||
  require('child_process').execSync("ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1").toString().trim();
const FPS     = Number(process.env.FPS || 30);
const SCENE   = process.env.SCENE  || (__dirname + '/reel.html');
const OUT     = process.env.OUTDIR || (__dirname + '/frames');
const NSHARDS = Number(process.env.NSHARDS || 1);
const SHARD   = Number(process.env.SHARD || 0);
const QUALITY = Number(process.env.QUALITY || 96);

(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const b = await chromium.launch({executablePath: CHROME, args: ['--force-color-profile=srgb']});
  const p = await b.newPage({viewport: {width: 1080, height: 1920}, deviceScaleFactor: 1});
  await p.goto('file://' + SCENE);
  await p.waitForFunction('window.READY === true', null, {timeout: 30000});

  const sceneFile = SCENE.split('?')[0];
  const hasBg = fs.existsSync(path.join(path.dirname(sceneFile), 'bg', 'f00000.jpg'));
  if (hasBg) await p.evaluate('window.HASBG = true');
  const dur   = await p.evaluate('window.DUR');
  const total = Math.round(dur * FPS);
  let n = 0;
  for (let i = SHARD; i < total; i += NSHARDS) {
    await p.evaluate(([t, i]) => window.SEEKF ? window.SEEKF(t, i) : window.SEEK(t), [i / FPS, i]);
    await p.screenshot({type: 'jpeg', quality: QUALITY,
      path: path.join(OUT, 'f' + String(i).padStart(5, '0') + '.jpg')});
    n++;
  }
  await b.close();
  console.log(`shard ${SHARD}/${NSHARDS}: ${n} frames`);
})();
