import { supabase } from "@/integrations/supabase/client";
import type { PhotoItem } from "./MultiPhotoUploader";

export const uploadPhotos = async (
  userId: string,
  photos: PhotoItem[]
): Promise<string[]> => {
  const urls: string[] = [];

  for (const photo of photos) {
    if (!photo.isNew || !photo.file) {
      urls.push(photo.url);
      continue;
    }
    const fileExt = photo.file.name.split(".").pop();
    const filePath = `${userId}/${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage
      .from("service-photos")
      .upload(filePath, photo.file);
    if (error) throw error;
    const { data } = supabase.storage.from("service-photos").getPublicUrl(filePath);
    urls.push(data.publicUrl);
  }

  return urls;
};
