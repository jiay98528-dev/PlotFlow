interface WhiteboardPreviewProps {
  locale: 'zh' | 'en';
}

export function WhiteboardPreview({ locale }: WhiteboardPreviewProps) {
  const copy =
    locale === 'zh'
      ? {
          file: '第一章.mdstory',
          saved: '已自动保存',
          chapter: '第一章',
          node: '节点：村口',
          body: '守卫拦住了月光下的道路。',
          choiceA: '选择：出示通行凭证 -> 城门开启',
          condition: '条件：持有通行凭证',
          choiceB: '选择：改走林间小路 -> 古松林',
          warning: '警告二号',
          warningText: '发现未续写分支',
          main: '村口',
          mainMeta: '两条选择',
          ok: '城门开启',
          okMeta: '带条件',
          warn: '古松林',
          warnMeta: '未续写',
          exportA: 'JSON',
          exportB: 'HTML 试玩',
          exportC: 'TXT 校对',
        }
      : {
          file: 'chapter-one.mdstory',
          saved: 'autosaved',
          chapter: '# Chapter One',
          node: '## Node: Village Gate',
          body: 'The guard blocks the moonlit road.',
          choiceA: '[Choice] Show the pass -> Node: Gate Opens',
          condition: '[Condition] $has_pass == true',
          choiceB: '[Choice] Take the forest path -> Node: Old Pines',
          warning: 'W002',
          warningText: 'Dead end detected',
          main: 'Village Gate',
          mainMeta: '2 choices',
          ok: 'Gate Opens',
          okMeta: 'conditioned',
          warn: 'Old Pines',
          warnMeta: 'dead end',
          exportA: 'JSON',
          exportB: 'HTML playable',
          exportC: 'TXT review',
        };

  return (
    <div className="whiteboard" aria-label={locale === 'zh' ? 'PlotFlow 界面预览' : 'PlotFlow interface preview'}>
      <div className="whiteboard__rail">
        <span />
        <span />
        <span />
      </div>
      <div className="whiteboard__editor">
        <div className="whiteboard__bar">
          <strong>{copy.file}</strong>
          <span>{copy.saved}</span>
        </div>
        <div className="whiteboard__code">
          <p className="muted">{copy.chapter}</p>
          <p>{copy.node}</p>
          <p>{copy.body}</p>
          <p>{copy.choiceA}</p>
          <p className="indent">{copy.condition}</p>
          <p>{copy.choiceB}</p>
        </div>
        <div className="whiteboard__problem">
          <span>{copy.warning}</span>
          <strong>{copy.warningText}</strong>
        </div>
      </div>
      <div className="whiteboard__graph">
        <div className="node node--main">
          <span>{copy.main}</span>
          <small>{copy.mainMeta}</small>
        </div>
        <div className="edge edge--a" />
        <div className="edge edge--b" />
        <div className="node node--ok">
          <span>{copy.ok}</span>
          <small>{copy.okMeta}</small>
        </div>
        <div className="node node--warn">
          <span>{copy.warn}</span>
          <small>{copy.warnMeta}</small>
        </div>
      </div>
      <div className="whiteboard__notes">
        <span>{copy.exportA}</span>
        <span>{copy.exportB}</span>
        <span>{copy.exportC}</span>
      </div>
    </div>
  );
}
