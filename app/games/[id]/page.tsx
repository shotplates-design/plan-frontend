"use client";

import { useParams } from "next/navigation";
import { GameDetail } from "@/components/game-detail";

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  return <GameDetail id={id} />;
}
