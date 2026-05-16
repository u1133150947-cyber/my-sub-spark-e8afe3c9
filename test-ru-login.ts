async function testLogin(password: string) {
  try {
    const loginPage = await fetch('https://ru.panelsu.ru/', { headers: { Accept: 'text/html' } });
    const loginHtml = await loginPage.text();
    const csrf = loginHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)?.[1] ?? '';
    const preCookie = (loginPage.headers.get('set-cookie') ?? '')
      .split(',')
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    const res = await fetch('https://ru.panelsu.ru/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(preCookie ? { Cookie: preCookie } : {}),
      },
      body: JSON.stringify({ username: 'admin', password, twoFactorCode: '' }),
    });
    const text = await res.text();
    console.log(`Password "${password}": HTTP ${res.status}, body: ${text.slice(0, 200)}`);
  } catch (e) {
    console.log(`Password "${password}": ERROR ${e}`);
  }
}

await testLogin('6WYia!Y5gV5D');
await testLogin('XUIhh5sj3!');
