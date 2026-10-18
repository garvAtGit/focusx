import { NextRequest, NextResponse } from "next/server";
import { processWebScanCore } from "@/lib/web-scanner";
import { getSession } from "@/app/actions/auth-actions";

export async function GET(request: NextRequest) {
  const t0 = performance.now();
  try {
    const url = new URL(request.url);
    const qrText = url.searchParams.get("qrText");
    const libraryId = url.searchParams.get("libraryId");
    const doorId = url.searchParams.get("doorId");
    
    if (!qrText || !libraryId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tSession = performance.now();
    const tCoreStart = performance.now();
    
    // Call the core logic
    const result = await processWebScanCore(qrText, libraryId, doorId || "WEB_SCANNER", sessionData);
    
    const tCoreEnd = performance.now();
    
    const finalResult = {
      ...result,
      _debug_timing: {
        total: tCoreEnd - t0,
        session: tSession - t0,
        core: tCoreEnd - tCoreStart
      }
    };
    
    console.log(`[API ROUTE GET] Total Time: ${tCoreEnd - t0}ms`);
    return NextResponse.json(finalResult);
  } catch (error: any) {
    console.error("[WebScan API Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
