export type Locale = 'zh' | 'en';

export type Tone = 'pass' | 'warn' | 'risk' | 'neutral';

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface Metric {
  label: string;
  value: string;
  note: string;
  tone: Tone;
}

export interface MilestoneStatus {
  id: string;
  title: string;
  total: number;
  complete: number;
  skipped: number;
  removed: number;
  progress: number;
}

export interface GateStatus {
  name: string;
  zhName?: string;
  status: Tone;
  result: string;
  zhResult?: string;
  detail: string;
  zhDetail?: string;
}

export interface FeatureStatus {
  title: string;
  zhTitle?: string;
  status: Tone;
  detail: string;
  zhDetail?: string;
  evidence: string;
  zhEvidence?: string;
}

export interface RoadmapItem {
  title: string;
  zhTitle?: string;
  status: Tone;
  detail: string;
  zhDetail?: string;
}

export interface ProjectStatus {
  generatedAt: string;
  summary: {
    completed: number;
    total: number;
    rate: number;
    remaining: number;
    deferred: number;
    removed: number;
    lastUpdated: string;
    grade: string;
  };
  milestones: MilestoneStatus[];
  releaseGates: GateStatus[];
  stableFeatures: FeatureStatus[];
  experimentalFeatures: FeatureStatus[];
  roadmap: RoadmapItem[];
  sourceRefs: string[];
}
