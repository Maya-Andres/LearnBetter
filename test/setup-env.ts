import { useE2eDatabase } from './e2e-env';

// Every test file gets its own copy of process.env, so the e2e database is selected again here.
useE2eDatabase();
