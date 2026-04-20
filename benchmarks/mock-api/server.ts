import { createApp, createRouter, defineEventHandler, getRouterParam, toNodeListener } from 'h3';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const PORT = parseInt(process.env.MOCK_API_PORT ?? '4100', 10);
const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

// Pre-load all fixtures into memory for fast responses
const items = new Map<string, string>();
const users = new Map<string, string>();
let topStories = '[]';
let askStories = '[]';
let showStories = '[]';

async function loadFixtures(): Promise<void> {
  topStories = await readFile(join(FIXTURES_DIR, 'topstories.json'), 'utf-8');
  askStories = await readFile(join(FIXTURES_DIR, 'askstories.json'), 'utf-8');
  showStories = await readFile(join(FIXTURES_DIR, 'showstories.json'), 'utf-8');

  const itemsDir = join(FIXTURES_DIR, 'items');
  const itemFiles = await readdir(itemsDir);
  for (const file of itemFiles) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace('.json', '');
    items.set(id, await readFile(join(itemsDir, file), 'utf-8'));
  }

  const usersDir = join(FIXTURES_DIR, 'users');
  const userFiles = await readdir(usersDir);
  for (const file of userFiles) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace('.json', '');
    users.set(id, await readFile(join(usersDir, file), 'utf-8'));
  }

  console.log(`Loaded ${items.size} items, ${users.size} users`);
}

const app = createApp();
const router = createRouter();

router.get('/v0/topstories.json', defineEventHandler(() => {
  return JSON.parse(topStories);
}));

router.get('/v0/askstories.json', defineEventHandler(() => {
  return JSON.parse(askStories);
}));

router.get('/v0/showstories.json', defineEventHandler(() => {
  return JSON.parse(showStories);
}));

// H3 router captures :id without the .json suffix — the real Firebase API
// uses /item/12345.json where .json is literal. Use a wildcard param to
// capture the full "12345.json" segment, then strip the suffix.
router.get('/v0/item/**:path', defineEventHandler((event) => {
  const raw = getRouterParam(event, 'path') ?? '';
  const id = raw.replace(/\.json$/, '');
  const data = items.get(id);
  if (!data) return null;
  return JSON.parse(data);
}));

router.get('/v0/user/**:path', defineEventHandler((event) => {
  const raw = getRouterParam(event, 'path') ?? '';
  const id = raw.replace(/\.json$/, '');
  const data = users.get(id);
  if (!data) return null;
  return JSON.parse(data);
}));

app.use(router);

async function main(): Promise<void> {
  await loadFixtures();
  const server = createServer(toNodeListener(app));
  server.listen(PORT, () => {
    console.log(`Mock HN API server ready on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
