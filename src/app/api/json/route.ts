import { EXAMPLE_ANSWER, EXAMPLE_PROMPT } from "@/lib/example";
import { openai } from "@/lib/openai";
import { NextRequest, NextResponse } from "next/server";
import { date, z, ZodTypeAny } from "zod";

// export const runtime = "edge";
/*
input : 
{
    "data":"my name is ahmed i am a 22 years old , i worked as a software engineer",
    "format":{
        "name":{"type":"string"},
        "age":{"type":"number"},
        "student":{"type":"boolean"},
        "engineer":{"type":"boolean"}
    }
}

output :
{
    "name":"ahmed",
    "age":22,
    "student":false,
    "engineer": true
}

example : 

  -extract data and format :
    "data":"my name is ahmed i am a 22 years old , i worked as a software engineer",
    "format":{"name":{"type":"string"} }

  -make schema form the format json  :
    if it object make a shape key will be "format" and call function again 
    if it object make a shape key will be "name" and call function again 
    if it object and the key is type call extract type to get the value "string" and make a zod.string().nullable()

    { format : { name:zod.string().nullable() } } the zod schema 
 */

type promiseExecutor<T> = (
  resolve: (value: T) => void,
  reject: (reason?: any) => void
) => void;

class RetirablePromise<T> extends Promise<T> {
  static async retry<T>(
    retries: number,
    executor: promiseExecutor<T>
  ): Promise<T> {
    return new RetirablePromise(executor).catch((error) => {
      console.error(`retry `, { error });
      return retries > 0
        ? RetirablePromise.retry(retries - 1, executor)
        : RetirablePromise.reject(error);
    });
  }
}

function extractType(format: any): any {
  console.log("extractType function", format);
  if (!format.hasOwnProperty("type")) {
    if (Array.isArray(format)) return "array";
    else return typeof format;
  }
  return format["type"];
}
function extractSchema(format: any): ZodTypeAny {
  console.log("extractSchema function input", format);

  const type = extractType(format);
  console.log(type);
  switch (type) {
    case "string":
      return z.string().nullable();

    case "number":
      return z.number().nullable();

    case "boolean":
      return z.boolean().nullable();

    case "symbol":
      return z.symbol().nullable();

    case "array":
      console.log("format.items", format);
      return z.array(extractSchema(format.items)).nullable();

    case "function":
      return z.function().nullable();

    case "object":
      //  if it object make a key and value to store key and zod type  at first it be any
      const shape: Record<string, ZodTypeAny> = {};

      // {"name":{"type":"string"} } --> name :zodSchemaTypeForString()
      for (const key in format) {
        if (key !== "type") {
          shape[key] = extractSchema(format[key]); // this will go deep into object and extract type with extractType
        }
      }

      return z.object(shape);

    default:
      throw new Error("Unsupportable data type", type);
  }
}
export const POST = async (req: NextRequest) => {
  const body = await req.json();

  // step 1 make sure that data is valid {date : string , formate : object 'do not know what will be in side it' }
  const genericSchema = z.object({
    data: z.string(),
    /*
      if you know exactly what will be in this object 
      format: z.object({ you know: z.string() })

      if you know exactly what will be in this object and other do not know 
      format: z.object({ you know: z.string() }).passthrough()

      if you do not like in our case 
      format: z.object({}).passthrough()
     */
    format: z.object({}).passthrough(),
  });

  const { data, format } = genericSchema.parse(body);

  const content = `DATA: \n"${data}"\n\n-----------\nExpected JSON format: ${JSON.stringify(
    format,
    null,
    2
  )}\n\n-----------\nValid JSON output in expected format:`;

  // step 2 make Schema from user format
  const extractedSchema = extractSchema(format);
  // console.log("extractedSchema", extractedSchema);

  // step 3 : retry mechanism
  const validationResult = await RetirablePromise.retry(
    1,
    async (resolve, reject) => {
      try {
        const res = await openai.chat.completions.create({
          model: "gpt-3.5-turbo-16k",
          messages: [
            {
              role: "assistant",
              content:
                "You are an AI that converts unstructured data into the attached JSON format. You respond with nothing but valid JSON based on the input data. Your output should DIRECTLY be valid JSON, nothing added before or after. You will begin right with the opening curly brace and end with the closing curly brace. Only if you absolutely cannot determine a field, use the value null.",
            },
            {
              role: "user",
              content: EXAMPLE_PROMPT,
            },
            {
              role: "system",
              content: EXAMPLE_ANSWER,
            },
            {
              role: "user",
              content,
            },
          ],
          temperature: 1,
          max_tokens: 256,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });

        const text = res.choices[0].message.content;

        const validationResult = extractedSchema.parse(JSON.parse(text || ""));

        return resolve(validationResult);
      } catch (error) {
        reject(error);
      }
    }
  );

  return NextResponse.json(validationResult, { status: 200 });
};
