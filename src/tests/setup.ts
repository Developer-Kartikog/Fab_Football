import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { db } from '@/services/persistence/db';

beforeEach(async () => {
  await db.projects.clear();
  await db.appMeta.clear();
});
