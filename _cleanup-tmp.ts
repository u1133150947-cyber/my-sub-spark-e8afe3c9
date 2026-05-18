import { Client } from 'ssh2';

const hosts = [
  { name: 'RU', host: '82.202.128.147', pw: 'K!E2QAGrxYFx' },
  { name: 'CZ', host: '185.87.148.138', pw: 'hf6Ka8viMl' },
];

const cmd = `
set -e
printf '=== BEFORE cleanup ===\n'
TMP_COUNT=$(ls /tmp/*.py /tmp/*.sh /tmp/*.ts 2>/dev/null | wc -l) || true
echo "temp scripts before: $TMP_COUNT"

printf '\n=== Cleaning /tmp scripts ===\n'
rm -f /tmp/check_*.py /tmp/fix_*.py /tmp/update_*.py /tmp/delete_*.py /tmp/final_*.py /tmp/orphan*.py /tmp/start_*.sh /tmp/audit_*.sh /tmp/audit_*.py /tmp/e2e_*.py /tmp/*.ts /tmp/*.js 2>/dev/null || true
printf 'temp scripts cleaned\n'

printf '\n=== Cleaning /root debris on RU ===\n'
rm -f /root/3x-ui-sub-manager.zip /root/82.202.128.147 2>/dev/null || true
printf 'root debris cleaned\n'

printf '\n=== Install fail2ban ===\n'
apt-get install -y -qq fail2ban 2>/dev/null || true
systemctl enable fail2ban 2>/dev/null || true
systemctl start fail2ban 2>/dev/null || true
systemctl is-active fail2ban 2>/dev/null || echo 'fail2ban status unknown'

cat <<'F2B' > /etc/fail2ban/jail.local
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
F2B

systemctl restart fail2ban 2>/dev/null || true

printf '\n=== AFTER cleanup ===\n'
ls /tmp/*.py /tmp/*.sh /tmp/*.ts 2>/dev/null | wc -l | sed 's/^/temp scripts after: /'
ls /root/3x-ui-sub-manager.zip /root/82.202.128.147 2>/dev/null | wc -l | sed 's/^/root debris after: /'
printf 'Done\n'
`;

for (const h of hosts) {
  await new Promise<void>((res) => {
    const c = new Client();
    console.log(`\n############## ${h.name} ${h.host} ##############`);
    c.on('ready', () => c.exec(cmd, (e, s) => {
      s.on('close', () => { c.end(); res(); })
       .on('data', d => process.stdout.write(d.toString()))
       .stderr.on('data', d => process.stderr.write(d.toString()));
    })).on('error', e => { console.error(e.message); res(); })
    .connect({ host: h.host, port: 22, username: 'root', password: h.pw, readyTimeout: 15000 });
  });
}
