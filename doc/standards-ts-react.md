# TypeScript 与 React 维护规范

> 文档导航：[工程规则与架构索引](indexes/engineering.md) · [总索引](INDEX.md)

## 类型与模块

根 [tsconfig.json](../tsconfig.json) 启用 strict、noUncheckedIndexedAccess、noUnusedLocals 等约束。公共数据合同在 [Core AST 类型](../packages/core/src/types/ast.ts)，诊断合同在 [diagnostic.ts](../packages/core/src/types/diagnostic.ts)，不要复制一套私有类型绕过它们。

跨模块输入先验证后使用。结果类型沿用现有 ParseResult、tagged union 与错误处理模式，不用 any 或无依据的类型断言掩盖分支。

Core 不依赖 Electron、React 或浏览器 DOM；桌面业务放在 app 服务层。项目内导入优先相对路径，workspace 包继续使用 @plotflow/core。保留 plotflow 技术命名空间以兼容旧文件和引擎。

## React 与 Zustand

- 复用 React 18 函数组件和现有 Hooks；副作用需清理订阅、事件与计时器。
- 从 Zustand 选择所需字段，避免无关状态变化引发整页订阅。
- 组件展示与业务命令分离。Graph 修改通过故事服务生成文本事务，再刷新解析与投影。
- 自定义 React Flow 节点沿用 React.FC<NodeProps>；状态用语义类名和主题 token 表达。
- Inspector 的未提交输入与已提交 AST 分开管理；提交拒绝时保留输入，不静默回滚成旧故事内容。

## 会话、异步与 IPC

异步读取、保存和解析结果绑定 storySessionId / revision / 路径。故事切换后，旧回调不能写入新会话。保存、导出、模式切换和替换故事先协调 Source Drawer 草稿。交互租约、事务与撤销的完整关系见 [TAD](TAD.md)。

IPC 使用共享通道名与 preload 类型；主进程校验调用来源和参数。文件对话框取消、用户拒绝、读取失败和保存失败分别处理，不把取消显示为成功。

## 可访问性与样式

所有主要控件提供可访问名称、键盘路径与可见焦点。弹窗和 Portal 下拉共享焦点域，背景快捷键不能穿透。用户界面文案走现有 i18n，颜色与层级走主题 token；详见 [CSS 规范](standards-css.md) 和 [桌面 UX](../spec/design-brief-editor-ux.md)。

## 检查

ESLint 的真实规则见 [.eslintrc.cjs](../.eslintrc.cjs)，格式见 [.prettierrc](../.prettierrc)。普通修改运行与改动相关的测试和类型检查；Windows GUI 测试使用后台隔离入口，不抢占用户桌面。检查结果记录在开发状态，不写进代码规范。

注释说明约束、原因和公共 API，避免复制易过期的行号、里程碑进度或整段实现。API 改动同步对应数据合同和受影响的文档索引。
