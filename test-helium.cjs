const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres:password@helium/heliumdb?sslmode=disable'
});
c.connect().then(() => {
  console.log('✅ Connected!');
  return c.query('SELECT current_database() as db, current_user as user, inet_server_addr() as server');
}).then(r => {
  console.log('DB:', r.rows[0].db);
  console.log('User:', r.rows[0].user);
  console.log('Server:', r.rows[0].server);
  c.end();
}).catch(e => console.error('❌ Error:', e.message));