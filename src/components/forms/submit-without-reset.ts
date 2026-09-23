"use client";

import { startTransition, type FormEvent } from "react";

/**
 * `<form action={fn}>` makes React 19 reset every uncontrolled field once the action
 * returns, which wipes what people typed when the server answers with a validation error.
 * Dispatching from onSubmit keeps their input; forms that should clear on success reset
 * themselves explicitly.
 */
export function submitWithoutReset(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
}
