/**
 * Cloudflare Pages / CI 构建注入脚本
 * 从环境变量 AMAP_KEY 和 AMAP_SECURITY_CODE 自动生成 config.js
 */
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.js');
const examplePath = path.join(__dirname, '..', 'config.example.js');

const amapKey = process.env.AMAP_KEY || '';
const amapSecret = process.env.AMAP_SECURITY_CODE || process.env.AMAP_SECURITY_JS_CODE || '';

if (amapKey || amapSecret) {
  console.log('检测到云端环境变量，正在注入生成 config.js...');
  const configContent = `/**
 * 由构建脚本通过环境变量自动生成 (Cloudflare Pages Build)
 */
window.BUS_MAP_CONFIG = {
  amapKey: '${amapKey.trim()}',
  securityJsCode: '${amapSecret.trim()}',
  defaultCenter: [116.397451, 39.909187],
  defaultZoom: 11,
  mapStyle: 'amap://styles/dark'
};
`;
  fs.writeFileSync(configPath, configContent, 'utf-8');
  console.log('✅ config.js 注入生成成功！');
} else if (fs.existsSync(configPath)) {
  console.log('ℹ️ 未检测到云端环境变量，保留本地已有 config.js');
} else {
  console.log('⚠️ 未检测到环境变量且无 config.js，复制 config.example.js 作为占位...');
  fs.copyFileSync(examplePath, configPath);
}
