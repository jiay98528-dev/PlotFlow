import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Languages,
  Map,
  Palette,
  PanelRightOpen,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { WhiteboardPreview } from './components/WhiteboardPreview';
import { developmentCopy, guide, landing, locales, navigation, officialThemes } from './data/siteContent';
import { fallbackProjectStatus } from './data/projectStatusFallback';
import type { GateStatus, Locale, ProjectStatus, Tone } from './types';

const toneLabels: Record<Locale, Record<Tone, string>> = {
  zh: {
    pass: '通过',
    warn: '注意',
    risk: '风险',
    neutral: '跟踪',
  },
  en: {
    pass: 'Pass',
    warn: 'Watch',
    risk: 'Risk',
    neutral: 'Tracking',
  },
};

const toneIcons: Record<Tone, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: TriangleAlert,
  risk: FlaskConical,
  neutral: Activity,
};

const milestoneNamesZh: Record<string, string> = {
  M0: '零号',
  M1: '一号',
  M2: '二号',
  M3: '三号',
  M4: '四号',
  M5: '五号',
  M6: '六号',
  M7: '七号',
};

const milestoneTitlesZh: Record<string, string> = {
  M0: '项目脚手架',
  M1: '核心解析与编辑',
  M2: '分支可视化',
  M3: '条件编辑与错误检测',
  M4: '导出系统',
  M5: '补全引擎',
  M6: '模板与主题',
  M7: '桌面应用打包发布',
};

function localizedGate(gate: GateStatus, locale: Locale) {
  return {
    name: locale === 'zh' ? gate.zhName ?? gate.name : gate.name,
    result: locale === 'zh' ? gate.zhResult ?? gate.result : gate.result,
    detail: locale === 'zh' ? gate.zhDetail ?? gate.detail : gate.detail,
  };
}

function localizedFeature(item: ProjectStatus['stableFeatures'][number], locale: Locale) {
  return {
    title: locale === 'zh' ? item.zhTitle ?? item.title : item.title,
    detail: locale === 'zh' ? item.zhDetail ?? item.detail : item.detail,
    evidence: locale === 'zh' ? item.zhEvidence ?? item.evidence : item.evidence,
  };
}

function localizedRoadmap(item: ProjectStatus['roadmap'][number], locale: Locale) {
  return {
    title: locale === 'zh' ? item.zhTitle ?? item.title : item.title,
    detail: locale === 'zh' ? item.zhDetail ?? item.detail : item.detail,
  };
}

function normalizePath(pathname: string) {
  if (pathname === '' || pathname === '/') {
    return '/';
  }
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function getProjectStatusPath(baseUrl: string) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}data/project-status.json`;
}

function getInitialLocale(): Locale {
  const saved = window.localStorage.getItem('plotflow-site-locale');
  if (saved === 'zh' || saved === 'en') {
    return saved;
  }
  return 'zh';
}

function useProjectStatus() {
  const [status, setStatus] = useState<ProjectStatus>(fallbackProjectStatus);

  useEffect(() => {
    let active = true;

    fetch(getProjectStatusPath(import.meta.env.BASE_URL))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Project status request failed: ${response.status}`);
        }
        return response.json() as Promise<ProjectStatus>;
      })
      .then((data) => {
        if (active) {
          setStatus(data);
        }
      })
      .catch(() => {
        if (active) {
          setStatus(fallbackProjectStatus);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return status;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const status = useProjectStatus();

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title =
      locale === 'zh'
        ? 'PlotFlow - 叙事分支工作台'
        : 'PlotFlow - Narrative Branching Workspace';
    window.localStorage.setItem('plotflow-site-locale', locale);
  }, [locale]);

  const navigate = (nextPath: string) => {
    const normalized = normalizePath(nextPath);
    if (normalized !== path) {
      window.history.pushState({}, '', normalized);
      setPath(normalized);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const page = useMemo(() => {
    if (path === '/guide/') {
      return <GuidePage locale={locale} />;
    }
    if (path === '/development/') {
      return <DevelopmentPage locale={locale} status={status} />;
    }
    return <LandingPage locale={locale} navigate={navigate} status={status} />;
  }, [locale, path, status]);

  return (
    <div className="site-shell">
      <Header locale={locale} navigate={navigate} path={path} setLocale={setLocale} />
      {page}
      <Footer locale={locale} navigate={navigate} />
    </div>
  );
}

interface PageProps {
  locale: Locale;
}

function Header({
  locale,
  navigate,
  path,
  setLocale,
}: PageProps & {
  navigate: (path: string) => void;
  path: string;
  setLocale: (locale: Locale) => void;
}) {
  return (
    <header className="site-header">
      <button className="brand-mark" type="button" onClick={() => navigate('/')}>
        <span className="brand-mark__sigil">PF</span>
        <span>
          <strong>PlotFlow</strong>
          <small>{locale === 'zh' ? '叙事分支工作台' : 'Branching narrative workspace'}</small>
        </span>
      </button>
      <nav className="nav-links" aria-label={locale === 'zh' ? '主导航' : 'Main navigation'}>
        {navigation[locale].map((item) => (
          <button
            className={path === item.path ? 'is-active' : ''}
            data-page={item.path === '/' ? 'home' : item.path.replace(/\//g, '')}
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="language-switch" aria-label={locale === 'zh' ? '语言切换' : 'Language switch'}>
        <Languages size={18} aria-hidden="true" />
        {locales.map((item) => (
          <button
            className={locale === item ? 'is-active' : ''}
            data-locale={item}
            key={item}
            type="button"
            onClick={() => setLocale(item)}
          >
            {item === 'zh' ? '中' : '英'}
          </button>
        ))}
      </div>
    </header>
  );
}

function LandingPage({
  locale,
  navigate,
  status,
}: PageProps & {
  navigate: (path: string) => void;
  status: ProjectStatus;
}) {
  const copy = landing[locale];
  const metricLabel =
    locale === 'zh'
      ? `${status.summary.completed}/${status.summary.total} 项完成`
      : `${status.summary.completed}/${status.summary.total} tasks complete`;

  return (
    <main>
      <section className="hero">
        <div className="hero__visual" aria-hidden="true">
          <WhiteboardPreview locale={locale} />
        </div>
        <div className="hero__content">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="hero__subtitle">{copy.subtitle}</p>
          <div className="hero__actions">
            <button className="button button--primary" type="button" onClick={() => navigate('/guide/')}>
              <BookOpen size={18} aria-hidden="true" />
              {copy.primaryCta}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => navigate('/development/')}
            >
              <Activity size={18} aria-hidden="true" />
              {copy.secondaryCta}
            </button>
          </div>
          <div className="hero__status">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>{metricLabel}</span>
            <span>{copy.status}</span>
          </div>
        </div>
      </section>

      <section className="section section--loop">
        <div className="section__intro">
          <p className="eyebrow">{copy.loopTitle}</p>
          <h2>{copy.loop}</h2>
        </div>
      </section>

      <section className="section">
        <div className="section__intro">
          <p className="eyebrow">{copy.featureTitle}</p>
          <h2>{locale === 'zh' ? '先稳定文本与图的协作，再推进全图形界面。' : 'Stabilize text plus graph first, then move toward full GUI.'}</h2>
        </div>
        <div className="feature-grid">
          {copy.features.map((feature, index) => (
            <article className="feature-item" key={feature.title}>
              {index === 0 && <PanelRightOpen size={22} aria-hidden="true" />}
              {index === 1 && <TriangleAlert size={22} aria-hidden="true" />}
              {index === 2 && <GitBranch size={22} aria-hidden="true" />}
              {index === 3 && <Download size={22} aria-hidden="true" />}
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--themes">
        <div className="section__intro">
          <p className="eyebrow">{officialThemes[locale].eyebrow}</p>
          <h2>{officialThemes[locale].title}</h2>
          <p>{officialThemes[locale].intro}</p>
        </div>
        <div className="theme-showcase">
          {officialThemes[locale].items.map((theme) => (
            <article className={`theme-showcase-card theme-showcase-card--${theme.id}`} key={theme.id}>
              <div className="theme-showcase-card__preview" aria-hidden="true">
                <Palette size={24} />
                <span />
                <span />
                <span />
              </div>
              <div>
                <h3>{theme.name}</h3>
                <p className="theme-showcase-card__alias">{theme.alias}</p>
                <strong>{theme.tone}</strong>
                <p>{theme.body}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="theme-store-row">
          <a className="button button--primary" href="https://plotflow.app/themes" rel="noreferrer" target="_blank">
            <ExternalLink size={18} aria-hidden="true" />
            {officialThemes[locale].storeCta}
          </a>
          <p>{officialThemes[locale].note}</p>
        </div>
      </section>

      <section className="section section--audience">
        <div className="section__intro">
          <p className="eyebrow">{copy.audiencesTitle}</p>
          <h2>{locale === 'zh' ? '同一份故事文件，服务写作、设计和程序。' : 'One story file for writing, design, and implementation.'}</h2>
        </div>
        <div className="audience-list">
          {copy.audiences.map((item) => (
            <article className="audience-row" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function GuidePage({ locale }: PageProps) {
  const copy = guide[locale];

  return (
    <main className="page-layout">
      <aside className="page-index" aria-label={locale === 'zh' ? '章节导航' : 'Section navigation'}>
        {copy.sections.map((section) => (
          <a href={`#${section.id}`} key={section.id}>
            {section.title}
          </a>
        ))}
      </aside>
      <article className="guide-article">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="lead">{copy.intro}</p>
        {copy.sections.map((section) => (
          <section className="guide-section" id={section.id} key={section.id}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {'code' in section && section.code ? <pre>{section.code}</pre> : null}
            {'tip' in section && section.tip ? (
              <p className="guide-tip">
                <Map size={18} aria-hidden="true" />
                {section.tip}
              </p>
            ) : null}
          </section>
        ))}
      </article>
    </main>
  );
}

function DevelopmentPage({ locale, status }: PageProps & { status: ProjectStatus }) {
  const copy = developmentCopy[locale];
  const generatedLabel =
    status.generatedAt === 'not-generated'
      ? locale === 'zh'
        ? '使用内置回退数据'
        : 'Using fallback data'
      : new Date(status.generatedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');

  return (
    <main className="development-page">
      <section className="dev-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="lead">{copy.intro}</p>
        <div className="metric-strip">
          <MetricBlock
            label={locale === 'zh' ? '历史任务' : 'Historical tasks'}
            note={locale === 'zh' ? '零号至七号，不含八号图优先范围' : 'M0-M7, excluding M8 graph-first scope'}
            value={`${status.summary.completed}/${status.summary.total}`}
          />
          <MetricBlock
            label={locale === 'zh' ? '完成率' : 'Completion'}
            note={locale === 'zh' ? `${status.summary.deferred} 项延后` : `${status.summary.deferred} deferred`}
            value={`${status.summary.rate}%`}
          />
          <MetricBlock
            label={locale === 'zh' ? '剩余项' : 'Remaining'}
            note={locale === 'zh' ? `${status.summary.removed} 项已移除` : `${status.summary.removed} removed`}
            value={`${status.summary.remaining}`}
          />
        </div>
        <p className="source-note">
          {copy.sourceNote} {locale === 'zh' ? '生成时间：' : 'Generated: '}
          {generatedLabel}
        </p>
      </section>

      <section className="section">
        <div className="section__intro">
          <p className="eyebrow">{copy.gatesTitle}</p>
          <h2>{locale === 'zh' ? '当前发行门禁的真实状态。' : 'Current release gate truth.'}</h2>
        </div>
        <div className="gate-list">
          {status.releaseGates.map((gate) => (
            <GateRow gate={gate} key={gate.name} locale={locale} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__intro">
          <p className="eyebrow">{copy.milestonesTitle}</p>
          <h2>{locale === 'zh' ? '已完成的主线能力集中在一号至六号里程碑。' : 'The stable product surface is concentrated in M1-M6.'}</h2>
        </div>
        <div className="milestone-grid">
          {status.milestones.map((milestone) => (
            <article className="milestone" key={milestone.id}>
              <div>
                <strong>{locale === 'zh' ? milestoneNamesZh[milestone.id] ?? milestone.id : milestone.id}</strong>
                <span>{locale === 'zh' ? milestoneTitlesZh[milestone.id] ?? milestone.title : milestone.title}</span>
              </div>
              <meter max={100} min={0} value={milestone.progress}>
                {milestone.progress}%
              </meter>
              <p>
                {milestone.complete}/{milestone.total} · {milestone.progress}%
              </p>
            </article>
          ))}
        </div>
      </section>

      <FeatureStatusSection
        icon={ShieldCheck}
        locale={locale}
        title={copy.stableTitle}
        items={status.stableFeatures}
      />
      <FeatureStatusSection
        icon={FlaskConical}
        locale={locale}
        title={copy.experimentalTitle}
        items={status.experimentalFeatures}
      />
      <section className="section">
        <div className="section__intro">
          <p className="eyebrow">{copy.roadmapTitle}</p>
          <h2>{locale === 'zh' ? '下一步围绕公开发行与图优先模式推进。' : 'Next work focuses on public release and graph-first editing.'}</h2>
        </div>
        <div className="roadmap-list">
          {status.roadmap.map((item) => {
            const localized = localizedRoadmap(item, locale);
            return (
              <article className={`roadmap-item tone-${item.status}`} key={item.title}>
                <strong>{localized.title}</strong>
                <p>{localized.detail}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function MetricBlock({ label, note, value }: { label: string; note: string; value: string }) {
  return (
    <div className="metric-block">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function GateRow({ gate, locale }: { gate: GateStatus; locale: Locale }) {
  const Icon = toneIcons[gate.status];
  const localized = localizedGate(gate, locale);

  return (
    <article className={`gate-row tone-${gate.status}`}>
      <Icon size={20} aria-hidden="true" />
      <div>
        <strong>{localized.name}</strong>
        <p>{localized.detail}</p>
      </div>
      <span>{localized.result || toneLabels[locale][gate.status]}</span>
    </article>
  );
}

function FeatureStatusSection({
  icon: Icon,
  items,
  locale,
  title,
}: {
  icon: typeof ShieldCheck;
  items: ProjectStatus['stableFeatures'];
  locale: Locale;
  title: string;
}) {
  return (
    <section className="section">
      <div className="section__intro">
        <p className="eyebrow">{locale === 'zh' ? '状态分层' : 'Status layer'}</p>
        <h2>{title}</h2>
      </div>
      <div className="status-grid">
        {items.map((item) => {
          const localized = localizedFeature(item, locale);
          return (
            <article className={`status-item tone-${item.status}`} key={item.title}>
              <Icon size={22} aria-hidden="true" />
              <h3>{localized.title}</h3>
              <p>{localized.detail}</p>
              <small>{localized.evidence}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Footer({ locale, navigate }: PageProps & { navigate: (path: string) => void }) {
  return (
    <footer className="site-footer">
      <div>
        <strong>PlotFlow</strong>
        <p>
          {locale === 'zh'
            ? '本地优先，不锁数据，面向独立游戏叙事生产。'
            : 'Local-first, source-readable, built for branching narrative production.'}
        </p>
      </div>
      <button className="footer-link" type="button" onClick={() => navigate('/guide/')}>
        {locale === 'zh' ? '开始阅读' : 'Start reading'}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </footer>
  );
}
