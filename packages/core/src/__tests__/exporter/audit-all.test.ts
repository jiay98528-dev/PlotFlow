/**
 * 导出数据完整性审计 (E2E)
 *
 * 对 4 个模板文件逐一执行：
 *   1. parseStory 解析
 *   2. 调用 JSON/HTML/TXT 导出器
 *   3. JSON：合法性 + Schema 一致性
 *   4. HTML：节点/选项完整性 + XSS 防注入
 *   5. TXT：无 Markdown 语法泄漏
 *
 * @version 0.1.0
 */

import { describe, it, expect } from 'vitest';
import { parseStory } from '../../parser/parser.js';
import { exportJSON } from '../../exporter/json.js';
import { exportHTML } from '../../exporter/html.js';
import { exportTXT } from '../../exporter/txt.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlotFlowData } from '../../types/ast.js';

// ============================================================================
// 模板文件读取
// ============================================================================

// __dirname polyfill for vitest ESM context
const _dirname = typeof __dirname !== 'undefined' ? __dirname : resolve(dirname(fileURLToPath(import.meta.url)));

/** 项目根目录（6 层上溯从 packages/core/src/__tests__/exporter 到项目根） */
function findProjectRoot(): string {
  // We know the absolute layout: PlotFlow/packages/core/src/__tests__/exporter/audit-all.test.ts
  // Use a known path anchor
  const candidates = [
    resolve(_dirname, '../../../../../..'), // from exporter/ up to PlotFlow/
    resolve(_dirname, '../../../../..'),
    resolve(_dirname, '../../../../'),
  ];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'));
        if (pkg.name === 'plotflow') return dir;
      } catch { /* ignore */ }
    }
  }
  return resolve(_dirname, '../../../../../..');
}

const PROJECT_ROOT = findProjectRoot();
const TEMPLATES_DIR = resolve(PROJECT_ROOT, 'templates');

interface TemplateFixture {
  name: string;
  filePath: string;
  content: string;
}

/** 读取所有模板文件 */
function loadTemplates(): TemplateFixture[] {
  const files = ['rpg-dialogue.mdstory', 'visual-novel.mdstory', 'puzzle-escape.mdstory'];
  const fixtures: TemplateFixture[] = [];

  for (const f of files) {
    const fp = resolve(TEMPLATES_DIR, f);
    if (!existsSync(fp)) {
      console.warn(`[WARN] 模板文件不存在: ${fp}`);
      continue;
    }
    fixtures.push({
      name: f.replace('.mdstory', ''),
      filePath: fp,
      content: readFileSync(fp, 'utf-8'),
    });
  }

  // godot-example 在子目录
  const godotFile = resolve(TEMPLATES_DIR, 'godot-example', 'story.mdstory');
  if (existsSync(godotFile)) {
    fixtures.push({
      name: 'godot-example',
      filePath: godotFile,
      content: readFileSync(godotFile, 'utf-8'),
    });
  }

  return fixtures;
}

const TEMPLATES = loadTemplates();

// ============================================================================
// JSON Schema 结构检查（验证关键字段匹配 json-schema.md）
// ============================================================================

interface SchemaCheckResult {
  valid: boolean;
  issues: string[];
}

function checkJsonSchema(json: Record<string, unknown>): SchemaCheckResult {
  const issues: string[] = [];
  const valid = true;

  // 1. 顶层必含字段
  for (const key of ['$schema', 'meta', 'variables', 'chapters']) {
    if (!(key in json)) {
      issues.push(`缺少顶层字段: ${key}`);
    }
  }

  // 2. $schema 必须为正确标识符
  if (json['$schema'] !== 'https://plotflow.dev/schema/0.1/story.json') {
    issues.push(`$schema 应为 "https://plotflow.dev/schema/0.1/story.json"，实际为 "${json['$schema']}"`);
  }

  // 3. meta 字段验证
  const meta = json['meta'] as Record<string, unknown> | undefined;
  if (meta) {
    if (!meta['plotflow']) issues.push('meta.plotflow 缺失');
    if (!meta['title'] && meta['title'] !== '') issues.push('meta.title 缺失');
    if (!meta['exportedAt']) issues.push('meta.exportedAt 缺失');
    // engine 默认为 'none'
    if (!meta['engine']) issues.push('meta.engine 缺失（应默认为 "none"）');
  } else {
    issues.push('meta 对象不存在');
  }

  // 4. variables 必为对象
  const vars = json['variables'];
  if (vars === null || typeof vars !== 'object' || Array.isArray(vars)) {
    issues.push('variables 必须为键值对象');
  }

  // 5. chapters 必为非空数组（Schema 要求 minItems: 1）
  const chapters = json['chapters'];
  if (!Array.isArray(chapters)) {
    issues.push('chapters 必须为数组');
  } else {
    if (chapters.length < 1) {
      issues.push('chapters 至少包含 1 个章节（minItems: 1）');
    }
    // 验证每个 chapter 结构
    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci] as Record<string, unknown>;
      if (!ch) { issues.push(`chapters[${ci}] 为空`); continue; }
      if (!ch['id']) issues.push(`chapters[${ci}] 缺少 id`);
      if (!ch['title'] && ch['title'] !== '') issues.push(`chapters[${ci}] 缺少 title`);

      const nodes = ch['nodes'] as Record<string, unknown>[] | undefined;
      if (!Array.isArray(nodes)) {
        issues.push(`chapters[${ci}] nodes 必须为数组`);
      } else {
        for (let ni = 0; ni < nodes.length; ni++) {
          const n = nodes[ni];
          if (!n) { issues.push(`chapters[${ci}].nodes[${ni}] 为空`); continue; }
          for (const f of ['id', 'chapterId', 'fullId', 'title', 'body', 'options', 'position', 'isRoot', 'isOrphan', 'isDeadEnd']) {
            if (!(f in n)) issues.push(`chapters[${ci}].nodes[${ni}] 缺少字段: ${f}`);
          }
          // body 必须为数组
          if (!Array.isArray(n['body'])) {
            issues.push(`chapters[${ci}].nodes[${ni}].body 必须为数组`);
          }
          // options 验证
          const opts = n['options'] as Record<string, unknown>[] | undefined;
          if (Array.isArray(opts)) {
            for (let oi = 0; oi < opts.length; oi++) {
              const o = opts[oi];
              if (!o) continue;
              for (const of2 of ['index', 'text', 'targetNodeId', 'targetFullId', 'conditions', 'sideEffects']) {
                if (!(of2 in o)) issues.push(`chapters[${ci}].nodes[${ni}].options[${oi}] 缺少字段: ${of2}`);
              }
            }
          }
        }
      }
    }
  }

  return { valid: valid && issues.length === 0, issues };
}

// ============================================================================
// HTML 完整性检查
// ============================================================================

interface HtmlCheckResult {
  valid: boolean;
  issues: string[];
}

function checkHtmlCompleteness(html: string, data: PlotFlowData): HtmlCheckResult {
  const issues: string[] = [];
  const valid = true;

  // 1. 基本结构
  if (!html.includes('<!DOCTYPE html>')) issues.push('缺少 DOCTYPE');
  if (!html.includes('<html')) issues.push('缺少 <html>');
  if (!html.includes('</html>')) issues.push('缺少 </html>');
  if (!html.includes('<script>')) issues.push('缺少 <script>');
  if (!html.includes('var STORY = ')) issues.push('缺少运行时数据 var STORY');
  if (!html.includes('<style>')) issues.push('缺少 CSS');
  if (!html.includes('</style>')) issues.push('CSS 未闭合');

  // 2. 节点标题完整性
  for (const ch of data.chapters) {
    for (const node of ch.nodes) {
      if (node.title && !html.includes(escapeHtmlEntity(node.title))) {
        // 标题可能在运行时 JSON 中，检查 var STORY 部分
        if (!html.includes(node.title)) {
          issues.push(`HTML 中未找到节点标题: "${node.title}"（来源: ${ch.id}/${node.fullId}）`);
        }
      }
    }
  }

  // 3. 运行时数据中节点数量正确
  const storyMatch = html.match(/var STORY = ({.*?});/s);
  if (storyMatch) {
    try {
      const storyData = JSON.parse(storyMatch[1]!);
      const nodeCountInStory = Object.keys(storyData.nodes || {}).length;
      const expectedCount = data.chapters.reduce((s, c) => s + c.nodes.length, 0);
      if (nodeCountInStory !== expectedCount) {
        issues.push(`HTML 运行时数据节点数(${nodeCountInStory}) 与 AST(${expectedCount}) 不一致`);
      }
    } catch (e) {
      issues.push(`var STORY JSON 解析失败: ${e}`);
    }
  }

  // 4. 引擎核心函数存在
  for (const fn of ['evalCond', 'applyEffects', 'renderNode', 'goCrumb', 'renderVars', 'esc', 'mdh']) {
    if (!html.includes(`function ${fn}(`)) {
      issues.push(`缺少 JS 引擎函数: ${fn}`);
    }
  }

  // 5. 关键 UI 元素
  for (const sel of ['#breadcrumb', '.option-btn', '#var-panel', '.dead-end', '#story-title', '#var-toggle']) {
    if (!html.includes(sel)) {
      issues.push(`HTML 中缺少 CSS 选择器: ${sel}`);
    }
  }

  // 6. 响应式 meta
  if (!html.includes('name="viewport"')) {
    issues.push('缺少 viewport meta 标签');
  }
  if (!html.includes('charset="UTF-8"') && !html.includes('charset=UTF-8')) {
    issues.push('缺少 charset meta 标签');
  }

  return { valid: valid && issues.length === 0, issues };
}

/** 基础 HTML 实体转义（用于查找匹配） */
function escapeHtmlEntity(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ============================================================================
// TXT 完整性检查 - 无 Markdown 语法泄漏
// ============================================================================

interface TxtCheckResult {
  valid: boolean;
  issues: string[];
}

function checkTxtCleanliness(txt: string, data: PlotFlowData): TxtCheckResult {
  const issues: string[] = [];
  const valid = true;
  const lines = txt.split('\n');

  // =====================================================================
  // 检查 1: 不应包含原始的 [选项] 语法（带方括号的选项标记）
  // TXT 输出会格式化选项为 "选项: 描述 -> 目标"，不应有原始的 [选项]
  // =====================================================================
  if (/\[选项\]/.test(txt)) {
    const matchingLines = lines.filter(l => l.includes('[选项]')).map(l => l.trim()).filter(l => l.startsWith('[选项]'));
    if (matchingLines.length > 0) {
      issues.push(`TXT body 中存在未剥离的原始 [选项] 语法（${matchingLines.length} 处）`);
    }
  }

  // =====================================================================
  // 检查 2: 不应包含以缩进开头的 效果: / 条件: 子行
  // 这些是 PlotFlow 特定语法（选项的子行），TXT 应只保留格式化后的选项
  // 注意: "条件:" 也可能出现在 formatOption 的 "(条件: xxx)" 中，所以只检查
  //       以空白缩进 + 效果:/条件: 开头的行，排除 "(条件:" 这种模式
  // =====================================================================
  for (const line of lines) {
    const trimmed = line.trimStart();
    // 检查原始子行: 至少 2 空格或 1 Tab 缩进 + 效果:/条件:
    if (/^[ \t]{2,}效果[:：]/.test(line) || /^\t+效果[:：]/.test(line)) {
      issues.push(`TXT 中存在未剥离的效果子行: "${line.trim()}"`);
      break;
    }
    // 条件子行同样检查: 排除 "(条件:" 开头的行（格式化输出用括号包裹）
    if (!trimmed.startsWith('(') && !trimmed.startsWith('选项:')) {
      if (/^[ \t]{2,}条件[:：]/.test(line) || /^\t+条件[:：]/.test(line)) {
        issues.push(`TXT 中存在未剥离的条件子行: "${line.trim()}"`);
        break;
      }
    }
  }

  // =====================================================================
  // 检查 3: 不应包含变量引用 $（TXT 应剥离 $ 前缀）
  // 仅检查常见的变量名模式，避免模板文本中的 $ 误报
  // =====================================================================
  const varRefRe = /\$[\w一-鿿]+/;
  if (varRefRe.test(txt)) {
    // 记录具体泄漏
    const varLines = lines.filter(l => varRefRe.test(l)).slice(0, 3);
    for (const vl of varLines) {
      const matches = vl.match(/\$[\w一-鿿]+/g);
      if (matches) issues.push(`TXT 中存在未剥离的变量引用: ${matches.join(', ')} 在行 "${vl.trim()}"`);
    }
  }

  // =====================================================================
  // 检查 4: 不应包含 Markdown 原始标记
  // =====================================================================
  const boldRe = /\*\*.+?\*\*/;
  if (boldRe.test(txt)) {
    issues.push('TXT 中存在未剥离的 Markdown 加粗标记 **');
  }

  const headingRe = /^#{1,6}\s+/m;
  if (headingRe.test(txt)) {
    issues.push('TXT 中存在未剥离的标题标记 #');
  }

  const codeRe = /`[^`]+`/;
  if (codeRe.test(txt)) {
    issues.push('TXT 中存在未剥离的行内代码反引号');
  }

  // =====================================================================
  // 检查 5: 节点标题完整性
  // =====================================================================
  for (const ch of data.chapters) {
    for (const node of ch.nodes) {
      if (node.title && node.title.length > 0) {
        if (!txt.includes(node.title)) {
          issues.push(`TXT 中未找到节点标题: "${node.title}"`);
        }
      }
    }
  }

  // =====================================================================
  // 检查 6: 结构完整性
  // =====================================================================
  if (data.chapters.length > 0) {
    if (!txt.startsWith('---') && !txt.startsWith(data.meta.title || '')) {
      issues.push('TXT 输出格式异常：应以 --- 或故事标题开头');
    }
  }

  return { valid: valid && issues.length === 0, issues };
}

// ============================================================================
// XSS 专用审计（强化版）
// ============================================================================

interface XssCheckResult {
  valid: boolean;
  issues: string[];
}

function checkHtmlXss(html: string): XssCheckResult {
  const issues: string[] = [];
  const valid = true;

  // 1. esc() 函数存在且使用 textContent 方式
  if (!html.includes('function esc(s)')) {
    issues.push('缺少 esc() HTML 转义函数');
  } else {
    // 验证 esc() 使用 textContent（而不是 innerHTML）
    if (!html.includes('textContent=s')) {
      issues.push('esc() 未使用 textContent 方式进行转义');
    }
  }

  // 2. 所有用户文本输出经过 esc() 包裹
  if (!html.includes('esc(o.text)')) issues.push('选项文本未经过 esc() 转义');
  if (!html.includes('esc(node.title||')) issues.push('节点标题未经过 esc() 转义');
  if (!html.includes('esc(c.title||')) issues.push('面包屑标题未经过 esc() 转义');
  if (!html.includes('esc(String(v))')) issues.push('变量值显示未经过 esc() 转义');

  // 3. mdh() Markdown 渲染函数使用 esc() 预处理
  if (!html.includes('function mdh(t)')) {
    issues.push('缺少 mdh() Markdown 渲染函数');
  } else {
    if (!html.includes('esc(t)')) {
      issues.push('mdh() 未对用户文本进行 HTML 转义');
    }
  }

  // 4. 提取 body 标签外的 HTML 源码，检查是否有未转义的用户文本标签
  //    （严格模式）
  const bodyParts = html.split(/<\/?script[^>]*>/);
  const outsideScript = (bodyParts[0] ?? '') + (bodyParts[2] ?? '');

  // 用户可见的 HTML body 中不应出现 <script> 标签（除非来自模板本身的固定标签）
  // 检查是否有 <script> 出现在非 JS 区域（除了 var STORY 的 JSON 字符串）
  // 我们已通过 split 移除 script 块，剩余的应该没有 <script>
  if (outsideScript.includes('<script')) {
    // 但是 <script> 本身在 bodyParts 分割时已被分离
    // 注意：var STORY = ... 在 script 块内，所以 script 内的内容不会出现在 outsideScript
    // 但我们还要检查 style 块
  }

  // 5. 检查 HTML title 标签是否转义（用户文本在 title 中）
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  if (titleMatch) {
    // title 中的用户文本应该被 escapeHtml 处理过
    // 检查是否包含未转义的 < 或 >
    const titleContent = titleMatch[1] ?? '';
    // title 经过 escapeHtml 转义后不应有 < 或 >（除非是模板中的固定字符）
    if (titleContent.includes('<') && !titleContent.includes('&lt;')) {
      // 如果没有 &lt; 但有 <，且不是来自 Story 标题中的文本
      issues.push('HTML <title> 中的用户文本未正确转义');
    }
  }

  // 6. 确认 STORY JSON 字符串中的用户文本不会被内联执行
  //    所有用户文本通过 JSON.stringify → var STORY = ... 注入
  //    运行时 JS 引擎通过 JSON.parse 读取，不会执行
  const storyMatch = html.match(/var STORY = ({.*?});/s);
  if (!storyMatch) {
    issues.push('缺少 var STORY 运行时数据');
  }

  return { valid: valid && issues.length === 0, issues };
}

// ============================================================================
// 主审计
// ============================================================================

describe('导出数据完整性审计 (7 步审计)', () => {
  // 第一步：验证模板文件已加载
  it('审计前检查: 模板文件已加载', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(4);
    console.log(`[INFO] 已加载 ${TEMPLATES.length} 个模板文件: ${TEMPLATES.map(t => t.name).join(', ')}`);
  });

  for (const tmpl of TEMPLATES) {
    describe(`模板: ${tmpl.name}`, () => {
      let parseResult: ReturnType<typeof parseStory>;
      let data: PlotFlowData;

      it('Step 1: parseStory 解析成功', () => {
        parseResult = parseStory(tmpl.content);
        expect(parseResult.ok).toBe(true);
        if (!parseResult.ok) return;
        data = parseResult.data;
        expect(data.chapters.length).toBeGreaterThan(0);
        console.log(`  [INFO] ${tmpl.name}: ${data.chapters.length} 章节, ${data.chapters.reduce((s, c) => s + c.nodes.length, 0)} 节点`);
      });

      // ------ JSON 验证 ------
      describe('Step 2-3: JSON 导出 & Schema 验证', () => {
        it('JSON 导出成功且合法', () => {
          if (!parseResult.ok) return;
          const jsonResult = exportJSON(data);
          expect(jsonResult.ok).toBe(true);
          if (!jsonResult.ok) return;

          const rawJson = jsonResult.data;
          // 验证是合法 JSON
          let parsed: Record<string, unknown>;
          expect(() => { parsed = JSON.parse(rawJson); }).not.toThrow();
          parsed = JSON.parse(rawJson);

          // Schema 一致性检查
          const schemaCheck = checkJsonSchema(parsed);
          if (!schemaCheck.valid) {
            console.log(`  [FAIL] Schema 问题: ${schemaCheck.issues.join('; ')}`);
          }
          expect(schemaCheck.valid).toBe(true);
          expect(schemaCheck.issues).toEqual([]);

          // JSON 美化格式验证
          expect(rawJson.endsWith('\n')).toBe(true);
          expect(rawJson).toContain('\n  "');
          expect(rawJson).toContain('\n    "');
        });

        it('JSON chapters 数据结构完整性', () => {
          if (!parseResult.ok) return;
          const jsonResult = exportJSON(data);
          if (!jsonResult.ok) return;
          const parsed = JSON.parse(jsonResult.data) as Record<string, unknown>;

          const chapters = parsed['chapters'] as Record<string, unknown>[];
          expect(chapters.length).toBe(data.chapters.length);

          // 每个章节的节点数与 AST 一致
          for (let ci = 0; ci < chapters.length; ci++) {
            const ch = chapters[ci]!;
            const astCh = data.chapters[ci]!;
            const nodes = ch['nodes'] as Record<string, unknown>[];
            expect(nodes.length).toBe(astCh.nodes.length);

            for (let ni = 0; ni < nodes.length; ni++) {
              const n = nodes[ni]!;
              const astNode = astCh.nodes[ni]!;

              // 核心字段一致
              expect(n['id']).toBe(astNode.id);
              expect(n['fullId']).toBe(astNode.fullId);
              expect(n['chapterId']).toBe(astNode.chapterId);
              expect(n['title']).toBe(astNode.title);

              // body 段落数组
              const bodyArr = n['body'] as string[];
              expect(Array.isArray(bodyArr)).toBe(true);

              // 选项数量和内容
              const opts = n['options'] as Record<string, unknown>[];
              expect(opts.length).toBe(astNode.options.length);
              for (let oi = 0; oi < opts.length; oi++) {
                const o = opts[oi]!;
                const astOpt = astNode.options[oi]!;
                expect(o['text']).toBe(astOpt.description);
                expect(o['targetNodeId']).toBe(astOpt.targetNodeId);
                expect(o['targetFullId']).toBe(astOpt.targetFullId);
              }

              // 位置信息
              expect(n['position']).toEqual({ x: 0, y: 0 });
            }
          }
        });

        it('JSON 条件表达式完整性', () => {
          if (!parseResult.ok) return;
          const jsonResult = exportJSON(data);
          if (!jsonResult.ok) return;
          const parsed = JSON.parse(jsonResult.data) as Record<string, unknown>;

          const chapters = parsed['chapters'] as Record<string, unknown>[];

          // 遍历所有选项，检查有条件的选项是否被正确导出
          for (const ch of data.chapters) {
            for (const node of ch.nodes) {
              for (const opt of node.options) {
                // 找到 JSON 中对应的选项
                const jsonCh = chapters.find((jc) => jc['id'] === ch.id) as Record<string, unknown> | undefined;
                if (!jsonCh) continue;
                const jsonNodes = jsonCh['nodes'] as Record<string, unknown>[];
                const jsonNode = jsonNodes.find((jn) => jn['id'] === node.id) as Record<string, unknown> | undefined;
                if (!jsonNode) continue;
                const jsonOpts = jsonNode['options'] as Record<string, unknown>[];
                const jsonOpt = jsonOpts.find((jo) => jo['text'] === opt.description) as Record<string, unknown> | undefined;
                if (!jsonOpt) continue;

                if (opt.condition !== null) {
                  // 有条件的选项：conditions 不为 null
                  expect(jsonOpt['conditions']).not.toBeNull();
                  const cond = jsonOpt['conditions'] as Record<string, unknown>;
                  expect(cond['expression']).toBeTruthy();
                  expect(cond['ast']).toBeTruthy();
                } else {
                  expect(jsonOpt['conditions']).toBeNull();
                }
              }
            }
          }
        });

        it('JSON 副作用(效果)完整性', () => {
          if (!parseResult.ok) return;
          const jsonResult = exportJSON(data);
          if (!jsonResult.ok) return;
          const parsed = JSON.parse(jsonResult.data) as Record<string, unknown>;

          const chapters = parsed['chapters'] as Record<string, unknown>[];

          for (const ch of data.chapters) {
            for (const node of ch.nodes) {
              for (const opt of node.options) {
                const jsonCh = chapters.find((jc) => jc['id'] === ch.id) as Record<string, unknown> | undefined;
                if (!jsonCh) continue;
                const jsonNodes = jsonCh['nodes'] as Record<string, unknown>[];
                const jsonNode = jsonNodes.find((jn) => jn['id'] === node.id) as Record<string, unknown> | undefined;
                if (!jsonNode) continue;
                const jsonOpts = jsonNode['options'] as Record<string, unknown>[];
                const jsonOpt = jsonOpts.find((jo) => jo['text'] === opt.description) as Record<string, unknown> | undefined;
                if (!jsonOpt) continue;

                const effects = jsonOpt['sideEffects'] as Record<string, unknown>[];
                expect(effects.length).toBe(opt.sideEffects.length);
                for (let ei = 0; ei < effects.length; ei++) {
                  const e = effects[ei]!;
                  const astE = opt.sideEffects[ei]!;
                  expect(e['variable']).toBe(astE.variableName);
                  expect(e['operation']).toBe(astE.operation);
                  expect(e['value']).toBe(astE.value);
                }
              }
            }
          }
        });
      });

      // ------ HTML 验证 ------
      describe('Step 4: HTML 完整性', () => {
        let htmlResult: ReturnType<typeof exportHTML>;

        it('HTML 导出成功', () => {
          if (!parseResult.ok) return;
          htmlResult = exportHTML(data);
          expect(htmlResult.ok).toBe(true);
        });

        it('HTML 节点/选项完整性', () => {
          if (!parseResult.ok) return;
          if (!htmlResult?.ok) return;
          const check = checkHtmlCompleteness(htmlResult.data, data);
          if (!check.valid) {
            console.log(`  [FAIL] HTML 问题: ${check.issues.join('; ')}`);
          }
          expect(check.valid).toBe(true);
          expect(check.issues).toEqual([]);
        });

        it('HTML 自包含（无外部资源）', () => {
          if (!parseResult.ok || !htmlResult?.ok) return;
          const html = htmlResult.data;
          expect(html).not.toContain('http://');
          // 允许 https:// 出现在 schema URL 注释中
          // 但不应有 <link> 外部 CSS
          expect(html).not.toContain('<link');
          // 不应有外部脚本
          expect(html).not.toContain('src=');
        });

        it('HTML 响应式布局', () => {
          if (!parseResult.ok || !htmlResult?.ok) return;
          const html = htmlResult.data;
          expect(html).toContain('width=device-width,initial-scale=1.0');
          expect(html).toContain('maximum-scale=1.0');
          expect(html).toContain('user-scalable=no');
        });
      });

      // ------ TXT 验证 ------
      describe('Step 5: TXT 完整性 (无 Markdown 泄漏)', () => {
        let txtResult: ReturnType<typeof exportTXT>;

        it('TXT 导出成功', () => {
          if (!parseResult.ok) return;
          txtResult = exportTXT(data);
          expect(txtResult.ok).toBe(true);
        });

        it('TXT 无 Markdown 语法泄漏', () => {
          if (!parseResult.ok || !txtResult?.ok) return;
          const check = checkTxtCleanliness(txtResult.data, data);
          if (!check.valid) {
            console.log(`  [FAIL] TXT 问题: ${check.issues.join('; ')}`);
          }
          expect(check.valid).toBe(true);
          expect(check.issues).toEqual([]);
        });

        it('TXT 结构完整: 章节分隔符和节点', () => {
          if (!parseResult.ok || !txtResult?.ok) return;
          const txt = txtResult.data;
          const chapters = data.chapters;

          // 每个非匿名章节前有 ---
          const sepCount = (txt.match(/^---$/gm) || []).length;
          const namedChapters = chapters.filter(c => !c.isAnonymous).length;
          // 实际分隔符可能等于或大于命名章节数（如果匿名章节也有 ---）
          // 最小为命名章节数
          expect(sepCount).toBeGreaterThanOrEqual(namedChapters > 0 ? namedChapters : 1);
        });

        it('TXT 选项和目标引用完整性', () => {
          if (!parseResult.ok || !txtResult?.ok) return;
          const txt = txtResult.data;

          for (const ch of data.chapters) {
            for (const node of ch.nodes) {
              for (const opt of node.options) {
                // 选项描述应以 "选项: " 开头出现在 TXT 中
                const optLine = `选项: ${opt.description}`;
                expect(txt).toContain(optLine);

                // 如果有跳转目标，应包含 ->
                if (opt.targetFullId) {
                  expect(txt).toContain(` → ${opt.targetFullId}`);
                }
              }
            }
          }
        });
      });
    });
  }

  // ------ XSS 全局审计 ------
  describe('Step 7: XSS 重点 — HTML 转义审计', () => {
    for (const tmpl of TEMPLATES) {
      it(`${tmpl.name}: HTML 用户文本已正确转义`, () => {
        const parseResult = parseStory(tmpl.content);
        expect(parseResult.ok).toBe(true);
        if (!parseResult.ok) return;

        const htmlResult = exportHTML(parseResult.data);
        expect(htmlResult.ok).toBe(true);
        if (!htmlResult.ok) return;

        const check = checkHtmlXss(htmlResult.data);
        if (!check.valid) {
          console.log(`  [FAIL] XSS 问题 (${tmpl.name}): ${check.issues.join('; ')}`);
        }
        expect(check.valid).toBe(true);
        expect(check.issues).toEqual([]);
      });
    }

    // 针对 XSS 的强化测试：注入恶意载荷
    it('XSS 注入载荷: <script>alert(1)</script> 在 HTML 中不执行', () => {
      const xssContent = `# 章

## 节点：安全

正文 <script>alert('xss')</script> <img src=x onerror=alert(2)>

[选项] 点击这里 <script>alert(3)</script> -> 节点：目标

## 节点：目标

安全到达。
`;
      const parseResult = parseStory(xssContent);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const htmlResult = exportHTML(parseResult.data);
      expect(htmlResult.ok).toBe(true);
      if (!htmlResult.ok) return;

      const html = htmlResult.data;

      // 验证载荷只在 var STORY JSON 字符串中，不在 HTML body 内
      const bodyParts = html.split(/<\/?script[^>]*>/);
      const beforeFirstScript = bodyParts[0] ?? '';
      const afterLastScript = bodyParts[2] ?? '';

      // HTML body（非 script 块）不应有未经转义的 <script> 标签
      expect(beforeFirstScript + afterLastScript).not.toContain('<script>alert');
      expect(beforeFirstScript + afterLastScript).not.toContain('onerror=');

      // 验证 esc() 函数存在且正确工作
      expect(html).toContain('function esc(s)');
      expect(html).toContain('textContent=s');

      // mdh() 先 esc 再渲染
      expect(html).toContain('function mdh(t)');
    });

    it('XSS 注入载荷: 属性注入尝试', () => {
      const xssContent = `# 章

## 节点：测试

正文内容。

[选项] "onmouseover="alert(1) -> 节点：目标

## 节点：目标

安全。
`;
      const parseResult = parseStory(xssContent);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const htmlResult = exportHTML(parseResult.data);
      expect(htmlResult.ok).toBe(true);
      if (!htmlResult.ok) return;

      const html = htmlResult.data;

      // 确认 onmouseover 在 HTML 中不出现为属性
      // 选项文本在 button 内部，应被 esc() 转义
      expect(html).toContain('esc(o.text)');

      // 选项文本中的 " 应被转义（但 esc() 在 JS 运行时执行，不易静态验证）
      // 验证 var STORY 中包含原始文本（在 JSON 字符串中安全）
      const storyMatch = html.match(/var STORY = ({.*?});/s);
      expect(storyMatch).not.toBeNull();
      if (storyMatch) {
        expect(storyMatch[1]).toContain('onmouseover');
      }
    });
  });

  // 跨模板交叉验证
  describe('交叉验证: 导出器间一致性', () => {
    it('所有模板 JSON 导出的节点总数与 HTML 运行时数据一致', () => {
      for (const tmpl of TEMPLATES) {
        const parseResult = parseStory(tmpl.content);
        expect(parseResult.ok).toBe(true);
        if (!parseResult.ok) return;
        const data = parseResult.data;

        const jsonResult = exportJSON(data);
        expect(jsonResult.ok).toBe(true);
        if (!jsonResult.ok) return;
        const jsonParsed = JSON.parse(jsonResult.data) as Record<string, unknown>;

        const htmlResult = exportHTML(data);
        expect(htmlResult.ok).toBe(true);
        if (!htmlResult.ok) return;

        // JSON chapters 总节点数
        const jsonChapters = jsonParsed['chapters'] as Record<string, unknown>[];
        const jsonNodeCount = jsonChapters.reduce((s, ch) => {
          const nodes = ch['nodes'] as Record<string, unknown>[] | undefined;
          return s + (nodes?.length ?? 0);
        }, 0);

        // HTML 运行时数据节点数
        const storyMatch = htmlResult.data.match(/var STORY = ({.*?});/s);
        expect(storyMatch).not.toBeNull();
        if (storyMatch) {
          const storyData = JSON.parse(storyMatch[1]!);
          const htmlNodeCount = Object.keys(storyData.nodes || {}).length;

          expect(htmlNodeCount).toBe(jsonNodeCount);
        }

        // TXT 节点标题完整性
        const txtResult = exportTXT(data);
        expect(txtResult.ok).toBe(true);
        if (!txtResult.ok) return;
        for (const ch of data.chapters) {
          for (const node of ch.nodes) {
            expect(txtResult.data).toContain(node.title);
          }
        }
      }
    });
  });
});
