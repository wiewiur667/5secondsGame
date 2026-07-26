import os from 'node:os'

// Pick the LAN IPv4 a phone can reach. Ported from the original server.js:
// skip WSL/VPN/virtual adapters and link-local, prefer common home ranges.
export function lanIp(): string {
  if (process.env.HOST && process.env.HOST !== '0.0.0.0') return process.env.HOST
  const skip = /wsl|vethernet|nordlynx|vpn|bluetooth|default switch|loopback/i
  const cands: string[] = []
  for (const [name, ifs] of Object.entries(os.networkInterfaces())) {
    for (const i of ifs || []) {
      if (i.family !== 'IPv4' || i.internal) continue
      if (skip.test(name)) continue
      if (i.address.startsWith('169.254.')) continue // link-local, no DHCP
      cands.push(i.address)
    }
  }
  return cands.find((a) => a.startsWith('192.168.')) || cands[0] || 'localhost'
}
