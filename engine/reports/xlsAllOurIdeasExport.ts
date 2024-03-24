import ExcelJS from "exceljs";
import fetch from "node-fetch";
import { Headers } from "node-fetch";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import models from "../../../models/index.cjs";
import {
  setJobError,
  updateUploadJobStatus,
  uploadToS3,
} from "./commonUtils.js";
import { AnyLengthString } from "aws-sdk/clients/comprehendmedical.js";

const dbModels: Models = models;
const Image = dbModels.Image as ImageClass;

const PAIRWISE_API_HOST = process.env.PAIRWISE_API_HOST; // Your API host
const defaultAuthHeader = new Headers({
  "Content-Type": "application/json",
  Authorization: `Basic ${Buffer.from(
    `${process.env.PAIRWISE_USERNAME}:${process.env.PAIRWISE_PASSWORD}`
  ).toString("base64")}`,
});

async function fetchChoices(
  questionId: number,
  utmSource?: string
): Promise<AoiChoiceData[]> {
  try {
    const url = `${PAIRWISE_API_HOST}/questions/${questionId}/choices.json?include_inactive=true&show_all=true${
      utmSource ? `?utm_source=${utmSource}` : ""
    }`;
    const response = await fetch(url, {
      method: "GET",
      headers: defaultAuthHeader,
    });

    console.log(url);

    if (!response.ok) {
      console.error(response.statusText);
      throw new Error("Fetching choices failed.");
    }

    const choices = (await response.json()) as AoiChoiceData[];
    return choices;
  } catch (error) {
    console.error("Error fetching choices:", error);
    throw error;
  }
}

async function fetchVotes(
  questionId: number,
  choiceId: number,
  utmSource?: string
): Promise<{ winning_votes: AoiVoteData[]; losing_votes: AoiVoteData[] }> {
  try {
    let url = `${PAIRWISE_API_HOST}/questions/${questionId}/choices/${choiceId}/show_votes.json`;
    if (utmSource) {
      url += `&utm_source=${utmSource}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: defaultAuthHeader,
    });

    if (!response.ok) {
      console.error(response.statusText);
      throw new Error("Fetching votes failed.");
    }

    const votes = (await response.json()) as {
      winning_votes: AoiVoteData[];
      losing_votes: AoiVoteData[];
    };
    return votes;
  } catch (error) {
    console.error("Error fetching votes:", error);
    throw error;
  }
}

export async function exportChoiceVotes(
  workPackage: AcXlsExportJobData,
  done: (error: Error | undefined, url?: string | undefined) => void
) {
  try {
    await updateUploadJobStatus(workPackage.jobId, 5);

    console.log(
      `Exporting choice votes for question ${workPackage.questionId} with utm_source ${workPackage.utmSource}`
    );

    const choices = (await fetchChoices(
      workPackage.questionId,
      workPackage.utmSource
    )) as AoiChoiceData[];
    console.log(`Found ${choices.length} choices`);

    const workbook = new ExcelJS.Workbook();
    const choicesSheet = workbook.addWorksheet("Choices");
    const winningVotesSheet = workbook.addWorksheet("Winning Votes");
    const losingVotesSheet = workbook.addWorksheet("Losing Votes");

    // Setting the headers
    const choicesHeaders = [
      "Id",
      "Question Id",
      "Wins",
      "Losses",
      "Votes",
      "Score",
      "Data",
      "Elo Rating",
      "Seed",
    ];
    choicesSheet.addRow(choicesHeaders);

    const votesHeaders = [
      "Id",
      "Voter Id",
      "Question Id",
      "Prompt Id",
      "Choice Id",
      "Loser Choice Id",
      "Created At",
      "Updated At",
      "Time Viewed",
      "UTM Source",
      "UTM Campaign",
      "UTM Medium",
      "UTM Content",
    ];
    winningVotesSheet.addRow(votesHeaders);
    losingVotesSheet.addRow(votesHeaders);

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      const votes = (await fetchVotes(
        workPackage.questionId,
        choice.id,
        workPackage.utmSource
      )) as {
        winning_votes: AoiVoteData[];
        losing_votes: AoiVoteData[];
      };

      const voteCount = choice.wins + choice.losses;

      choicesSheet.addRow([
        choice.id,
        choice.question_id,
        choice.wins,
        choice.losses,
        voteCount,
        choice.score,
        choice.data,
        "N/A",
        "N/A",
      ]);

      votes.winning_votes.forEach((vote) => {
        winningVotesSheet.addRow([
          vote.id,
          vote.voter_id,
          vote.question_id,
          vote.prompt_id,
          vote.choice_id,
          vote.loser_choice_id,
          vote.created_at,
          vote.updated_at,
          vote.time_viewed,
          vote.tracking!.utmSource,
          vote.tracking!.utmCampaign,
          vote.tracking!.utmMedium,
          vote.tracking!.utmContent,
        ]);
      });

      votes.losing_votes.forEach((vote) => {
        losingVotesSheet.addRow([
          vote.id,
          vote.voter_id,
          vote.question_id,
          vote.prompt_id,
          vote.choice_id,
          vote.loser_choice_id,
          vote.created_at,
          vote.updated_at,
          vote.time_viewed,
          vote.tracking!.utmSource,
          vote.tracking!.utmCampaign,
          vote.tracking!.utmMedium,
          vote.tracking!.utmContent,
        ]);
      });

      const progress = Math.round((i / choices.length) * 95); // Scale to 95% maximum to leave room for final steps
      await updateUploadJobStatus(workPackage.jobId, progress);
    }

    // Generate and upload the workbook to S3
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `choice_votes_${uuidv4()}.xlsx`;

    console.log(`Uploading choice votes to S3: ${filename}`);

    uploadToS3(
      workPackage.jobId,
      `${workPackage.userId}`,
      filename,
      workPackage.exportType,
      buffer,
      async (error, url) => {
        if (error) {
          console.error("Error uploading choice votes to S3:", error);
          done(error, url);
        } else {
          console.log(`Uploaded choice votes to S3: ${url}`);
          await updateUploadJobStatus(workPackage.jobId, 100, {
            reportUrl: url,
          });
          done(undefined, url);
        }
      }
    );

    console.log(
      `Successfully exported and uploaded choice votes for question ${workPackage.questionId}`
    );
  } catch (error: any) {
    console.error("Error exporting choice votes:", error);
    await setJobError(workPackage.jobId, "Error exporting choice votes");
    done(error);
  }
}