import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';

    // 優先的に 192.168.x.x や 10.x.x.x などのローカルIPv4アドレスを探す
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;

      for (const net of netList) {
        // IPv4 かつ 内部ループバックでないものを抽出
        if (net.family === 'IPv4' && !net.internal) {
          if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.')) {
            localIp = net.address;
            break;
          }
          if (localIp === '127.0.0.1') {
            localIp = net.address;
          }
        }
      }
      if (localIp !== '127.0.0.1') break;
    }

    const port = process.env.PORT || 3000;
    const localUrl = `http://${localIp}:${port}`;

    return NextResponse.json({
      ip: localIp,
      port,
      url: localUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, url: 'http://localhost:3000' }, { status: 500 });
  }
}
