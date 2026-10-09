/**
 * 从高德开放平台 AMap.LineSearch 批量获取北京市全量官方高精公交路线
 * 包含：折线轨迹（车道级GCJ-02）、沿途站点、首末班时间、票价、运营公司
 */

import fs from "node:fs/promises";
import path from "node:path";

// 生成北京市所有可能存在的公交路线名称列表
export function generateBeijingBusNames() {
  const names = new Set();

  // 1. 常规市区干线 1 ~ 999路
  for (let i = 1; i <= 999; i++) {
    names.add(`${i}路`);
  }

  // 2. 夜班车网 夜1 ~ 夜38路
  for (let i = 1; i <= 38; i++) {
    names.add(`夜${i}路`);
  }

  // 3. 快速公交 BRT
  for (let i = 1; i <= 4; i++) {
    names.add(`快速公交${i}线`);
    names.add(`快速公交${i}线支线`);
  }

  // 4. 微循环专线 专1 ~ 专210路
  for (let i = 1; i <= 210; i++) {
    names.add(`专${i}路`);
  }

  // 5. 各区县前缀支线 (F房山, H怀柔, M门头沟, T通州, C昌平, S顺义, Y延庆)
  const prefixes = [
    { p: 'F', max: 85 },
    { p: 'H', max: 80 },
    { p: 'M', max: 45 },
    { p: 'T', max: 120 },
    { p: 'C', max: 120 },
    { p: 'S', max: 50 },
    { p: 'Y', max: 45 },
    { p: '昌', max: 70 },
    { p: '顺', max: 60 },
    { p: '通', max: 50 },
    { p: '房', max: 50 },
    { p: '密', max: 60 },
    { p: '平', max: 60 },
    { p: '兴', max: 80 }
  ];

  prefixes.forEach(({ p, max }) => {
    for (let i = 1; i <= max; i++) {
      names.add(`${p}${i}路`);
    }
  });

  // 6. 知名环线/特字头/观光车
  const specials = [
    "44路内环", "44路外环", "300路内环", "300路外环", 
    "特8路内环", "特8路外环", "特8路", "特11路", "特13路",
    "北京大兴国际机场大巴", "首都机场大巴",
    "观光1线", "观光2线", "观光3线"
  ];
  specials.forEach(s => names.add(s));

  return Array.from(names);
}
