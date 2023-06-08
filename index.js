"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// # Imports
var dotenv_1 = require("dotenv");
var openai_1 = require("openai");
var readline = require("readline");
var fs = require("fs");
var fs_1 = require("fs");
var tiktoken_1 = require("@dqbd/tiktoken");
(0, dotenv_1.config)();
// # Variables
var apiKey = process.env.OPENAI_API_KEY;
var configuration = new openai_1.Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
var openai = new openai_1.OpenAIApi(configuration);
var tokensLimit = 4096;
var model = "gpt-3.5-turbo";
var userUI = readline.createInterface({
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
var fileName = "context";
var extensions = ["txt", "docx"];
/**
 * It checks for file existence based on fileName, path, and extensions. When it finds one it grabs it's content and pass it along to replace the newlines etc.
 * @returns context without any newlines and such
 */
function readFileContext() {
    return __awaiter(this, void 0, void 0, function () {
        var context, i, extension, dir, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = "";
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < extensions.length)) return [3 /*break*/, 5];
                    extension = extensions[i];
                    dir = "".concat(fileName, ".").concat(extension);
                    if (!fs.existsSync(dir)) return [3 /*break*/, 3];
                    return [4 /*yield*/, fs_1.promises.readFile(dir, "utf8")];
                case 2:
                    data = _a.sent();
                    context = data;
                    return [3 /*break*/, 5];
                case 3:
                    if (i + 1 === extensions.length)
                        throw new Error("Context file doesn't exist!");
                    _a.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/, context.replace(/\r?\n|\r/gm, " ")];
            }
        });
    });
}
// This code is taken from https://gist.github.com/ceifa/a607e715247dd90be7337d358c1d0769
/**
 * Loops over sentences and checks if the sentence is executed the max tokens, if it didn't it adds another sentence upon the old sentence and checks again until the tokens count reaches the max tokens or there are no more sentences. When it does it passes it into an array of chunks.
 * @param context
 * @returns chunks of text that doesn't execute the maximum tokens declared
 */
function splitIntoChunks(context, maxTokens) {
    if (maxTokens === void 0) { maxTokens = tokensLimit / 4; }
    return __awaiter(this, void 0, void 0, function () {
        var tokenizer, sentences, nTokens, chunks, tokensSoFar, chunk, i, sentence, token;
        return __generator(this, function (_a) {
            tokenizer = (0, tiktoken_1.get_encoding)("cl100k_base");
            sentences = context.split(". ");
            nTokens = sentences.map(function (sentence) { return tokenizer.encode(" " + sentence).length; });
            tokenizer.free();
            chunks = [];
            tokensSoFar = 0;
            chunk = [];
            for (i = 0; i < sentences.length; i++) {
                sentence = sentences[i];
                token = nTokens[i];
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
            return [2 /*return*/, chunks];
        });
    });
}
// TODO: Error when running from CMDER, Rate Limit! But when it gets run from vs terminal it doesn't break
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
function checkIsAnswerFailed(answer) {
    var failAnswers = [
        "The context does not provide information",
        "I could not find an answer",
    ];
    return failAnswers.some(function (fail) { return answer.includes(fail); });
}
function conclusion(answers, question) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var answersCombined, chunks, lastResponse, i, chunk, res, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("Generating final text...");
                    answersCombined = answers.join("");
                    return [4 /*yield*/, splitIntoChunks(answersCombined, 500)];
                case 1:
                    chunks = _b.sent();
                    lastResponse = "";
                    i = 0;
                    _b.label = 2;
                case 2:
                    if (!(i < chunks.length)) return [3 /*break*/, 8];
                    chunk = chunks[i];
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    sleep(1500);
                    return [4 /*yield*/, openai.createCompletion({
                            model: "text-davinci-003",
                            prompt: "Use the provided context delimited by triple quotes to answer questions. The context: \"\"\"".concat(chunk, "\"\"\".\nThe question: ").concat(question),
                            temperature: 0.2,
                            max_tokens: 500,
                            // top_p: 1.0,
                            frequency_penalty: 0.0,
                            presence_penalty: 0.0,
                            stop: null,
                        })];
                case 4:
                    res = _b.sent();
                    lastResponse += (_a = res.data.choices[0].text) === null || _a === void 0 ? void 0 : _a.replace(/\r?\n|\r/gm, " ");
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _b.sent();
                    console.log(error_1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/, lastResponse];
                case 7:
                    i++;
                    return [3 /*break*/, 2];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function sleep(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var context, chunks, userMessages, answers, systemDeclaration;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, readFileContext()];
            case 1:
                context = _a.sent();
                return [4 /*yield*/, splitIntoChunks(context)];
            case 2:
                chunks = _a.sent();
                // await summarizeContext(chunks);
                console.log("Chunks count:", chunks.length);
                userMessages = [];
                answers = [];
                systemDeclaration = "Use the provided context delimited by triple quotes to answer questions. If the answer cannot be found in the context, write \"I could not find an answer.\". Don't repeat the question just answer it.";
                userUI.prompt();
                userUI.on("line", function (input) { return __awaiter(void 0, void 0, void 0, function () {
                    var j, chunk, query, res, answer, isAnswerFailed, error_2, finalAnswer;
                    var _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                console.log("Loading chunks...");
                                j = 0;
                                _b.label = 1;
                            case 1:
                                if (!(j < chunks.length)) return [3 /*break*/, 8];
                                chunk = chunks[j];
                                console.log("".concat(j, " out of ").concat(chunks.length, " loaded."));
                                query = "\n      Context: \"\"\"".concat(chunk, "\"\"\"\n      Question: ").concat(input, "\n      ");
                                _b.label = 2;
                            case 2:
                                _b.trys.push([2, 4, , 5]);
                                return [4 /*yield*/, openai.createChatCompletion({
                                        model: model,
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
                                    })];
                            case 3:
                                res = _b.sent();
                                answer = (_a = res.data.choices[0].message) === null || _a === void 0 ? void 0 : _a.content;
                                console.log(answer, "here");
                                if (answer) {
                                    isAnswerFailed = checkIsAnswerFailed(answer);
                                    if (isAnswerFailed) {
                                        return [3 /*break*/, 7];
                                    }
                                    else {
                                        answers.push(answer);
                                    }
                                }
                                else {
                                    throw new Error("Answer doesn't exist!");
                                }
                                return [3 /*break*/, 5];
                            case 4:
                                error_2 = _b.sent();
                                console.log(error_2);
                                return [3 /*break*/, 5];
                            case 5: return [4 /*yield*/, sleep(500)];
                            case 6:
                                _b.sent();
                                _b.label = 7;
                            case 7:
                                j++;
                                return [3 /*break*/, 1];
                            case 8: return [4 /*yield*/, conclusion(answers, input)];
                            case 9:
                                finalAnswer = _b.sent();
                                console.log(finalAnswer);
                                console.log(answers);
                                answers = [];
                                // userMessages.push({ role: "user", content: input });
                                userUI.prompt();
                                return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/];
        }
    });
}); })();
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
// TODO: Accuracy, optimization, summarizing summary data. Loading chunks twice problem. It should load once
