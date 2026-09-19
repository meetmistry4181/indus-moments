import { supabase } from "./supabase";

export async function getPrivatePhotoUrl(
  path: string,
  expiresIn = 300
) {
  const { data, error } = await supabase.storage
    .from("event-photos")
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Could not create signed URL:", error);
    return null;
  }

  return data.signedUrl;
}