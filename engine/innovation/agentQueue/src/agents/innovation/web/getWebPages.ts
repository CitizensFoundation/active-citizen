import { HTTPResponse, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { IEngineConstants } from "../../../constants.js";
import { PdfReader } from "pdfreader";
import axios from "axios";

import { htmlToText } from "html-to-text";
import { BaseProcessor } from "../baseProcessor.js";

import weaviate, { WeaviateClient } from "weaviate-ts-client";

import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { ChatOpenAI } from "langchain/chat_models/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import { WebPageVectorStore } from "../vectorstore/webPage.js";

import ioredis from "ioredis";

const redis = new ioredis.default(
  process.env.REDIS_MEMORY_URL || "redis://localhost:6379"
);

//@ts-ignore
puppeteer.use(StealthPlugin());

export class GetWebPagesProcessor extends BaseProcessor {
  webPageVectorStore = new WebPageVectorStore();
  searchResultTarget!: IEngineWebPageTargets;
  currentEntity: IEngineAffectedEntity | undefined;

  renderRefinePrompt(
    currentWebPageAnalysis: IEngineWebPageAnalysisData,
    problemStatement: IEngineProblemStatement,
    text: string
  ) {
    return [
      new SystemChatMessage(
        `As an expert trained to analyze complex text in relation to a given problem statement, adhere to the following guidelines:

        1. Refine the "Current Analysis JSON" data with new information from the "New Text Context", if needed, and output in the "Refined Analysis JSON" section.
        2. Refine the possible solutions to the problem statement based on the new text. Do not make up your own solutions.
        3. Refine the summary based on the new text, if needed.
        4. Add new paragraphs to the 'mostRelevantParagraphs' array only if the new paragraphs are very relevant to the problem statement.
        5. Never output more than 7 paragraphs in the 'mostRelevantParagraphs' array, rather rewrite and combine paragraphs already there.
        6. Output everything in JSON format without further explanation.
        8. Tackle the task step-by-step.`
      ),
      new HumanChatMessage(
        `
        Problem Statement:
        ${problemStatement.description}
        ${
          this.searchResultTarget == "subProblem"
            ? `

        Sub Problem:
        ${this.renderSubProblem(this.currentSubProblemIndex!)}
        `
            : ``
        }

        Current Analysis JSON:
        ${JSON.stringify(currentWebPageAnalysis, null, 2)}

        New Text Context:
        ${text}

        Refined Analysis JSON:`
      ),
    ];
  }

  renderInitialMessages(
    problemStatement: IEngineProblemStatement,
    text: string
  ) {
    return [
      new SystemChatMessage(
        `As an expert trained to analyze complex text in relation to a given problem statement, adhere to the following guidelines:

        1. Analyze how the text under "Text context" is related to the problem statement and sub-problem if specified
        2. Output only the most relevant paragraphs you find in the Text Context in the mostRelevantParagraphs JSON array.
        3. Identify possible solutions to the problem statement in the Text Context and store in the solutionsToProblemIdentifiedInText JSON array.
        4. Never make up your your own solutions.
        4. Never store any citations or references in 'mostRelevantParagraphs'.
        5. Avoid using markdown format.
        6. Output everything in JSON format without further explanation.
        7. Perform the task step-by-step.

        Examples:

        Problem Statement:
        Obesity in children in many countries is increasing.

        Text context:
        Childhood Overweight & Obesity
        Print
        Childhood obesity is a serious health problem in the United States where 1 in 5 children and adolescents are affected. Some groups of children are more affected than others, but all children are at risk of gaining weight that is higher than what is considered healthy.

        Obesity is complex. Many factors can contribute to excess weight gain including behavior, genetics and taking certain medications. But societal and community factors also matter: child care and school environments, neighborhood design, access to healthy, affordable foods and beverages, and access to safe and convenient places for physical activity affect our ability to make healthy choices.

        Every child deserves a healthy start in life. Learn what parents and caregivers can to do help prevent obesity at home, how healthcare systems can help families prevent and manage childhood obesity, and what strategies communities can use to support a healthy, active lifestyle for all.

        Childhood Obesity Facts
        How many children in the United States have obesity?

        Defining Childhood Overweight & Obesity
        How is childhood obesity measured?

        Causes and Consequences
        What contributes to childhood obesity? What are the health risks?

        Clinical Guidelines
        Resources for clinicians and healthcare providers on childhood obesity. Also see CDC’s Clinical Growth Charts.

        Child and Teen BMI Calculator
        Use this calculator for children aged 2 through 19 years old.

        JSON Output:
        [
          {
            "summary": "The text discusses the issue of childhood obesity in the United States, highlighting that 1 in 5 children are affected. It explains that obesity is a complex issue with many contributing factors, including behavior, genetics, medication, and societal and community factors. The text suggests that parents, caregivers, healthcare systems, and communities all have a role to play in preventing and managing childhood obesity.",
            "relevanceToProblem": "The text discusses the problem of childhood obesity, its causes, and potential solutions, which directly relates to the problem statement.",
            "mostRelevantParagraphs": [
              "Childhood obesity is a serious health problem in the United States where 1 in 5 children and adolescents are affected. Some groups of children are more affected than others, but all children are at risk of gaining weight that is higher than what is considered healthy.",
              "Obesity is complex. Many factors can contribute to excess weight gain including behavior, genetics and taking certain medications. But societal and community factors also matter: child care and school environments, neighborhood design, access to healthy, affordable foods and beverages, and access to safe and convenient places for physical activity affect our ability to make healthy choices.",
              "Every child deserves a healthy start in life. Learn what parents and caregivers can to do help prevent obesity at home, how healthcare systems can help families prevent and manage childhood obesity, and what strategies communities can use to support a healthy, active lifestyle for all.",
            ],
            "solutionsToProblemIdentifiedInText": [
              "Parents and caregivers can help prevent obesity at home",
              "Healthcare systems can help families prevent and manage childhood obesity",
              "Communities can use strategies to support a healthy, active lifestyle for all"
            ],
          }
        ]

        Problem Statement:
        Prototype robotic prosthetic leg batteries are not lasting long enough.

        Sub Problem:
        Larger batteries are too heavy.

        Text context:
        Predicting the impact of formation protocols on
        battery lifetime immediately after manufacturing
        Andrew Weng1,*, Peyman Mohtat1
        , Peter M. Attia2
        , Valentin Sulzer1
        , Suhak Lee1
        , Greg
        Less3
        , and Anna Stefanopoulou1
        1Department of Mechanical Engineering, University of Michigan, Ann Arbor, MI 48109, USA
        2Department of Materials Science and Engineering, Stanford University, Stanford, CA 94305, USA
        3University of Michigan Battery Lab, Ann Arbor, MI 48105, USA
        *
        Lead Contact and Corresponding Author (asweng@umich.edu)
        Summary
        Increasing the speed of battery formation can significantly lower lithium-ion battery manufacturing costs. However, adopting
        faster formation protocols in practical manufacturing settings is challenging due to a lack of inexpensive, rapid diagnostic
        signals that can inform possible impacts to long-term battery lifetime. This work identifies the cell resistance measured at low
        states of charge as an early-life diagnostic feature for screening new formation protocols. We show that this signal correlates to
        cycle life and improves the accuracy of data-driven battery lifetime prediction models. The signal is obtainable at the end of
        the manufacturing line, takes seconds to acquire, and does not require specialized test equipment. We explore a physical
        connection between this resistance signal and the quantity of lithium consumed during formation, suggesting that the signal
        may be broadly applicable for evaluating any manufacturing process change that could impact the total lithium consumed
        during formation.

        3 Conclusion
        In this work, we demonstrated that low-SOC resistance (RLS) correlates to cycle life across two different battery
        formation protocols. As a predictive feature, RLS provided higher prediction accuracy compared to conventional
        measures of formation quality such as Coulombic efficiency as well as state-of-the art predictive features based
        on changes in discharge voltage curves. RLS is measurable at the end of the manufacturing line using ordinary
        battery test equipment and can be measured within seconds. Changes in RLS are attributed to differences in the
        amount of lithium consumed to the SEI during formation, where a decrease in RLS indicates that more lithium is
        consumed.

        References
        1
        Australian Trade and Investment Commission, The Lithium-Ion Battery Value Chain: New Economy Opportunities
        for Australia, tech. rep. (2018), p. 56.
        2
        Benchmark Minerals Intelligence, EV Battery arms race enters new gear with 115 megafactories, Europe sees
        most rapid growth, 2019.

        JSON Output:
        {
          "summary": "The text discusses the potential of faster formation protocols in improving the lifetime of lithium-ion batteries. It identifies the cell resistance measured at low states of charge as a diagnostic feature that can predict battery lifetime. This signal is related to the quantity of lithium consumed during formation, and it can be used to evaluate any changes in the manufacturing process that could affect battery lifetime.",
          "relevanceToProblem": "The text discusses the impact of formation protocols on battery lifetime, which is directly related to the problem of prototype robotic prosthetic leg batteries not lasting long enough.",
          "mostRelevantParagraphs": [
            "In this work, we demonstrated that low-SOC resistance (RLS) correlates to cycle life across two different battery formation protocols. As a predictive feature, RLS provided higher prediction accuracy compared to conventional measures of formation quality such as Coulombic efficiency as well as state-of-the art predictive features based on changes in discharge voltage curves. RLS is measurable at the end of the manufacturing line using ordinary battery test equipment and can be measured within seconds. Changes in RLS are attributed to differences in the amount of lithium consumed to the SEI during formation, where a decrease in RLS indicates that more lithium is consumed."
          ],
          "solutionsToProblemIdentifiedInText": [
            "Adopting faster formation protocols and using the cell resistance measured at low states of charge as an early-life diagnostic feature for screening new formation protocols."
          ]
        }
        `
      ),
      new HumanChatMessage(
        `
        Problem Statement:
        ${problemStatement.description}
        ${
          this.searchResultTarget == "subProblem"
            ? `

        Sub Problem:
        ${this.renderSubProblem(this.currentSubProblemIndex!)}
        `
            : ``
        }

        Text Context:
        ${text}

        JSON Output:`
      ),
    ];
  }

  async getTokenCount(text: string) {
    const emptyMessages = this.renderInitialMessages(
      this.memory.problemStatement,
      ""
    );

    const promptTokenCount = await this.chat!.getNumTokensFromMessages(
      emptyMessages
    );

    const textForTokenCount = new HumanChatMessage(text);

    const textTokenCount = await this.chat!.getNumTokensFromMessages([
      textForTokenCount,
    ]);

    const totalTokenCount =
      promptTokenCount.totalCount +
      textTokenCount.totalCount +
      IEngineConstants.getPageAnalysisModel.maxOutputTokens;

    return { totalTokenCount, promptTokenCount };
  }

  async getInitialAnalysis(text: string) {
    this.logger.info("Get Initial Analysis");
    const messages = this.renderInitialMessages(
      this.memory.problemStatement,
      text
    );

    const analysis = (await this.callLLM(
      "web-get-pages",
      IEngineConstants.getPageAnalysisModel,
      messages
    )) as IEngineWebPageAnalysisData;

    return analysis;
  }

  async getRefinedAnalysis(
    currentAnalysis: IEngineWebPageAnalysisData,
    text: string
  ) {
    this.logger.info("Get Refined Analysis");
    const messages = this.renderRefinePrompt(
      currentAnalysis,
      this.memory.problemStatement,
      text
    );

    const analysis = (await this.callLLM(
      "web-get-pages",
      IEngineConstants.getPageAnalysisModel,
      messages
    )) as IEngineWebPageAnalysisData;

    return analysis;
  }

  async getTextAnalysis(text: string) {
    const { totalTokenCount, promptTokenCount } = await this.getTokenCount(
      text
    );

    this.logger.debug(
      `Total token count: ${totalTokenCount} Prompt token count: ${JSON.stringify(promptTokenCount)}`
    );

    let textAnalysis: IEngineWebPageAnalysisData;

    if (IEngineConstants.getPageAnalysisModel.tokenLimit < totalTokenCount) {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize:
          IEngineConstants.getPageAnalysisModel.tokenLimit -
          promptTokenCount.totalCount -
          128,
        chunkOverlap: 50,
      });

      this.logger.debug(
        `Splitting text into chunks of ${splitter.chunkSize} tokens`
      );

      const documents = await splitter.createDocuments([text]);

      this.logger.debug(`Got ${documents.length} documents`);

      for (let d = 0; d < documents.length; d++) {
        const document = documents[d];

        if (d == 0) {
          textAnalysis = await this.getInitialAnalysis(document.pageContent);
        } else {
          textAnalysis = await this.getRefinedAnalysis(
            textAnalysis!,
            document.pageContent
          );
        }
      }
    } else {
      textAnalysis = await this.getInitialAnalysis(text);
    }

    return textAnalysis!;
  }

  async processPageText(
    text: string,
    subProblemIndex: number | undefined,
    url: string,
    type: IEngineWebPageTypes
  ) {
    this.logger.debug(
      `Processing page text ${text.slice(0,500)} for ${url} for ${type} search results ${subProblemIndex} sub problem index`
    );

    const textAnalysis = await this.getTextAnalysis(text);

    textAnalysis.url = url;
    textAnalysis.subProblemIndex = subProblemIndex;
    textAnalysis.searchType = type;
    textAnalysis.groupId = this.memory.groupId;
    textAnalysis.communityId = this.memory.communityId;
    textAnalysis.domainId = this.memory.domainId;

    this.logger.debug(
      `Got text analysis ${JSON.stringify(textAnalysis, null, 2)}`
    );

    try {
      await this.webPageVectorStore.postWebPage(textAnalysis);
    } catch (e) {
      this.logger.error(`Error posting web page`);
      this.logger.error(e);
    }
  }

  //TODO: Use arxiv API as seperate datasource, use other for non arxiv papers
  // https://github.com/hwchase17/langchain/blob/master/langchain/document_loaders/arxiv.py
  // https://info.arxiv.org/help/api/basics.html
  async getAndProcessPdf(
    subProblemIndex: number | undefined,
    url: string,
    type: IEngineWebPageTypes
  ) {
    return new Promise<void>(async (resolve, reject) => {
      console.log("getAndProcessPdf");

      try {
        let finalText = "";
        let pdfBuffer;

        const redisKey = `pg_ca_v5p:${url}`;
        const cachedHtml = await redis.get(redisKey);

        if (cachedHtml) {
          pdfBuffer = Buffer.from(cachedHtml, "base64");
        } else {
          const sleepingForMs =
            IEngineConstants.minSleepBeforeBrowserRequest +
            Math.random() *
              IEngineConstants.maxAdditionalRandomSleepBeforeBrowserRequest;

          this.logger.info(`Fetching PDF ${url} in ${sleepingForMs} ms`);

          await new Promise((r) => setTimeout(r, sleepingForMs));

          const axiosResponse = await axios.get(url, {
            responseType: "arraybuffer",
          });

          pdfBuffer = axiosResponse.data;

          if (pdfBuffer) {
            this.logger.debug(`Caching PDF response`);
            const base64Pdf = Buffer.from(pdfBuffer).toString("base64");

            await redis.set(
              redisKey,
              base64Pdf,
              "EX",
              IEngineConstants.getPageCacheExpiration
            );
          }
        }

        if (pdfBuffer) {
          console.log(pdfBuffer);
          try {
            new PdfReader({}).parseBuffer(
              pdfBuffer,
              async (err: any, item: any) => {
                if (err) {
                  this.logger.error(`Error parsing PDF ${url}`);
                  this.logger.error(err);
                  resolve();
                } else if (!item) {
                  finalText = finalText.replace(/(\r\n|\n|\r){3,}/gm, "\n\n");
                  console.log(`Got final text: ${finalText}`);
                  await this.processPageText(
                    finalText,
                    subProblemIndex,
                    url,
                    type
                  );
                  resolve();
                } else if (item.text) {
                  finalText += item.text + " ";
                }
              }
            );
          } catch (e) {
            this.logger.error(`No PDF buffer`);
            this.logger.error(e);
            resolve();
          }
        } else {
          this.logger.error(`No PDF buffer`);
          resolve();
        }
      } catch (e) {
        this.logger.error(`Error in get pdf`);
        this.logger.error(e);
        resolve();
      }
    });
  }

  async getAndProcessHtml(
    subProblemIndex: number | undefined,
    url: string,
    browserPage: Page,
    type: IEngineWebPageTypes
  ) {
    try {
      let finalText, htmlText;

      const redisKey = `pg_ca_v4t:${url}`;
      const cachedHtml = await redis.get(redisKey);

      if (cachedHtml) {
        htmlText = cachedHtml;
      } else {
        const sleepingForMs =
          IEngineConstants.minSleepBeforeBrowserRequest +
          Math.random() *
            IEngineConstants.maxAdditionalRandomSleepBeforeBrowserRequest;

        this.logger.info(`Fetching HTML page ${url} in ${sleepingForMs} ms`);

        await new Promise((r) => setTimeout(r, sleepingForMs));

        const response = await browserPage.goto(url, {
          waitUntil: "networkidle0",
        });
        if (response) {
          htmlText = await response.text();
          if (htmlText) {
            this.logger.debug(`Caching response`);
            await redis.set(
              redisKey,
              htmlText.toString(),
              "EX",
              IEngineConstants.getPageCacheExpiration
            );
          }
        }
      }

      if (htmlText) {
        finalText = htmlToText(htmlText, {
          wordwrap: false,
          selectors: [
            {
              selector: "a",
              format: "skip",
              options: {
                ignoreHref: true,
              },
            },
            {
              selector: "img",
              format: "skip",
            },
            {
              selector: "form",
              format: "skip",
            },
            {
              selector: "nav",
              format: "skip",
            },
          ],
        });

        finalText = finalText.replace(/(\r\n|\n|\r){3,}/gm, "\n\n");

        //this.logger.debug(`Got HTML text: ${finalText}`);
        await this.processPageText(finalText, subProblemIndex, url, type);
      } else {
        this.logger.error(`No HTML text found for ${url}`);
      }
    } catch (e) {
      this.logger.error(`Error in get html`);
      this.logger.error(e);
    }
  }

  async getAndProcessPage(
    subProblemIndex: number | undefined,
    url: string,
    browserPage: Page,
    type: IEngineWebPageTypes
  ) {

    if (url.toLowerCase().endsWith(".pdf")) {
      await this.getAndProcessPdf(subProblemIndex, url, type);
    } else {
      await this.getAndProcessHtml(subProblemIndex, url, browserPage, type);
    }

    return true;
  }

  async processSubProblems(
    searchQueryType: IEngineWebPageTypes,
    browserPage: Page
  ) {
    for (
      let s = 0;
      s <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      s++
    ) {
      this.currentSubProblemIndex = s;

      this.logger.info(
        `Fetching pages for Sub Problem ${s} for ${searchQueryType} search results`
      );

      this.searchResultTarget = "subProblem";

      const urlsToGet = this.getUrlsToFetch(
        this.memory.subProblems[s].searchResults!.pages[searchQueryType]
      );

      for (let i = 0; i < urlsToGet.length; i++) {
        await this.getAndProcessPage(
          s,
          urlsToGet[i],
          browserPage,
          searchQueryType
        );
      }

      await this.processEntities(s, searchQueryType, browserPage);

      await this.saveMemory();
    }
  }

  async processEntities(
    subProblemIndex: number,
    searchQueryType: IEngineWebPageTypes,
    browserPage: Page
  ) {
    for (
      let e = 0;
      e <
      Math.min(
        this.memory.subProblems[subProblemIndex].entities.length,
        IEngineConstants.maxTopEntitiesToSearch
      );
      e++
    ) {
      this.logger.info(
        `Fetching pages for Entity ${subProblemIndex}-${e} for ${searchQueryType} search results`
      );
      this.searchResultTarget = "entity";

      this.currentEntity = this.memory.subProblems[subProblemIndex].entities[e];

      const urlsToGet = this.getUrlsToFetch(
        this.memory.subProblems[subProblemIndex].entities[e].searchResults!
          .pages[searchQueryType]
      );

      for (let i = 0; i < urlsToGet.length; i++) {
        await this.getAndProcessPage(
          subProblemIndex,
          urlsToGet[i],
          browserPage,
          searchQueryType
        );
      }

      this.currentEntity = undefined;
    }
  }

  getUrlsToFetch(allPages: SerpOrganicResult[]): string[] {
    let outArray: SerpOrganicResult[] = [];

    outArray = outArray.concat(
      allPages.filter(
        (page) =>
          page.position <= IEngineConstants.maxWebPagesToGetByTopSearchPosition
      )
    );

    outArray = outArray.concat(
      allPages.slice(0, IEngineConstants.maxTopWebPagesToGet)
    );

    // Map to URLs and remove duplicates
    const urlsToGet: string[] = Array.from(
      outArray
        .map((p) => p.link)
        .reduce((unique, item) => unique.add(item), new Set())
    ) as string[];

    this.logger.debug(
      `Got ${urlsToGet.length} URLs to fetch ${JSON.stringify(
        urlsToGet,
        null,
        2
      )}`
    );

    return urlsToGet;
  }

  async processProblemStatement(
    searchQueryType: IEngineWebPageTypes,
    browserPage: Page
  ) {
    this.logger.info(
      `Ranking Problem Statement for ${searchQueryType} search results`
    );

    this.searchResultTarget = "problemStatement";

    const urlsToGet = this.getUrlsToFetch(
      this.memory.problemStatement.searchResults!.pages[searchQueryType]
    );

    for (let i = 0; i < urlsToGet.length; i++) {
      await this.getAndProcessPage(
        undefined,
        urlsToGet[i],
        browserPage,
        searchQueryType
      );
    }
  }

  async getAllPages() {
    puppeteer.launch({ headless: "new" }).then(async (browser) => {
      this.logger.debug("Launching browser");
      const browserPage = await browser.newPage();
      await browserPage.setUserAgent(IEngineConstants.currentUserAgent);

      for (const searchQueryType of [
        "general",
        "scientific",
        "openData",
        "news",
      ] as const) {
        await this.processProblemStatement(searchQueryType, browserPage);
        await this.processSubProblems(
          searchQueryType as IEngineWebPageTypes,
          browserPage
        );
      }

      await this.saveMemory();

      await browser.close();
    });
  }

  async process() {
    this.logger.info("Get Web Pages Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.getPageAnalysisModel.temperature,
      maxTokens: IEngineConstants.getPageAnalysisModel.maxOutputTokens,
      modelName: IEngineConstants.getPageAnalysisModel.name,
      verbose: IEngineConstants.getPageAnalysisModel.verbose,
    });

    await this.getAllPages();

    await this.saveMemory();
  }
}
