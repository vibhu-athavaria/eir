import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example) before running this script.');
  process.exit(1);
}

const targetEmail = process.argv[2];
if (!targetEmail) {
  console.error('Usage: node --env-file=.env scripts/seed.js <user-email> [password]');
  console.error('If the account does not exist yet, it is created (email pre-confirmed) with the given');
  console.error('password, or a randomly generated one if none is given.');
  process.exit(1);
}
const providedPassword = process.argv[3];

const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MOODS = [10, 11, 13, 19, 5, 4, 8];
const ALTERNATIVES = ['Went for a walk', 'Deep breathing', 'Called a friend', 'Journaled'];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function findOrCreateUser(email, password) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const existing = data.users.find((u) => u.email === email);
  if (existing) {
    console.log(`Using existing account ${email}.`);
    return existing.id;
  }

  const finalPassword = password || crypto.randomBytes(12).toString('base64url');
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: finalPassword,
    email_confirm: true,
  });
  if (createError) throw createError;
  console.log(`Created test account ${email} (password: ${finalPassword}) — save this, it won't be shown again.`);
  return created.user.id;
}

async function seed() {
  const userId = await findOrCreateUser(targetEmail, providedPassword);

  const dailyLogs = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return {
      user_id: userId,
      date: date.toISOString().slice(0, 10),
      moods: [randomFrom(MOODS)],
      self_harmed: Math.random() < 0.1,
      journal: i % 3 === 0 ? `Sample journal entry for day ${i}.` : null,
      alternatives_used: Math.random() < 0.4 ? [randomFrom(ALTERNATIVES)] : [],
    };
  });

  const vents = [
    { user_id: userId, content: 'Sample vent: today was a rough day.', anonymous_name: 'Anonymous' },
    { user_id: userId, content: 'Sample vent: feeling a bit better now.', anonymous_name: 'Anonymous' },
  ];

  // upsert, not insert: daily_logs has a (user_id, date) uniqueness constraint,
  // so re-running this script against an account that already has sample data
  // for today's date range would otherwise fail on a duplicate-key error.
  const { error: logsError } = await supabase
    .from('daily_logs')
    .upsert(dailyLogs, { onConflict: 'user_id,date' });
  if (logsError) throw logsError;

  const { error: ventsError } = await supabase.from('vents').insert(vents);
  if (ventsError) throw ventsError;

  console.log(`Seeded ${dailyLogs.length} daily logs and ${vents.length} vents for ${targetEmail}.`);
}

seed().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
