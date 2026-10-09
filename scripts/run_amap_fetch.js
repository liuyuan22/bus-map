import fs from "node:fs/promises";
import { generateBeijingBusNames } from "/Users/liuyuan/Desktop/Tests/bus-map/scripts/bus_names.js";

const task = await taskSpace("fetch all amap bus routes");
const page = task.page("p1");
await page.goto("http://localhost:8080/index.html");

const allNames = generateBeijingBusNames();
console.log(`=== 开始高德全网公交采集，共 ${allNames.length} 个路线候选名称 ===`);

// 分批抓取，每批 100 个
const batchSize = 100;
const totalBatches = Math.ceil(allNames.length / batchSize);
const collectedRoutes = new Map(); // id -> route

const outPath = "/Users/liuyuan/Desktop/Tests/bus-map/data/beijing_bus_routes.json";

// 尝试加载已有的
try {
  const existing = JSON.parse(await fs.readFile(outPath, "utf-8"));
  existing.forEach(r => collectedRoutes.set(r.id, r));
  console.log(`已载入本地已有线路: ${collectedRoutes.size} 条`);
} catch (e) {}

for (let b = 0; b < totalBatches; b++) {
  const slice = allNames.slice(b * batchSize, (b + 1) * batchSize);
  console.log(`[${b + 1}/${totalBatches}] 正在查询 ${slice.length} 个线路候选 (${slice[0]} ~ ${slice[slice.length - 1]})...`);
  
  const t0 = Date.now();
  const batchResults = await page.evaluate(async (names) => {
    return new Promise((resolve) => {
      AMap.plugin(["AMap.LineSearch"], () => {
        const ls = new AMap.LineSearch({
          pageIndex: 1,
          city: "010",
          pageSize: 4,
          extensions: "all"
        });

        const results = [];
        let completed = 0;
        let pointer = 0;
        const concurrency = 4;

        function work() {
          if (pointer >= names.length) {
            if (completed >= names.length) resolve(results);
            return;
          }
          const q = names[pointer++];
          ls.search(q, (status, result) => {
            completed++;
            if (status === "complete" && result.info === "OK" && result.lineInfo) {
              result.lineInfo.forEach(l => {
                const path = (l.path || []).map(p => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]);
                const stops = (l.via_stops || []).map(s => ({
                  name: s.name,
                  coord: [Number(s.location.lng.toFixed(6)), Number(s.location.lat.toFixed(6))]
                }));
                results.push({
                  id: `amap_${l.id}`,
                  ref: l.name.split('(')[0] || q,
                  name: l.name,
                  from: l.start_stop,
                  to: l.end_stop,
                  company: l.company || '北京公交',
                  opening_hours: `${l.basic_price ? '票价:' + l.basic_price + '元' : ''} ${l.start_time ? '首末班:' + l.start_time + '-' + l.end_time : ''}`.trim(),
                  stop_count: stops.length,
                  path_count: path.length,
                  stops: stops,
                  path: path
                });
              });
            }
            if (completed >= names.length) {
              resolve(results);
            } else {
              // 保护性短延时 20ms
              setTimeout(work, 20);
            }
          });
        }

        for (let i = 0; i < concurrency; i++) {
          work();
        }
      });
    });
  }, slice);

  let added = 0;
  batchResults.forEach(r => {
    if (!collectedRoutes.has(r.id)) {
      collectedRoutes.set(r.id, r);
      added++;
    }
  });

  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  批次耗时 ${duration}s，新增有效官方线路 ${added} 条，当前总计: ${collectedRoutes.size} 条`);

  // 每批实时原子写盘
  const routesArray = Array.from(collectedRoutes.values());
  const tmpPath = outPath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(routesArray, null, 2), "utf-8");
  await fs.rename(tmpPath, outPath);

  // 稍微暂停 200ms
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\n=== 采集全部完成！最终高德官方有效线路总数: ${collectedRoutes.size} 条 ===`);
await task.finish({ keep: [] });
