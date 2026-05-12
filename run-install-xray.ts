async function run() {
  const loginRes = await fetch('https://ru.panelsu.ru/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'admin_3x', password: 'XUIhh5sj3!' }).toString()
  });
  const loginData = await loginRes.json();
  console.log('Login:', loginData);
  const cookies = loginRes.headers.get('set-cookie');
  if (cookies) {
    const installRes = await fetch('https://ru.panelsu.ru/server/installXray/v25.8.29', {
      method: 'POST',
      headers: { 'Cookie': cookies, 'Accept': 'application/json' }
    });
    const installData = await installRes.json();
    console.log('Install:', installData);
  }
}
run();
