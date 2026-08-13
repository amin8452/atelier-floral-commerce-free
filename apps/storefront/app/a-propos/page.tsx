import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "À propos de l’atelier" };

export default function AboutPage() {
  return (
    <section className="section narrow editorial-page">
      <p className="eyebrow">À propos de l’atelier</p>
      <h1>Nous fabriquons les bijoux un par un.</h1>
      <p>Nous travaillons avec des fleurs naturelles que nous faisons sécher avant de les placer dans la résine. La composition, le coulage et les finitions sont réalisés à la main.</p>
      <p>Aucune fleur n’a exactement la même forme. Deux bijoux d’un même modèle peuvent donc présenter de petites différences. C’est normal, et nous préférons vous le préciser.</p>
      <p>Si vous souhaitez vérifier une couleur, une dimension ou la disponibilité d’un modèle, <Link href="/contact">écrivez-nous avant de commander</Link>.</p>
    </section>
  );
}
