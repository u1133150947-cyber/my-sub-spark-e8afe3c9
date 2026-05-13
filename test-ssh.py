import paramiko

def test_ssh(ip, pwd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(ip, port=22, username='root', password=pwd, timeout=5)
        print(f"{ip}: Success")
    except Exception as e:
        print(f"{ip}: Failed - {e}")
    finally:
        client.close()

test_ssh('185.87.148.138', 'K!E2QAGrxYFx')
test_ssh('82.202.128.147', 'K!E2QAGrxYFx')
