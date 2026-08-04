export type NewsCategory = "technology" | "entertainment" | "sports";

export interface SourceDefinition {
  id: string;
  category: NewsCategory;
  publisher: "VnExpress" | "Tuổi Trẻ" | "Thanh Niên";
  feedUrl: string;
  pollMinutes: number;
  acquisition: "rss";
  legalStatus: "poc-only";
}

export const PHASE_0_SOURCES = [
  {
    id: "vne-tech",
    category: "technology",
    publisher: "VnExpress",
    feedUrl: "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss",
    pollMinutes: 15,
    acquisition: "rss",
    legalStatus: "poc-only",
  },
  {
    id: "tto-tech",
    category: "technology",
    publisher: "Tuổi Trẻ",
    feedUrl: "https://tuoitre.vn/nhip-song-so.rss",
    pollMinutes: 15,
    acquisition: "rss",
    legalStatus: "poc-only",
  },
  {
    id: "tn-tech",
    category: "technology",
    publisher: "Thanh Niên",
    feedUrl: "https://thanhnien.vn/rss/cong-nghe.rss",
    pollMinutes: 15,
    acquisition: "rss",
    legalStatus: "poc-only",
  },
  {
    id: "vne-ent",
    category: "entertainment",
    publisher: "VnExpress",
    feedUrl: "https://vnexpress.net/rss/giai-tri.rss",
    pollMinutes: 15,
    acquisition: "rss",
    legalStatus: "poc-only",
  },
  {
    id: "tto-ent",
    category: "entertainment",
    publisher: "Tuổi Trẻ",
    feedUrl: "https://tuoitre.vn/giai-tri.rss",
    pollMinutes: 15,
    acquisition: "rss",
    legalStatus: "poc-only",
  },
  {
    id: "tn-ent",
    category: "entertainment",
    publisher: "Thanh Niên",
    feedUrl: "https://thanhnien.vn/rss/giai-tri.rss",
    pollMinutes: 15,
    acquisition: "rss",
    legalStatus: "poc-only",
  },
  {
    id: "vne-sport",
    category: "sports",
    publisher: "VnExpress",
    feedUrl: "https://vnexpress.net/rss/the-thao.rss",
    pollMinutes: 10,
    acquisition: "rss",
    legalStatus: "poc-only",
  },
  {
    id: "tto-sport",
    category: "sports",
    publisher: "Tuổi Trẻ",
    feedUrl: "https://tuoitre.vn/the-thao.rss",
    pollMinutes: 10,
    acquisition: "rss",
    legalStatus: "poc-only",
  },
  {
    id: "tn-sport",
    category: "sports",
    publisher: "Thanh Niên",
    feedUrl: "https://thanhnien.vn/rss/the-thao.rss",
    pollMinutes: 10,
    acquisition: "rss",
    legalStatus: "poc-only",
  },
] as const satisfies readonly SourceDefinition[];

export function getSourceById(sourceId: string): SourceDefinition {
  const source = PHASE_0_SOURCES.find((candidate) => candidate.id === sourceId);

  if (!source) {
    throw new Error(`Unknown source ID: ${sourceId}`);
  }

  return source;
}

export function validateSourceRegistry(
  sources: readonly SourceDefinition[],
): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const feedUrls = new Set<string>();

  for (const source of sources) {
    if (ids.has(source.id)) {
      issues.push(`Duplicate source ID: ${source.id}`);
    }
    ids.add(source.id);

    if (feedUrls.has(source.feedUrl)) {
      issues.push(`Duplicate feed URL: ${source.feedUrl}`);
    }
    feedUrls.add(source.feedUrl);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(source.feedUrl);
    } catch {
      issues.push(`Invalid feed URL for ${source.id}: ${source.feedUrl}`);
      continue;
    }

    if (parsedUrl.protocol !== "https:") {
      issues.push(`Feed URL must use HTTPS for ${source.id}`);
    }

    if (!Number.isInteger(source.pollMinutes) || source.pollMinutes < 5) {
      issues.push(`pollMinutes must be an integer >= 5 for ${source.id}`);
    }
  }

  return issues;
}
