import { getCineLifeConfigDiagnostics } from "@/lib/providers";

export async function GET() {
  return Response.json(await getCineLifeConfigDiagnostics(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
