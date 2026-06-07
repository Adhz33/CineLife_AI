import { getTrailerJob } from "@/lib/providers";

export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "";

  if (!jobId || !userId) {
    return jsonResponse({ error: "jobId and userId are required." }, 400);
  }

  try {
    const job = await getTrailerJob(jobId, userId);

    return jsonResponse({
      jobId,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      error: job.error,
      resultVideoUrl: job.result_video_url,
      downloadUrl: job.download_url ?? job.result_video_url,
      metadata: job.metadata ?? {},
      updatedAt: job.updated_at,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "Unable to load trailer job.",
      },
      404,
    );
  }
}
