import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..', '..');
const FIXTURE_DIR = path.join(TEST_DIR, 'fixtures');

async function readJson(name) {
  return JSON.parse(await readFile(path.join(FIXTURE_DIR, name), 'utf8'));
}

async function readSource(relativePath) {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

function isSupportedVersion(version) {
  return version === '0.1' || version === '0.2'
    || version.startsWith('0.1.') || version.startsWith('0.2.');
}

function readSchemaVersion(data) {
  const schema = String(data?.$schema ?? '');
  const match = schema.match(/\/schema\/([^/]+)/);
  if (match) return match[1];
  return String(data?.meta?.plotflow ?? '0.1');
}

function loadContract(data) {
  const warnings = [];
  const version = readSchemaVersion(data);
  if (!isSupportedVersion(version)) {
    warnings.push(`Story version '${version}' is newer or unknown; supported fields only`);
  }

  const nodes = new Map();
  const localIds = new Map();
  for (const chapter of data.chapters ?? []) {
    for (const node of chapter.nodes ?? []) {
      // The key is copied verbatim. No separator parsing or reconstruction.
      nodes.set(node.fullId, { ...node, chapterId: node.chapterId ?? chapter.id });
      const candidates = localIds.get(node.id) ?? [];
      candidates.push(node.fullId);
      localIds.set(node.id, candidates);
    }
  }

  return {
    version,
    warnings,
    nodes,
    getNode(id) {
      if (nodes.has(id)) return nodes.get(id);
      const candidates = localIds.get(id) ?? [];
      return candidates.length === 1 ? nodes.get(candidates[0]) : undefined;
    },
    resolveOption(option) {
      return option?.targetFullId ? nodes.get(option.targetFullId) : undefined;
    },
  };
}

class ScopedVariableStore {
  constructor(definitions) {
    this.definitions = definitions ?? {};
    this.globals = {};
    this.chapters = new Map();
    this.currentChapterId = '';
    for (const [name, definition] of Object.entries(this.definitions)) {
      if ((definition.scope ?? 'global') !== 'chapter') this.globals[name] = structuredClone(definition.default);
    }
  }

  setCurrentChapter(chapterId) {
    this.currentChapterId = chapterId;
    if (!this.chapters.has(chapterId)) {
      const values = {};
      for (const [name, definition] of Object.entries(this.definitions)) {
        if (definition.scope === 'chapter' && this.canAccess(name, chapterId)) {
          values[name] = structuredClone(definition.default);
        }
      }
      this.chapters.set(chapterId, values);
    }
  }

  get(name) {
    const definition = this.definitions[name];
    if (!this.canAccess(name)) return undefined;
    if (definition?.scope === 'chapter') return this.chapters.get(this.currentChapterId)?.[name];
    return this.globals[name];
  }

  set(name, value) {
    const definition = this.definitions[name];
    if (!this.canAccess(name)) return false;
    if (definition?.scope === 'chapter') this.chapters.get(this.currentChapterId)[name] = value;
    else this.globals[name] = value;
    return true;
  }

  canAccess(name, chapterId = this.currentChapterId) {
    const definition = this.definitions[name];
    return definition?.scope !== 'chapter' || !definition.chapter || definition.chapter === chapterId;
  }
}

function resolveOperand(operand, variables) {
  if (!operand || typeof operand !== 'object') return { found: false };
  if (operand.type === 'literal') return { found: Object.hasOwn(operand, 'value'), value: operand.value };
  if (operand.type === 'variable') {
    const value = variables.get(operand.name.replace(/^\$/, ''));
    return { found: value !== undefined, value };
  }
  return { found: false };
}

function evaluateComparison(ast, variables) {
  let left;
  let right;
  if ('left' in ast || 'right' in ast) {
    left = resolveOperand(ast.left, variables);
    right = resolveOperand(ast.right, variables);
  } else {
    const value = variables.get(String(ast.variable ?? '').replace(/^\$/, ''));
    left = { found: value !== undefined, value };
    right = { found: Object.hasOwn(ast, 'value'), value: ast.value };
  }
  if (!left.found || !right.found) return false;
  switch (ast.operator) {
    case '==': return left.value === right.value;
    case '!=': return left.value !== right.value;
    case '>': return left.value > right.value;
    case '>=': return left.value >= right.value;
    case '<': return left.value < right.value;
    case '<=': return left.value <= right.value;
    default: return false;
  }
}

function canResolveOperand(operand, variables) {
  if (!operand || typeof operand !== 'object') return false;
  if (operand.type === 'literal') return Object.hasOwn(operand, 'value');
  if (operand.type === 'variable') return variables.get(operand.name.replace(/^\$/, '')) !== undefined;
  return false;
}

function canResolveAst(ast, variables) {
  if (!ast || typeof ast !== 'object') return false;
  if (ast.type === 'logical_and' || ast.type === 'logical_or') {
    return canResolveAst(ast.left, variables) && canResolveAst(ast.right, variables);
  }
  if (ast.type === 'logical_not') return canResolveAst(ast.operand, variables);
  if (ast.type === 'comparison') {
    if ('left' in ast || 'right' in ast) {
      return canResolveOperand(ast.left, variables) && canResolveOperand(ast.right, variables);
    }
    return variables.get(String(ast.variable ?? '').replace(/^\$/, '')) !== undefined;
  }
  return true;
}

function evaluateAst(ast, variables) {
  if (!canResolveAst(ast, variables)) return false;
  if (ast.type === 'logical_not') return !evaluateAst(ast.operand, variables);
  if (ast.type === 'logical_and') return evaluateAst(ast.left, variables) && evaluateAst(ast.right, variables);
  if (ast.type === 'logical_or') return evaluateAst(ast.left, variables) || evaluateAst(ast.right, variables);
  if (ast.type === 'comparison') return evaluateComparison(ast, variables);
  return false;
}

function assertBalanced(source, open, close, label) {
  const opens = [...source].filter((character) => character === open).length;
  const closes = [...source].filter((character) => character === close).length;
  assert.equal(opens, closes, `${label}: unbalanced ${open}${close}`);
}

for (const fixtureName of ['story-0.1.json', 'story-0.2.json']) {
  test(`${fixtureName}: chapters, opaque fullId, target chapter and scoped variables`, async () => {
    const fixture = await readJson(fixtureName);
    const loaded = loadContract(fixture);
    assert.deepEqual(loaded.warnings, []);
    assert.equal(loaded.version, fixtureName.includes('0.2') ? '0.2' : '0.1');
    if (fixtureName.includes('0.2')) {
      assert.equal(fixture.meta.plotflow, '0.1', '$schema must take precedence over fixed meta.plotflow');
    }
    assert.equal(loaded.nodes.size, 2);

    const alphaFullId = 'pf://chapter%2Falpha::node%2Fentry?rev=1';
    const betaFullId = 'opaque+plotflow://beta%2Fentry#node';
    const alpha = loaded.getNode(alphaFullId);
    assert.equal(alpha?.fullId, alphaFullId);
    assert.equal(loaded.getNode('entry'), undefined, 'ambiguous local id must fail closed');
    assert.equal(alpha.options[0].targetChapterId, 'chapter/beta');
    assert.equal(loaded.resolveOption(alpha.options[0])?.fullId, betaFullId);
    if (fixtureName.includes('0.2')) {
      assert.deepEqual(alpha.options[0].conditions.ast.left, { type: 'literal', value: 10 });
      assert.deepEqual(alpha.options[0].conditions.ast.right, { type: 'variable', name: 'coins' });
    } else {
      assert.equal(alpha.options[0].conditions.ast.variable, 'coins');
      assert.equal(alpha.options[0].conditions.ast.value, 10);
    }

    const variables = new ScopedVariableStore(fixture.variables);
    variables.setCurrentChapter('chapter/alpha');
    assert.equal(evaluateAst(alpha.options[0].conditions.ast, variables), true);
    assert.equal(variables.set('chapterFlag', true), true);
    assert.equal(variables.set('coins', 11), true);
    variables.setCurrentChapter('chapter/beta');
    assert.equal(variables.get('chapterFlag'), undefined, 'owned chapter value must be inaccessible');
    assert.equal(variables.set('chapterFlag', false), false, 'cross-chapter writes must be denied');
    assert.equal(evaluateAst({
      type: 'logical_not',
      operand: { type: 'comparison', variable: 'chapterFlag', operator: '==', value: true },
    }, variables), false, 'NOT must not turn an unauthorized lookup into true');
    assert.equal(variables.get('betaFlag'), false, 'beta-owned value must initialize in beta only');
    assert.equal(variables.get('coins'), 11, 'global values must cross chapters');
    variables.setCurrentChapter('chapter/alpha');
    assert.equal(variables.get('chapterFlag'), true, 'owned value must persist for the session');
    assert.equal(variables.get('betaFlag'), undefined);
  });
}

test('higher schema warns but still loads supported fields', async () => {
  const fixture = await readJson('story-0.3-forward.json');
  const loaded = loadContract(fixture);
  assert.equal(loaded.warnings.length, 1);
  assert.match(loaded.warnings[0], /0\.3.*newer or unknown/);
  assert.equal(loaded.nodes.size, 2);
  assert.equal(
    loaded.resolveOption(loaded.getNode('pf://chapter%2Falpha::node%2Fentry?rev=1').options[0])?.title,
    'Beta Entry',
  );
});

test('Godot source follows the executable fixture contract', async () => {
  const loader = await readSource('addons/plotflow/runtime/StoryLoader.gd');
  const node = await readSource('addons/plotflow/runtime/StoryNode.gd');
  const store = await readSource('addons/plotflow/runtime/VariableStore.gd');
  const condition = await readSource('addons/plotflow/runtime/ConditionEval.gd');

  assert.match(loader, /data\.get\("chapters"/);
  assert.match(loader, /nodes\[node\.full_id\] = node/);
  assert.match(node, /opt\.get\("targetChapterId"/);
  assert.match(node, /opt\.get\("targetFullId"/);
  assert.match(store, /var _global_vars: Dictionary/);
  assert.match(store, /var _chapter_vars: Dictionary/);
  assert.match(store, /func set_current_chapter/);
  assert.match(loader, /version == "0\.1" or version == "0\.2"/);
  assert.match(loader, /data\.get\("\$schema"/);
  assert.match(loader, /func _read_schema_version/);
  assert.match(loader, /newer or unknown/);
  assert.match(node, /"conditions": _duplicate_condition/);
  assert.match(condition, /comparison\.has\("left"\)/);
  assert.match(condition, /_resolve_operand/);
  assert.match(condition, /_ast_variables_accessible/);
  assert.match(condition, /"literal"/);
  assert.match(condition, /"variable"/);
  assert.match(store, /_chapter_owners/);
  assert.match(store, /_warn_unauthorized/);
  assert.match(store, /func apply_effects/);
  assert.doesNotMatch(loader + node, /full_id[^\n]*\.split|\.split\([^\n]*full_id/i);
  assert.doesNotMatch(condition, /static\s+fn\b/);
});

test('Unity source has explicit JSON and scope-aware APIs while retaining Dictionary entry points', async () => {
  const models = await readSource('plugins/unity/IPlotFlowReader.cs');
  const reader = await readSource('plugins/unity/PlotFlowJsonReader.cs');
  const store = await readSource('plugins/unity/PlotFlowVariableStore.cs');

  assert.match(models, /\[JsonProperty\("chapters"\)\]/);
  assert.match(models, /\[JsonProperty\("nodes"\)\]/);
  assert.match(models, /\[JsonProperty\("default"\)\]/);
  assert.match(models, /\[JsonProperty\("targetChapterId"\)\][\s\S]*TargetChapterId/);
  assert.match(models, /GetAvailableOptions\(string nodeId, Dictionary<string, object> variables\)/);
  assert.match(models, /IPlotFlowScopedReader/);
  assert.match(reader, /_nodeIndex\[node\.FullId\] = node/);
  assert.match(reader, /WarnForSchemaVersion/);
  assert.match(reader, /ReadSchemaVersion/);
  assert.match(reader, /data\?\.SchemaVersion/);
  assert.match(reader, /parsed\.Minor > 2/);
  assert.match(reader, /comp\["left"\]/);
  assert.match(reader, /ResolveOperand/);
  assert.match(reader, /CanResolveAllVariables/);
  assert.match(reader, /TryResolveVariablePath/);
  assert.match(store, /class PlotFlowVariableStore/);
  assert.match(store, /CurrentChapterId/);
  assert.match(store, /_globalValues/);
  assert.match(store, /_chapterValues/);
  assert.match(store, /ImportLegacyDictionary/);
  assert.match(store, /CanAccess/);
  assert.match(store, /TrySet/);
  assert.match(reader, /Cannot apply effect to chapter variable/);
  assert.doesNotMatch(reader + store, /FullId\.Split|TargetFullId\.Split/);
  assertBalanced(models, '{', '}', 'IPlotFlowReader.cs');
  assertBalanced(reader, '{', '}', 'PlotFlowJsonReader.cs');
  assertBalanced(store, '{', '}', 'PlotFlowVariableStore.cs');
});

test('Unreal data and Blueprint reference contracts expose current chapter semantics', async () => {
  const types = await readSource('plugins/unreal/PlotFlowDataTypes.h');
  const blueprint = await readSource('plugins/unreal/BPI_PlotFlowReader.uasset.md');

  assert.match(types, /struct FPlotFlowChapter/);
  assert.match(types, /struct FPlotFlowVariableStore/);
  assert.match(types, /FString CurrentChapterId/);
  assert.match(types, /FString TargetChapterId/);
  assert.match(types, /ParseStoryFromJson/);
  assert.match(types, /BuildEffectiveVariables/);
  assert.match(blueprint, /chapters\[\]\.nodes\[\]/);
  assert.match(blueprint, /opaque key/);
  assert.match(blueprint, /0\.1\/0\.2/);
  assert.match(blueprint, /更高版本.*warning/);
  assertBalanced(types, '{', '}', 'PlotFlowDataTypes.h');
});
