async function run() {
  const loginRes = await fetch('https://ru.panelsu.ru/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({ username: 'admin_3x', password: 'XUIhh5sj3!' }).toString()
  });
  console.log('Login status:', loginRes.status);
  const loginData = await loginRes.text();
  console.log('Login:', loginData);
  const cookies = loginRes.headers.get('set-cookie');
  if (cookies) {
    const installRes = await fetch('https://ru.panelsu.ru/server/installXray/v25.8.29', {
      method: 'POST',
      headers: { 'Cookie': cookies, 'Accept': 'application/json' }
    });
    console.log('Install status:', installRes.status);
    const installData = await installRes.text();
    console.log('Install:', installData);
  }
}
run();
