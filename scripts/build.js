/**
 * 生产发布构建脚本 (Build for Cloudflare / Production)
 * 1. 自动从环境变量注入生成 config.js (若有)
 * 2. 导出纯净的生产发布目录 dist/ (排除 98MB 原始 JSON、开发脚本与敏感文件)
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const configPath = path.join(rootDir, 'config.js');
const examplePath = path.join(rootDir, 'config.example.js');

// 1. 处理环境变量注入
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
  console.log('ℹ️ 未检测到云端环境变量，使用现有 config.js');
} else {
  console.log('⚠️ 未检测到环境变量且无 config.js，复制 config.example.js 作为占位...');
  fs.copyFileSync(examplePath, configPath);
}

// 2. 清理并初始化 dist 目录
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 辅助递归复制
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. 复制静态文件到 dist
console.log('正在打包纯净静态资源到 dist/ ...');

// 复制根目录入口文件
fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(distDir, 'index.html'));
fs.copyFileSync(configPath, path.join(distDir, 'config.js'));

// 复制资源目录
copyDir(path.join(rootDir, 'css'), path.join(distDir, 'css'));
copyDir(path.join(rootDir, 'js'), path.join(distDir, 'js'));
copyDir(path.join(rootDir, 'fonts'), path.join(distDir, 'fonts'));

// 复制数据目录（仅复制 10MB 的 Gzip 压缩包，严禁复制 98MB 原始文件）
const distDataDir = path.join(distDir, 'data');
fs.mkdirSync(distDataDir, { recursive: true });
const gzFile = path.join(rootDir, 'data', 'beijing_bus_routes.json.gz');
if (fs.existsSync(gzFile)) {
  fs.copyFileSync(gzFile, path.join(distDataDir, 'beijing_bus_routes.json.gz'));
} else {
  console.warn('⚠️ 未找到 beijing_bus_routes.json.gz！');
}

console.log('🎉 打包构建完成！dist 目录已就绪。');
