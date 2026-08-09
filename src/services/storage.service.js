import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage, getWorkshopId } from "../firebase/client";

export async function uploadOrderPhotos(orderId, files = []) {
  const workshopId = getWorkshopId();
  const uploads = Array.from(files).map(async (file) => {
    const extension = file.name.split(".").pop() || "jpg";
    const path = `workshops/${workshopId}/orders/${orderId}/receipts/${crypto.randomUUID()}.${extension}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: { orderId }
    });
    return {
      name: file.name,
      path,
      url: await getDownloadURL(storageRef)
    };
  });
  return Promise.all(uploads);
}
