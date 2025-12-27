import fs from 'fs';
import { Database, verbose } from 'sqlite3';
import type { Node, NodeAttributes, Variant, Work } from './model';

export function initDb(name: string): Database {
  if (fs.existsSync(`${name}.sqlite`)) {
    fs.rmSync(`${name}.sqlite`);
  }

  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  const sqlite3 = verbose();
  const db = new sqlite3.Database(`${name}.sqlite`);
  db.serialize(() => {
    db.run(`PRAGMA journal_mode = WAL;`);
    db.run(`PRAGMA journal_size_limit = 67108864; -- 64 MB`);
    db.run(`VACUUM`);
    db.run(
      `CREATE TABLE IF NOT EXISTS works
             (
                 rowId INTEGER PRIMARY KEY AUTOINCREMENT,
                 id    TEXT,
                 title TEXT
             );`,
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS variants
             (
                 rowId     INTEGER PRIMARY KEY AUTOINCREMENT,
                 id        TEXT,
                 title     TEXT,
                 language  TEXT,
                 version   TEXT,
                 workRowId INTEGER,
                 FOREIGN KEY (workRowId) REFERENCES works (rowid) ON DELETE CASCADE,
                 FOREIGN KEY (id) REFERENCES nodeIds (id) ON DELETE CASCADE
             );`,
    );
    db.run(
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
    db.run(
      `CREATE TABLE IF NOT EXISTS nodeIds
             (
                 id        TEXT    NOT NULL,
                 nodeRowId INTEGER NOT NULL,
                 FOREIGN KEY (nodeRowId) REFERENCES nodes (rowid) ON DELETE CASCADE
             )`,
    );
    db.run(`VACUUM`);
  });

  return db;
}

export function closeDb(db: Database) {
  db.serialize(() => {
    db.run(`VACUUM`);
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_nodes_parentRowId ON nodes (parentRowId)`,
    );
    db.run(`CREATE INDEX IF NOT EXISTS idx_nodes_id ON nodeIds (id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes (name)`);
  });
}

export function insertNode(node: Node, db: Database): Promise<number> {
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = db.prepare(
        `INSERT INTO nodes (rowId, name, parentRowId, attributes, content)
                 VALUES (?, ?, ?, ?, ?)`,
      );
      stmt.run(
        node.rowId,
        node.name,
        node.parentRowId,
        JSON.stringify(node.attributes),
        node.content,
      );

      db.get(`SELECT last_insert_rowid()`, (err, row: object) => {
        resolve(row['last_insert_rowid()'] as number);
      });
    });
  });
}

export async function insertNodeId(
  id: string,
  nodeRowId: number,
  db: Database,
): Promise<void> {
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = db.prepare(
        `INSERT INTO nodeIds (id, nodeRowId)
                 VALUES (?, ?)`,
      );

      stmt.run(id, nodeRowId);
      resolve();
    });
  });
}

export function insertWork(node: Work, db: Database): Promise<number> {
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = db.prepare(`INSERT INTO works (id, title)
                                     VALUES (?, ?)`);
      stmt.run(node.id, node.title);

      db.get(`SELECT last_insert_rowid()`, (err, row: object) => {
        resolve(row['last_insert_rowid()'] as number);
      });
    });
  });
}

export function insertVariant(variant: Variant, db: Database): Promise<number> {
  return new Promise((resolve) => {
    db.serialize(() => {
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

      db.get(`SELECT last_insert_rowid()`, (err, row: object) => {
        resolve(row['last_insert_rowid()'] as number);
      });
    });
  });
}

export function vacuum(db: Database): Promise<void> {
  return new Promise((resolve) => {
    db.exec(`VACUUM;`, () => resolve());
  });
}

export async function mergeIntoMain(mainDb: Database, dbName: string) {
  const maxId = (await getMaxNodeRowId(mainDb)) ?? 0;
  mainDb.serialize(() => {
    mainDb.run(`attach '${dbName}.sqlite' as toMerge`);
    mainDb.run(`begin`);
    mainDb.run(
      `insert into nodes (rowId, name, parentRowId, attributes, content)
             select rowId + ?,
                    name,
                    CASE WHEN parentRowId IS NULL THEN NULL ELSE parentRowId + ? END,
                    attributes,
                    content
             from toMerge.nodes`,
      maxId,
      maxId,
    );
    mainDb.run(
      `insert into nodeIds (id, nodeRowId)
             select id, nodeRowId + ?
             from toMerge.nodeIds`,
      maxId,
    );
    mainDb.run(`commit`);
    mainDb.run(`detach toMerge`);
  });
}

function getMaxNodeRowId(db: Database): Promise<number> {
  return new Promise<number>((resolve) => {
    db.serialize(() => {
      db.get(
        `SELECT max(rowId)
                    from nodes`,
        (_, row: object) => {
          resolve(row['max(rowId)'] as number);
        },
      );
    });
  });
}

export function getNode(id: string, db: Database): Promise<Node> {
  return new Promise<Node>((resolve) => {
    db.serialize(() => {
      db.get(
        `SELECT n.rowId as rowId, n.name, n.attributes, n.content
                 from nodes n
                          join nodeIds ni on ni.nodeRowId = n.rowId
                 WHERE ni.id = ?`,
        id,
        (_, row: object) => {
          resolve({
            rowId: row['rowId'] as number,
            name: row['name'] as string,
            content: row['content'] as string,
            attributes: JSON.parse(
              row['attributes'] as string,
            ) as NodeAttributes,
          });
        },
      );
    });
  });
}
