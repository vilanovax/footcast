export interface ScriptNewsItem {
  eventId: string;
  title: string;
  summary?: string | null;
  category?: string | null;
  scope?: string | null;
  officialStatus?: string | null;
  importanceScore?: number | null;
  sourceLabels?: string[];
}

export interface ScriptClaim {
  claim: string;
  eventId: string;
  sourceLabel: string;
  confidence: number;
  status: 'supported' | 'unverified' | 'weak';
}

export interface FactCheckIssue {
  claim: string;
  eventId: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

export interface GeneratedScript {
  title: string;
  bodyMd: string;
  wordCount: number;
  estimatedDurationSec: number;
  claims: ScriptClaim[];
  segments: Array<{ heading: string; eventId: string; wordCount: number }>;
  generator: string;
}

export interface FactCheckResult {
  ok: boolean;
  issues: FactCheckIssue[];
  supportedClaims: number;
  totalClaims: number;
}
