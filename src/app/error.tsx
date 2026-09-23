"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/misc";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4 py-16">
      <ErrorState
        title="We fumbled that rally"
        description={error.digest ? `Something went wrong on our side (ref ${error.digest}). Please try again.` : "Something went wrong. Please try again."}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </main>
  );
}
