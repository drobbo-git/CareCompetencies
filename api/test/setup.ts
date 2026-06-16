import dotenv from 'dotenv';
import path from 'path';

// Must run before any test file imports ../src/app (which imports ../src/db,
// whose connection config is read from process.env at module-load time).
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

if (process.env.DB_SERVER !== 'localhost') {
  throw new Error(
    'Refusing to run tests: .env.test must point DB_SERVER at the local test ' +
    'container, not a shared database. See api/.env.test.example.',
  );
}
