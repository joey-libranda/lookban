"use client";

import { ImageUploader } from "./ImageUploader";
import { setStoreImageAction } from "@/server/actions/admin";

/** Client wrapper so the upload callback is created on the client (functions can't be passed from server pages). */
export function StoreImageUploader({ storeId, kind }: { storeId: string; kind: "logo" | "cover" }) {
  return <ImageUploader bucket="store-assets" folder={storeId} label={`Upload ${kind}`}
                        onUploaded={(p) => setStoreImageAction(storeId, kind, p)} />;
}
