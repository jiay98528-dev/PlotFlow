/**
 * Graph Lab 与 Split 条件面板共享的条件树编辑 API。
 *
 * 实现暂与历史 ConditionEditor 同文件保存，以避免两套 Builder 逻辑漂移；
 * 消费方统一从本模块导入，后续可在不改公共接口的前提下移动实现。
 */
export {
  ConditionTreeEditor,
  builderToConditionNode,
  conditionNodeToBuilder,
  serializeConditionExpression,
  type ConditionGroup,
  type ConditionRow,
  type ConditionTreeEditorProps,
} from '../panels/ConditionEditor';

