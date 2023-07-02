interface IEngineWorkerData {
  memoryId: string;
  initialProblemStatement: IEngineProblemStatement;
}

interface IEngineProblemStatement {
  description: string;
  subProblemStatements: IEngineProblemStatement[];
}

interface IEngineAffectedEntityBase {
  name: string;
}

interface IEngineAffectedEntity {
  name: string;
  currentPositiveEffects?: string[];
  currentNegativeEffects?: string[];
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
  | "init"
  | "search"
  | "get-page"
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
  currentStage: IEngineStageTypes;
  currentStageTimeStart: number;
  currentUserFeedback?: IEngineUserFeedback[];
  initialTimeStart: number;
  currentStageCost: number;
  totalCost: number;
  nextStageAfterUserInput?: IEngineStageTypes;
  problemStatement: IEngineProblemStatement;
  entities: IEngineAffectedEntity[];
  solutionIdeas: IEngineSolutionIdeas[];
  currentStageData?: IEEngineSearchResultData | IEEngineSearchResultPage | undefined;
  currentStageError?: string | undefined;
}
