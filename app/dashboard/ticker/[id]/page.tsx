"use client";

import { useParams } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { TickerDetailContent } from "@/components/dashboard/TickerDetailContent";

export default function TickerDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      <AppNav />
      <div className="px-4 py-6 md:px-6 md:py-8 lg:px-8 max-w-6xl mx-auto">
        <TickerDetailContent tickerOrCode={id} />
      </div>
    </main>
  );
}
