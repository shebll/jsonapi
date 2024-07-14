import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API,
  organization: "org-EbvpEbLJ50QexwnI2Sv0T8rV",
});
