
type SerpKnowledgeGraph = {
  title: string;
  type: string;
  kgmid: string;
  knowledge_graph_search_link: string;
  serpapi_knowledge_graph_search_link: string;
  header_images: HeaderImage[];
  description: string;
  source: Source;
};

type HeaderImage = {
  image: string;
  source: string;
};

type Link = {
  text: string;
  link: string;
};


type SiteLink = {
  title: string;
  link: string;
};

type DetectedExtensions = {
  [key: string]: number;
};

type RichSnippet = {
  bottom: {
      extensions: string[];
      detected_extensions: DetectedExtensions;
  };
};

type Source = {
  description: string;
  source_info_link: string;
  security: string;
  icon: string;
};

type AboutThisResult = {
  source: Source;
  keywords: string[];
  languages: string[];
  regions: string[];
};

type SerpOrganicResult = {
  position: number;
  title: string;
  link: string;
  date: string;
  displayed_link: string;
  snippet: string;
  sitelinks: {
      inline: SiteLink[];
  };
  rich_snippet: RichSnippet;
  about_this_result: AboutThisResult;
  about_page_link: string;
  about_page_serpapi_link: string;
  cached_page_link: string;
  related_pages_link: string;
};

type SerpOrganicResults = SerpOrganicResult[];

interface IEngineWorkerData {
  memoryId: string;
  initialProblemStatement: IEngineProblemStatement;
}

interface IEngineProblemStatement {
  description: string;
  title?: string;
  allSubProblems: IEngineProblemStatement[];
  selectedSubProblems: IEngineProblemStatement[];
}

interface IEngineAffectedEntityBase {
  name: string;
}

interface IEngineAffectedEntityAffect {
  subProblemIndex: number;
  reason: string;
}

interface IEngineAffectedEntity {
  name: string;
  subProblemIndex: number;
  positiveEffects?: IEngineAffectedEntityAffect[];
  negativeEffects?: IEngineAffectedEntityAffect[];
}

interface IEEngineIdeaAffectedEntity extends IEngineAffectedEntityBase {
  positiveEffects?: string[];
  negativeEffects?: string[];
  positiveScore: number;
  negativeScore: number;
}

interface IEngineSolutionIdea {
  id: string;
  solutionTitle: string;
  solutionDescription: string;
  howCanItHelp: string;
  affectedEntities?: IEEngineIdeaAffectedEntity[];
}

interface IEEngineSearchResultPage {
  url: string;
  title: string;
  description: string;
  data?: string;
}

interface IEEngineSearchResultData {
  searchQuery: string;
  pages: IEEngineSearchResultPage[];
}

type IEngineStageTypes =
  | "create-sub-problems"
  | "create-entities"
  | "create-search-queries"
  | "rank-search-pages"
  | "rank-sub-problems"
  | "rank-entities"
  | "web-search"
  | "web-get-pages"
  | "create-seed-ideas"
  | "parse"
  | "save"
  | "done";

interface IEngineUserFeedback {
  feedbackType: string;
  subjectText: string;
  userFeedback?: string;
  userFeedbackRatings?: number[];
}

interface IEngineBaseAIModelConstants {
  name: string;
  temperature: number;
  maxTokens: number;
  tokenLimit: number;
  inTokenCostUSD: number;
  outTokenCostUSD: number;
  verbose: boolean;
}

interface IEngineMemoryData {
  id: string;
  timeStart: number;
  totalCost: number;
  lastSavedAt?: number;
  currentStageError?: string | undefined;
}

interface IEngineInnovationStagesData {
  timeStart?: number;
  userFeedback?: IEngineUserFeedback[];
  tokensIn?: number;
  tokensOut?: number;
  tokensInCost?: number;
  tokensOutCost?: number;
}

interface IEngineSearchQuery {
  subProblemIndex: number;
  generalSearchQuery: string;
  scientificSearchQuery: string;
}

interface IEngineSearchResults {
  all: {
    general: SerpOrganicResult[][];
    scientific: SerpOrganicResult[][];
  };
  orderedURLsToGet: {
    general: string[][];
    scientific: string[][];
  };
  orderedSearchPages: {
    general: SerpOrganicResult[][];
    scientific: SerpOrganicResult[][];
  };
  knowledgeGraph: {
    general: SerpKnowledgeGraph[][];
    scientific: SerpKnowledgeGraph[][];
  };
}

interface IEngineInnovationMemoryData extends IEngineMemoryData {
  currentStage: IEngineStageTypes;
  stages: Record<IEngineStageTypes, IEngineInnovationStagesData>;
  problemStatement: IEngineProblemStatement;
  entities: {
    all: IEngineAffectedEntity[];
    selected: IEngineAffectedEntity[];
  }
  searchQueries: IEngineSearchQuery[];
  searchResults: IEngineSearchResults;
  solutionIdeas: IEngineSolutionIdea[];
  currentStageData?:
    | IEEngineSearchResultData
    | IEEngineSearchResultPage
    | undefined;
}

type IEngineWebPageTypes = "general" | "scientific";

interface IEngineWebPageAnalysisData {
  allRelevantParagraphs: string[];
  possibleSolutionsToProblem: string[];
  relevanceToProblem: string;
  tags: string[];
  entities: string[];
  url: string;
  subProblemIndex: number;
  type: IEngineWebPageTypes;
}
