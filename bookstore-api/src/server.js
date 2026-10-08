import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './app.js';
import { openDatabase } from './db.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.DB_PATH || path.join(rootDir, 'data', 'bookstore.db');
const port = Number(process.env.PORT) || 3000;

const db = openDatabase(dbPath);
const app = createApp(db);

app.listen(port, () => {
  console.log(`Bookstore API listening on http://localhost:${port}`);
});
