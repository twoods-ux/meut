import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = '/workspace/tools/meut-pgdata';
const port = 5433;

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'meut',
  password: 'meut',
  port,
  persistent: true,
  onLog: (msg) => process.stdout.write(String(msg)),
  onError: (msg) => process.stderr.write(String(msg)),
});

async function main() {
  const initialized = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (!initialized) {
    console.log('Initializing postgres data dir...');
    await pg.initialise();
  }
  console.log('Starting postgres on', port);
  await pg.start();
  try {
    await pg.createDatabase('meut');
    console.log('Created database meut');
  } catch (e) {
    console.log('createDatabase note:', e?.message || e);
  }
  console.log('READY postgresql://meut:meut@127.0.0.1:' + port + '/meut');
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
