export type BuiltinTemplateId =
  | 'blank'
  | 'rpg-dialogue'
  | 'visual-novel'
  | 'puzzle-escape'
  | 'godot-example';

export interface BuiltinTemplate {
  readonly id: BuiltinTemplateId;
  readonly titleKey: string;
  readonly title: string;
  readonly description: string;
  readonly nodeCount: number;
  readonly engine: 'generic' | 'godot';
  readonly accent: 'heading' | 'option' | 'condition' | 'target';
  readonly content: string;
}

const blankTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "{{engine}}"
vars:
---

# 第一章

## 节点：开始
写下第一个场景。
`;

const rpgDialogueTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "{{engine}}"
vars:
  信任度: int
  金币: int
  阵营: enum[外来者, 村民, 商会]
---

# 村口黄昏

## 节点：村口
夕阳压在木栅栏上，守卫把长矛横在你胸前。
[选项] 说明自己只是路过 -> 节点：守卫盘问
  效果: (信任度+1)
[选项] 塞给守卫两枚金币 -> 节点：侧门
  条件: $金币 >= 2
  效果: (金币-2, 信任度+2)

## 节点：守卫盘问
守卫眯起眼，问你是否见过北边燃起的黑烟。
[选项] 承认看见了黑烟 -> 节点：黑烟传闻
  效果: (信任度+1)
[选项] 装作什么都不知道 -> 节点：酒馆

## 节点：侧门
守卫收下金币，示意你从磨坊后的小门进去。
[选项] 直接去酒馆打听消息 -> 节点：酒馆
[选项] 先去仓库观察 -> 节点：仓库

## 节点：黑烟传闻
守卫压低声音，说那是旧矿坑重新开门的信号。
[选项] 请求加入巡逻队 -> 节点：巡逻邀请
  条件: $信任度 >= 2
  效果: (阵营='村民')
[选项] 独自调查矿坑 -> 节点：仓库

## 节点：酒馆
酒馆里炉火很旺，老板娘正在擦一只裂口杯。
[选项] 询问矿坑的事 -> 节点：仓库
[选项] 留下休息 -> 节点：夜宿

## 节点：仓库
仓库门缝里透出蓝色火光，地上有新鲜泥印。
[选项] 撬门进去 -> 节点：巡逻邀请
  条件: $信任度 >= 1
[选项] 回酒馆找人帮忙 -> 节点：酒馆

## 节点：巡逻邀请
村长把一枚铜徽章按进你掌心，巡逻队今晚就出发。
[选项] 接受任务 -> 节点：夜宿
  效果: (阵营='村民')

## 节点：夜宿
夜色落下，村外的黑烟像一根钉子钉在天边。
`;

const visualNovelTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "{{engine}}"
vars:
  好感度: int
  约定: bool
  路线: enum[未定, 天台, 图书馆]
---

# 放学后的风

## 节点：走廊
最后一节课的铃声散去，走廊里只剩夕光和粉笔灰。
[选项] 去天台透气 -> 节点：天台
  效果: (路线='天台')
[选项] 去图书馆还书 -> 节点：图书馆
  效果: (路线='图书馆')

## 节点：天台
她靠在栏杆边，手里捏着一张没有投出的明信片。
[选项] 问她明信片要寄给谁 -> 节点：明信片
  效果: (好感度+1)
[选项] 安静地站在旁边 -> 节点：晚风

## 节点：图书馆
管理员已经关掉一半灯，你在借阅台旁遇见她。
[选项] 帮她找遗失的书签 -> 节点：明信片
  效果: (好感度+1)
[选项] 先把自己的书还掉 -> 节点：晚风

## 节点：明信片
她笑了一下，说这张卡片其实一直没写收件人。
[选项] 提议一起写完它 -> 节点：约定
  条件: $好感度 >= 1
  效果: (约定=true)
[选项] 把话题岔开 -> 节点：晚风

## 节点：约定
你们约好明天放学后再见，信纸被晚霞染成金色。
[选项] 结束这一幕 -> 节点：晚风

## 节点：晚风
校门慢慢合上，今天的选择已经在心里留下回声。
`;

const puzzleEscapeTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "{{engine}}"
vars:
  钥匙: bool
  电源: bool
  密码: int
  线索: int
  出口: enum[未知, 北门, 地下室]
---

# 密室

## 节点：醒来
你在一间没有窗的房间醒来，墙上的时钟停在 03:17。
[选项] 检查书桌 -> 节点：书桌
[选项] 检查铁门 -> 节点：铁门
[选项] 查看配电箱 -> 节点：配电箱

## 节点：书桌
抽屉里有半张旧地图，背面写着一串被划掉的数字。
[选项] 翻找抽屉底部 -> 节点：钥匙盒
  效果: (线索+1)
[选项] 记录数字 317 -> 节点：数字锁
  效果: (密码=317)

## 节点：钥匙盒
盒子没有上锁，里面放着一把沾灰的小钥匙。
[选项] 拿走钥匙 -> 节点：书桌
  效果: (钥匙=true)

## 节点：配电箱
配电箱的开关被胶带封住，旁边贴着警告纸条。
[选项] 撕开胶带合上开关 -> 节点：灯亮
  条件: $线索 >= 1
  效果: (电源=true)
[选项] 回到房间中央 -> 节点：醒来

## 节点：灯亮
灯管闪烁后稳定下来，北墙露出一块新的数字面板。
[选项] 走向数字面板 -> 节点：数字锁
[选项] 检查地板暗门 -> 节点：地下室入口

## 节点：数字锁
面板要求输入三位数字，按键磨损最严重的是 3、1、7。
[选项] 输入 317 -> 节点：北门
  条件: $电源 == true AND $密码 == 317
  效果: (出口='北门')
[选项] 暂时离开 -> 节点：醒来

## 节点：铁门
铁门外传来水滴声，门锁像是老式机械结构。
[选项] 用小钥匙试锁 -> 节点：地下室入口
  条件: $钥匙 == true
  效果: (出口='地下室')
[选项] 放弃硬开 -> 节点：醒来

## 节点：地下室入口
暗门下方有潮湿的台阶，空气里有铁锈味。
[选项] 沿台阶下去 -> 节点：地下室

## 节点：地下室
地下室尽头的梯子通向街边排水口。
[选项] 爬出去 -> 节点：逃脱

## 节点：北门
北墙的门滑开，冷空气扑面而来。
[选项] 走出去 -> 节点：逃脱

## 节点：逃脱
你回头看见灯光一盏盏熄灭，房间重新沉入黑暗。
`;

const godotTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "godot"
vars:
  courage: int
  has_lantern: bool
  route: enum[village, cave, shrine]
---

# Godot 示例

## 节点：Start
The player stands at the edge of a quiet village.
[选项] Talk to the elder -> 节点：Elder
  效果: (route='village')
[选项] Enter the cave -> 节点：CaveGate
  条件: $courage >= 1
  效果: (route='cave')

## 节点：Elder
The elder offers a lantern and points toward the old shrine.
[选项] Accept the lantern -> 节点：ShrinePath
  效果: (has_lantern=true, courage+1)
[选项] Ask about the cave -> 节点：CaveGate

## 节点：CaveGate
Cold air rolls out of the cave mouth.
[选项] Light the lantern and enter -> 节点：CaveDepths
  条件: $has_lantern == true
[选项] Return to the village -> 节点：Elder

## 节点：ShrinePath
Stone markers lead into a cedar grove.
[选项] Follow the markers -> 节点：Shrine
  效果: (route='shrine')
[选项] Cut across the ridge -> 节点：CaveDepths

## 节点：Shrine
A sealed bell waits beneath the roof beams.
[选项] Ring the bell -> 节点：Signal
  条件: $courage >= 2
[选项] Leave quietly -> 节点：Start

## 节点：CaveDepths
Crystals pulse with a rhythm that matches the player's steps.
[选项] Take a crystal shard -> 节点：Signal
  效果: (courage+1)
[选项] Retreat -> 节点：CaveGate

## 节点：Signal
The bell and the crystal answer each other across the valley.
[选项] Return to the elder -> 节点：Resolve

## 节点：Resolve
The elder marks the player's map with the next destination.
[选项] Save the result -> 节点：ExportHook

## 节点：ExportHook
This node is meant for the Godot runtime loader demo.
[选项] Finish sample -> 节点：End

## 节点：End
The sample story ends here.
`;

export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  {
    id: 'blank',
    titleKey: 'dialogs.blankFile',
    title: '空白文件',
    description: '最小可编辑结构，适合从零写一个场景。',
    nodeCount: 1,
    engine: 'generic',
    accent: 'heading',
    content: blankTemplate,
  },
  {
    id: 'rpg-dialogue',
    titleKey: 'templates.rpg',
    title: 'RPG 对话',
    description: '村庄入口、守卫盘问和阵营变量，展示条件与效果。',
    nodeCount: 8,
    engine: 'generic',
    accent: 'option',
    content: rpgDialogueTemplate,
  },
  {
    id: 'visual-novel',
    titleKey: 'templates.visualNovel',
    title: '视觉小说',
    description: '放学后的双路线片段，适合轻量角色分支。',
    nodeCount: 6,
    engine: 'generic',
    accent: 'heading',
    content: visualNovelTemplate,
  },
  {
    id: 'puzzle-escape',
    titleKey: 'templates.puzzle',
    title: '解谜逃脱',
    description: '钥匙、电源、密码和出口变量组成的多节点条件链。',
    nodeCount: 11,
    engine: 'generic',
    accent: 'condition',
    content: puzzleEscapeTemplate,
  },
  {
    id: 'godot-example',
    titleKey: 'templates.godot',
    title: 'Godot 示例',
    description: '英文 Godot runtime loader 示例，便于引擎侧集成演示。',
    nodeCount: 10,
    engine: 'godot',
    accent: 'target',
    content: godotTemplate,
  },
];
