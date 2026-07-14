# PlotFlow 外审证据包 v2

五个证据包的 required cases 固定在 `cases/*.json`，报告不能自行删减 case 或自报 PASS。每个 case 都必须有独立执行记录、actor、非零且守恒的 counters、退出码、逐步结果、原始 transcript SHA256 和 required artifacts。skip、零测试、缺 case、开放 P0/P1 均阻断 PASS。

## 双阶段证据链

1. 外审执行者生成 `raw-report.json`、`result.json`、transcripts 和 artifacts。
2. 同一只读执行者重新读取原始回报，生成 `transcription.json`，逐 case 核对 status、exitCode 和 counters。
3. 执行 `pnpm external-review:finalize -- --evidence-dir <临时证据目录>`。该命令只生成 `PENDING_TRACKED_VERIFICATION` manifest，不宣称通过。
4. 将小型正式证据复制到 `spec/external-review/evidence/<candidate>/<pack>/` 并作为 evidence-only commit 提交。大型视频存于不可变 artifact，manifest 记录 HTTPS URL、大小和 SHA256。
5. 提交后执行 `pnpm external-review:verify -- --evidence-dir <tracked pack dir>`。校验器拒绝绝对路径、路径穿越、symlink、未跟踪/被修改文件、blob/hash 不一致及候选之后的非证据代码变化。

## result.json 结构片段

下例只展示一个 execution 的字段形状，**不能单独构成 PASS**。真实结果必须完整覆盖对应 `cases/<pack>.json` 的全部 case、actor、固定 steps 与 artifacts；远程产物只接受带 run/artifact provenance 的 GitHub Actions 不可变产物 URL。

```json
{
  "schemaVersion": 2,
  "pack": "graph-main-journey",
  "status": "PASS",
  "revision": "40-character-candidate-sha",
  "startedAt": "2026-07-12T00:00:00.000Z",
  "finishedAt": "2026-07-12T00:20:00.000Z",
  "actor": { "id": "reviewer-1", "role": "external-gui-reviewer" },
  "findings": [],
  "executions": [{
    "caseId": "graph.first-run-edit-save",
    "status": "PASS",
    "actor": { "id": "reviewer-1", "role": "external-gui-reviewer" },
    "startedAt": "2026-07-12T00:00:00.000Z",
    "finishedAt": "2026-07-12T00:05:00.000Z",
    "exitCode": 0,
    "counters": { "total": 1, "passed": 1, "failed": 0, "skipped": 0 },
    "steps": [
      { "id": "first-launch", "status": "PASS" },
      { "id": "create-story", "status": "PASS" },
      { "id": "gui-edit", "status": "PASS" },
      { "id": "native-save", "status": "PASS" }
    ],
    "transcript": { "path": "transcripts/first-run.json", "sha256": "64-char-sha256" },
    "artifacts": [
      { "kind": "video", "path": "artifacts/first-run.mp4", "bytes": 123, "sha256": "64-char-sha256" },
      { "kind": "story-output", "path": "artifacts/first-run.mdstory", "bytes": 456, "sha256": "64-char-sha256" }
    ]
  }]
}
```

`transcript` 必须是 schema v2 的结构化 JSON，并与 execution 的 case、actor、起止时间、退出码、counters、固定 steps 完全守恒；每个固定 step 至少包含一条带时间戳的 event。任意文本占位、空事件或只复述 PASS 的文件均无效。

远程大型 artifact 只接受 GitHub Actions artifact API URL。正式 verify 会用 `GITHUB_TOKEN` 重新查询 run 与 artifact，要求 run 的 `head_sha` 等于候选 revision、结论为 success、artifact 未过期，并重新下载核对字节数、SHA256 与内容类型。manifest 中的 hash 指 GitHub 下载归档本身，不是页面 URL；缺少 token 时远程 artifact 的正式核验直接失败。

最终状态由校验器根据 required cases 推导。`BLOCKED/NOT_RUN` 不得包含产品缺陷；`MITIGATED` 不等于关闭。
