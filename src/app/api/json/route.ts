import { NextRequest, NextResponse } from "next/server";
import { date, z, ZodTypeAny } from "zod";
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
 */

function extractType(format: any): any {
  console.log("extractType", format);
  if (!format.hasOwnProperty("type")) {
    if (Array.isArray(format)) return "array";
    else return typeof format;
  }
  return format["type"];
}
function extractSchema(format: any): any {
  console.log("extractSchema", format);

  const type = extractType(format);
  console.log("type", type);
  switch (type) {
    case "string":
      return z.string().nullable();
    case "number":
      return z.number().nullable();
    case "boolean":
      return z.boolean().nullable();
    case "symbol":
      return z.symbol().nullable();
    case "object":
      const shape: Record<string, ZodTypeAny> = {};
      for (const key in format) {
        if (key !== "type") {
          shape[key] = extractSchema(format[key]);
        }
      }
      return z.object(shape);
    case "array":
      return z.array(extractSchema(format.items)).nullable();
    case "function":
      return z.function().nullable();
    default:
      throw new Error("Unsupportable data type", type);
  }
}
export const POST = async (req: NextRequest) => {
  const body = await req.json();

  // step 1 make sure that data is valid
  const genericSchema = z.object({
    data: z.string(),
    format: z.object({}).passthrough(),
  });

  const { data, format } = genericSchema.parse(body);

  // step 2 make Schema from user format
  const extractedSchema = extractSchema(format);

  const { name, student, engineer, age } = extractedSchema.parse({
    name: "ahmed",
    student: false,
    engineer: false,
    age: 11,
  });
  // console.log("extractedSchema", extractedSchema);
  console.log("extractedSchema", name);
  console.log("extractedSchema", student);
  console.log("extractedSchema", age);
  console.log("extractedSchema", engineer);
  return new Response("ok");
};
