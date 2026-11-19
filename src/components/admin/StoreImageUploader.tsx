"use client";

import { ImageUploader } from "./ImageUploader";
import { setStoreImageAction } from "@/server/actions/admin";

/** Client wrapper so the upload callback is created on the client (functions can't be passed from server pages). */
export function StoreImageUploader({ storeId, kind, children }: { storeId: string; kind: "logo" | "cover"; children?: React.ReactNode }) {
  return <ImageUploader bucket="store-assets" folder={storeId} label={kind === "logo" ? "Upload Logo" : "Upload Cover"} actions={children}
                        onUploaded={(p) => setStoreImageAction(storeId, kind, p)} />;
}
