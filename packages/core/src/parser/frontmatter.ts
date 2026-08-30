/**
 * YAML Frontmatter 解析器
 *
 * @packageDocumentation
 * @remarks
 * 从 .mdstory 原始文本中提取并解析 --- ... --- YAML Frontmatter 块。
 * 验证变量声明的类型、枚举值、嵌套深度、重复检测。
 *
 * 所有错误通过 ParseResult 模式返回，不抛异常。
 *
 * 对应规范：
 * - spec/syntax-formal.md §2 (YAML Frontmatter)
 * - spec/syntax-formal.md §2.4 (嵌套规则)
 * - spec/syntax-formal.md §2.5 (变量名规则)
 *
 * @version 0.1.0
 */

import * as yaml from 'js-yaml';
import type { ParseResult } from '../result.js';
import { success, failure } from '../result.js';
import type {
  StoryLayout,
  VariableDeclaration,
  VariableType,
  VariableValue,
} from '../types/ast.js';
import type { Diagnostic, ErrorCode, SourceRange } from '../types/diagnostic.js';
import { createDiagnosticLocalization, DIAGNOSTIC_MESSAGES } from '../types/diagnostic.js';
import { analyzeStorySource } from './source.js';

// ============================================================================
// FrontmatterResult 接口
// ============================================================================

/**
 * YAML Frontmatter 解析结果。
 *
 * @remarks
 * variables 数组包含所有在 Frontmatter 中声明的变量。
 * title / author / engine / plotflow 为可选的元信息字段。
 */
export interface FrontmatterResult {
  /** 变量声明列表 */
  readonly variables: VariableDeclaration[];
  /** 故事标题 */
  readonly title?: string;
  /** 作者 */
  readonly author?: string;
  /** 目标引擎 */
  readonly engine?: string;
  /** PlotFlow 格式版本 */
  readonly plotflow?: string;
  /** Graph Lab 布局数据 */
  readonly layout?: StoryLayout;
}

// ============================================================================
// 常量
// ============================================================================

/**
 * 保留字集合。
 * 这些词不可用作变量名。
 * 对应 syntax-formal.md §2.5。
 */
const RESERVED_WORDS = new Set([
  'int',
  'float',
  'bool',
  'string',
  'enum',
  'object',
  'true',
  'false',
  'AND',
  'OR',
  'NOT',
  'none',
  'plotflow',
  'title',
  'author',
  'engine',
  'layout',
  'vars',
]);

/**
 * 变量名验证正则。
 * 必须以 Unicode 字母开头，可包含字母、数字、下划线。
 * 长度：1-64 个 Unicode 码点。
 */
const VAR_NAME_RE = /^[\p{L}][\p{L}\p{N}_]{0,63}$/u;

/**
 * 基本类型集合（不需要额外解析的单值类型）。
 */
const PRIMITIVE_TYPES = new Set<string>(['int', 'float', 'bool', 'string']);

/**
 * 最大对象嵌套深度。
 * 以最外层 object 为第 1 层计数。
 */
const MAX_OBJECT_DEPTH = 3;

/**
 * Frontmatter 的 UTF-8 字节上限。
 * 对应 syntax-formal.md §8.8 的 64 KB 资源边界，并在进入 YAML 解析器前执行。
 */
const MAX_FRONTMATTER_BYTES = 64 * 1024;

/**
 * 枚举类型语法匹配：enum[v1, v2, ...]
 * 支持英文逗号和中文逗号分隔。
 */
const ENUM_REGEX = /^enum\[(.*)\]$/;

/**
 * 对象类型开始标记。
 */
const OBJECT_START_MARKER = 'object{';

/**
 * 默认值映射表。
 * 当变量声明无显式默认值时，由此表生成。
 */
const TYPE_DEFAULTS: Readonly<Record<VariableType, VariableValue>> = {
  int: 0,
  float: 0.0,
  bool: false,
  string: '',
  enum: '', // 将被第一个枚举值替换
  object: {}, // 将被子字段默认值替换
};

// ============================================================================
// 诊断创建辅助
// ============================================================================

/** 错误计数器（用于生成唯一 ID） */
let errorSeq = 0;

/** 重置错误计数器（每次 parseFrontmatter 调用时重置） */
function resetErrorSeq(): void {
  errorSeq = 0;
}

/**
 * 创建诊断错误对象。
 *
 * @param code - 错误代码
 * @param line - 绝对行号（1-based，相对于源文件）
 * @param startColumn - 起始列号（1-based）
 * @param endColumn - 结束列号（1-based）
 * @param message - 错误消息（可选，默认使用 DIAGNOSTIC_MESSAGES）
 * @param detail - 详细信息（可选）
 */
function createDiagnostic(
  code: ErrorCode,
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
    severity: 'error',
    message: message ?? DIAGNOSTIC_MESSAGES[code],
    ...createDiagnosticLocalization(code),
    detail,
    range,
  };
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 解析 .mdstory 原始文本的 YAML Frontmatter 块。
 *
 * @param raw - .mdstory 文件原始 UTF-8 文本
 * @returns ParseResult\<FrontmatterResult\>
 *   - ok: true 时携带解析后的变量列表和元信息
 *   - ok: false 时携带所有诊断错误
 *
 * @remarks
 * - 无 --- 块时返回空 variables 数组（不报错）
 * - 换行符兼容 CRLF 和 LF
 * - 特殊字符（Unicode/emoji/中英混排）不崩溃
 *
 * @example
 * ```typescript
 * const result = parseFrontmatter(rawMdstory);
 * if (result.ok) {
 *   for (const v of result.data.variables) {
 *     console.log(v.name, v.type, v.defaultValue);
 *   }
 * }
 * ```
 */
export function parseFrontmatter(raw: string): ParseResult<FrontmatterResult> {
  const recovered = parseFrontmatterWithDiagnostics(raw);
  if (recovered.diagnostics.length > 0) {
    return failure(recovered.diagnostics);
  }
  return success(recovered.data);
}

/**
 * Parser-internal recovery entry point. It preserves every valid declaration
 * while returning diagnostics separately, so the story parser can keep a
 * partial AST without changing parseFrontmatter's public Result contract.
 */
export function parseFrontmatterWithDiagnostics(raw: string): {
  readonly data: FrontmatterResult;
  readonly diagnostics: readonly Diagnostic[];
} {
  resetErrorSeq();
  const errors: Diagnostic[] = [];

  // 步骤 1：提取 Frontmatter 块
  const source = analyzeStorySource(raw);
  if (!source.frontmatter) {
    return { data: { variables: [] }, diagnostics: [] };
  }

  const fmContent = source.frontmatter.content;
  const fmContentStartLine = source.frontmatter.contentStartLine;

  if (new TextEncoder().encode(fmContent).byteLength > MAX_FRONTMATTER_BYTES) {
    return {
      data: { variables: [] },
      diagnostics: [
        createDiagnostic(
          'E005',
          fmContentStartLine,
          1,
          1,
          'Frontmatter 超过 64 KB 上限',
          '请精简 Frontmatter 后重试。故事正文不计入此限制。',
        ),
      ],
    };
  }

  // 步骤 2：分割 Frontmatter 内容为行
  const allFmLines = fmContent.split(/\r?\n|\r/);

  // 步骤 3：找到 vars: 行来分割元信息和变量声明
  const varsLineIndex = findVarsLineIndex(allFmLines);

  // 步骤 4：解析元信息（vars: 之前的行）
  const metaLines = varsLineIndex >= 0 ? allFmLines.slice(0, varsLineIndex) : allFmLines;

  const meta = parseMetaSection(metaLines, fmContentStartLine, errors);

  // 步骤 5：解析变量声明（vars: 之后的行）
  let variables: VariableDeclaration[] = [];
  if (varsLineIndex >= 0) {
    const varsLines = allFmLines.slice(varsLineIndex + 1);
    variables = parseVarsSection(varsLines, fmContentStartLine + varsLineIndex + 1, errors);
  }

  return {
    data: {
      variables,
      title: meta.title,
      author: meta.author,
      engine: meta.engine,
      plotflow: meta.plotflow,
      layout: meta.layout,
    },
    diagnostics: errors,
  };
}

// ============================================================================
// 辅助：找到 vars: 行
// ============================================================================

/**
 * 在 Frontmatter 行列表中查找 `vars:` 行的索引。
 *
 * @returns 索引（0-based），未找到返回 -1
 */
function findVarsLineIndex(lines: readonly string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trimStart();
    // 忽略纯注释行
    if (trimmed.startsWith('#')) continue;
    // 匹配 `vars:`（YAML 键，后面可跟冒号结束、空格或注释）
    if (/^vars:[ \t]*(#.*)?$/.test(trimmed)) {
      return i;
    }
  }
  return -1;
}

// ============================================================================
// 元信息解析（通过 js-yaml）
// ============================================================================

interface MetaFields {
  title?: string;
  author?: string;
  engine?: string;
  plotflow?: string;
  layout?: StoryLayout;
}

const ENGINE_TARGETS = new Set(['generic', 'godot', 'unity', 'unreal']);

/**
 * 使用 js-yaml 解析元信息字段。
 */
function parseMetaSection(
  lines: readonly string[],
  absoluteStartLine: number,
  errors: Diagnostic[],
): MetaFields {
  if (lines.length === 0 || lines.every((l) => l.trim() === '' || l.trimStart().startsWith('#'))) {
    return {};
  }

  const yamlText = lines.join('\n');
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlText);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(
      createDiagnostic(
        'E005',
        absoluteStartLine,
        1,
        1,
        `Frontmatter YAML 语法错误: ${message}`,
        message,
      ),
    );
    return {};
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const obj = parsed as Record<string, unknown>;
  const meta: MetaFields = {};

  if (typeof obj['title'] === 'string') meta.title = obj['title'];
  if (typeof obj['author'] === 'string') meta.author = obj['author'];
  if (typeof obj['engine'] === 'string') {
    if (ENGINE_TARGETS.has(obj['engine'])) {
      meta.engine = obj['engine'];
    } else {
      errors.push(
        createDiagnostic(
          'E005',
          absoluteStartLine,
          1,
          1,
          `engine "${obj['engine']}" 无效；仅支持 generic、godot、unity、unreal`,
        ),
      );
    }
  }
  if (typeof obj['plotflow'] === 'string' || typeof obj['plotflow'] === 'number') {
    meta.plotflow = String(obj['plotflow']);
  }
  meta.layout = parseStoryLayout(obj['layout']);

  return meta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseStoryLayout(value: unknown): StoryLayout | undefined {
  if (!isRecord(value)) return undefined;
  const graph = value['graph'];
  if (!isRecord(graph)) return undefined;

  const versionValue = graph['version'];
  const version =
    typeof versionValue === 'number'
      ? versionValue
      : typeof versionValue === 'string'
        ? Number(versionValue)
        : undefined;
  if (version !== 1) return undefined;

  const rawNodes = graph['nodes'];
  if (!Array.isArray(rawNodes)) {
    return { graph: { version: 1, nodes: [] } };
  }

  const nodes = rawNodes.flatMap((raw): StoryLayout['graph']['nodes'][number][] => {
    if (!isRecord(raw) || typeof raw['id'] !== 'string') return [];
    const x = parseFiniteNumber(raw['x']);
    const y = parseFiniteNumber(raw['y']);
    if (x === null || y === null) return [];
    return [{ id: raw['id'], x, y }];
  });

  return { graph: { version: 1, nodes } };
}

// ============================================================================
// 结构化 YAML 变量声明
// ============================================================================

const STRUCTURED_VARIABLE_KEYS = new Set([
  'type',
  'default',
  'scope',
  'chapter',
  'description',
  'values',
  'fields',
]);

const HAS_OWN = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function findStructuredVariableEnd(
  lines: readonly string[],
  startIndex: number,
  parentIndent: number,
): number {
  let i = startIndex + 1;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i++;
      continue;
    }
    const indent = line.match(/^([ \t]*)/)?.[1]?.length ?? 0;
    if (indent <= parentIndent) break;
    i++;
  }
  return i;
}

function parseStructuredYamlValue(
  lines: readonly string[],
  startIndex: number,
  endIndex: number,
  parentIndent: number,
  variableName: string,
  absoluteLine: number,
  errors: Diagnostic[],
): unknown {
  const yamlText = lines
    .slice(startIndex, endIndex)
    .map((line) => line.slice(Math.min(parentIndent, line.length)))
    .join('\n');

  try {
    const parsed = yaml.load(yamlText);
    if (!isRecord(parsed) || !HAS_OWN(parsed, variableName)) {
      errors.push(
        createDiagnostic(
          'E005',
          absoluteLine,
          1,
          1 + variableName.length,
          `变量 "${variableName}" 的结构化 YAML 声明无效`,
        ),
      );
      return undefined;
    }
    return parsed[variableName];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(
      createDiagnostic(
        'E005',
        absoluteLine,
        1,
        1 + variableName.length,
        `变量 "${variableName}" 的 YAML 语法错误: ${message}`,
        message,
      ),
    );
    return undefined;
  }
}

function createStructuredDiagnostic(
  errors: Diagnostic[],
  code: ErrorCode,
  line: number,
  name: string,
  message: string,
): void {
  errors.push(createDiagnostic(code, line, 1, 1 + name.length, message));
}

function parseStructuredPrimitiveDefault(
  type: VariableType,
  rawDefault: unknown,
  name: string,
  absoluteLine: number,
  errors: Diagnostic[],
): VariableValue | undefined {
  let valid = false;
  switch (type) {
    case 'int':
      valid =
        typeof rawDefault === 'number' &&
        Number.isInteger(rawDefault) &&
        rawDefault >= -2147483648 &&
        rawDefault <= 2147483647;
      break;
    case 'float':
      valid = typeof rawDefault === 'number' && Number.isFinite(rawDefault);
      break;
    case 'bool':
      valid = typeof rawDefault === 'boolean';
      break;
    case 'string':
      valid = typeof rawDefault === 'string';
      break;
    default:
      break;
  }

  if (!valid) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `变量 "${name}" 的 default 与 ${type} 类型不匹配`,
    );
    return undefined;
  }
  return rawDefault as VariableValue;
}

function resolveStructuredDefault(
  declaration: VariableDeclaration,
  rawDefault: unknown,
  absoluteLine: number,
  errors: Diagnostic[],
): VariableValue | undefined {
  if (declaration.type === 'enum') {
    if (typeof rawDefault !== 'string' || !declaration.enumValues?.includes(rawDefault)) {
      createStructuredDiagnostic(
        errors,
        'E003',
        absoluteLine,
        declaration.name,
        `变量 "${declaration.name}" 的 default 必须是 values 中的一个值`,
      );
      return undefined;
    }
    return rawDefault;
  }

  if (declaration.type !== 'object') {
    return parseStructuredPrimitiveDefault(
      declaration.type,
      rawDefault,
      declaration.name,
      absoluteLine,
      errors,
    );
  }

  if (!isRecord(rawDefault)) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      declaration.name,
      `对象变量 "${declaration.name}" 的 default 必须是 YAML 映射`,
    );
    return undefined;
  }

  const fields = declaration.fields ?? [];
  const fieldNames = new Set(fields.map((field) => field.name));
  const unknownField = Object.keys(rawDefault).find((key) => !fieldNames.has(key));
  if (unknownField) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      declaration.name,
      `对象变量 "${declaration.name}" 的 default 包含未声明字段 "${unknownField}"`,
    );
    return undefined;
  }

  const resolved: Record<string, unknown> = {};
  for (const field of fields) {
    if (!HAS_OWN(rawDefault, field.name)) {
      resolved[field.name] = field.defaultValue;
      continue;
    }
    const fieldDefault = resolveStructuredDefault(
      field,
      rawDefault[field.name],
      absoluteLine,
      errors,
    );
    if (fieldDefault === undefined) return undefined;
    resolved[field.name] = fieldDefault;
  }
  return resolved;
}

function parseStructuredVariable(
  name: string,
  rawDeclaration: unknown,
  absoluteLine: number,
  depth: number,
  errors: Diagnostic[],
): VariableDeclaration | null {
  // fields 内仍可使用现有 shorthand，便于渐进迁移。
  if (typeof rawDeclaration === 'string') {
    if (PRIMITIVE_TYPES.has(rawDeclaration)) {
      const type = rawDeclaration as VariableType;
      return { name, type, defaultValue: TYPE_DEFAULTS[type], lineNumber: absoluteLine };
    }
    if (ENUM_REGEX.test(rawDeclaration)) {
      return parseEnumType(rawDeclaration, name, absoluteLine, errors);
    }
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `无法识别的字段类型: "${rawDeclaration}"`,
    );
    return null;
  }

  if (!isRecord(rawDeclaration)) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `变量 "${name}" 的结构化声明必须是 YAML 映射`,
    );
    return null;
  }

  const unknownKey = Object.keys(rawDeclaration).find((key) => !STRUCTURED_VARIABLE_KEYS.has(key));
  if (unknownKey) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `变量 "${name}" 包含未知属性 "${unknownKey}"`,
    );
    return null;
  }

  const rawType = rawDeclaration['type'];
  if (
    typeof rawType !== 'string' ||
    (!PRIMITIVE_TYPES.has(rawType) && rawType !== 'enum' && rawType !== 'object')
  ) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `变量 "${name}" 缺少合法 type；支持 int、float、bool、string、enum、object`,
    );
    return null;
  }
  const type = rawType as VariableType;

  const rawScope = rawDeclaration['scope'];
  if (rawScope !== undefined && rawScope !== 'global' && rawScope !== 'chapter') {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `变量 "${name}" 的 scope 只能是 global 或 chapter`,
    );
    return null;
  }

  const rawChapter = rawDeclaration['chapter'];
  if (
    rawChapter !== undefined &&
    (typeof rawChapter !== 'string' || rawChapter.trim().length === 0)
  ) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `变量 "${name}" 的 chapter 必须是非空字符串`,
    );
    return null;
  }
  if (depth > 1 && (rawScope !== undefined || rawChapter !== undefined)) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `嵌套字段 "${name}" 继承顶层变量作用域，不能声明 scope 或 chapter`,
    );
    return null;
  }
  if (rawScope === 'chapter' && rawChapter === undefined) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `chapter scope 变量 "${name}" 必须声明 chapter`,
    );
    return null;
  }
  if (rawScope !== 'chapter' && rawChapter !== undefined) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `只有 scope: chapter 的变量 "${name}" 可以声明 chapter`,
    );
    return null;
  }

  const rawDescription = rawDeclaration['description'];
  if (rawDescription !== undefined && typeof rawDescription !== 'string') {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `变量 "${name}" 的 description 必须是字符串`,
    );
    return null;
  }

  if (type === 'enum') {
    const rawValues = rawDeclaration['values'];
    if (
      !Array.isArray(rawValues) ||
      rawValues.length === 0 ||
      rawValues.some((value) => typeof value !== 'string' || value.length === 0)
    ) {
      createStructuredDiagnostic(
        errors,
        'E003',
        absoluteLine,
        name,
        `变量 "${name}" 的 values 必须是非空字符串数组`,
      );
      return null;
    }
    const enumValues = rawValues as string[];
    if (new Set(enumValues).size !== enumValues.length) {
      createStructuredDiagnostic(
        errors,
        'E003',
        absoluteLine,
        name,
        `变量 "${name}" 的 values 包含重复项`,
      );
      return null;
    }
    if (HAS_OWN(rawDeclaration, 'fields')) {
      createStructuredDiagnostic(
        errors,
        'E005',
        absoluteLine,
        name,
        `enum 变量 "${name}" 不能声明 fields`,
      );
      return null;
    }

    const implicitDefault = enumValues[0]!;
    const base: VariableDeclaration = {
      name,
      type,
      defaultValue: implicitDefault,
      enumValues,
      ...(rawScope !== undefined ? { scope: rawScope } : {}),
      ...(typeof rawChapter === 'string' ? { chapterId: rawChapter.trim() } : {}),
      ...(rawDescription !== undefined ? { description: rawDescription } : {}),
      lineNumber: absoluteLine,
    };
    const defaultValue = HAS_OWN(rawDeclaration, 'default')
      ? resolveStructuredDefault(base, rawDeclaration['default'], absoluteLine, errors)
      : implicitDefault;
    return defaultValue === undefined ? null : { ...base, defaultValue };
  }

  if (type === 'object') {
    if (depth > MAX_OBJECT_DEPTH) {
      errors.push(
        createDiagnostic(
          'E006',
          absoluteLine,
          1,
          1 + name.length,
          DIAGNOSTIC_MESSAGES['E006'],
          `变量 "${name}" 的嵌套深度为 ${depth}，超过最大限制 ${MAX_OBJECT_DEPTH} 层`,
        ),
      );
      return null;
    }
    if (HAS_OWN(rawDeclaration, 'values')) {
      createStructuredDiagnostic(
        errors,
        'E005',
        absoluteLine,
        name,
        `object 变量 "${name}" 不能声明 values`,
      );
      return null;
    }
    const rawFields = rawDeclaration['fields'];
    if (!isRecord(rawFields)) {
      createStructuredDiagnostic(
        errors,
        'E005',
        absoluteLine,
        name,
        `对象变量 "${name}" 的 fields 必须是 YAML 映射`,
      );
      return null;
    }

    const fields: VariableDeclaration[] = [];
    const seenFields = new Map<string, number>();
    for (const [fieldName, rawField] of Object.entries(rawFields)) {
      const nameError = validateVariableName(fieldName, absoluteLine, seenFields);
      if (nameError) {
        errors.push(nameError);
        continue;
      }
      const field = parseStructuredVariable(fieldName, rawField, absoluteLine, depth + 1, errors);
      if (field) fields.push(field);
    }
    if (errors.length > 0 && fields.length !== Object.keys(rawFields).length) return null;

    const implicitDefault: Record<string, unknown> = {};
    for (const field of fields) implicitDefault[field.name] = field.defaultValue;
    const base: VariableDeclaration = {
      name,
      type,
      defaultValue: implicitDefault,
      fields,
      ...(rawScope !== undefined ? { scope: rawScope } : {}),
      ...(typeof rawChapter === 'string' ? { chapterId: rawChapter.trim() } : {}),
      ...(rawDescription !== undefined ? { description: rawDescription } : {}),
      lineNumber: absoluteLine,
    };
    const defaultValue = HAS_OWN(rawDeclaration, 'default')
      ? resolveStructuredDefault(base, rawDeclaration['default'], absoluteLine, errors)
      : implicitDefault;
    return defaultValue === undefined ? null : { ...base, defaultValue };
  }

  if (HAS_OWN(rawDeclaration, 'values') || HAS_OWN(rawDeclaration, 'fields')) {
    createStructuredDiagnostic(
      errors,
      'E005',
      absoluteLine,
      name,
      `变量 "${name}" 的 ${type} 类型不能声明 values 或 fields`,
    );
    return null;
  }

  const implicitDefault = TYPE_DEFAULTS[type];
  const defaultValue = HAS_OWN(rawDeclaration, 'default')
    ? parseStructuredPrimitiveDefault(type, rawDeclaration['default'], name, absoluteLine, errors)
    : implicitDefault;
  if (defaultValue === undefined) return null;
  return {
    name,
    type,
    defaultValue,
    ...(rawScope !== undefined ? { scope: rawScope } : {}),
    ...(typeof rawChapter === 'string' ? { chapterId: rawChapter.trim() } : {}),
    ...(rawDescription !== undefined ? { description: rawDescription } : {}),
    lineNumber: absoluteLine,
  };
}

// ============================================================================
// 变量声明区解析（手动逐行解析）
// ============================================================================

/**
 * 解析 `vars:` 之后的变量声明。
 *
 * 状态机模型：
 * - VARS: 解析顶层变量声明
 * - OBJECT_FIELDS: 解析 object{...} 内的字段声明
 *
 * @param lines - vars: 之后的行（不含 vars: 行本身）
 * @param absoluteStartLine - 第一行在源文件中的绝对行号（1-based）
 * @param errors - 累积诊断错误
 */
function parseVarsSection(
  lines: readonly string[],
  absoluteStartLine: number,
  errors: Diagnostic[],
): VariableDeclaration[] {
  const variables: VariableDeclaration[] = [];
  const seenNames = new Map<string, number>(); // name → absoluteLineNumber
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const absoluteLine = absoluteStartLine + i;

    // 跳过空行和纯注释行
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i++;
      continue;
    }

    // 检查缩进 — 变量声明必须有缩进（比 vars: 更深）
    const indent = line.match(/^([ \t]*)/)?.[1]?.length ?? 0;
    if (indent === 0) {
      // 无缩进 = 不是变量声明，可能到了 Frontmatter 结束或其他区段
      i++;
      continue;
    }

    const trimmedLine = line.trimStart();
    const structuredHeader = /^([^:：]+):[ \t]*(.*)$/.exec(trimmedLine);
    const structuredName = structuredHeader?.[1]?.trim();
    const structuredTail = structuredHeader?.[2]?.trim() ?? '';
    const isStructuredDeclaration =
      structuredName !== undefined && (structuredTail === '' || structuredTail.startsWith('{'));

    if (isStructuredDeclaration) {
      const endIndex = structuredTail === '' ? findStructuredVariableEnd(lines, i, indent) : i + 1;
      const nameError = validateVariableName(structuredName, absoluteLine, seenNames);
      if (nameError) {
        errors.push(nameError);
        i = endIndex;
        continue;
      }
      const rawDeclaration = parseStructuredYamlValue(
        lines,
        i,
        endIndex,
        indent,
        structuredName,
        absoluteLine,
        errors,
      );
      if (rawDeclaration !== undefined) {
        const variable = parseStructuredVariable(
          structuredName,
          rawDeclaration,
          absoluteLine,
          1,
          errors,
        );
        if (variable) variables.push(variable);
      }
      i = endIndex;
      continue;
    }

    // 解析变量名和类型声明
    const parseResult = parseVariableLine(line, absoluteLine, indent, 1);
    if (parseResult.type === 'error') {
      errors.push(parseResult.error);
      i++;
      continue;
    }

    const varName = parseResult.name;
    const typeSpec = parseResult.typeSpec;

    // 验证变量名
    const nameError = validateVariableName(varName, absoluteLine, seenNames);
    if (nameError) {
      errors.push(nameError);
      if (typeSpec.startsWith(OBJECT_START_MARKER)) {
        // 跳过 object 内容直到 }
        i = skipObjectBlock(lines, i + 1, indent);
      }
      i++;
      continue;
    }

    // 根据类型声明解析变量
    if (PRIMITIVE_TYPES.has(typeSpec)) {
      // 基本类型
      const varType = typeSpec as VariableType;
      variables.push({
        name: varName,
        type: varType,
        defaultValue: TYPE_DEFAULTS[varType],
        lineNumber: absoluteLine,
      });
      i++;
    } else if (ENUM_REGEX.test(typeSpec)) {
      // 枚举类型
      const enumResult = parseEnumType(typeSpec, varName, absoluteLine, errors);
      if (enumResult) {
        variables.push(enumResult);
      }
      i++;
    } else if (typeSpec.startsWith(OBJECT_START_MARKER)) {
      // 对象类型 — 需要解析多行内容
      const objectResult = parseObjectType(lines, i, varName, absoluteLine, indent, 1, errors);
      if (objectResult.variable) {
        variables.push(objectResult.variable);
      }
      i = objectResult.nextIndex;
    } else {
      // 无法识别的类型
      const colonIdx = line.indexOf(':');
      const typeStartCol = colonIdx >= 0 ? colonIdx + 2 : 1;
      errors.push(
        createDiagnostic(
          'E005',
          absoluteLine,
          typeStartCol,
          typeStartCol + typeSpec.length,
          `无法识别的变量类型: "${typeSpec}"，支持的类型: int, float, bool, string, enum[...], object{...}`,
        ),
      );
      i++;
    }
  }

  return variables;
}

// ============================================================================
// 行解析结构
// ============================================================================

interface VarLineSuccess {
  type: 'success';
  name: string;
  typeSpec: string;
}

interface VarLineError {
  type: 'error';
  error: Diagnostic;
}

type VarLineResult = VarLineSuccess | VarLineError;

/**
 * 解析单行变量声明，提取变量名和类型声明字符串。
 *
 * @param line - 当前行（已去首尾空白检查）
 * @param absoluteLine - 绝对行号
 * @param indent - 行缩进长度
 * @param _depth - 当前嵌套深度（保留参数，供将来扩展）
 */
function parseVariableLine(
  line: string,
  absoluteLine: number,
  _indent: number,
  _depth: number,
): VarLineResult {
  const trimmed = line.trimStart();

  // 查找冒号位置（处理中文冒号 U+FF1A）
  const colonHalf = trimmed.indexOf(':');
  const colonFull = trimmed.indexOf('：');
  let colonIdx = -1;
  if (colonHalf >= 0 && colonFull >= 0) {
    colonIdx = Math.min(colonHalf, colonFull);
  } else if (colonHalf >= 0) {
    colonIdx = colonHalf;
  } else if (colonFull >= 0) {
    colonIdx = colonFull;
  }

  if (colonIdx <= 0) {
    // 无冒号或冒号在行首 → 格式错误
    return {
      type: 'error',
      error: createDiagnostic(
        'E005',
        absoluteLine,
        1,
        trimmed.length,
        `变量声明格式错误: "${trimmed}"，应为 "变量名: 类型"`,
      ),
    };
  }

  const name = trimmed.slice(0, colonIdx).trim();
  const typeSpec = trimmed.slice(colonIdx + 1).trim();

  if (name.length === 0) {
    return {
      type: 'error',
      error: createDiagnostic('E005', absoluteLine, 1, colonIdx, '变量名不能为空'),
    };
  }

  if (typeSpec.length === 0) {
    return {
      type: 'error',
      error: createDiagnostic(
        'E005',
        absoluteLine,
        colonIdx + 1,
        trimmed.length,
        `变量 "${name}" 缺少类型声明`,
      ),
    };
  }

  return { type: 'success', name, typeSpec };
}

// ============================================================================
// 变量名验证
// ============================================================================

/**
 * 验证变量名。
 *
 * 检查：
 * 1. 格式（Unicode字母开头，字母/数字/下划线，1-64码点）
 * 2. 非保留字
 * 3. 不重复声明
 *
 * @returns 诊断错误（如果有），否则 null
 */
function validateVariableName(
  name: string,
  absoluteLine: number,
  seenNames: Map<string, number>,
): Diagnostic | null {
  // 检查格式
  if (!VAR_NAME_RE.test(name)) {
    let detail: string;
    if (name.length > 64) {
      detail = `变量名长度超过限制 (${name.length} > 64 个 Unicode 码点)`;
    } else {
      detail = '变量名必须以字母或中文字符开头，只能包含字母、数字、下划线';
    }
    return createDiagnostic(
      'E005',
      absoluteLine,
      1,
      1 + name.length,
      `无效的变量名: "${name}"`,
      detail,
    );
  }

  // 检查保留字
  if (RESERVED_WORDS.has(name)) {
    return createDiagnostic(
      'E005',
      absoluteLine,
      1,
      1 + name.length,
      `"${name}" 是保留字，不能用作变量名`,
    );
  }

  // 检查重复声明
  const existingLine = seenNames.get(name);
  if (existingLine !== undefined) {
    return createDiagnostic(
      'E008',
      absoluteLine,
      1,
      1 + name.length,
      `变量 "${name}" 重复声明（首次声明在第 ${existingLine} 行）`,
    );
  }

  seenNames.set(name, absoluteLine);
  return null;
}

// ============================================================================
// 枚举类型解析
// ============================================================================

/** Split only at separators outside quotes, enum brackets and object braces. */
function splitTopLevel(value: string, separators: ReadonlySet<string>): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let squareDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < value.length; index++) {
    const char = value[index]!;
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '[') {
      squareDepth++;
    } else if (char === ']') {
      squareDepth = Math.max(0, squareDepth - 1);
    } else if (char === '{') {
      braceDepth++;
    } else if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (squareDepth === 0 && braceDepth === 0 && separators.has(char)) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

function findTopLevelColon(value: string): number {
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let squareDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < value.length; index++) {
    const char = value[index]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '[') squareDepth++;
    else if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    else if (char === '{') braceDepth++;
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if ((char === ':' || char === '：') && squareDepth === 0 && braceDepth === 0) {
      return index;
    }
  }
  return -1;
}

/** Find the closing brace matching an already-consumed opening object brace. */
function findObjectClosingBrace(value: string): number {
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let squareDepth = 0;
  let braceDepth = 1;

  for (let index = 0; index < value.length; index++) {
    const char = value[index]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '[') squareDepth++;
    else if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    else if (squareDepth === 0 && char === '{') braceDepth++;
    else if (squareDepth === 0 && char === '}') {
      braceDepth--;
      if (braceDepth === 0) return index;
    }
  }
  return -1;
}

function unquoteEnumValue(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if (!((first === '"' && last === '"') || (first === "'" && last === "'"))) {
    return value;
  }
  return value.slice(1, -1).replace(/\\(.)/g, '$1');
}

/**
 * 解析枚举类型声明。
 *
 * @param typeSpec - 类型声明字符串（如 "enum[战士, 法师, 盗贼]"）
 * @param varName - 变量名
 * @param absoluteLine - 绝对行号
 * @param errors - 累积错误
 * @returns 解析后的 VariableDeclaration，解析失败返回 null
 */
function parseEnumType(
  typeSpec: string,
  varName: string,
  absoluteLine: number,
  errors: Diagnostic[],
): VariableDeclaration | null {
  const match = ENUM_REGEX.exec(typeSpec);
  if (!match || match[1] === undefined) {
    errors.push(
      createDiagnostic(
        'E005',
        absoluteLine,
        1,
        typeSpec.length,
        `枚举类型格式错误: "${typeSpec}"，应为 enum[值1, 值2, ...]`,
      ),
    );
    return null;
  }

  const rawValues = match[1];
  const enumValues = splitTopLevel(rawValues, new Set([',', '，']))
    .map((value) => unquoteEnumValue(value.trim()))
    .filter((v) => v.length > 0);

  // 验证枚举值不为空
  if (enumValues.length === 0) {
    errors.push(
      createDiagnostic(
        'E003',
        absoluteLine,
        1,
        typeSpec.length,
        `变量 "${varName}" 的枚举值列表不能为空`,
      ),
    );
    return null;
  }

  // 检查重复枚举值
  const enumSet = new Set(enumValues);
  if (enumSet.size !== enumValues.length) {
    errors.push(
      createDiagnostic(
        'E003',
        absoluteLine,
        1,
        typeSpec.length,
        `变量 "${varName}" 的枚举值列表包含重复项`,
      ),
    );
    return null;
  }

  return {
    name: varName,
    type: 'enum',
    defaultValue: enumValues[0]!,
    enumValues,
    lineNumber: absoluteLine,
  };
}

// ============================================================================
// 对象类型解析
// ============================================================================

interface ObjectParseResult {
  variable: VariableDeclaration | null;
  nextIndex: number; // 下一行索引
}

function createObjectDeclaration(
  name: string,
  fields: VariableDeclaration[],
  lineNumber: number,
): VariableDeclaration {
  const defaultValue: Record<string, unknown> = {};
  for (const field of fields) defaultValue[field.name] = field.defaultValue;
  return {
    name,
    type: 'object',
    defaultValue,
    fields: fields.length > 0 ? fields : undefined,
    lineNumber,
  };
}

function parseInlineFieldType(
  typeSpec: string,
  fieldName: string,
  absoluteLine: number,
  depth: number,
  errors: Diagnostic[],
): VariableDeclaration | null {
  if (PRIMITIVE_TYPES.has(typeSpec)) {
    const type = typeSpec as VariableType;
    return {
      name: fieldName,
      type,
      defaultValue: TYPE_DEFAULTS[type],
      lineNumber: absoluteLine,
    };
  }
  if (ENUM_REGEX.test(typeSpec)) {
    return parseEnumType(typeSpec, fieldName, absoluteLine, errors);
  }
  if (typeSpec.startsWith(OBJECT_START_MARKER)) {
    return parseInlineObjectDeclaration(typeSpec, fieldName, absoluteLine, depth, errors);
  }
  errors.push(
    createDiagnostic(
      'E005',
      absoluteLine,
      1,
      Math.max(1, typeSpec.length),
      `无法识别的字段类型: "${typeSpec}"`,
    ),
  );
  return null;
}

function parseInlineObjectFields(
  content: string,
  objectName: string,
  absoluteLine: number,
  depth: number,
  errors: Diagnostic[],
): VariableDeclaration[] {
  const fields: VariableDeclaration[] = [];
  const seenNames = new Map<string, number>();

  for (const rawField of splitTopLevel(content, new Set([',', '，']))) {
    const fieldText = rawField.trim();
    if (!fieldText) continue;
    const colonIndex = findTopLevelColon(fieldText);
    if (colonIndex <= 0) {
      errors.push(
        createDiagnostic(
          'E005',
          absoluteLine,
          1,
          Math.max(1, fieldText.length),
          `object "${objectName}" 的字段声明格式错误: "${fieldText}"`,
        ),
      );
      continue;
    }

    const fieldName = fieldText.slice(0, colonIndex).trim();
    const typeSpec = fieldText.slice(colonIndex + 1).trim();
    const nameError = validateVariableName(fieldName, absoluteLine, seenNames);
    if (nameError) {
      errors.push(nameError);
      continue;
    }
    if (!typeSpec) {
      errors.push(
        createDiagnostic(
          'E005',
          absoluteLine,
          colonIndex + 1,
          fieldText.length,
          `字段 "${fieldName}" 缺少类型声明`,
        ),
      );
      continue;
    }

    const field = parseInlineFieldType(typeSpec, fieldName, absoluteLine, depth + 1, errors);
    if (field) fields.push(field);
  }
  return fields;
}

function parseInlineObjectDeclaration(
  typeSpec: string,
  objectName: string,
  absoluteLine: number,
  depth: number,
  errors: Diagnostic[],
): VariableDeclaration | null {
  if (depth > MAX_OBJECT_DEPTH) {
    errors.push(
      createDiagnostic(
        'E006',
        absoluteLine,
        1,
        1,
        DIAGNOSTIC_MESSAGES['E006'],
        `变量 "${objectName}" 的嵌套深度为 ${depth}，超过最大限制 ${MAX_OBJECT_DEPTH} 层`,
      ),
    );
    return null;
  }

  const afterBrace = typeSpec.slice(OBJECT_START_MARKER.length);
  const closingIndex = findObjectClosingBrace(afterBrace);
  const content = closingIndex >= 0 ? afterBrace.slice(0, closingIndex) : afterBrace;
  if (closingIndex < 0) {
    errors.push(
      createDiagnostic(
        'E005',
        absoluteLine,
        1,
        Math.max(1, typeSpec.length),
        `object "${objectName}" 缺少闭合的 "}"`,
      ),
    );
  } else {
    const trailing = afterBrace.slice(closingIndex + 1).trim();
    if (trailing && !trailing.startsWith('#')) {
      errors.push(
        createDiagnostic(
          'E005',
          absoluteLine,
          1,
          Math.max(1, typeSpec.length),
          `object "${objectName}" 的闭合括号后存在无法识别的内容`,
          trailing,
        ),
      );
    }
  }

  const fields = parseInlineObjectFields(content, objectName, absoluteLine, depth, errors);
  return createObjectDeclaration(objectName, fields, absoluteLine);
}

/**
 * 解析 object{...} 类型的多行声明。
 *
 * 递归解析嵌套的对象字段。
 *
 * @param lines - 所有行
 * @param startIndex - object{ 所在行的索引
 * @param varName - 变量名
 * @param absoluteLine - object{ 行的绝对行号
 * @param parentIndent - 父级缩进长度
 * @param depth - 当前嵌套深度（1-based）
 * @param errors - 累积错误
 */
function parseObjectType(
  lines: readonly string[],
  startIndex: number,
  varName: string,
  absoluteLine: number,
  parentIndent: number,
  depth: number,
  errors: Diagnostic[],
): ObjectParseResult {
  // 深度检查
  if (depth > MAX_OBJECT_DEPTH) {
    errors.push(
      createDiagnostic(
        'E006',
        absoluteLine,
        1,
        1,
        DIAGNOSTIC_MESSAGES['E006'],
        `变量 "${varName}" 的嵌套深度为 ${depth}，超过最大限制 ${MAX_OBJECT_DEPTH} 层`,
      ),
    );
    // 跳过整个 object 块
    const skipTo = skipObjectBlock(lines, startIndex + 1, parentIndent);
    return { variable: null, nextIndex: skipTo };
  }

  // 字段缩进 = 父缩进 + 2（标准 YAML 缩进）
  const fieldIndent = parentIndent + 2;

  // 解析 object{ 行，检查是否在同一行有内容
  const objectLine = lines[startIndex]!;
  const openBraceIdx = objectLine.indexOf('{');
  const afterBrace = openBraceIdx >= 0 ? objectLine.slice(openBraceIdx + 1) : '';

  const fields: VariableDeclaration[] = [];
  let i = startIndex + 1;
  let closed = false;

  const inlineClosingIndex = findObjectClosingBrace(afterBrace);
  if (inlineClosingIndex >= 0) {
    const inlineVariable = parseInlineObjectDeclaration(
      objectLine.slice(objectLine.indexOf(OBJECT_START_MARKER)).trim(),
      varName,
      absoluteLine,
      depth,
      errors,
    );
    return { variable: inlineVariable, nextIndex: startIndex + 1 };
  }

  // 支持起始行先声明部分字段、随后继续多行书写；缺少闭合时仍保留字段。
  if (afterBrace.trim()) {
    fields.push(
      ...parseInlineObjectFields(
        afterBrace.trim().replace(/[,，]\s*$/, ''),
        varName,
        absoluteLine,
        depth,
        errors,
      ),
    );
  }

  // 解析多行字段
  while (i < lines.length) {
    const line = lines[i]!;
    const fieldAbsoluteLine = absoluteLine + (i - startIndex);

    // 跳过空行
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 检查缩进
    const lineIndent = line.match(/^([ \t]*)/)?.[1]?.length ?? 0;

    // 遇到 } 关闭标记（在父缩进级别）
    const trimmed = line.trimStart();
    if (lineIndent === parentIndent && trimmed === '}') {
      i++; // 跳过 }
      closed = true;
      break;
    }

    // 如果缩进小于字段缩进且不是 }，说明 object 块结束（可能是格式问题）
    if (lineIndent < fieldIndent) {
      break;
    }

    // 缩进大于字段缩进，尝试作为字段解析
    // 跳过注释行
    if (trimmed.startsWith('#')) {
      i++;
      continue;
    }

    // 解析字段
    const fieldParseResult = parseVariableLine(line, fieldAbsoluteLine, lineIndent, depth + 1);
    if (fieldParseResult.type === 'error') {
      errors.push(fieldParseResult.error);
      i++;
      continue;
    }

    const fieldName = fieldParseResult.name;
    const fieldTypeSpec = fieldParseResult.typeSpec;

    // 检查字段名重复（在同一个 object 内）
    if (fields.some((f) => f.name === fieldName)) {
      errors.push(
        createDiagnostic(
          'E008',
          fieldAbsoluteLine,
          1,
          1 + fieldName.length,
          `字段 "${fieldName}" 在 object "${varName}" 中重复声明`,
        ),
      );
      i++;
      continue;
    }

    // 验证变量名基本规则
    if (!VAR_NAME_RE.test(fieldName)) {
      errors.push(
        createDiagnostic(
          'E005',
          fieldAbsoluteLine,
          1,
          1 + fieldName.length,
          `无效的字段名: "${fieldName}"`,
        ),
      );
      i++;
      continue;
    }

    if (RESERVED_WORDS.has(fieldName)) {
      errors.push(
        createDiagnostic(
          'E005',
          fieldAbsoluteLine,
          1,
          1 + fieldName.length,
          `"${fieldName}" 是保留字，不能用作字段名`,
        ),
      );
      i++;
      continue;
    }

    // 根据字段类型声明创建字段变量
    if (PRIMITIVE_TYPES.has(fieldTypeSpec)) {
      fields.push({
        name: fieldName,
        type: fieldTypeSpec as VariableType,
        defaultValue: TYPE_DEFAULTS[fieldTypeSpec as VariableType],
        lineNumber: fieldAbsoluteLine,
      });
      i++;
    } else if (ENUM_REGEX.test(fieldTypeSpec)) {
      const enumResult = parseEnumType(fieldTypeSpec, fieldName, fieldAbsoluteLine, errors);
      if (enumResult) {
        fields.push(enumResult);
      }
      i++;
    } else if (fieldTypeSpec.startsWith(OBJECT_START_MARKER)) {
      // 嵌套 object
      const nestedResult = parseObjectType(
        lines,
        i,
        fieldName,
        fieldAbsoluteLine,
        lineIndent,
        depth + 1,
        errors,
      );
      if (nestedResult.variable) {
        fields.push(nestedResult.variable);
      }
      i = nestedResult.nextIndex;
    } else {
      errors.push(
        createDiagnostic(
          'E005',
          fieldAbsoluteLine,
          1,
          1 + fieldTypeSpec.length,
          `无法识别的字段类型: "${fieldTypeSpec}"`,
        ),
      );
      i++;
    }
  }

  if (!closed) {
    errors.push(
      createDiagnostic(
        'E005',
        absoluteLine,
        1,
        Math.max(1, objectLine.trim().length),
        `object "${varName}" 缺少闭合的 "}"`,
      ),
    );
  }

  return {
    variable: createObjectDeclaration(varName, fields, absoluteLine),
    nextIndex: i,
  };
}

/**
 * 跳过 object{...} 块，直到找到匹配的 }。
 * 用于解析失败时跳过整个块。
 *
 * @returns 跳过后的下一行索引
 */
function skipObjectBlock(
  lines: readonly string[],
  startIndex: number,
  parentIndent: number,
): number {
  let i = startIndex;
  // 追踪嵌套的 object{ 以便正确匹配 }
  let braceDepth = 1;

  while (i < lines.length && braceDepth > 0) {
    const line = lines[i]!;
    const trimmed = line.trim();
    const indent = line.match(/^([ \t]*)/)?.[1]?.length ?? 0;

    // 计数 { 和 }
    for (const ch of trimmed) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }

    // 如果遇到 } 并且缩进为 parentIndent，且 braceDepth 归零
    if (braceDepth <= 0 && indent === parentIndent) {
      i++;
      break;
    }

    i++;
  }

  return i;
}
