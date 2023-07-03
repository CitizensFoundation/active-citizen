interface IEngineWorkerData {
  memoryId: string;
  initialProblemStatement: IEngineProblemStatement;
}

interface IEngineProblemStatement {
  description: string;
  title?: string;
  subProblems: IEngineProblemStatement[];
}

interface IEngineAffectedEntityBase {
  name: string;
}

interface  IEngineAffectedEntityAffect {
  subProblemIndex: number;
  reason: string;
}

interface IEngineAffectedEntity {
  entityName: string;
  positiveEffects?: IEngineAffectedEntityAffect[];
  negativeEffects?: IEngineAffectedEntityAffect[];
}

interface IEEngineIdeaAffectedEntity extends IEngineAffectedEntityBase {
  positiveEffects?: string[];
  negativeEffects?: string[];
  positiveScore: number;
  negativeScore: number;
}

interface IEngineSolutionIdeas {
  id: string;
  title: string;
  description: string;
  affectedEntities: IEEngineIdeaAffectedEntity[];
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
  | "web-search"
  | "web-get-pages"
  | "parse"
  | "save"
  | "done";

interface IEngineUserFeedback {
  feedbackType: string;
  subjectText: string;
  userFeedback?: string;
  userFeedbackRatings?: number[];
}

interface IEngineMemoryData {
  id: string;
  initialTimeStart: number;
  totalCost: number;
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

interface IEngineInnovationMemoryData extends IEngineMemoryData {
  currentStage: IEngineStageTypes;
  stages: Record<IEngineStageTypes, IEngineInnovationStagesData>;
  problemStatement: IEngineProblemStatement;
  entities: IEngineAffectedEntity[];
  searchQueries: IEngineSearchQuery[];
  solutionIdeas: IEngineSolutionIdeas[];
  currentStageData?: IEEngineSearchResultData | IEEngineSearchResultPage | undefined;
}