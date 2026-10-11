"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/ui/confirm-action";

export function DeleteCommunityButton({ communityId, name }: { communityId: string; name: string }) {
  const router = useRouter();

  async function remove() {
    const res = await fetch(`/api/community/${communityId}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) router.push("/app/community");
  }

  return (
    <ConfirmAction
      message={`Delete "${name}" and all of its posts? This cannot be undone.`}
      ariaLabel={`Delete community ${name}`}
      onConfirm={remove}
      triggerClassName="btn-secondary text-red-600"
      trigger={
        <>
          <Trash2 className="h-4 w-4" />
          <span>Delete community</span>
        </>
      }
    />
  );
}