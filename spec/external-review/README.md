# PlotFlow 外审证据包

五个证据包刻意隔离跨应用风险。Graph 主闭环保持连续，但浏览器、Narrator、响应式和性能不再共享同一条脆弱旅程。

每包目录必须至少包含：`environment.json`、`environment.md`、`result.json`、一段 OBS/Playwright 视频、关键截图、输入输出文件，以及终结器生成的 `SHA256SUMS.txt` 和 `pack-manifest.json`。

推荐流程：在当前 Windows 11 真机清除旧安装和 PlotFlow 用户配置 → 安装本次 manifest 对应构建 → 预检 → 开始 OBS → 执行单包 → 停止 OBS → 写 `result.json` → 终结证据。工具中断后只续测当前包，不跨包继承结论。

结果模板：

```json
{
  "pack": "graph-main-journey",
  "status": "PASS",
  "revision": "40-character-git-sha",
  "startedAt": "2026-07-12T00:00:00.000Z",
  "finishedAt": "2026-07-12T00:20:00.000Z",
  "defects": [],
  "observations": [],
  "resumeFrom": null
}
```

若状态为 `FAIL`，`defects` 不得为空；若状态为 `BLOCKED/NOT_RUN`，`defects` 必须为空，并通过 `observations` 和 `resumeFrom` 说明原因与续测点。
