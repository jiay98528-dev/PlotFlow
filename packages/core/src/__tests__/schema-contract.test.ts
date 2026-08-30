import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { exportJSON, parseStory } from '../index.js';

type JsonObject = Record<string, unknown>;

function readJson(relativeUrl: string): JsonObject {
  return JSON.parse(readFileSync(new URL(relativeUrl, import.meta.url), 'utf8')) as JsonObject;
}

function asObject(value: unknown, label: string): JsonObject {
  expect(value, label).toBeTypeOf('object');
  expect(value, label).not.toBeNull();
  expect(Array.isArray(value), label).toBe(false);
  return value as JsonObject;
}

function asArray(value: unknown, label: string): unknown[] {
  expect(Array.isArray(value), label).toBe(true);
  return value as unknown[];
}

function asStringArray(value: unknown, label: string): string[] {
  const values = asArray(value, label);
  expect(values.every((item) => typeof item === 'string'), label).toBe(true);
  return values as string[];
}

function definition(schema: JsonObject, name: string): JsonObject {
  const definitions = asObject(schema['$defs'], '$defs');
  return asObject(definitions[name], `$defs.${name}`);
}

function properties(schema: JsonObject): JsonObject {
  return asObject(schema['properties'], 'properties');
}

function variableVariant(schema: JsonObject, type: string): JsonObject {
  const variants = asArray(schema['oneOf'], 'VariableDef.oneOf');
  const match = variants.find((candidate) => {
    const variantProperties = properties(asObject(candidate, `VariableDef.${type}`));
    return asObject(variantProperties['type'], `${type}.type`)['const'] === type;
  });
  expect(match, `VariableDef variant ${type}`).toBeDefined();
  return asObject(match, `VariableDef.${type}`);
}

const schema01 = readJson('../../schema/0.1/story.json');
const schema02 = readJson('../../schema/0.2/story.json');

describe('machine-readable PlotFlow story schemas', () => {
  it('freezes the historical 0.1 Option contract', () => {
    expect(schema01['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema01['$id']).toBe('https://plotflow.dev/schema/0.1/story.json');

    const option = definition(schema01, 'Option');
    const optionProperties = properties(option);
    const required = asStringArray(option['required'], '0.1 Option.required');

    expect(required).toEqual(['index', 'text', 'conditions', 'sideEffects']);
    expect(optionProperties).not.toHaveProperty('targetChapterId');
    expect(asObject(optionProperties['targetFullId'], '0.1 targetFullId')['type'])
      .toEqual(['string', 'null']);
  });

  it('defines the breaking 0.2 cross-chapter Option contract', () => {
    expect(schema02['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema02['$id']).toBe('https://plotflow.dev/schema/0.2/story.json');
    expect(asObject(properties(schema02)['$schema'], '0.2 instance $schema')['const'])
      .toBe('https://plotflow.dev/schema/0.2/story.json');

    const option = definition(schema02, 'Option');
    const optionProperties = properties(option);
    const required = asStringArray(option['required'], '0.2 Option.required');

    expect(required).toContain('targetChapterId');
    expect(required).toContain('targetFullId');
    expect(asObject(optionProperties['targetChapterId'], 'targetChapterId')['type'])
      .toEqual(['string', 'null']);
    expect(asObject(optionProperties['targetFullId'], 'targetFullId')['type']).toEqual(['string', 'null']);
    expect(asObject(optionProperties['targetNodeId'], 'targetNodeId')['type']).toEqual(['string', 'null']);
  });

  it('preserves both typed comparison operands in Schema 0.2', () => {
    const comparison = definition(schema02, 'Comparison');
    expect(asStringArray(comparison['required'], 'Comparison.required'))
      .toEqual(['type', 'left', 'operator', 'right']);
    expect(properties(comparison)).not.toHaveProperty('variable');
    expect(properties(comparison)).not.toHaveProperty('value');
    expect(definition(schema02, 'Operand')['oneOf']).toBeDefined();
  });

  it('constrains engines and keeps node full IDs as non-empty strings', () => {
    const meta = definition(schema02, 'Meta');
    const engine = asObject(properties(meta)['engine'], 'Meta.engine');
    expect(engine['enum']).toEqual(['godot', 'unity', 'unreal', 'none']);

    const node = definition(schema02, 'Node');
    const fullId = asObject(properties(node)['fullId'], 'Node.fullId');
    expect(fullId).toMatchObject({ type: 'string', minLength: 1 });
  });

  it('requires chapter ownership exactly when a variable has chapter scope', () => {
    const variableDef = definition(schema02, 'TopLevelVariableDef');
    const rules = asArray(variableDef['allOf'], 'VariableDef.allOf');
    const conditionalRule = rules.find((rule) => 'if' in asObject(rule, 'VariableDef.allOf item'));
    expect(conditionalRule).toBeDefined();
    const conditional = asObject(conditionalRule, 'VariableDef chapter-scope conditional');
    const ifSchema = asObject(conditional['if'], 'VariableDef.if');
    const thenSchema = asObject(conditional['then'], 'VariableDef.then');
    const elseSchema = asObject(conditional['else'], 'VariableDef.else');

    expect(asStringArray(ifSchema['required'], 'VariableDef.if.required')).toContain('scope');
    expect(asObject(properties(ifSchema)['scope'], 'VariableDef.if.scope')['const']).toBe('chapter');
    expect(asStringArray(thenSchema['required'], 'VariableDef.then.required')).toContain('chapter');
    expect(asStringArray(
      asObject(elseSchema['not'], 'VariableDef.else.not')['required'],
      'VariableDef.else.not.required',
    )).toContain('chapter');
  });

  it('requires object fields while explicitly allowing an empty field map', () => {
    const variableShape = definition(schema02, 'VariableShape');
    const objectVariant = variableVariant(variableShape, 'object');
    expect(asStringArray(objectVariant['required'], 'object.required')).toContain('fields');

    const fields = asObject(properties(objectVariant)['fields'], 'object.fields');
    expect(fields).toMatchObject({ type: 'object', minProperties: 0 });
    expect(fields).toHaveProperty('additionalProperties');
  });

  it('keeps scope and chapter on top-level variables only', () => {
    const topLevel = definition(schema02, 'TopLevelVariableDef');
    const field = definition(schema02, 'FieldDef');
    const shape = definition(schema02, 'VariableShape');

    expect(properties(topLevel)).toHaveProperty('scope');
    expect(properties(topLevel)).toHaveProperty('chapter');
    expect(properties(shape)).not.toHaveProperty('scope');
    expect(properties(shape)).not.toHaveProperty('chapter');
    expect(field['unevaluatedProperties']).toBe(false);
    expect(field['allOf']).toEqual([{ $ref: '#/$defs/VariableShape' }]);
  });

  it.each(['0.1', '0.2'])('keeps the website %s schema byte-identical to core', (version) => {
    const core = readFileSync(new URL(`../../schema/${version}/story.json`, import.meta.url));
    const website = readFileSync(
      new URL(`../../../../website/public/schema/${version}/story.json`, import.meta.url),
    );
    expect(website.equals(core)).toBe(true);
  });

  it('validates a real exporter result against schema 0.2 with Ajv', () => {
    const parsed = parseStory(`---
engine: generic
vars:
  coins: int
  bag:
    type: object
    fields: {}
---
# Chapter
## 节点：Start
Body.
[选项] Wait -> 节点：End
[选项] Continue -> 节点：End
  条件: 5 < $coins
## 节点：End
Done.
`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const exported = exportJSON(parsed.data);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const ajv = new Ajv2020({ strict: true, allErrors: true });
    ajv.addFormat('date-time', {
      type: 'string',
      validate: (value: string) => Number.isFinite(Date.parse(value)),
    });
    const validate = ajv.compile(schema02);
    const valid = validate(JSON.parse(exported.data));
    expect(validate.errors).toEqual(null);
    expect(valid).toBe(true);

    const payload = JSON.parse(exported.data) as {
      chapters: Array<{ nodes: Array<{ options: Array<{ conditions?: { ast?: unknown } }> }> }>;
    };
    expect(payload.chapters[0]?.nodes[0]?.options[1]?.conditions?.ast).toEqual({
      type: 'comparison',
      left: { type: 'literal', value: 5 },
      operator: '<',
      right: { type: 'variable', name: 'coins' },
    });
  });
});
