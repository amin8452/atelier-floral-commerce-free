import Link from "next/link";

export default function NotFound() {
  return <section className="section narrow"><div className="state-panel"><p className="eyebrow">Erreur 404</p><h1>Cette page n’existe pas.</h1><p>La création recherchée a peut-être été retirée ou son adresse a changé.</p><Link className="btn primary" href="/boutique">Retour à la boutique</Link></div></section>;
}
