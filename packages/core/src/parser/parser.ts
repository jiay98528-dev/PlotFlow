/**
 * .mdstory Markdown 节点解析器 — 递归下降子集
 *
 * @packageDocumentation
 * @remarks
 * 主解析入口 + 章节/节点解析。不使用 unified/remark（M2 后再迁移）。
 *
 * 对应规范：
 * - spec/syntax-formal.md §1 (文件结构) + §3 (章节与节点)
 * - spec/syntax-formal.md §10.5 (容错解析策略)
 *
 * 所有错误通过 ParseResult 模式返回，不抛异常。
 *
 * @version 0.1.0
 */

import { success } from '../result.js';
import type { ParseResult } from '../result.js';
import type {
  PlotFlowData,
  StoryMeta,
  EngineTarget,
  Chapter,
  StoryNode,
  NodeDiagnostics,
  Option,
  VariableDeclaration,
} from '../types/ast.js';
import type {
  Diagnostic,
  ErrorCode,
  WarningCode,
  InfoCode,
  SourceRange,
  DiagnosticSeverity,
} from '../types/diagnostic.js';
import { DIAGNOSTIC_MESSAGES } from '../types/diagnostic.js';
import { parseFrontmatter } from './frontmatter.js';
import type { FrontmatterResult } from './frontmatter.js';
import { parseOptions } from './options.js';

// ============================================================================
// 诊断创建辅助
// ============================================================================

/** 错误计数器（每次 parseStory 调用重置） */
let errorSeq = 0;

/** 重置错误计数器 */
function resetErrorSeq(): void {
  errorSeq = 0;
}

/**
 * 创建诊断对象。
 *
 * @param code - 诊断代码
 * @param severity - 严重级别
 * @param line - 绝对行号（1-based）
 * @param startColumn - 起始列号（1-based）
 * @param endColumn - 结束列号（1-based）
 * @param message - 消息（可选，默认使用 DIAGNOSTIC_MESSAGES）
 * @param detail - 详细信息（可选）
 */
function createDiagnostic(
  code: ErrorCode | WarningCode | InfoCode,
  severity: DiagnosticSeverity,
  line: number,
  startColumn: number = 1,
  endColumn: number = 1,
  message?: string,
  detail?: string,
): Diagnostic {
  errorSeq++;
  const seqStr = String(errorSeq).padStart(3, '0');
  const range: SourceRange = {
    startLine: line,
    startColumn,
    endLine: line,
    endColumn,
  };
  return {
    id: `${code}-${seqStr}`,
    code,
    severity,
    message: message ?? DIAGNOSTIC_MESSAGES[code],
    detail,
    range,
  };
}

// ============================================================================
// 正则常量 — 标题检测
// ============================================================================

/**
 * 章节标题匹配：`# ChapterTitle`
 * - 必须以 `# ` 或 `#\t` 开头（H1 Markdown 语法）
 * - 不能是 `##`（H2 留给节点）
 * - 提取标题文本（去除前导 `#` 和空白）
 */
const CHAPTER_HEADING_RE = /^#[ \t]+(.+)$/;

/**
 * 节点标题匹配：`## 节点：NodeName` 或 `## 节点:NodeName`
 * - `##` + 空白 + "节点" + 冒号（全角或半角）+ 节点名
 * - 冒号前后允许可选空白
 */
const NODE_HEADING_RE = /^##[ \t]+节点[：:][ \t]*(.*)$/;

/**
 * 分隔符：`---`（Markdown 水平线），节点间分隔。
 * 匹配以 `---` 开头的行（允许行首空白）。
 */
const SEPARATOR_RE = /^[ \t]*---[ \t]*$/;

// ============================================================================
// 常量
// ============================================================================

/** 匿名章节 ID */
const ANONYMOUS_CHAPTER_ID = '_anonymous';

/** 默认元信息字段 */
const DEFAULT_TITLE = 'Untitled';
const DEFAULT_AUTHOR = 'Unknown';

// ============================================================================
// 内部 — 章节构建器
// ============================================================================

/**
 * 章节构建临时结构。
 * 解析过程中逐步累积节点，结束后转换为 Chapter。
 */
interface ChapterBuilder {
  id: string;
  title: string;
  isAnonymous: boolean;
  lineNumber: number;
  nodes: StoryNode[];
}

// ============================================================================
// 公共 API — parseStory
// ============================================================================

/**
 * 解析 .mdstory 原始文本为 PlotFlowData 中间表示。
 *
 * 完整解析管道：
 * 1. 解析 YAML Frontmatter（变量声明 + 元信息）
 * 2. 定位 Frontmatter 结束位置
 * 3. 对剩余文本逐行解析章节与节点
 * 4. 对每个节点的 body 调用 parseOptions → parseCondition + parseEffects
 * 5. 累积所有阶段的诊断信息
 * 6. 组装 PlotFlowData
 *
 * @param raw - .mdstory 文件原始 UTF-8 文本
 * @returns ParseResult\<PlotFlowData\>
 *   - ok: true 时携带完整的 AST，diagnostics 携带 warning/info 级别诊断
 *   - ok: false 时携带所有错误诊断
 *
 * @remarks
 * - 解析不中断：一个节点/选项解析失败不影响后续节点
 * - Frontmatter 解析失败仍会尝试解析章节（使用空变量列表）
 * - 所有错误通过 ParseResult 返回，不抛异常
 * - 空文件 → ok，返回空 PlotFlowData
 * - 纯 Frontmatter 无节点 → ok
 * - 节点无选项 → ok（死胡同节点）
 */
export function parseStory(raw: string): ParseResult<PlotFlowData> {
  resetErrorSeq();

  // Strip UTF-8 BOM if present (U+FEFF at file start breaks /^---/ regex)
  if (raw.length > 0 && raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
  }

  // 步骤 1：解析 Frontmatter
  const fmResult = parseFrontmatter(raw);

  // 步骤 2：收集 Frontmatter 诊断
  const allDiagnostics: Diagnostic[] = [];
  let variables: VariableDeclaration[] = [];
  let fmMeta: FrontmatterResult;

  if (fmResult.ok) {
    fmMeta = fmResult.data;
    variables = fmMeta.variables;
    allDiagnostics.push(...fmResult.diagnostics);
  } else {
    // Frontmatter 解析失败时使用默认空值，不中断解析
    allDiagnostics.push(...fmResult.errors);
    fmMeta = { variables: [] };
  }

  // 步骤 3：定位 Frontmatter 结束位置
  const fmEndMatch = raw.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*/);
  const fmEndIndex = fmEndMatch ? (fmEndMatch.index ?? 0) + fmEndMatch[0].length : 0;

  // 计算章节/节点区域的起始行号（1-based）
  const fmLineCount = fmEndIndex > 0
    ? raw.slice(0, fmEndIndex).split(/\r?\n|\r/).length
    : 1;
  const bodyStartLine = fmEndIndex > 0 ? fmLineCount : 1;

  // 步骤 4：解析章节与节点（传入变量列表用于选项/条件/效果解析）
  const afterFm = raw.slice(fmEndIndex);
  const lines = afterFm.split(/\r?\n|\r/);
  const cnResult = parseChaptersAndNodes(lines, bodyStartLine, variables);

  // 步骤 5：收集章节/节点解析诊断
  if (cnResult.ok) {
    allDiagnostics.push(...cnResult.diagnostics);
  } else {
    allDiagnostics.push(...cnResult.errors);
  }

  // 步骤 6：组装 PlotFlowData（始终返回 AST，错误通过 diagnostics 传递）
  // V02-033: 删除 hasErrors → failure 的全有或全无策略。
  // 解析器内部遵循"解析不中断"原则——一个节点/选项的错误不影响其他节点。
  // 错误级诊断由编辑器波浪线 + 分支图横幅 + 状态栏消息共同呈现。
  const meta: StoryMeta = {
    plotflow: '0.1',
    title: fmMeta.title ?? DEFAULT_TITLE,
    author: fmMeta.author ?? DEFAULT_AUTHOR,
    engine: fmMeta.engine as EngineTarget | undefined,
  };

  const chapters = cnResult.ok ? cnResult.data.chapters : [];

  return success(
    {
      sourcePath: null,
      meta,
      variables: fmMeta.variables,
      chapters,
    },
    allDiagnostics,
  );
}

// ============================================================================
// 公共 API — parseChaptersAndNodes
// ============================================================================

/**
 * 从行列表中解析章节与节点。
 *
 * 解析策略（递归下降子集）：
 * - 识别 `# XXX` → 创建 Chapter（isAnonymous = false）
 * - 识别 `## 节点：XXX` → 创建 StoryNode
 * - 无显式 `#` 章节的节点 → 归入匿名章节（id = "_anonymous"）
 * - 提取节点正文 body（节点标题之后到下一个 `##` 或 `#` 或文件尾之间的文本）
 * - 对每个节点的 body 调用 parseOptions 解析选项（含条件/效果）
 * - fullId 格式：`章节ID-节点ID`（匿名章节：`节点ID`）
 * - E007：fullId 重名检测
 * - I003：匿名章节归属检测
 * - W005：空正文检测
 *
 * @param lines - 源文件行列表（不含 Frontmatter 部分）
 * @param startLine - lines[0] 在源文件中的绝对行号（1-based）
 * @param variables - Frontmatter 中声明的变量列表（传递给 parseOptions 用于条件/效果类型检查）
 * @returns ParseResult\<{ chapters: Chapter[]; nodes: StoryNode[] }\>
 *   - ok: true 携带解析结果，diagnostics 携带 warning/info 级别诊断
 *   - ok: false 携带错误诊断
 */
export function parseChaptersAndNodes(
  lines: string[],
  startLine: number,
  variables: readonly VariableDeclaration[],
): ParseResult<{ chapters: Chapter[]; nodes: StoryNode[] }> {
  resetErrorSeq();
  const allErrors: Diagnostic[] = [];

  // ------------------------------------------------------------------
  // 状态变量
  // ------------------------------------------------------------------

  /** 章节构建器集合（key = 章节 ID） */
  const chapterBuilders = new Map<string, ChapterBuilder>();

  /** fullId → lineNumber 映射（用于 E007 重名检测） */
  const seenFullIds = new Map<string, number>();

  /** 是否正在节点内部收集正文 */
  let inNode = false;

  /** 当前节点 ID（不含章节前缀） */
  let currentNodeId = '';

  /** 当前节点标题 */
  let currentNodeTitle = '';

  /** 当前节点标题行号（1-based） */
  let currentNodeLineNumber = 0;

  /** 当前节点正文行累积 */
  let currentNodeBodyLines: string[] = [];

  /** 当前章节 ID（null 表示尚无章节） */
  let currentChapterId: string | null = null;

  // ------------------------------------------------------------------
  // 辅助：确保章节构建器存在
  // ------------------------------------------------------------------

  function ensureChapter(
    id: string,
    title: string,
    isAnonymous: boolean,
    lineNumber: number,
  ): ChapterBuilder {
    if (!chapterBuilders.has(id)) {
      chapterBuilders.set(id, {
        id,
        title,
        isAnonymous,
        lineNumber,
        nodes: [],
      });
    }
    return chapterBuilders.get(id)!;
  }

  // ------------------------------------------------------------------
  // 辅助：终结当前节点（将累积状态转换为 StoryNode）
  // ------------------------------------------------------------------

  function finalizeNode(): void {
    if (!inNode) return;

    // 确定所属章节
    let chapterId: string;
    let chapterIsAnonymous: boolean;
    if (currentChapterId !== null) {
      chapterId = currentChapterId;
      const builder = chapterBuilders.get(chapterId);
      chapterIsAnonymous = builder?.isAnonymous ?? false;
    } else {
      // 无章节归属 → 匿名章节
      chapterId = ANONYMOUS_CHAPTER_ID;
      chapterIsAnonymous = true;
    }

    // 生成 fullId
    const fullId = chapterIsAnonymous
      ? currentNodeId
      : `${chapterId}-${currentNodeId}`;

    // 确保章节构建器存在
    const builder = ensureChapter(
      chapterId,
      chapterIsAnonymous ? '' : (currentChapterId ?? ''),
      chapterIsAnonymous,
      chapterIsAnonymous ? -1 : 0, // 匿名章节无具体行号
    );

    // E007: 检测 fullId 重名
    const diagnosticIds: string[] = [];
    const existingLine = seenFullIds.get(fullId);
    if (existingLine !== undefined) {
      const diag = createDiagnostic(
        'E007',
        'error',
        currentNodeLineNumber,
        1,
        1,
        `节点 ID "${fullId}" 重复（首次声明在第 ${existingLine} 行）`,
      );
      allErrors.push(diag);
      diagnosticIds.push(diag.id);
    }
    seenFullIds.set(fullId, currentNodeLineNumber);

    // 组装正文
    const body = currentNodeBodyLines
      .map((l) => l.trimEnd())
      .join('\n')
      .trim();

    // ---- 解析选项 (M1-03/04/05 集成) ----
    let nodeOptions: Option[] = [];
    const bodyStartLine = currentNodeLineNumber + 1;
    const optResult = parseOptions(body, bodyStartLine, variables);
    if (optResult.ok) {
      nodeOptions = optResult.data;
      // 非致命诊断（warnings/infos）累积到 allErrors
      allErrors.push(...optResult.diagnostics);
    } else {
      // 选项解析致命错误累积，但不阻止当前节点生成（解析不中断原则）
      allErrors.push(...optResult.errors);
    }

    // W005: 空正文检测
    // 计算纯叙事正文（过滤语法标记行，BUG6 修复）
    const narrativeBodyLines = currentNodeBodyLines.filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('[选项]') && !t.startsWith('条件:') && !t.startsWith('效果:');
    });
    const narrativeBody = narrativeBodyLines
      .map((l) => l.trimEnd())
      .join('\n')
      .trim();

    if (body.length === 0) {
      const diag = createDiagnostic(
        'W005',
        'warning',
        currentNodeLineNumber,
        1,
        1,
        `节点 "${currentNodeTitle}" 正文描述为空`,
      );
      allErrors.push(diag);
      diagnosticIds.push(diag.id);
    }

    // I003: 匿名章节归属
    if (chapterIsAnonymous) {
      const diag = createDiagnostic(
        'I003',
        'info',
        currentNodeLineNumber,
        1,
        1,
        `节点 "${currentNodeTitle}" 未归属于任何章节`,
      );
      allErrors.push(diag);
      diagnosticIds.push(diag.id);
    }

    const diagnostics: NodeDiagnostics = {
      isRoot: false,     // M3 填充
      isOrphan: false,   // M3 填充
      isDeadEnd: false,  // M3 填充
      diagnosticIds,
    };

    const node: StoryNode = {
      id: currentNodeId,
      fullId,
      title: currentNodeTitle,
      body: narrativeBody,
      chapterId,
      options: nodeOptions,
      diagnostics,
      lineNumber: currentNodeLineNumber,
    };

    // 添加到章节构建器
    builder.nodes.push(node);

    // 重置节点状态
    inNode = false;
    currentNodeId = '';
    currentNodeTitle = '';
    currentNodeBodyLines = [];
    currentNodeLineNumber = 0;
  }

  // ------------------------------------------------------------------
  // 主循环：逐行扫描
  // ------------------------------------------------------------------

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const absoluteLine = startLine + i;
    const trimmed = line.trimStart();

    // --- 检测章节标题：`# XXX`（但不匹配 `##`） ---
    if (
      trimmed.startsWith('#') &&
      !trimmed.startsWith('##') &&
      CHAPTER_HEADING_RE.test(trimmed)
    ) {
      const match = CHAPTER_HEADING_RE.exec(trimmed)!;
      const chapterTitle = match[1]!.trim();

      // 章节标题不能为空
      if (chapterTitle.length === 0) {
        const diag = createDiagnostic(
          'E005',
          'error',
          absoluteLine,
          1,
          trimmed.length,
          '章节标题不能为空',
        );
        allErrors.push(diag);
        continue;
      }

      // 章节标题长度限制：256 个 Unicode 码点
      if ([...chapterTitle].length > 256) {
        const diag = createDiagnostic(
          'W006',
          'warning',
          absoluteLine,
          1,
          trimmed.length,
          `章节标题过长（${[...chapterTitle].length} > 256 个 Unicode 码点），将被截断`,
        );
        allErrors.push(diag);
      }

      // 终结当前节点
      finalizeNode();

      // 创建/切换到新章节
      const chapterId = chapterTitle;
      currentChapterId = chapterId;

      ensureChapter(chapterId, chapterTitle, false, absoluteLine);

      continue;
    }

    // --- 检测畸形的 # 行（非 ##，但不匹配章节标题正则）---
    if (
      trimmed.startsWith('#') &&
      !trimmed.startsWith('##') &&
      !CHAPTER_HEADING_RE.test(trimmed)
    ) {
      const diag = createDiagnostic(
        'E005',
        'error',
        absoluteLine,
        1,
        trimmed.length,
        `章节标题格式错误: "${trimmed}"，应为 "# 章节标题"`,
      );
      allErrors.push(diag);
      continue;
    }

    // --- 检测节点标题：`## 节点：XXX` 或 `## 节点:XXX` ---
    if (trimmed.startsWith('##') && NODE_HEADING_RE.test(trimmed)) {
      const match = NODE_HEADING_RE.exec(trimmed)!;
      let nodeTitle = match[1]!.trim();

      // 节点标题不能为空
      if (nodeTitle.length === 0) {
        const diag = createDiagnostic(
          'E005',
          'error',
          absoluteLine,
          1,
          trimmed.length,
          '节点标题不能为空',
        );
        allErrors.push(diag);
        // 终结当前节点（如果有），但不创建新节点
        finalizeNode();
        continue;
      }

      // 节点名长度限制：128 个 Unicode 码点
      if ([...nodeTitle].length > 128) {
        const diag = createDiagnostic(
          'E005',
          'error',
          absoluteLine,
          1,
          trimmed.length,
          `节点名过长（${[...nodeTitle].length} > 128 个 Unicode 码点）`,
        );
        allErrors.push(diag);
        finalizeNode();
        continue;
      }

      // 节点名不得包含禁止字符：`/` 和 `\`
      if (nodeTitle.includes('/') || nodeTitle.includes('\\')) {
        const diag = createDiagnostic(
          'E005',
          'error',
          absoluteLine,
          1,
          trimmed.length,
          `节点名包含禁止字符 "/" 或 "\\": "${nodeTitle}"`,
        );
        allErrors.push(diag);
        // 仍继续解析，但替换禁止字符为下划线
        nodeTitle = nodeTitle.replace(/[/\\]/g, '_');
      }

      // 终结当前节点
      finalizeNode();

      // 开始新节点
      currentNodeId = nodeTitle;
      currentNodeTitle = nodeTitle;
      currentNodeLineNumber = absoluteLine;
      currentNodeBodyLines = [];
      inNode = true;

      continue;
    }

    // --- 在节点内部：收集正文行 ---
    if (inNode) {
      // 检查是否遇到节点间分隔符 `---`
      // 分隔符定义：独占一行的 `---`（允许行首/行尾空白）
      if (SEPARATOR_RE.test(line)) {
        // 向前探测：后续行是否为新节点或新章节
        // 如果是，则当前 --- 是分隔符，不是正文
        let nextContentLine = -1;
        for (let j = i + 1; j < lines.length; j++) {
          const nl = lines[j]!;
          const nt = nl.trimStart();
          if (nt === '') continue; // 跳过空行
          // 检查是否为空注释（HTML注释）
          if (nt.startsWith('<!--')) continue;
          nextContentLine = j;
          break;
        }

        if (nextContentLine >= 0) {
          const nextTrimmed = lines[nextContentLine]!.trimStart();
          // 如果下一非空行是节点或章节标题，当前 --- 是分隔符
          if (
            (nextTrimmed.startsWith('##') && NODE_HEADING_RE.test(nextTrimmed)) ||
            (nextTrimmed.startsWith('#') && !nextTrimmed.startsWith('##') && CHAPTER_HEADING_RE.test(nextTrimmed))
          ) {
            // 这是分隔符，不加入正文
            // 而且终结当前节点的正文收集（但不终结节点本身——finalizeNode 在检测到新节点时调用）
            continue;
          }
        }

        // 不是分隔符，当作正文中的水平线
        currentNodeBodyLines.push(line);
        continue;
      }

      // 普通正文行
      currentNodeBodyLines.push(line);
    }
    // else: 不在节点内，也不是标题 → 忽略（前导空白行/注释等）
  }

  // 终结最后一个节点
  finalizeNode();

  // ------------------------------------------------------------------
  // 组装结果：从 ChapterBuilder → Chapter[]
  // ------------------------------------------------------------------

  const chapters: Chapter[] = [];

  // 先处理匿名章节（如果有节点）
  const anonBuilder = chapterBuilders.get(ANONYMOUS_CHAPTER_ID);
  if (anonBuilder && anonBuilder.nodes.length > 0) {
    chapters.push({
      id: ANONYMOUS_CHAPTER_ID,
      title: '',
      isAnonymous: true,
      nodes: anonBuilder.nodes,
      lineNumber: -1,
    });
  }

  // 处理命名章节（按首次出现顺序排列）
  for (const [id, builder] of chapterBuilders) {
    if (id === ANONYMOUS_CHAPTER_ID) continue;
    chapters.push({
      id: builder.id,
      title: builder.title,
      isAnonymous: false,
      nodes: builder.nodes,
      lineNumber: builder.lineNumber,
    });
  }

  // 收集所有节点（扁平列表）
  const nodes: StoryNode[] = [];
  for (const builder of chapterBuilders.values()) {
    nodes.push(...builder.nodes);
  }

  // 回填 targetFullId（M2: 跨章节引用解析）
  resolveTargetFullIds(chapterBuilders);

  // V02-033: 始终返回 success 含部分解析结果。
  // 错误通过 diagnostics（severity === 'error'）传递给上游。
  // 单个选项/节点的 E005 等错误不影响其他节点的正常解析。
  return success({ chapters, nodes }, allErrors);
}

// ============================================================================
// targetFullId 解析
// ============================================================================

/**
 * 为所有选项回填 targetFullId。
 *
 * 算法：
 * 1. 收集所有节点的 fullId → StoryNode 映射，以及 nodeId → fullId[] 映射
 * 2. 遍历所有选项，对 targetFullId === null 且 targetNodeId 存在的选项：
 *    a. 优先在同章节查找 `${chapterId}-${targetNodeId}`
 *    b. 若未找到，在全局按 node.id === targetNodeId 查找（仅当唯一匹配时）
 *    c. 找到则回填 targetFullId；否则保持 null（验证器报告 E001）
 */
function resolveTargetFullIds(chapterBuilders: Map<string, ChapterBuilder>): void {
  const allNodes = new Map<string, StoryNode>();
  const nodeIdToFullIds = new Map<string, string[]>();

  for (const builder of chapterBuilders.values()) {
    for (const node of builder.nodes) {
      allNodes.set(node.fullId, node);
      const list = nodeIdToFullIds.get(node.id) ?? [];
      list.push(node.fullId);
      nodeIdToFullIds.set(node.id, list);
    }
  }

  for (const builder of chapterBuilders.values()) {
    for (const node of builder.nodes) {
      for (const option of node.options) {
        if (option.targetFullId !== null) continue;
        if (!option.targetNodeId) continue;

        // 优先：同章节查找
        const sameChapterFullId = `${node.chapterId}-${option.targetNodeId}`;
        if (allNodes.has(sameChapterFullId)) {
          (option as { targetFullId: string | null }).targetFullId = sameChapterFullId;
          continue;
        }

        // 跨章节：仅当节点 ID 全局唯一时匹配
        const matches = nodeIdToFullIds.get(option.targetNodeId);
        if (matches && matches.length === 1) {
          (option as { targetFullId: string | null }).targetFullId = matches[0]!;
        }
        // 否则 targetFullId 保持 null —— 验证器会报告 E001 (未定义目标节点)
      }
    }
  }
}
