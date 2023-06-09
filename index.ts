// # Imports
import { config } from "dotenv";
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
import { decode, encode, isWithinTokenLimit } from "gpt-tokenizer";
import * as readline from "readline";
import * as fs from "fs";
import { promises as fsPromises } from "fs";
import { encoding_for_model, get_encoding } from "@dqbd/tiktoken";

config();
// # Variables
const apiKey = process.env.OPENAI_API_KEY;
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const tokensLimit = 4096;
const model = "gpt-3.5-turbo";
const userUI = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
// # Main

/* Plan
- Read file .txt or .docx, store it as a context
- Loop over context and split into 2000 tokens chunks
- Use davinci model to summarize the chunks
- Fed gpt the new summarized text and ask questions
*/
const fileName = "context";
const extensions = ["txt", "docx"];

/**
 * It checks for file existence based on fileName, path, and extensions. When it finds one it grabs it's content and pass it along to replace the newlines etc.
 * @returns context without any newlines and such
 */
async function readFileContext() {
  let context = "";
  for (let i = 0; i < extensions.length; i++) {
    const extension = extensions[i];
    const dir = `${fileName}.${extension}`;
    if (fs.existsSync(dir)) {
      // ! if it's not awaited it won't work.
      const data = await fsPromises.readFile(dir, "utf8");
      context = data;
      break;
    } else {
      if (i + 1 === extensions.length)
        throw new Error("Context file doesn't exist!");
    }
  }
  return context.replace(/\r?\n|\r/gm, " ");
}

// This code is taken from https://gist.github.com/ceifa/a607e715247dd90be7337d358c1d0769
/**
 * Loops over sentences and checks if the sentence is executed the max tokens, if it didn't it adds another sentence upon the old sentence and checks again until the tokens count reaches the max tokens or there are no more sentences. When it does it passes it into an array of chunks.
 * @param context
 * @returns chunks of text that doesn't execute the maximum tokens declared
 */
async function splitIntoChunks(context: string, maxTokens = tokensLimit / 4) {
  // const enc = encoding_for_model("gpt-3.5-turbo");
  // const tokens = enc.encode("hello world!");
  // enc.free();

  const tokenizer = get_encoding("cl100k_base");

  // Split sentences when you find a ". " (dot and next line)
  const sentences = context.split(". ");
  // Array of tokens length for each sentence (sentence contains)
  const nTokens = sentences.map(
    (sentence) => tokenizer.encode(" " + sentence).length
  );
  tokenizer.free();

  const chunks = [];
  let tokensSoFar = 0;
  let chunk = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const token = nTokens[i];

    // if the old sentences token + this sentence token executes the limit push it to the final chunk and reset current chunk
    // 400 + 101 = 501 > 500
    if (tokensSoFar + token > maxTokens) {
      chunks.push(chunk.join(". ") + ".");
      chunk = [];
      tokensSoFar = 0;
    }

    // if the token is larger the the maximum number of tokens, skip this iteration
    // 101 > 500
    if (token > maxTokens) {
      continue;
    }

    // 101 < 500
    // push the sentence to the chunk
    chunk.push(sentence);
    // add token count + 1 because we have added a dot
    tokensSoFar += token + 1;
  }

  // if there is a chunk exists push it to the final chunks array
  if (chunk) {
    chunks.push(chunk.join(". ") + ".");
  }

  return chunks;
}

// It need sleep but I'll ignore for now
// // TODO: Error when running from CMDER, Rate Limit! But when it gets run from vs terminal it doesn't break
// async function summarizeContext(contextChunks: string[]) {
//   const summarizedChunks: string[] = [];
//   for (let contextChunk of contextChunks) {
//     try {
//       const res = await openai.createCompletion({
//         model: "text-davinci-003",
//         prompt: `Context will be passed along. Summarize it in a way that makes it understandable, clear, and shorter in term of length, without making information loss. This context will be feed to gpt-3.5-turbo. The Context: ${contextChunk}`,
//         temperature: 1,
//         max_tokens: 500,
//         top_p: 1.0,
//         frequency_penalty: 0.0,
//         presence_penalty: 0.0,
//       });
//       console.log(res.data.choices[0]);
//       res.data.choices[0].text
//         ? summarizedChunks.push(
//             res.data.choices[0].text.trim().replace(/\r?\n|\r/gm, " ")
//           )
//         : console.log("A problem might have occurred!");
//     } catch (error) {
//       // throw new Error(`Error: ${error}`);
//     }
//   }
//   return summarizedChunks;
// }

/**
 * It checks if the answer contains a fail sentence, if it does it returns true (answerFailed).
 * @param answer
 * @returns boolean representing if the answer contains a fail message
 */
function checkIsAnswerFailed(answer: string) {
  const failAnswers = [
    "The context does not provide information",
    "I could not find an answer",
  ];

  return failAnswers.some((fail) => answer.includes(fail));
}

/**
 * Splits sentences into chunks if needed. Summarize or answer the question based on the question the user provided.
 * @param answers - Array of strings generated by gpt
 * @param question - User's question
 * @returns The final answer for the question
 */
async function conclusion(answers: string[], question: string) {
  console.log("Generating final text...");
  // Join sentences
  const answersCombined = answers.join("");
  const chunks = await splitIntoChunks(answersCombined, 500);
  let lastResponse = "";
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      sleep(1500);
      const res = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: `Use the provided context delimited by triple quotes to answer questions. The context: """${chunk}""".\nThe question: ${question}`,
        temperature: 0.2,
        max_tokens: 500,
        // top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        stop: null,
      });
      // Add response to the last response.
      lastResponse += res.data.choices[0].text?.replace(/\r?\n|\r/gm, " ");
    } catch (error) {
      console.log(error);
    }

    return lastResponse.trim();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const context = await readFileContext();
  const chunks = await splitIntoChunks(context);
  // await summarizeContext(chunks);
  console.log("Chunks count:", chunks.length);

  // const userMessages: ChatCompletionRequestMessage[] = [];
  let answers: string[] = [];
  const systemDeclaration = `Use the provided context delimited by triple quotes to answer questions. If the answer cannot be found in the context, write "I could not find an answer.". Don't repeat the question just answer it.`;

  // Provide prompt
  userUI.prompt();
  // Listen to line
  userUI.on("line", async (input) => {
    console.log(`Loading chunks...`);
    // Loop over each chunk and ask gpt a question about the chunk
    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j];
      console.log(`${j} out of ${chunks.length} loaded.`);
      const query = `
      Context: """${chunk}"""
      Question: ${input}
      `;
      try {
        const res = await openai.createChatCompletion({
          model,
          messages: [
            { role: "system", content: systemDeclaration },
            // ...userMessages,
            { role: "user", content: query },
          ],
          temperature: 0,
          max_tokens: 500,
          // top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });
        // Check answer if it does contains FAIL answers. If it does skip iteration.
        const answer = res.data.choices[0].message?.content;
        if (answer) {
          console.log("Chunks answer: ", answer?.trim());
          const isAnswerFailed = checkIsAnswerFailed(answer);
          if (isAnswerFailed) {
            continue;
          } else {
            answers.push(answer);
          }
        } else {
          throw new Error("Answer doesn't exist!");
        }
      } catch (error) {
        console.log(error);
      }
      await sleep(500);
    }
    const finalAnswer = await conclusion(answers, input);
    console.log("Final answer: ", finalAnswer);
    answers = [];
    // userMessages.push({ role: "user", content: input });
    userUI.prompt();
  });
})();

// text-davinci-003
// gpt-3.5-turbo
// const res = await openai.createCompletion({
//   model: "text-davinci-003",
//   prompt: systemDeclaration + query,
//   temperature: 0,
//   max_tokens: 150,
//   top_p: 1,
//   frequency_penalty: 0,
//   presence_penalty: 0,
//   stop: null,
// });
