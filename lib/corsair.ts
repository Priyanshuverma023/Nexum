import 'dotenv/config';

import { createCorsair } from 'corsair';
import { gmail } from '@corsair-dev/gmail';
import { googlecalendar } from '@corsair-dev/googlecalendar';
import { pool } from './db';

export const corsair = createCorsair({
  multiTenancy: true,
  kek: process.env.CORSAIR_KEK!,
  database: pool,
  hub: {
    projectApiKey: process.env.CORSAIR_DEV_API_KEY!,
    signingSecret: process.env.CORSAIR_DEV_SIGNING_SECRET!,
  },
  plugins: [
    gmail(),
    googlecalendar(),
  ],
});