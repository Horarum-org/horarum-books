import fs from 'fs';
import BetterSqlite3, { Database } from 'better-sqlite3';
import type { Node, Variant, Work } from './model';

export function initDb(name: string): Database {
  if (fs.existsSync(`${name}.sqlite`)) {
    fs.rmSync(`${name}.sqlite`);
  }

  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  const db: Database = new BetterSqlite3(`${name}.sqlite`);

  db.pragma('journal_mode = WAL');
  db.pragma('journal_size_limit = 67108864; -- 64 MB');

  db.transaction(() => {
    db.exec(
      `CREATE TABLE IF NOT EXISTS works
             (
                 rowId INTEGER PRIMARY KEY AUTOINCREMENT,
                 id    TEXT,
                 title TEXT
             );`,
    );
    db.exec(
      `CREATE TABLE IF NOT EXISTS variants
             (
                 rowId     INTEGER PRIMARY KEY AUTOINCREMENT,
                 id        TEXT,
                 title     TEXT,
                 language  TEXT,
                 version   TEXT,
                 workRowId INTEGER
             );`,
    );
    db.exec(
      `
                CREATE TABLE IF NOT EXISTS nodes
                (
                    rowId       INTEGER PRIMARY KEY AUTOINCREMENT,
                    name        INTEGER,
                    parentRowId INTEGER,
                    attributes  TEXT,
                    content     TEXT,
                    FOREIGN KEY (parentRowId) REFERENCES nodes (rowid) ON DELETE CASCADE
                )`,
    );
    db.exec(
      `CREATE TABLE IF NOT EXISTS nodeIds
             (
                 id        TEXT    NOT NULL,
                 nodeRowId INTEGER NOT NULL,
                 FOREIGN KEY (nodeRowId) REFERENCES nodes (rowid) ON DELETE CASCADE
             )`,
    );
  })();

  db.exec(`VACUUM`);

  return db;
}

export function closeDb(db: Database) {
  db.exec(`VACUUM`);
  db.transaction(() => {
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_nodes_parentRowId ON nodes (parentRowId)`,
    );
    db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_id ON nodeIds (id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes (name)`);
  })();
}

export function insertNode(node: Node, db: Database): number {
  const stmt = db.prepare(
    `INSERT INTO nodes (rowId, name, parentRowId, attributes, content)
                 VALUES (?, ?, ?, ?, ?)`,
  );

  const attributes = JSON.stringify(node.attributes);

  stmt.run(
    node.rowId,
    node.name,
    node.parentRowId,
    attributes === '{}' ? null : attributes,
    node.content,
  );

  return (db.prepare(`SELECT last_insert_rowid() as rowId`).get() as object)[
    'rowId'
  ] as number;
}

export function insertNodeId(id: string, nodeRowId: number, db: Database) {
  const stmt = db.prepare(
    `INSERT INTO nodeIds (id, nodeRowId)
                 VALUES (?, ?)`,
  );

  stmt.run(id, nodeRowId);
}

export function insertWork(node: Work, db: Database): number {
  const stmt = db.prepare(
    `INSERT INTO works (id, title)
            VALUES (?, ?)`,
  );
  stmt.run(node.id, node.title);

  return (db.prepare(`SELECT last_insert_rowid() as rowId`).get() as object)[
    'rowId'
  ] as number;
}

export function insertVariant(variant: Variant, db: Database): number {
  const stmt = db.prepare(`
                INSERT INTO variants (id, title, language, workRowId, version)
                SELECT ?, ?, ?, w.rowId, ?
                FROM works w
                WHERE w.id = ?`);
  stmt.run(
    variant.id,
    variant.title,
    variant.language,
    variant.version,
    variant.workId,
  );

  return (db.prepare(`SELECT last_insert_rowid() as rowId`).get() as object)[
    'rowId'
  ] as number;
}
