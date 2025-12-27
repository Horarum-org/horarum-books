import { seedWorkVariant } from './workSeeder';

async function seedSqlite() {
  const workPath = process.argv[2];
  await seedWorkVariant(workPath);
}

seedSqlite();
