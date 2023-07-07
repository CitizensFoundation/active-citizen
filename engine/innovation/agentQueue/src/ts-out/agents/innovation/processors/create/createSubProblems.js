import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage, } from "langchain/schema";
import { IEngineConstants } from "../../../../constants.js";
export class CreateSubProblemsProcessor extends BaseProcessor {
    async renderRefinePrompt(results) {
        const messages = [
            new SystemChatMessage(`
            As an AI expert, your role involves the analysis and refinement of problem statements, along with the creation of sub-problems. Please keep these guidelines in mind:

            1. Refine the given sub-problems and present them as a JSON array.
            2. Maintain the JSON output format strictly for the sub-problems.
            3. Use your extensive knowledge to enrich the details about the sub-problems.
            4. Elaborate on the impact of these sub-problems, if necessary, to provide better context.
            5. Refrain from providing solutions; your focus should be on explicating the problems.
            6. Avoid suggesting tasks or actions; your task is to explain the problems.
            7. Do not provide output in markdown format.
            8. Adopt a systematic and detailed approach for this task and proceed in a step-by-step manner.`),
            new HumanChatMessage(`
           Problem Statement:
           "${this.memory.problemStatement.description}"

           Review and Refine the Following Sub-Problems (in JSON format):
           ${JSON.stringify(results, null, 2)}

           Refined Sub-Problems (in JSON format):
         `),
        ];
        return messages;
    }
    async renderCreatePrompt() {
        //TODO: Human review and improvements of those GPT-4 generated few-shots
        const messages = [
            new SystemChatMessage(`
            As an AI expert, you are tasked with the analysis of problem statements and generation of sub-problems. Please adhere to the following guidelines:

            1. Create 21 clear and concise sub-problems for any given problem statement and present them as a JSON array.
            2. Ensure to strictly adhere to the JSON format for outputting the sub-problems.
            3. The output should exclusively consist of the JSON array.
            4. Refrain from providing output in markdown format.
            5. Approach this task in a systematic and detailed manner, proceeding step-by-step.

            Below are some examples for your reference:

            Problem Statement:
            "Increasing obesity rates in a mid-sized urban population"

            Output:
            [
              {
                "title": "Poor Nutritional Awareness",
                "description": "A significant part of the population may not fully understand the nutritional content of their diet. This lack of knowledge can lead to poor food choices, contributing to obesity."
              },
              {
                "title": "Limited Access to Healthy Foods",
                "description": "Food deserts, areas where access to affordable, healthy food options is limited, may exist in the city. This restricted access can push residents towards unhealthy, processed food options."
              },
              {
                "title": "Lack of Physical Activity",
                "description": "Sedentary lifestyles, often stemming from desk-bound jobs and increasing screen time, can contribute to weight gain and obesity."
              },
              {
                "title": "Environmental Factors",
                "description": "The city might lack safe, accessible spaces for outdoor physical activities. Without such spaces, residents might find it difficult to maintain a regular exercise regimen."
              },
              {
                "title": "Socioeconomic Factors",
                "description": "Lower-income households may find it difficult to afford healthier food options or gym memberships, influencing their ability to maintain a healthy weight."
              },
              {
                "title": "Education and Outreach",
                "description": "A lack of effective health education programs in schools and communities could result in limited awareness about the importance of maintaining a healthy weight and how to do so."
              },
              {
                "title": "Policy and Legislation",
                "description": "Current government policies might not support or incentivize healthy lifestyles or food choices, contributing to an environment that facilitates obesity."
              }
            ]

            Problem Statement:
            "Declining local biodiversity in a mid-sized coastal town due to urban development."

            Output:
            [
              {
                "title": "Habitat Destruction",
                "description": "New developments, such as buildings or roads, are removing or fragmenting natural habitats, thereby reducing the living spaces and resources available for local species."
              },
              {
                "title": "Pollution",
                "description": "Construction and daily human activities contribute to water, air, and soil pollution. This degradation of natural resources can harm local species and disrupt ecosystems."
              },
              {
                "title": "Climate Change Impacts",
                "description": "Global warming impacts like rising temperatures and sea levels can alter the local environment, affecting species' survival and disrupting ecological balance."
              },
              {
                "title": "Invasive Species",
                "description": "Introduction of non-native species can create competition for local species and upset the ecological balance. These invasive species can alter habitats and out-compete native species."
              },
              {
                "title": "Overexploitation",
                "description": "Overfishing or overhunting can lead to a rapid decline in local species populations. This imbalance in the ecosystem can affect biodiversity."
              },
              {
                "title": "Lack of Awareness",
                "description": "Community members may not understand the importance of biodiversity, leading to behavior that inadvertently harms local ecosystems. This gap in awareness can hinder conservation efforts."
              },
              {
                "title": "Policy and Legislation",
                "description": "Existing laws and regulations may fail to protect local biodiversity adequately. This deficiency in policy could permit harmful practices to persist, thereby affecting biodiversity."
              }
            ]

            Problem Statement:
            "Increasing high school dropout rates in a mid-sized city school district"

            Output:
            [
              {
                "title": "Academic Challenges",
                "description": "Students often grapple with academic subjects, and the lack of adequate assistance exacerbates these difficulties. The lack of personalized attention or tutoring opportunities can contribute to poor performance and disinterest."
              },
              {
                "title": "Lack of Engagement",
                "description": "The existing curriculum and school activities might not resonate with students' interests or cater to different learning styles. This lack of engagement can demotivate students and make school seem irrelevant, increasing dropout risks."
              },
              {
                "title": "Socioeconomic Factors",
                "description": "SFor students from low-income families, economic pressures might force them into work to support their families instead of attending school. This economic necessity may lead to inconsistent attendance or eventual dropping out."
              },
              {
                "title": "Family Issues",
                "description": "Unstable home environments or lack of familial support can negatively affect students' school performance and attendance. Emotional stress or responsibilities at home can distract from educational commitment."
              },
              {
                "title": "School Environment",
                "description": "Limited resources, safety concerns, or issues like bullying within the school can create an unwelcoming environment, discouraging regular attendance and fostering a desire to leave school."
              },
              {
                "title": "Lack of Future Orientation",
                "description": "If students fail to perceive the relevance of a high school diploma to their future career plans, they may not see the value in completing their education. This lack of future orientation can fuel dropout rates."
              },
              {
                "title": "Policy and Legislation",
                "description": "Existing education policies might not effectively target dropout prevention and intervention, making it difficult to address and curb the issue at a systemic level."
              }
            ]

            Problem Statement:
            "Improving the efficiency and accuracy of patient record management in a mid-sized hospital"
            [
              {
                "title": "Information Consolidation",
                "description": "Patient data is scattered across various systems like EHRs, lab systems, etc. This dispersion hampers quick access and smooth data transfer, leading to inefficiencies and potential information loss or discrepancies."
              },
              {
                "title": "Interoperability",
                "description": "Different hospital systems may not communicate well, leading to isolated information and process inefficiencies. For example, an update in a patient's medication record may not reflect in their primary health record."
              },
              {
                "title": "Data Accuracy",
                "description": "Manual data input increases the risk of human error, including misspellings, transcription errors, or inconsistent data entry, potentially causing harmful consequences such as misdiagnoses."
              },
              {
                "title": "Security and Privacy",
                "description": "The risk of data breaches increases with digitization. Hospitals must ensure secure handling of sensitive patient information, maintain patient confidentiality, and comply with regulations like HIPAA, which presents significant challenges."
              },
              {
                "title": "Ease of Use",
                "description": "Complex or counterintuitive user interfaces in patient record systems can lead to inefficiencies and errors. Staff may waste time navigating the system or input incorrect data due to confusion."
              },
              {
                "title": "Staff Training",
                "description": "Training staff on system use is essential but can be time-consuming, costly, and require regular refreshers. Ensuring staff use the system correctly and consistently post-training is another challenge."
              },
              {
                "title": "Budget Constraints",
                "description": " Mid-sized hospitals often face budget constraints. Investing in new systems involves considering the cost of the system, maintenance, updates, training, and potential cost of system failures or violations, posing a significant financial challenge."
              }
            ]
            `),
            new HumanChatMessage(`
           Problem Statement:
           "${this.memory.problemStatement.description}"

           Sub-Problems (in JSON format):
         `),
        ];
        return messages;
    }
    async createSubProblems() {
        let results = (await this.callLLM("create-sub-problems", IEngineConstants.createSubProblemsModel, await this.renderCreatePrompt()));
        if (IEngineConstants.enable.refine.createSubProblems) {
            results = await this.callLLM("create-sub-problems", IEngineConstants.createSubProblemsModel, await this.renderRefinePrompt(results));
        }
        this.memory.subProblems = results;
        await this.saveMemory();
    }
    async process() {
        this.logger.info("Sub Problems Processor");
        super.process();
        this.chat = new ChatOpenAI({
            temperature: IEngineConstants.createSubProblemsModel.temperature,
            maxTokens: IEngineConstants.createSubProblemsModel.maxOutputTokens,
            modelName: IEngineConstants.createSubProblemsModel.name,
            verbose: IEngineConstants.createSubProblemsModel.verbose,
        });
        await this.createSubProblems();
    }
}
