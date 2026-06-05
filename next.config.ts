import type { NextConfig } from "next";
import os from "os";

// 获取本机所有局域网 IP 地址
const getLocalExternalIPs = (): string[] => {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        // IPv4 且非回环地址
        if (alias.family === 'IPv4' && !alias.internal) {
          ips.push(alias.address);
        }
      }
    }
  }
  return ips;
};

const localIPs = getLocalExternalIPs();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", ...localIPs.map(ip => `${ip}:4000`), ...localIPs]
};

export default nextConfig;
