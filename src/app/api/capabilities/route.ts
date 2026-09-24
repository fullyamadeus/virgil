import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ai: Boolean(process.env.OPENAI_API_KEY) || process.env.AI_TEST_MODE === "true", testMode: process.env.AI_TEST_MODE === "true" });
}
