const h = { url: 'https://ru.panelsu.ru:2053', user: 'admin', pass: 'sD2bU8oJ7mQ!vR9wF@p' };

async function login() {
  const data = new URLSearchParams();
  data.append('username', h.user);
  data.append('password', h.pass);
  
  // get csrf
  const r1 = await fetch(h.url + '/');
  const text = await r1.text();
  const m = text.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
  const csrf = m ? m[1] : '';

  const res = await fetch(h.url + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf },
    body: data
  });
  return res.headers.get('set-cookie');
}

async function getList(cookie: string) {
  const res = await fetch(h.url + '/panel/api/inbounds/list', {
    headers: { cookie: cookie || '', Accept: 'application/json' }
  });
  const list = await res.json();
  console.log('inbounds:', list.obj.map((i: any) => ({ remark: i.remark, protocol: i.protocol, network: JSON.parse(i.streamSettings)?.network })));
}

async function addTest() {
  const c = await login();
  await getList(c || '');
}
addTest();
