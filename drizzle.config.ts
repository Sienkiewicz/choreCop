import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/drizzle-schema.ts',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? './chorecop.db',
  },
});
