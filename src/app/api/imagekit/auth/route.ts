import { NextResponse } from "next/server";
import ImageKit from "imagekit";

function getImageKitClient(): ImageKit {
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error('ImageKit is not configured (NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY / IMAGEKIT_PRIVATE_KEY / NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)');
  }
  return new ImageKit({ publicKey, privateKey, urlEndpoint });
}

export async function GET() {
  try {
    const { getSession } = await import('@/app/actions/auth-actions');
    const session = await getSession();
    if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authParams = getImageKitClient().getAuthenticationParameters();
    return NextResponse.json(authParams);
  } catch {
    return NextResponse.json({ error: "Failed to generate auth params" }, { status: 500 });
  }
}
