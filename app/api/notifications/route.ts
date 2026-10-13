import { requireApi } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/http";
import { buildNotifications } from "@/lib/notifications";

/** Polled by the notification bell (every ~20 s while the portal is open). */
export async function GET() {
  const { admin, response } = await requireApi();
  if (response) return response;
  try {
    return ok(await buildNotifications(admin));
  } catch (error) {
    console.error("[GET /api/notifications]", error);
    return fail("Could not load notifications.", 500);
  }
}
