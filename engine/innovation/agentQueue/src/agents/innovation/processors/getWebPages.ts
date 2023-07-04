import { HTTPResponse, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { IEngineConstants } from "../../../constants.js";
import * as pdfjs from "pdfjs-dist/es5/build/pdf.js";
import { htmlToText } from "html-to-text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";

import weaviate, { WeaviateClient } from "weaviate-ts-client";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { WebPageVectorStore } from "../vectorstore/webPage.js";

const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_MEMORY_URL || undefined);

puppeteer.use(StealthPlugin());
pdfjs.GlobalWorkerOptions.workerSrc = require("pdfjs-dist/es5/build/pdf.worker.js");

export class GetWebPagesProcessor extends BaseProcessor {
  webPageVectorStore = new WebPageVectorStore();

  renderRefinePrompt(
    currentWebPageAnalysis: IEngineWebPageAnalysisData,
    problemStatement: IEngineProblemStatement,
    text: string
  ) {
    return [
      new SystemChatMessage(
        `You are an expert trained to analyse complex text in relation to a given problem statement.

        Adhere to the following guidelines:
        1. You are refining the Current Analysis JSON with new information from the provided New Text Context.
        2. Analyze how this text is related to the problem statement and output after Refined Analysis JSON:
        2. Suggest possible solutions to the problem statement.
        3. Provide a summary of the text.
        4. Provide a list of tags for the text.
        5. Provide a list of entities for the text.
        6. Output all paragraphs that are relevant to the problem statement
        7. If there are citations or references, output them in references seperatly not in allParagraphs.
        9. Output everything in JSON without an explanation
          [ { allRelevantParagraphs, possibleSolutionToProblem, relevanceToProblem, summary, tags, entities, references } ].
        10. Let's think step-by-step.
      `
      ),
      new HumanChatMessage(
        `
        Problem Statement:
        ${problemStatement.description}

        Current Analysis JSON:
        ${JSON.stringify(currentWebPageAnalysis, null, 2)}

        New Text Context:
        ${text}

        Refined Analysis JSON:
      `
      ),
    ];
  }

  renderInitialMessages(
    problemStatement: IEngineProblemStatement,
    text: string
  ) {
    return [
      new SystemChatMessage(
        `You are an expert trained to analyse complex text in relation to a given problem statement.

        Adhere to the following guidelines:
        1. Analyze how the text context is related to the problem statement.
        2. Suggest possible solutions to the problem statement.
        3. Provide a summary of the text.
        4. Provide a list of tags for the text.
        5. Provide a list of entities for the text.
        6. Output all paragraphs that are relevant to the problem statement
        7. If there are citations or references, output them in references seperatly not in allParagraphs.
        9. Output everything in JSON without an explanation
          [ { allRelevantParagraphs, possibleSolutionToProblem, relevanceToProblem, summary, tags, entities, references } ].
        10. Let's think step-by-step.

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
            "allRelevantParagraphs": [
              "Childhood obesity is a serious health problem in the United States where 1 in 5 children and adolescents are affected. Some groups of children are more affected than others, but all children are at risk of gaining weight that is higher than what is considered healthy.",
              "Obesity is complex. Many factors can contribute to excess weight gain including behavior, genetics and taking certain medications. But societal and community factors also matter: child care and school environments, neighborhood design, access to healthy, affordable foods and beverages, and access to safe and convenient places for physical activity affect our ability to make healthy choices.",
              "Every child deserves a healthy start in life. Learn what parents and caregivers can to do help prevent obesity at home, how healthcare systems can help families prevent and manage childhood obesity, and what strategies communities can use to support a healthy, active lifestyle for all.",
              "Childhood Obesity Facts",
              "How many children in the United States have obesity?",
              "Defining Childhood Overweight & Obesity",
              "How is childhood obesity measured?",
              "What contributes to childhood obesity? What are the health risks?",
              "Resources for clinicians and healthcare providers on childhood obesity. Also see CDC’s Clinical Growth Charts.",
              "Child and Teen BMI Calculator"
            ],
            "possibleSolutionsToProblem": [
              "Parents and caregivers can help prevent obesity at home",
              "Healthcare systems can help families prevent and manage childhood obesity",
              "Communities can use strategies to support a healthy, active lifestyle for all"
            ],
            "relevanceToProblem": "The text discusses the problem of childhood obesity, its causes, and potential solutions, which directly relates to the problem statement.",
            "summary": "The text discusses the issue of childhood obesity in the United States, highlighting that 1 in 5 children are affected. It explains that obesity is a complex issue with many contributing factors, including behavior, genetics, medication, and societal and community factors. The text suggests that parents, caregivers, healthcare systems, and communities all have a role to play in preventing and managing childhood obesity.",
            "tags": ["Childhood Obesity", "Health", "Prevention", "Management", "United States"],
            "entities": ["United States", "CDC", "Child and Teen BMI Calculator"]
          }
        ]

        Problem Statement:
        Prototype robotic prosthetic leg batteries are not lasting long enough.

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

        y. A key question is
        whether fast formation created more heterogeneous aging behavior which caused the higher variability in aging,
        Page 12
        or if the higher variability is due to the cells lasting longer. To answer this question, we employed the modified
        signed-likelihood ratio test78 to check for equality of the coefficients of variation, defined as the ratio between the
        standard deviation and the mean cycle life. The resulting p-values were greater than 0.05 in all cases. Therefore,
        with the available data, we cannot conclude that fast formation increased the variation in aging beyond the effect of
        improving cycle life. While a relationship between formation protocol and aging variability may still generally exist,
        this difference could not be determined with our sample sizes (n = 10 cells per group). This result motivates the
        continued usage of larger samples sizes for future studies on the impact of formation protocol on aging variability.
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
          "allRelevantParagraphs": [
            "Increasing the speed of battery formation can significantly lower lithium-ion battery manufacturing costs. However, adopting faster formation protocols in practical manufacturing settings is challenging due to a lack of inexpensive, rapid diagnostic signals that can inform possible impacts to long-term battery lifetime. This work identifies the cell resistance measured at low states of charge as an early-life diagnostic feature for screening new formation protocols. We show that this signal correlates to cycle life and improves the accuracy of data-driven battery lifetime prediction models. The signal is obtainable at the end of the manufacturing line, takes seconds to acquire, and does not require specialized test equipment. We explore a physical connection between this resistance signal and the quantity of lithium consumed during formation, suggesting that the signal may be broadly applicable for evaluating any manufacturing process change that could impact the total lithium consumed during formation.",
            "In this work, we demonstrated that low-SOC resistance (RLS) correlates to cycle life across two different battery formation protocols. As a predictive feature, RLS provided higher prediction accuracy compared to conventional measures of formation quality such as Coulombic efficiency as well as state-of-the art predictive features based on changes in discharge voltage curves. RLS is measurable at the end of the manufacturing line using ordinary battery test equipment and can be measured within seconds. Changes in RLS are attributed to differences in the amount of lithium consumed to the SEI during formation, where a decrease in RLS indicates that more lithium is consumed."
          ],
          "possibleSolutionToProblem": [
            "Adopting faster formation protocols and using the cell resistance measured at low states of charge as an early-life diagnostic feature for screening new formation protocols."
          ],
          "relevanceToProblem": [
            "The text discusses the impact of formation protocols on battery lifetime, which is directly related to the problem of prototype robotic prosthetic leg batteries not lasting long enough."
          ],
          "summary": [
            "The text discusses the potential of faster formation protocols in improving the lifetime of lithium-ion batteries. It identifies the cell resistance measured at low states of charge as a diagnostic feature that can predict battery lifetime. This signal is related to the quantity of lithium consumed during formation, and it can be used to evaluate any changes in the manufacturing process that could affect battery lifetime."
          ],
          "tags": [
            "Battery lifetime",
            "Formation protocols",
            "Cell resistance",
            "Lithium consumption",
            "Manufacturing process"
          ],
          "entities": [
            "Andrew Weng",
            "Peyman Mohtat",
            "Peter M. Attia",
            "Valentin Sulzer",
            "Suhak Lee",
            "Greg Less",
            "Anna Stefanopoulou",
            "Department of Mechanical Engineering, University of Michigan",
            "Department of Materials Science and Engineering, Stanford University",
            "University of Michigan Battery Lab"
          ],
          "references": [
            "Australian Trade and Investment Commission, The Lithium-Ion Battery Value Chain: New Economy Opportunities for Australia, tech. rep. (2018), p. 56.",
            "Benchmark Minerals Intelligence, EV Battery arms race enters new gear with 115 megafactories, Europe sees most rapid growth, 2019."
          ]
        }
      `
      ),
      new HumanChatMessage(
        `
        Problem Statement:
        ${problemStatement.description}

        Text Context:
        ${text}

        JSON Output:
      `
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
      IEngineConstants.getPageAnalysisModel.maxTokens;

    return { totalTokenCount, promptTokenCount };
  }

  async getInitialAnalysis(text: string) {
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

    let textAnalysis: IEngineWebPageAnalysisData;

    if (IEngineConstants.getPageAnalysisModel.tokenLimit < totalTokenCount) {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize:
          IEngineConstants.getPageAnalysisModel.tokenLimit -
          promptTokenCount.totalCount -
          128,
        chunkOverlap: 100,
      });

      this.logger.debug(
        `Splitting text into chunks of ${splitter.chunkSize} tokens`
      );

      const documents = await splitter.createDocuments([text]);

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

  async processPageText(text: string, problemIndex: number, url: string) {
    const textAnalysis = await this.getTextAnalysis(text);
    textAnalysis.url = url;
    textAnalysis.subProblemIndex = problemIndex;
    await this.webPageVectorStore.postWebPage(textAnalysis);
  }

  async getPdfText(response: HTTPResponse) {
    const pdfBuffer = await response.buffer();
    const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(" ");
    }

    return fullText;
  }

  async processPdf(response: HTTPResponse, problemIndex: number, url: string) {
    try {
      const text = await this.getPdfText(response);
      await this.processPageText(text, problemIndex, url);
    } catch (e) {
      this.logger.error(e);
    }
  }

  async processHtml(problemIndex: number, url: string, browserPage: Page) {
    try {
      const html = await browserPage.content();
      const text = htmlToText(html, {
        wordwrap: false,
      });
      await this.processPageText(text, problemIndex, url);
    } catch (e) {
      this.logger.error(e);
    }
  }

  async getBrowserPage(browserPage: Page, url: string) {
    let response;
    const redisKey = `pg_ca_v1:${url}`;
    const cachedPage = await redis.get(redisKey);

    if (cachedPage) {
      response = cachedPage;
    } else {
      response = await browserPage.goto(url, {
        timeout: IEngineConstants.getPageTimeout,
      });
      await redis.set(
        redisKey,
        response,
        "EX",
        IEngineConstants.getPageCacheExpiration
      );
    }

    return response;
  }

  async getAndProcessPage(
    problemIndex: number,
    url: string,
    browserPage: Page
  ) {
    const response = await this.getBrowserPage(browserPage, url);

    if (response) {
      if (url.toLowerCase().endsWith(".pdf")) {
        await this.processPdf(response, problemIndex, url);
      } else {
        await this.processHtml(problemIndex, url, browserPage);
      }

      return true;
    } else {
      this.logger.warn(`No response for url ${url} ${problemIndex}`);
      return false;
    }
  }

  async getAllPages(problemIndexUrls: string[][]) {
    puppeteer.launch({ headless: true }).then(async (browser) => {
      this.logger.debug("Launching browser");
      const browserPage = await browser.newPage();
      await browserPage.setUserAgent(IEngineConstants.currentUserAgent);

      for (
        let problemIndex = 0;
        problemIndex < problemIndexUrls.length;
        problemIndex++
      ) {
        if (problemIndexUrls[problemIndex].length === 0) {
          this.logger.warn(
            `No urls to process for problem index ${problemIndex}`
          );
        }

        for (let i = 0; i < problemIndexUrls[problemIndex].length; i++) {
          await this.getAndProcessPage(
            problemIndex,
            problemIndexUrls[problemIndex][i],
            browserPage
          );
        }
      }

      await this.saveMemory();

      await browser.close();
    });
  }

  async process() {
    this.logger.info("Search Web Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.getPageAnalysisModel.temperature,
      maxTokens: IEngineConstants.getPageAnalysisModel.maxTokens,
      modelName: IEngineConstants.getPageAnalysisModel.name,
      verbose: IEngineConstants.getPageAnalysisModel.verbose,
    });

    await this.getAllPages(
      this.memory.searchResults.orderedWebPagesToGet.general
    );
    await this.getAllPages(
      this.memory.searchResults.orderedWebPagesToGet.scientific
    );
  }
}
