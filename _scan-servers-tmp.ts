import { Client } from 'ssh2';
const cmd = `
set +e
echo '=== UPTIME / LOAD ==='; uptime
echo; echo '=== TOP CPU PROCS ==='; ps -eo pid,user,%cpu,%mem,etime,cmd --sort=-%cpu | head -15
echo; echo '=== LISTENING SOCKETS ==='; ss -lntup | awk 'NR==1 || !/127.0.0.1|::1\\]/'
echo; echo '=== ESTABLISHED OUT CONNS (non-local) ==='; ss -ntp state established | grep -vE '127\\.0\\.0\\.1|::1' | head -30
echo; echo '=== SYSTEMD SERVICES (running, non-stock) ==='; systemctl list-units --type=service --state=running --no-pager --no-legend | awk '{print $1}'
echo; echo '=== CRONTABS ==='; for u in $(cut -f1 -d: /etc/passwd); do crontab -u "$u" -l 2>/dev/null | sed "s|^|[$u] |"; done; echo '-- /etc/cron* --'; ls -la /etc/cron.* /etc/cron.d/ 2>/dev/null; cat /etc/crontab 2>/dev/null
echo; echo '=== SYSTEMD TIMERS ==='; systemctl list-timers --all --no-pager | head -20
echo; echo '=== AUTHORIZED_KEYS ==='; for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do [ -f "$f" ] && echo "-- $f --" && cat "$f"; done
echo; echo '=== RECENT LOGINS ==='; last -n 15 2>/dev/null
echo; echo '=== USERS WITH SHELL ==='; awk -F: '$7 ~ /sh$/ {print $1, $3, $7}' /etc/passwd
echo; echo '=== SUID FILES (non-standard locations) ==='; find / -xdev -perm -4000 -type f 2>/dev/null | grep -vE '^/(usr|bin|sbin)/' | head
echo; echo '=== /tmp /var/tmp /dev/shm executables ==='; find /tmp /var/tmp /dev/shm -type f \\( -perm -u+x -o -name '*.sh' -o -name '*.py' -o -name '*.elf' \\) 2>/dev/null | head -30
echo; echo '=== LARGE/RECENT BINS in /root /opt /usr/local/bin ==='; ls -lat /root /opt /usr/local/bin 2>/dev/null | head -30
echo; echo '=== HIDDEN dirs in /root /tmp ==='; ls -la /root /tmp 2>/dev/null | grep -E '^\\..*|^d.* \\.'
echo; echo '=== RECENT FILES (<7d) in /etc /root /usr/local ==='; find /etc /root /usr/local -xdev -type f -mtime -7 2>/dev/null | grep -vE '(/log|/cache|x-ui\\.db|caddy|certificates|acme|\\.json|hysteria|sub-manager)' | head -40
echo; echo '=== LD_PRELOAD / preload files ==='; cat /etc/ld.so.preload 2>/dev/null; env | grep -i preload
echo; echo '=== KERNEL MODULES (non-stock check) ==='; lsmod | head -5; echo "(only checking presence)"
echo; echo '=== rkhunter/chkrootkit quick (if present) ==='; which rkhunter chkrootkit 2>/dev/null
echo; echo '=== FAIL2BAN / suspicious auth ==='; tail -30 /var/log/auth.log 2>/dev/null | grep -iE 'invalid|fail|accept' | tail -15
`;

const hosts = [
  { name: 'RU', host: '82.202.128.147', pw: 'K!E2QAGrxYFx' },
  { name: 'CZ', host: '185.87.148.138', pw: 'hf6Ka8viMl' },
];
for (const h of hosts) {
  await new Promise<void>(res => {
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
