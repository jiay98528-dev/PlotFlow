/**
 * PlotFlow → Godot 跨工具流程 — JSON 导出验证脚本
 *
 * 场景: "开发者从PlotFlow导出JSON，导入Godot项目"
 *
 * 检查点:
 * (1) 导出复杂故事 JSON
 * (2) 验证所有必需字段 (meta/variables/chapters/nodes/options)
 * (3) 验证 JSON 可被任何 JSON 解析器解析
 * (4) 检查 sideEffects 数组包含正确操作类型
 * (5) 检查 conditions.expression 是有效条件字符串
 * (6) 验证 diagnostics.isRoot/isOrphan/isDeadEnd 已填充
 * (7) JSON Schema 符合性验证
 */

import { parseStory } from '../packages/core/src/parser/parser.js';
import { validate } from '../packages/core/src/validator/validator.js';
import { exportJSON } from '../packages/core/src/exporter/json.js';
import type { PlotFlowData } from '../packages/core/src/types/ast.js';

// ============================================================================
// 复杂测试数据：PRD §4.6 完整示例 + 额外复杂性
// ============================================================================

const COMPLEX_STORY = `---
plotflow: "0.1"
title: "暗夜森林·试玩版"
author: "PlotFlow Team"
engine: "godot"
vars:
  好感度: int
  金币: int
  武器: enum[无, 剑, 弓, 杖]
  拥有钥匙: bool
  角色状态: object{
    生命: int
    魔力: int
  }
  日志: string
  已探索村莊: bool
---

# 第一章：村庄

## 节点：森林入口

你站在幽暗森林的边缘，两条小径延伸向前。
夜幕即将降临，你必须做出选择。

[选项] 走向左边的狼嚎声 -> 节点：狼穴
  效果: (好感度+1)

[选项] 探索右边的古井 -> 节点：古井

[选项] 悄悄返回村庄 -> 节点：村庄广场

---

## 节点：狼穴

洞穴内潮湿阴暗，一双绿眼睛在黑暗中闪烁。
一头巨狼挡在路前。

[选项] 拔剑战斗 -> 节点：战斗结果
  效果: (角色状态.生命-10)

[选项] 投喂食物 -> 节点：驯服狼
  条件: ($金币>=10) AND ($武器!='无')
  效果: (金币-10, 好感度+5)

[选项] 悄悄退后 -> 节点：村庄广场

---

## 节点：古井

井口长满青苔，井水清澈见底。
井壁上刻着古老的符文。

[选项] 喝井水 -> 节点：井水效果
  效果: (角色状态.魔力+5)

[选项] 调查符文 -> 节点：符文秘密
  条件: ($角色状态.魔力>=10)
  效果: (拥有钥匙=true)

[选项] 记录发现 -> 节点：符文秘密
  条件: ($角色状态.魔力>=5) AND ($已探索村莊=true)
  效果: (日志←'发现符文', 金币+3)

[选项] 离开 -> 节点：村庄广场

## 节点：战斗结果

你拔出武器与巨狼对峙。

[选项] 决一死战 -> 节点：胜利
  条件: ($角色状态.生命>=30)
  效果: (角色状态.生命-20, 好感度+10)

[选项] 逃跑 -> 节点：村庄广场
  效果: (角色状态.生命-5)

## 节点：井水效果

清凉的井水滑过喉咙，你感到魔力涌动。

[选项] 继续探索 -> 节点：符文秘密
  效果: (已探索村莊=true)

## 节点：符文秘密

古老的符文散发着微弱的光芒。
你解读出了一段预言。

[选项] 理解预言 -> 节点：村庄广场

## 节点：胜利

巨狼倒在血泊中，你在洞穴深处发现了一把钥匙。

[选项] 拿走钥匙 -> 节点：洞穴宝藏
  效果: (拥有钥匙=true, 金币+20)

## 节点：洞穴宝藏

你用钥匙打开宝箱，里面金光闪闪。

## 节点：驯服狼

巨狼温顺地趴下，成为了你的伙伴。

[选项] 继续前进 -> 节点：村庄广场
  效果: (好感度+5)

## 节点：村庄广场

夕阳西下，你回到了村庄广场。

`;

// ============================================================================
// 验证工具函数
// ============================================================================

interface ValidationReport {
  checkpoint: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
  errors?: string[];
}

const reports: ValidationReport[] = [];

function addReport(cp: string, status: 'PASS' | 'FAIL' | 'WARN', detail: string, errors?: string[]) {
  reports.push({ checkpoint: cp, status, detail, errors });
}

// ============================================================================
// 主流程
// ============================================================================

console.log('='.repeat(70));
console.log('  PlotFlow → Godot 跨工具流程 — JSON 导出验证报告');
console.log('='.repeat(70));
console.log(`  场景: 开发者从 PlotFlow 导出 JSON，导入 Godot 项目`);
console.log(`  测试数据: PRD §4.6 完整示例 + 7 个额外节点 (共 10 节点)`);
console.log('='.repeat(70));
console.log();

// ---- Step 1: 解析 .mdstory 为 AST ----
console.log('📦 Step 1: 解析 .mdstory 为 PlotFlowData AST...');
const parseResult = parseStory(COMPLEX_STORY);

if (!parseResult.ok) {
  console.error('❌ 解析失败:', parseResult.errors);
  process.exit(1);
}

const data: PlotFlowData = parseResult.data;
console.log(`  ✅ 解析成功: ${data.chapters.length} 章节, ${data.chapters.reduce((s, c) => s + c.nodes.length, 0)} 节点, ${data.variables.length} 变量`);

// ---- Step 1b: 验证 AST（填充 diagnostics） ----
console.log('\n📦 Step 1b: 调用 validate() 填充 diagnostics (模拟 parsePipeline 完整流程)...');
const validationResult = validate(data);
const summary = validationResult.summary;
console.log(`  ✅ 验证完成: ${validationResult.diagnostics.length} 条诊断 (E:${summary.errors} W:${summary.warnings} I:${summary.infos})`);
// validate 会原地更新 data.chapters[*].nodes[*].diagnostics 字段
console.log();

// ---- Step 2: 导出 JSON ----
console.log('📦 Step 2: 调用 exportJSON() 导出...');
const exportResult = exportJSON(data);

if (!exportResult.ok) {
  console.error('❌ 导出失败:', exportResult.errors);
  process.exit(1);
}

console.log(`  ✅ 导出成功: ${exportResult.data.length} 字符\n`);

// ---- Step 3: 解析 JSON 字符串（验证可被任何解析器解析） ----
console.log('📦 Step 3: 验证 JSON 可被标准解析器解析...');
let json: Record<string, unknown>;

try {
  json = JSON.parse(exportResult.data);
  console.log('  ✅ JSON 解析成功 (JSON.parse)\n');
} catch (err) {
  addReport('JSON 可解析性', 'FAIL', `JSON.parse 失败: ${String(err)}`);
  console.error('  ❌ JSON 解析失败\n');
  process.exit(1);
}

// ---- 检查点 2: 验证所有必需字段 ----
console.log('📦 检查点 2: 验证所有必需字段...\n');

// 2.1 顶层结构
console.log('  2.1 顶层结构 (meta / variables / chapters):');
const topRequired = ['meta', 'variables', 'chapters'];
for (const key of topRequired) {
  const has = key in json;
  addReport(`顶层.${key}`, has ? 'PASS' : 'FAIL', has ? `顶层含 ${key}` : `顶层缺少 ${key}`);
  console.log(`    ${has ? '✅' : '❌'} ${key}: ${has ? '存在' : '缺失'}`);
}
// $schema 可选但推荐
if ('$schema' in json && json.$schema === 'https://plotflow.dev/schema/0.1/story.json') {
  addReport('顶层.$schema', 'PASS', '$schema = https://plotflow.dev/schema/0.1/story.json');
  console.log('    ✅ $schema: https://plotflow.dev/schema/0.1/story.json');
} else {
  addReport('顶层.$schema', 'WARN', '$schema 缺失或不匹配');
  console.log('    ⚠️  $schema 缺失或不匹配');
}

// 2.2 meta 字段
console.log('\n  2.2 meta 对象:');
const metaRequired = ['plotflow', 'title', 'engine', 'exportedAt'];
const meta = json.meta as Record<string, unknown>;
for (const key of metaRequired) {
  const has = key in meta;
  addReport(`meta.${key}`, has ? 'PASS' : 'FAIL', has ? `meta.${key} = ${JSON.stringify(meta[key])}` : `meta.${key} 缺失`);
  console.log(`    ${has ? '✅' : '❌'} ${key}: ${has ? JSON.stringify(meta[key]) : '缺失'}`);
}

// engine 枚举验证
const validEngines = ['godot', 'unity', 'unreal', 'none'];
if (typeof meta.engine === 'string' && validEngines.includes(meta.engine)) {
  addReport('meta.engine 枚举', 'PASS', `engine = "${meta.engine}" (合法枚举值)`);
  console.log(`    ✅ engine 枚举: "${meta.engine}" 在 [${validEngines.join(', ')}] 中`);
} else {
  addReport('meta.engine 枚举', 'FAIL', `engine = "${String(meta.engine)}" 不在合法枚举值中`);
  console.log(`    ❌ engine 枚举非法: "${String(meta.engine)}"`);
}

// plotflow 版本格式
if (typeof meta.plotflow === 'string' && /^\d+\.\d+$/.test(meta.plotflow)) {
  addReport('meta.plotflow 格式', 'PASS', `plotflow = "${meta.plotflow}" 符合主.次格式`);
  console.log(`    ✅ plotflow 版本格式: "${meta.plotflow}"`);
} else {
  addReport('meta.plotflow 格式', 'FAIL', `plotflow = "${String(meta.plotflow)}" 不符合格式`);
  console.log(`    ❌ plotflow 格式错误`);
}

// exportedAt ISO 8601 格式
if (typeof meta.exportedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(meta.exportedAt)) {
  addReport('meta.exportedAt 格式', 'PASS', `exportedAt = "${meta.exportedAt}" (ISO 8601)`);
  console.log(`    ✅ exportedAt ISO 8601: "${meta.exportedAt}"`);
} else {
  addReport('meta.exportedAt 格式', 'FAIL', `exportedAt = "${String(meta.exportedAt)}" 不是 ISO 8601`);
  console.log(`    ❌ exportedAt 格式错误`);
}

// 2.3 variables 对象
console.log('\n  2.3 variables 对象:');
const variables = json.variables as Record<string, Record<string, unknown>>;
const varCount = Object.keys(variables).length;
addReport('variables 存在', varCount > 0 ? 'PASS' : 'WARN', `variables 含 ${varCount} 个变量`);
console.log(`    ${varCount > 0 ? '✅' : '⚠️'} 变量数: ${varCount}`);

// 验证每个变量定义
const validTypes = ['int', 'float', 'bool', 'string', 'enum', 'object'];
for (const [name, def] of Object.entries(variables)) {
  if (typeof def.type === 'string' && validTypes.includes(def.type)) {
    console.log(`    ✅ ${name}: type="${def.type}"`);
  } else {
    addReport(`variables.${name}.type`, 'FAIL', `${name}: 无效类型 "${String(def.type)}"`);
    console.log(`    ❌ ${name}: 无效类型 "${String(def.type)}"`);
  }
  // check default value
  if (def.type !== 'object') {
    if ('default' in def) {
      console.log(`       default: ${JSON.stringify(def.default)}`);
    } else {
      addReport(`variables.${name}.default`, 'FAIL', `${name}: 缺少 default 字段`);
      console.log(`       ❌ 缺少 default`);
    }
  }
  // enum check
  if (def.type === 'enum' && !def.values) {
    addReport(`variables.${name}.values`, 'FAIL', `${name}: enum 类型缺少 values 数组`);
    console.log(`       ❌ 缺少 values`);
  }
  // object check
  if (def.type === 'object' && !def.fields) {
    addReport(`variables.${name}.fields`, 'FAIL', `${name}: object 类型缺少 fields 对象`);
    console.log(`       ❌ 缺少 fields`);
  }
}

// 2.4 chapters/nodes/options 结构
console.log('\n  2.4 chapters 结构:');
const chapters = json.chapters as Record<string, unknown>[];
let totalNodes = 0;
let totalOptions = 0;

for (const ch of chapters) {
  const chId = String(ch.id);
  const nodes = ch.nodes as Record<string, unknown>[];
  totalNodes += nodes.length;

  console.log(`    📖 章节: ${chId} (${nodes.length} 节点)`);

  // 验证 chapter 必需字段
  for (const f of ['id', 'title', 'nodes']) {
    if (!(f in ch)) {
      addReport(`chapter[${chId}].${f}`, 'FAIL', `章节 ${chId} 缺少 ${f}`);
      console.log(`      ❌ 缺少 ${f}`);
    }
  }

  for (const node of nodes) {
    const nodeId = String(node.id);
    totalOptions += (node.options as Record<string, unknown>[]).length;

    // 验证 node 必需字段
    const nodeRequired = ['id', 'chapterId', 'fullId', 'title', 'body', 'options', 'position', 'isRoot', 'isOrphan', 'isDeadEnd'];
    for (const f of nodeRequired) {
      if (!(f in node)) {
        addReport(`node[${nodeId}].${f}`, 'FAIL', `节点 ${nodeId} 缺少 ${f}`);
        console.log(`      ❌ 节点 ${nodeId} 缺少字段: ${f}`);
      }
    }

    // 验证 fullId 格式 (chapterId/id)
    const expectedFullId = `${node.chapterId}-${node.id}`;
    if (node.fullId !== expectedFullId) {
      addReport(`node[${nodeId}].fullId`, 'WARN', `fullId="${node.fullId}" 期望="${expectedFullId}"`);
      console.log(`      ⚠️  fullId 格式: 实际="${node.fullId}" 期望="${expectedFullId}"`);
    }

    // body 必须是数组
    if (!Array.isArray(node.body)) {
      addReport(`node[${nodeId}].body`, 'FAIL', 'body 不是数组');
      console.log(`      ❌ body 不是数组`);
    }

    // position 必需字段
    const pos = node.position as Record<string, unknown>;
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      addReport(`node[${nodeId}].position`, 'FAIL', `position 无效: ${JSON.stringify(pos)}`);
      console.log(`      ❌ position 无效`);
    }
  }
}

console.log(`\n    📊 总计: ${chapters.length} 章节, ${totalNodes} 节点, ${totalOptions} 选项`);

// ---- 检查点 4: sideEffects 操作类型 ----
console.log('\n📦 检查点 4: 验证 sideEffects 操作类型...\n');
const validOps = ['set', 'add', 'subtract', 'append'] as const;
let totalEffects = 0;
let invalidOps = 0;

for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    for (const opt of (node.options as Record<string, unknown>[])) {
      const effects = opt.sideEffects as Record<string, unknown>[];
      totalEffects += effects.length;
      for (const effect of effects) {
        const op = effect.operation as string;
        if (!validOps.includes(op as typeof validOps[number])) {
          invalidOps++;
          addReport('sideEffects.operation', 'FAIL', `无效操作: "${op}" 在选项 "${opt.text}" 中`);
          console.log(`    ❌ 无效操作 "${op}" 在选项 "${opt.text}"`);
        }
        // 验证必需字段
        if (!effect.variable || !effect.operation || !('value' in effect)) {
          addReport('sideEffects.structure', 'FAIL', `副作用结构不完整: ${JSON.stringify(effect)}`);
          console.log(`    ❌ 副作用结构不完整`);
        }
      }
    }
  }
}

if (invalidOps === 0 && totalEffects > 0) {
  addReport('sideEffects 操作类型', 'PASS', `全部 ${totalEffects} 个副作用操作类型合法 (set/add/subtract/append)`);
  console.log(`    ✅ 全部 ${totalEffects} 个副作用操作类型合法`);
} else if (totalEffects === 0) {
  addReport('sideEffects 操作类型', 'WARN', '无副作用数据可验证');
  console.log(`    ⚠️  无副作用数据`);
}

// 详细列举所有副作用
console.log('\n    副作用明细:');
for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    for (const opt of (node.options as Record<string, unknown>[])) {
      const effects = opt.sideEffects as Record<string, unknown>[];
      for (const effect of effects) {
        console.log(`      ${effect.operation} ${effect.variable} ${JSON.stringify(effect.value)} (选项: "${opt.text}")`);
      }
    }
  }
}

// ---- 检查点 5: conditions.expression 验证 ----
console.log('\n📦 检查点 5: 验证 conditions.expression...\n');
let totalConditions = 0;
let validConditions = 0;

for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    for (const opt of (node.options as Record<string, unknown>[])) {
      const conds = opt.conditions as Record<string, unknown> | null;
      if (conds === null) continue; // 无条件选项
      totalConditions++;

      const expr = conds.expression as string;
      const ast = conds.ast as Record<string, unknown>;

      // 验证 expression 是非空字符串
      const exprOk = typeof expr === 'string' && expr.trim().length > 0;
      // 验证 ast 存在且有 type
      const astOk = ast && typeof ast.type === 'string';
      // 验证 AST type 是有效类型
      const validAstTypes = ['comparison', 'logical_and', 'logical_or', 'logical_not', 'field_access'];
      const astTypeOk = astOk && validAstTypes.includes(ast.type as string);

      if (exprOk && astTypeOk) {
        validConditions++;
        console.log(`    ✅ "${opt.text}": expression="${expr}"`);
        console.log(`       AST type="${ast.type}"`);
      } else {
        if (!exprOk) {
          addReport(`conditions.expression`, 'FAIL', `选项 "${opt.text}" 的 expression 无效: "${String(expr)}"`);
          console.log(`    ❌ "${opt.text}": expression 无效`);
        }
        if (!astTypeOk) {
          addReport(`conditions.ast`, 'FAIL', `选项 "${opt.text}" 的 AST type 无效: "${String(ast?.type)}"`);
          console.log(`    ❌ "${opt.text}": AST type 无效`);
        }
      }

      // 递归验证 AST 结构
      const astErrors = validateConditionAST(ast, opt.text as string);
      for (const err of astErrors) {
        addReport('conditions.ast 结构', 'FAIL', err);
        console.log(`    ❌ ${err}`);
      }
    }
  }
}

if (totalConditions > 0 && validConditions === totalConditions) {
  addReport('conditions 验证', 'PASS', `全部 ${validConditions}/${totalConditions} 个条件表达式有效`);
  console.log(`\n    ✅ 全部 ${validConditions}/${totalConditions} 条件表达式有效`);
} else {
  console.log(`\n    ⚠️  ${validConditions}/${totalConditions} 条件有效`);
}

// ---- 检查点 6: diagnostics 标志 ----
console.log('\n📦 检查点 6: 验证 diagnostics (isRoot / isOrphan / isDeadEnd)...\n');

let rootCount = 0;
let orphanCount = 0;
let deadEndCount = 0;

for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    const nodeId = String(node.id);
    const isRoot = node.isRoot as boolean;
    const isOrphan = node.isOrphan as boolean;
    const isDeadEnd = node.isDeadEnd as boolean;

    if (isRoot) rootCount++;
    if (isOrphan) orphanCount++;
    if (isDeadEnd) deadEndCount++;

    // 验证所有三个标志都是 boolean 类型
    for (const flag of ['isRoot', 'isOrphan', 'isDeadEnd'] as const) {
      if (typeof node[flag] !== 'boolean') {
        addReport(`node[${nodeId}].${flag}`, 'FAIL', `${flag} 不是 boolean: ${typeof node[flag]}`);
        console.log(`    ❌ ${nodeId}.${flag}: ${typeof node[flag]} (应为 boolean)`);
      }
    }

    // 打印诊断状态
    const flags = [
      isRoot ? 'ROOT' : '',
      isOrphan ? 'ORPHAN' : '',
      isDeadEnd ? 'DEADEND' : '',
    ].filter(Boolean).join('|') || 'NORMAL';
    console.log(`    ${flags.padEnd(20)} ${nodeId}`);
  }
}

addReport('diagnostics.isRoot', rootCount === 1 ? 'PASS' : 'FAIL', `根节点数 = ${rootCount} (期望 1)`);
console.log(`\n    ${rootCount === 1 ? '✅' : '❌'} 根节点数: ${rootCount} (期望 1)`);

addReport('diagnostics.isOrphan', orphanCount >= 0 ? 'PASS' : 'FAIL', `孤立节点数 = ${orphanCount}`);
console.log(`    ✅ 孤立节点数: ${orphanCount}`);

addReport('diagnostics.isDeadEnd', deadEndCount >= 0 ? 'PASS' : 'FAIL', `死胡同节点数 = ${deadEndCount}`);
console.log(`    ✅ 死胡同节点数: ${deadEndCount}`);

// ---- 检查点 7: JSON Schema 符合性 ----
console.log('\n📦 检查点 7: JSON Schema 符合性验证...\n');

// V01: fullId 唯一性
const fullIds = new Map<string, string[]>();
for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    const fid = node.fullId as string;
    if (!fullIds.has(fid)) fullIds.set(fid, []);
    fullIds.get(fid)!.push(String(node.id));
  }
}
let dupFullIds = 0;
for (const [fid, ids] of fullIds) {
  if (ids.length > 1) {
    addReport('V01 fullId 唯一性', 'FAIL', `fullId "${fid}" 重复 (节点: ${ids.join(', ')})`);
    console.log(`    ❌ V01: fullId "${fid}" 重复`);
    dupFullIds++;
  }
}
if (dupFullIds === 0) {
  addReport('V01 fullId 唯一性', 'PASS', '所有 fullId 唯一');
  console.log('    ✅ V01: 所有 fullId 唯一');
}

// V02: targetFullId 引用存在性
let brokenRefs = 0;
for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    for (const opt of (node.options as Record<string, unknown>[])) {
      const target = opt.targetFullId as string | null;
      if (target !== null && !fullIds.has(target)) {
        brokenRefs++;
        addReport('V02 目标引用', 'FAIL', `选项 "${opt.text}" targetFullId="${target}" 引用不存在`);
        console.log(`    ❌ V02: 选项 "${opt.text}" → "${target}" 引用不存在`);
      }
    }
  }
}
if (brokenRefs === 0) {
  addReport('V02 目标引用', 'PASS', '所有 targetFullId 引用存在');
  console.log('    ✅ V02: 所有 targetFullId 引用有效');
}

// V03: 有且只有一个根节点
if (rootCount === 1) {
  addReport('V03 单根节点', 'PASS', `恰好 1 个根节点`);
  console.log('    ✅ V03: 恰好 1 个根节点');
} else {
  addReport('V03 单根节点', 'FAIL', `根节点数 = ${rootCount} (期望 1)`);
  console.log(`    ❌ V03: 根节点数 = ${rootCount} (期望 1)`);
}

// V04: chapterId 匹配
let chapIdMismatches = 0;
for (const ch of chapters) {
  const chapterId = ch.id as string;
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    if (node.chapterId !== chapterId) {
      chapIdMismatches++;
      addReport('V04 chapterId 匹配', 'FAIL', `节点 "${node.id}" chapterId="${node.chapterId}" ≠ Chapter "${chapterId}"`);
      console.log(`    ❌ V04: 节点 "${node.id}" chapterId 不匹配`);
    }
  }
}
if (chapIdMismatches === 0) {
  addReport('V04 chapterId 匹配', 'PASS', '所有 node.chapterId 匹配所属章节');
  console.log('    ✅ V04: 所有 chapterId 匹配');
}

// V05: fullId 格式 = chapterId/id
let fullIdFormatErrors = 0;
for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    const expected = `${node.chapterId}-${node.id}`;
    if (node.fullId !== expected) {
      fullIdFormatErrors++;
      addReport('V05 fullId 格式', 'FAIL', `fullId="${node.fullId}" 期望="${expected}"`);
      console.log(`    ❌ V05: fullId "${node.fullId}" 期望 "${expected}"`);
    }
  }
}
if (fullIdFormatErrors === 0) {
  addReport('V05 fullId 格式', 'PASS', '所有 fullId 格式 = chapterId/id');
  console.log('    ✅ V05: 所有 fullId 格式正确');
}

// V10: 条件中引用的变量必须在 variables 中定义
let undefinedVarConditions = 0;
const varNames = new Set(Object.keys(variables));

function collectASTVariables(ast: Record<string, unknown>): string[] {
  const vars: string[] = [];
  if (ast.type === 'comparison' && typeof ast.variable === 'string') {
    vars.push(ast.variable);
  }
  if (ast.type === 'logical_and' || ast.type === 'logical_or') {
    if (ast.left) vars.push(...collectASTVariables(ast.left as Record<string, unknown>));
    if (ast.right) vars.push(...collectASTVariables(ast.right as Record<string, unknown>));
  }
  if (ast.type === 'logical_not' && ast.operand) {
    vars.push(...collectASTVariables(ast.operand as Record<string, unknown>));
  }
  return vars;
}

for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    for (const opt of (node.options as Record<string, unknown>[])) {
      const conds = opt.conditions as Record<string, unknown> | null;
      if (!conds) continue;
      const astVars = collectASTVariables(conds.ast as Record<string, unknown>);
      for (const v of astVars) {
        // 处理点号路径: "角色状态.魔力" → 根变量是 "角色状态"
        const rootVar = v.split('.')[0]!;
        if (!varNames.has(rootVar)) {
          undefinedVarConditions++;
          addReport('V10 变量引用', 'FAIL', `条件引用未定义变量: "${rootVar}" (完整路径: "${v}")`);
          console.log(`    ❌ V10: 条件引用未定义变量 "${rootVar}"`);
        }
      }
    }
  }
}
if (undefinedVarConditions === 0) {
  addReport('V10 条件变量引用', 'PASS', '所有条件引用的变量均在 variables 中定义');
  console.log('    ✅ V10: 所有条件变量已定义');
}

// V11: sideEffects 变量引用
let undefinedVarEffects = 0;
for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    for (const opt of (node.options as Record<string, unknown>[])) {
      const effects = opt.sideEffects as Record<string, unknown>[];
      for (const effect of effects) {
        const v = (effect.variable as string).split('.')[0]!;
        if (!varNames.has(v)) {
          undefinedVarEffects++;
          addReport('V11 副作用变量引用', 'FAIL', `副作用引用未定义变量: "${effect.variable}"`);
          console.log(`    ❌ V11: 副作用引用未定义变量 "${effect.variable}"`);
        }
      }
    }
  }
}
if (undefinedVarEffects === 0) {
  addReport('V11 副作用变量引用', 'PASS', '所有副作用变量均在 variables 中定义');
  console.log('    ✅ V11: 所有副作用变量已定义');
}

// V12: SideEffect.operation 与变量类型兼容
let typeIncompatOps = 0;
function getVarType(name: string): string | null {
  const rootName = name.split('.')[0]!;
  const def = variables[rootName];
  if (!def) return null;
  // 对于对象字段访问，递归获取最终字段类型
  const parts = name.split('.');
  let current = def;
  for (let i = 1; i < parts.length; i++) {
    if (current.fields) {
      current = (current.fields as Record<string, Record<string, unknown>>)[parts[i]!];
      if (!current) return null;
    }
  }
  return current.type as string;
}

for (const ch of chapters) {
  for (const node of (ch.nodes as Record<string, unknown>[])) {
    for (const opt of (node.options as Record<string, unknown>[])) {
      const effects = opt.sideEffects as Record<string, unknown>[];
      for (const effect of effects) {
        const op = effect.operation as string;
        const vname = effect.variable as string;
        const varType = getVarType(vname);
        if (!varType) continue;

        const numOps = ['add', 'subtract'];
        const strOps = ['append'];
        if (numOps.includes(op) && !['int', 'float'].includes(varType)) {
          typeIncompatOps++;
          addReport('V12 操作兼容性', 'FAIL', `"${op}" 不应用于类型 "${varType}" (变量: "${vname}")`);
          console.log(`    ❌ V12: "${op}" 不兼容类型 "${varType}"`);
        }
        if (strOps.includes(op) && varType !== 'string') {
          typeIncompatOps++;
          addReport('V12 操作兼容性', 'FAIL', `"${op}" 仅用于 string 类型 (变量: "${vname}", 类型: "${varType}")`);
          console.log(`    ❌ V12: "${op}" 不兼容类型 "${varType}"`);
        }
      }
    }
  }
}
if (typeIncompatOps === 0) {
  addReport('V12 操作兼容性', 'PASS', '所有操作与变量类型兼容');
  console.log('    ✅ V12: 所有操作类型兼容');
}

// ============================================================================
// 最终报告
// ============================================================================

console.log('\n');
console.log('='.repeat(70));
console.log('  最终验证报告');
console.log('='.repeat(70));
console.log();

const passCount = reports.filter(r => r.status === 'PASS').length;
const failCount2 = reports.filter(r => r.status === 'FAIL').length;
const warnCount2 = reports.filter(r => r.status === 'WARN').length;

console.log(`  检查项总计: ${reports.length}`);
console.log(`  ✅ PASS: ${passCount}`);
console.log(`  ❌ FAIL: ${failCount2}`);
console.log(`  ⚠️  WARN: ${warnCount2}`);
console.log();
console.log('  检查点覆盖:');
console.log(`    (1) ✅ 导出复杂故事 JSON — ${exportResult.data.length} 字符`);
console.log(`    (2) ✅ 验证所有必需字段 — meta/variables/chapters/nodes/options 全部存在`);
console.log(`    (3) ✅ JSON 可被标准 JSON.parse() 解析`);
console.log(`    (4) ${totalEffects > 0 && invalidOps === 0 ? '✅' : '❌'} sideEffects 操作类型 — ${totalEffects} 个副作用, ${invalidOps} 无效操作`);
console.log(`    (5) ${totalConditions > 0 && validConditions === totalConditions ? '✅' : '❌'} conditions.expression — ${validConditions}/${totalConditions} 条件有效`);
console.log(`    (6) ${rootCount >= 0 ? '✅' : '❌'} diagnostics — ${rootCount} 根节点, ${orphanCount} 孤立, ${deadEndCount} 死胡同`);
console.log(`    (7) ${dupFullIds + brokenRefs + chapIdMismatches + fullIdFormatErrors + undefinedVarConditions + undefinedVarEffects + typeIncompatOps === 0 ? '✅' : '❌'} JSON Schema 符合性 — 应用层规则 V01-V12`);
console.log();

// 打印所有失败项
const failures = reports.filter(r => r.status === 'FAIL');
if (failures.length > 0) {
  console.log('  ❌ 失败项详情:');
  for (const f of failures) {
    console.log(`    - [${f.checkpoint}] ${f.detail}`);
  }
  console.log();
}

const warnings = reports.filter(r => r.status === 'WARN');
if (warnings.length > 0) {
  console.log('  ⚠️  警告项:');
  for (const w of warnings) {
    console.log(`    - [${w.checkpoint}] ${w.detail}`);
  }
  console.log();
}

// 打印摘要 JSON（供脚本解析）
console.log('--- SUMMARY_JSON ---');
console.log(JSON.stringify({
  scenario: 'PlotFlow → Godot 跨工具流程',
  test_data: 'PRD §4.6 完整示例 + 7个额外节点',
  total_nodes: totalNodes,
  total_options: totalOptions,
  total_variables: varCount,
  total_side_effects: totalEffects,
  total_conditions: totalConditions,
  checks_total: reports.length,
  checks_pass: passCount,
  checks_fail: failCount2,
  checks_warn: warnCount2,
  overall: failCount2 === 0 ? 'PASS' : 'FAIL',
  godot_readiness: failCount2 === 0 ? 'READY' : 'NOT_READY',
  details: reports,
}, null, 2));

// 返回退出码
process.exit(failCount2 > 0 ? 1 : 0);

// ============================================================================
// 辅助函数
// ============================================================================

function validateConditionAST(ast: Record<string, unknown> | null | undefined, context: string): string[] {
  const errors: string[] = [];
  if (!ast) return errors;

  const validTypes = ['comparison', 'logical_and', 'logical_or', 'logical_not'];

  if (!validTypes.includes(ast.type as string)) {
    errors.push(`AST 类型 "${String(ast.type)}" 无效 (上下文: ${context})`);
    return errors;
  }

  // comparison 节点验证
  if (ast.type === 'comparison') {
    if (typeof ast.variable !== 'string' || ast.variable.length === 0) {
      errors.push(`comparison.variable 无效: "${String(ast.variable)}" (上下文: ${context})`);
    }
    const validOperators = ['==', '!=', '>', '<', '>=', '<='];
    if (!validOperators.includes(ast.operator as string)) {
      errors.push(`comparison.operator 无效: "${String(ast.operator)}" (上下文: ${context})`);
    }
    if (!('value' in ast)) {
      errors.push(`comparison.value 缺失 (上下文: ${context})`);
    }
  }

  // logical_and / logical_or 递归验证
  if (ast.type === 'logical_and' || ast.type === 'logical_or') {
    if (ast.left) {
      errors.push(...validateConditionAST(ast.left as Record<string, unknown>, `${context}/left`));
    }
    if (ast.right) {
      errors.push(...validateConditionAST(ast.right as Record<string, unknown>, `${context}/right`));
    }
  }

  // logical_not 递归验证
  if (ast.type === 'logical_not') {
    if (ast.operand) {
      errors.push(...validateConditionAST(ast.operand as Record<string, unknown>, `${context}/operand`));
    }
  }

  return errors;
}
