# PlotFlow Progress Dashboard

这个包承载 PlotFlow 的独立工程驾驶舱页面。

## 维护流程

1. 更新源文档或机器产物：
   - `README.md`
   - `spec/progress.md`
   - `spec/milestones.md`
   - `spec/audit/pass1-data.json`
   - `scripts/output/journey-report.json`
   - `scripts/benchmark/perf-report.json`
2. 运行 `pnpm dashboard:refresh` 生成规范化数据。
3. 如需本地查看，运行 `pnpm dashboard:dev`。
4. 如需产出静态页面，运行 `pnpm dashboard:build`。

## 变更边界

- 源内容变化：优先改源文档或 JSON。
- 抽取失败或源格式变化：改 `scripts/progress-dashboard/extractor.mjs`。
- 展示优先级、模块顺序、阈值、文案：改 `src/config/defaultDashboardConfig.ts`。
- UI 结构和组件：改 `src/`。

## 不变量

- 页面不手写任何业务数字。
- `public/dashboard-data.json` 是页面唯一数据入口。
- 冲突数据必须通过 discrepancy 暴露，不能静默覆盖。
