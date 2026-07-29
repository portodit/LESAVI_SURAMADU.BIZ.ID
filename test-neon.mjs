import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const result = await sql`SELECT current_database() as db, current_user as user, inet_server_addr() as server_addr`;
console.log('✅ Connected!');
console.log('DB:', result[0].db);
console.log('User:', result[0].user);
console.log('Server:', result[0].server_addr);