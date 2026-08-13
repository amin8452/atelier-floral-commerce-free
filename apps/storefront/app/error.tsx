"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="section narrow"><div className="state-panel error-state" role="alert"><h1>Une erreur est survenue.</h1><p>La page n’a pas pu être chargée correctement.</p><button className="btn primary" type="button" onClick={reset}>Réessayer</button></div></section>;
}
