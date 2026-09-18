import prisma from "@/lib/prisma";

export async function publishOutbox(eventId: string) {
  const outbox = await prisma.realtimeOutbox.findUnique({ where: { eventId } });
  if (!outbox || outbox.isPublished) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  try {
    const checkinLog = await prisma.checkinLog.findUnique({
      where: { id: outbox.checkinLogId! },
      select: { libraryId: true, status: true, timestamp: true }
    });

    const headers = {
      'apikey': supabaseKey,
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json'
    };

    // 1. Publish to Student Private Channel (Full payload)
    const studentTopic = `scan:${encodeURIComponent(outbox.studentId!)}`;
    const studentEvent = encodeURIComponent('scan_result');
    const studentUrl = `${supabaseUrl}/realtime/v1/api/broadcast/${studentTopic}/events/${studentEvent}?private=true`;

    const tStart = performance.now();
    let studentResStatus = 0;
    let studentResError = "";
    
    try {
      const studentRes = await fetch(studentUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(outbox.payload)
      });
      studentResStatus = studentRes.status;
      if (!studentRes.ok) studentResError = await studentRes.text();
    } catch (e: any) {
      studentResError = String(e);
    }
    
    const elapsedMs = performance.now() - tStart;
    
    console.log(JSON.stringify({
      marker: "REALTIME_T3",
      eventId: outbox.eventId,
      topic: studentTopic,
      event: "scan_result",
      status: studentResStatus,
      elapsedMs: Math.round(elapsedMs),
      success: studentResStatus >= 200 && studentResStatus < 300,
      error: studentResError || undefined
    }));

    if (studentResStatus < 200 || studentResStatus >= 300) {
      throw new Error(`Supabase REST Error (Student): ${studentResError}`);
    }

    // 2. Publish to Librarian Private Channel (Minimal payload without PII)
    if (checkinLog) {
      const libTopic = `library_scans:${encodeURIComponent(checkinLog.libraryId)}`;
      const libEvent = encodeURIComponent('scanner_update');
      const libUrl = `${supabaseUrl}/realtime/v1/api/broadcast/${libTopic}/events/${libEvent}?private=true`;
      
      const libPayload = {
        status: checkinLog.status,
        eventId: outbox.eventId,
        timestamp: checkinLog.timestamp.toISOString(),
        doorId: (outbox.payload as any)?.doorId
      };

      const libRes = await fetch(libUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(libPayload)
      });
      if (!libRes.ok) console.error('Supabase REST Error (Library): ' + await libRes.text());
    }

    await prisma.realtimeOutbox.update({
      where: { id: outbox.id },
      data: { isPublished: true, attempts: { increment: 1 } }
    });
  } catch (error) {
    console.error('[Realtime Publisher] Failed for ' + eventId + ':', error);
    const nextAttempt = new Date(Date.now() + Math.pow(2, outbox.attempts) * 10000);
    await prisma.realtimeOutbox.update({
      where: { id: outbox.id },
      data: { attempts: { increment: 1 }, lastError: String(error), nextAttemptAt: nextAttempt }
    });
  }
}
