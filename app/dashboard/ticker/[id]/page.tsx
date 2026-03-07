"use client";

import { useParams } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { TickerDetailContent } from "@/components/dashboard/TickerDetailContent";

export default function TickerDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  return (
    <main className="min-h-screen bg-background">
      <AppNav />
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto bg-background">
        <TickerDetailContent tickerOrCode={id} />
      </div>
    </main>
  );
}
