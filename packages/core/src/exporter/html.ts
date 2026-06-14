/**
 * HTML 可玩版导出器 — M4-05~09
 *
 * @packageDocumentation
 * @remarks
 * 将 PlotFlowData AST 导出为单文件自包含 HTML，
 * 浏览器直接打开即可交互式游玩分支叙事。
 *
 * 功能特性：
 * - 自包含单 HTML 文件（内嵌 CSS + JS）
 * - 暗色主题，桌面 + 移动端响应式
 * - 节点描述渲染 HTML（支持基础 Markdown）
 * - 选项按钮：可用选项绿色，有条件选项灰显 + 🔒
 * - 条件评估引擎（AST 递归求值）
 * - 变量即时更新
 * - 面包屑导航（可点击回溯）
 * - 底部可折叠变量面板（实时显示）
 * - 所有用户文本 HTML 转义（防 XSS）
 * - 不含用户文本部分 ≤ 50KB
 *
 * @version 0.1.0
 */

import type { PlotFlowData, StoryNode, Option, SideEffect, ConditionNode, VariableDeclaration } from '../types/ast.js';
import type { ParseResult } from '../result.js';
import { success, failure } from '../result.js';

// ============================================================================
// 运行时数据结构（嵌入 HTML JSON 的压缩格式）
// ============================================================================

/**
 * 运行时节点（精简版，不含诊断/位置等导出无关字段）。
 */
interface RuntimeNode {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly options: RuntimeOption[];
}

/**
 * 运行时选项（精简版）。
 */
interface RuntimeOption {
  readonly text: string;
  readonly target: string;
  readonly condition: ConditionNode | null;
  readonly conditionRaw: string | null;
  readonly effects: SideEffect[];
}

/**
 * 嵌入 HTML 的运行时故事数据。
 */
interface RuntimeData {
  readonly title: string;
  readonly rootId: string;
  readonly vars: Record<string, unknown>;
  readonly nodes: Record<string, RuntimeNode>;
}

// ============================================================================
// HTML 转义
// ============================================================================

/**
 * HTML 转义用户文本，防止 XSS。
 * 转义: & < > " '
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// 构建运行时数据（从 PlotFlowData 压缩为 JSON）
// ============================================================================

/**
 * 从 PlotFlowData 构建运行时 JSON 字符串。
 * 只包含运行时必需字段，排除诊断/位置等导出无关数据。
 */
function buildRuntimeJson(data: PlotFlowData): string {
  const nodes: Record<string, RuntimeNode> = {};
  let rootId = '';

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      nodes[node.fullId] = toRuntimeNode(node);
      if (node.diagnostics.isRoot) {
        rootId = node.fullId;
      }
    }
  }

  // 没有标记为 root 的节点则取第一个
  if (!rootId && data.chapters.length > 0 && data.chapters[0]!.nodes.length > 0) {
    rootId = data.chapters[0]!.nodes[0]!.fullId;
  }

  const initialVars = buildInitialVariables(data.variables);

  const runtime: RuntimeData = {
    title: data.meta.title || 'PlotFlow Story',
    rootId,
    vars: initialVars,
    nodes,
  };

  return JSON.stringify(runtime);
}

/** 将 StoryNode 转为运行时节点 */
function toRuntimeNode(node: StoryNode): RuntimeNode {
  return {
    id: node.id,
    title: node.title,
    body: node.body,
    options: node.options.map(toRuntimeOption),
  };
}

/** 将 Option 转为运行时选项 */
function toRuntimeOption(opt: Option): RuntimeOption {
  return {
    text: opt.description,
    target: opt.targetFullId || '',
    condition: opt.condition,
    conditionRaw: opt.conditionRaw,
    effects: opt.sideEffects,
  };
}

/** 从 VariableDeclaration[] 构建初始变量值 Record */
function buildInitialVariables(variables: VariableDeclaration[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const v of variables) {
    if (v.type === 'object') {
      result[v.name] = buildObjectValue(v);
    } else {
      result[v.name] = v.defaultValue;
    }
  }
  return result;
}

/** 递归构建 object 类型变量的初始值 */
function buildObjectValue(v: VariableDeclaration): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  if (v.fields) {
    for (const field of v.fields) {
      if (field.type === 'object') {
        obj[field.name] = buildObjectValue(field);
      } else {
        obj[field.name] = field.defaultValue;
      }
    }
  }
  return obj;
}

// ============================================================================
// HTML 模板生成
// ============================================================================

/**
 * 生成嵌入 CSS。
 * 暗色主题，桌面 + 移动端响应式。
 */
function generateCSS(): string {
  return `*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;min-height:100vh}
#app{display:flex;flex-direction:column;min-height:100vh;max-width:800px;margin:0 auto;padding:0 16px}
#header{position:sticky;top:0;z-index:10;background:#161b22;border-bottom:1px solid #30363d;padding:12px 0;backdrop-filter:blur(8px)}
#story-title{font-size:1.1em;font-weight:600;color:#e6edf3;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#breadcrumb{font-size:0.85em;color:#8b949e;overflow-x:auto;white-space:nowrap;padding-bottom:2px;scrollbar-width:none}
#breadcrumb::-webkit-scrollbar{display:none}
.crumb-link{color:#3fb950;cursor:pointer;text-decoration:none;display:inline-block;padding:2px 0}
.crumb-link:hover{color:#2ea043;text-decoration:underline}
.crumb-sep{color:#484f58;margin:0 6px;user-select:none}
.crumb-current{color:#8b949e}
#content{flex:1;padding:24px 0 16px}
#node-body p{margin-bottom:1em}
#node-body p:last-child{margin-bottom:0}
#node-body strong{color:#e6edf3;font-weight:600}
#node-body code{background:#1c2333;color:#3fb950;padding:2px 6px;border-radius:4px;font-size:0.9em;font-family:"SF Mono","Consolas","Liberation Mono",monospace}
#node-body s{color:#484f58}
#options{margin-top:24px;display:flex;flex-direction:column;gap:8px}
.option-btn{background:#1c2333;color:#e6edf3;border:1px solid #30363d;border-left:4px solid #3fb950;border-radius:8px;padding:12px 16px;font-size:1em;cursor:pointer;text-align:left;transition:background .15s,border-color .15s,transform .1s}
.option-btn:hover:not(:disabled){background:#21262d;border-left-color:#2ea043;transform:translateX(4px)}
.option-btn:active:not(:disabled){transform:translateX(2px)}
.option-btn:disabled{opacity:.45;cursor:not-allowed;border-left-color:#484f58}
.lock-icon{margin-right:8px;font-size:0.9em}
.condition-text{font-size:0.82em;color:#484f58;padding:2px 16px 4px;font-style:italic}
.condition-text::before{content:"\\2699 ";font-style:normal}
.dead-end{text-align:center;color:#484f58;font-size:1.2em;padding:40px 0;font-style:italic}
#var-panel{position:fixed;bottom:0;left:0;right:0;z-index:20;background:#161b22;border-top:1px solid #30363d;transition:transform .25s ease}
#var-panel.collapsed{transform:translateY(calc(100% - 40px))}
#var-toggle{width:100%;background:#1c2333;color:#8b949e;border:none;border-bottom:1px solid #30363d;padding:8px 16px;font-size:0.85em;cursor:pointer;text-align:left;display:flex;align-items:center;gap:6px}
#var-toggle:hover{color:#e6edf3}
#var-content{max-height:200px;overflow-y:auto;padding:8px 16px 16px}
.var-table{width:100%;border-collapse:collapse;font-size:0.82em}
.var-table td{padding:4px 8px;border-bottom:1px solid #30363d}
.var-key{color:#8b949e;font-family:"SF Mono","Consolas","Liberation Mono",monospace}
.var-val{color:#e6edf3;text-align:right;font-weight:500}
.start-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50vh;text-align:center;gap:16px}
.start-screen h2{font-size:1.5em;color:#e6edf3}
.start-screen p{color:#8b949e;max-width:500px}
.start-btn{background:#3fb950;color:#0d1117;border:none;border-radius:8px;padding:12px 32px;font-size:1.1em;font-weight:600;cursor:pointer;transition:background .15s,transform .1s;margin-top:8px}
.start-btn:hover{background:#2ea043;transform:scale(1.02)}
.error-msg{color:#f85149;padding:20px;text-align:center}
@media(max-width:600px){#app{padding:0 12px}#header{padding:10px 0}#content{padding:16px 0 12px}.option-btn{padding:14px 16px;font-size:1.05em}#var-content{max-height:160px}}`;
}

/**
 * 生成嵌入 JavaScript 游戏引擎。
 */
function generateJS(): string {
  // 注意：此函数生成 JS 代码字符串，会被 HTML 直接嵌入。
  // 使用分号连接的紧凑风格控制文件体积。
  return '(function(){' +
'\'use strict\';' +
'var S=JSON.parse(JSON.stringify(STORY));' +
'var st={vars:S.vars,cur:S.rootId||Object.keys(S.nodes)[0],crumb:[]};' +
'var root=S.nodes[st.cur];' +
'if(root)st.crumb.push({id:st.cur,title:root.title});' +
'function $(id){return document.getElementById(id)}' +
'var el=$(\'content\'),bc=$(\'breadcrumb\'),vct=$(\'var-content\'),vt=$(\'var-toggle\'),vp=$(\'var-panel\');' +
'function esc(s){var d=document.createElement(\'div\');d.textContent=s;return d.innerHTML}' +
'function getVar(n){if(n.includes(\'.\')){var p=n.split(\'.\'),v=st.vars;for(var i=0;i<p.length;i++){if(v==null||typeof v!==\'object\')return undefined;v=v[p[i]]}return v}return st.vars[n]}' +
'function setVar(n,v){if(n.includes(\'.\')){var p=n.split(\'.\'),c=st.vars;for(var i=0;i<p.length-1;i++){if(c[p[i]]==null||typeof c[p[i]]!==\'object\')c[p[i]]={};c=c[p[i]]}c[p[p.length-1]]=v}else{st.vars[n]=v}}' +
'function resolveOp(op){if(!op)return undefined;if(op.operandType===\'literal\')return op.literalValue;return getVar(op.variableName||\'\')}' +
'function evalCond(cond){if(!cond)return true;' +
'if(cond.type===\'comparison\'){var l=resolveOp(cond.left),r=resolveOp(cond.right);' +
'switch(cond.operator){case\'==\':return l==r;case\'!=\':return l!=r;case\'>\':return l>r;case\'<\':return l<r;case\'>=\':return l>=r;case\'<=\':return l<=r}return false}' +
'if(cond.type===\'logical\'){var ops=cond.operands||[];' +
'switch(cond.operator){case\'AND\':return ops.every(function(c){return evalCond(c)});' +
'case\'OR\':return ops.some(function(c){return evalCond(c)});' +
'case\'NOT\':return ops.length>0&&!evalCond(ops[0])}}return true}' +
'function applyEffects(eff){if(!eff||eff.length===0)return;' +
'for(var i=0;i<eff.length;i++){var e=eff[i],c=getVar(e.variableName);' +
'switch(e.operation){case\'set\':setVar(e.variableName,e.value);break;' +
'case\'add\':setVar(e.variableName,(typeof c===\'number\'?c:0)+(typeof e.value===\'number\'?e.value:0));break;' +
'case\'subtract\':setVar(e.variableName,(typeof c===\'number\'?c:0)-(typeof e.value===\'number\'?e.value:0));break;' +
'case\'append\':setVar(e.variableName,String(c||\'\')+String(e.value));break}}}' +
'function mdh(t){var h=esc(t);' +
'h=h.replace(/\\*\\*(.+?)\\*\\*/g,\'<strong>$1</strong>\');' +
'h=h.replace(/\\*(.+?)\\*/g,\'<em>$1</em>\');' +
'h=h.replace(/~~(.+?)~~/g,\'<s>$1</s>\');' +
'h=h.replace(/`([^`]+)`/g,\'<code>$1</code>\');' +
'return h.split(/\\n{2,}/).map(function(p){var s=p.trim();if(!s)return\'\';return\'<p>\'+s.replace(/\\n/g,\'<br>\')+\'</p>\'}).join(\'\')}' +
'function serCond(cond){if(!cond)return\'\';' +
'if(cond.type===\'comparison\'){' +
'var l=cond.left?((cond.left.operandType===\'variable\'?\'$\':\'\')+(cond.left.variableName||String(cond.left.literalValue||\'\'))):\'?\';' +
'var r=cond.right?((cond.right.operandType===\'variable\'?\'$\':\'\')+(cond.right.variableName||String(cond.right.literalValue||\'\'))):\'?\';' +
'return l+\' \'+cond.operator+\' \'+r}' +
'if(cond.type===\'logical\'){if(cond.operator===\'NOT\')return\'NOT (\'+serCond(cond.operands[0])+\')\';' +
'return cond.operands.map(function(c){return\'(\'+serCond(c)+\')\'}).join(\' \'+cond.operator+\' \')}return\'?\'}' +
'function render(){var node=S.nodes[st.cur];if(!node){el.innerHTML=\'<p class="error-msg">\\u8282\\u70b9\\u672a\\u627e\\u5230</p>\';renderBC();renderVars();return}' +
'if(st.cur===S.rootId&&st.crumb.length===1){el.innerHTML=\'<div class="start-screen"><h2>\'+esc(node.title)+\'</h2>\'+mdh(node.body)+\'<button class="start-btn" id="start-btn">\\u5f00\\u59cb\\u5192\\u9669</button></div>\';var sb=$(\'start-btn\');if(sb)sb.onclick=function(){renderNode(node)};renderBC();renderVars();return}' +
'renderNode(node)}' +
'function renderNode(node){el.innerHTML=\'<h2 style="font-size:1.3em;margin-bottom:16px;color:#e6edf3">\'+esc(node.title)+\'</h2><div id="node-body">\'+mdh(node.body)+\'</div><div id="options">\'+renderOpts(node)+\'</div>\';' +
'el.querySelectorAll(\'.option-btn:not([disabled])\').forEach(function(btn){btn.onclick=function(){var idx=parseInt(this.dataset.index);var opt=node.options[idx];if(opt)choose(opt)}});' +
'renderBC();renderVars();el.scrollIntoView({behavior:\'smooth\',block:\'start\'})}' +
'function renderOpts(node){if(!node.options||node.options.length===0)return\'<p class="dead-end">\\u2014\\u2014 \\u6545\\u4e8b\\u7ed3\\u675f \\u2014\\u2014</p>\';' +
'var h=\'\';for(var i=0;i<node.options.length;i++){var o=node.options[i],av=evalCond(o.condition);' +
'h+=\'<button class="option-btn\'+(av?\'\':\' option-disabled\')+\'" data-index="\'+i+\'"\'+(av?\'\':\' disabled\')+\'>\';' +
'if(!av)h+=\'<span class="lock-icon">\\ud83d\\udd12</span>\';' +
'h+=esc(o.text)+\'</button>\';' +
'if(!av&&o.conditionRaw){h+=\'<div class="condition-text">\'+esc(o.conditionRaw)+\'</div>\'}' +
'else if(!av&&o.condition){h+=\'<div class="condition-text">\'+esc(serCond(o.condition))+\'</div>\'}}return h}' +
'function choose(opt){if(!opt.target)return;applyEffects(opt.effects);st.cur=opt.target;' +
'var tn=S.nodes[opt.target];if(tn)st.crumb.push({id:opt.target,title:tn.title});render()}' +
'function renderBC(){var h=\'\';for(var i=0;i<st.crumb.length;i++){var c=st.crumb[i];' +
'if(i>0)h+=\'<span class="crumb-sep">\\u203a</span>\';' +
'if(i===st.crumb.length-1){h+=\'<span class="crumb-current">\'+esc(c.title)+\'</span>\'}' +
'else{h+=\'<a class="crumb-link" data-idx="\'+i+\'">\'+esc(c.title)+\'</a>\'}}' +
'bc.innerHTML=h;bc.querySelectorAll(\'.crumb-link\').forEach(function(el){el.onclick=function(){goCrumb(parseInt(this.dataset.idx))}})}' +
'function goCrumb(idx){if(idx<0||idx>=st.crumb.length)return;st.cur=st.crumb[idx].id;st.crumb=st.crumb.slice(0,idx+1);render()}' +
'function renderVars(){var h=\'<table class="var-table"><tbody>\';' +
'for(var k in st.vars){if(st.vars.hasOwnProperty(k)){var v=st.vars[k];' +
'if(v!==null&&typeof v===\'object\'&&!Array.isArray(v)){' +
'for(var sk in v){if(v.hasOwnProperty(sk)){h+=\'<tr><td class="var-key">\'+esc(k)+\'.\'+esc(sk)+\'</td><td class="var-val">\'+esc(String(v[sk]))+\'</td></tr>\'}}}' +
'else{h+=\'<tr><td class="var-key">\'+esc(k)+\'</td><td class="var-val">\'+esc(String(v))+\'</td></tr>\'}}}' +
'h+=\'</tbody></table>\';vct.innerHTML=h}' +
'vt.onclick=function(){vp.classList.toggle(\'collapsed\');vt.textContent=vp.classList.contains(\'collapsed\')?\'\\ud83d\\udcca \\u53d8\\u91cf\':\'\\ud83d\\udcca \\u53d8\\u91cf \\u25bc\'};' +
'render()})()';
}

// ============================================================================
// 主导出函数
// ============================================================================

/**
 * 将 PlotFlowData 导出为可游玩的自包含 HTML 字符串。
 *
 * HTML 特性：
 * - 自包含文件，内嵌 CSS + JS，浏览器直接打开即可游玩
 * - 暗色主题，桌面 + 移动端响应式
 * - 节点文章渲染为基础 Markdown HTML
 * - 选项按钮（绿色可用，灰色锁定带 🔒 图标和条件说明）
 * - 条件评估引擎（递归 AST 求值，支持 AND/OR/NOT + 比较）
 * - 变量即时更新（选项触发效果后实时反映）
 * - 面包屑导航（顶部显示路径，可点击回溯）
 * - 底部可折叠变量面板（实时显示所有变量值）
 * - 所有用户文本 HTML 转义（防 XSS）
 * - 不含用户文本部分 ≤ 50KB
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns ParseResult — ok 携带 HTML 字符串，fail 携带诊断信息
 *
 * @throws 不抛异常，所有错误通过返回值 ok: false 表示
 */
export function exportHTML(data: PlotFlowData): ParseResult<string> {
  // 验证是否有可导出的节点
  const totalNodes = data.chapters.reduce((sum, ch) => sum + ch.nodes.length, 0);
  if (totalNodes === 0) {
    return failure([
      {
        id: 'E005@export-html',
        code: 'E005',
        severity: 'error',
        message: '没有可导出的故事节点',
        detail: '故事中至少需要包含一个节点才能导出为 HTML。请先添加章节和节点内容。',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
      },
    ]);
  }

  // 构建运行时 JSON
  const runtimeJson: string = buildRuntimeJson(data);

  // 生成 HTML
  const html: string = generateHTML(data.meta.title, runtimeJson);

  return success(html);
}

/**
 * 组装完整的 HTML 文档字符串。
 */
function generateHTML(title: string, runtimeJson: string): string {
  const escapedTitle = escapeHtml(title || 'PlotFlow Story');
  const css = generateCSS();
  const js = generateJS();

  // 构造完整的 HTML
  return '<!DOCTYPE html>\n'
    + '<html lang="zh-CN">\n'
    + '<head>\n'
    + '<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">\n'
    + '<title>' + escapedTitle + '</title>\n'
    + '<style>\n' + css + '\n</style>\n'
    + '</head>\n'
    + '<body>\n'
    + '<div id="app">\n'
    + '  <header id="header">\n'
    + '    <div id="story-title">' + escapedTitle + '</div>\n'
    + '    <nav id="breadcrumb"></nav>\n'
    + '  </header>\n'
    + '  <main id="content"></main>\n'
    + '</div>\n'
    + '<aside id="var-panel" class="collapsed">\n'
    + '  <button id="var-toggle">📊 变量</button>\n'
    + '  <div id="var-content"></div>\n'
    + '</aside>\n'
    + '<script>\n'
    + 'var STORY = ' + runtimeJson + ';\n'
    + js + '\n'
    + '</script>\n'
    + '</body>\n'
    + '</html>';
}
