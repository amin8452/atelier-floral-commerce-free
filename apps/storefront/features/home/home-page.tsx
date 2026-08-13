import Image from "next/image";
import Link from "next/link";
import signatureProductImage from "@/assets/collier-coeur-fleurs-aurelis.jpg";
import { CatalogError } from "@/components/catalog-error";
import { ProductCard } from "@/components/product-card";
import { buildStoreWhatsAppUrl } from "@/lib/whatsapp";
import type { HomePageData } from "@/services/home";

const craftSteps = [
  { number: "01", title: "Nous préparons les fleurs", description: "Nous les faisons sécher avant de les utiliser dans un bijou." },
  { number: "02", title: "Nous composons le motif", description: "Nous plaçons les pétales un à un dans le moule choisi." },
  { number: "03", title: "Nous terminons la pièce", description: "Nous coulons la résine, puis nous démoulons, contrôlons et polissons le bijou." },
] as const;

const personalizationMessage = "Bonjour, je souhaite imaginer un bijou floral personnalisé avec votre atelier.";

export function HomePage({ data }: { data: HomePageData }) {
  const { settings, featuredProducts, collections } = data;
  const whatsappUrl = buildStoreWhatsAppUrl(settings.whatsappNumber, personalizationMessage);

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="eyebrow">Des fleurs séchées · un travail manuel</p>
          <h1 id="home-title">De vraies fleurs, dans un bijou fait à la main.</h1>
          <p className="home-hero-lead">
            Nous séchons les fleurs, les plaçons une à une, puis les coulons dans la résine. Comme aucune fleur n’est identique, chaque bijou est légèrement différent.
          </p>
          <div className="home-hero-actions">
            <Link className="btn primary" href="/boutique">Voir les bijoux <ArrowIcon /></Link>
            <ContactLink className="btn secondary" whatsappUrl={whatsappUrl}>Parler de votre idée</ContactLink>
          </div>
          <dl className="home-hero-details">
            <div><dt>Petites quantités</dt><dd>Nous fabriquons peu de pièces à la fois.</dd></div>
            <div><dt>Une question ?</dt><dd>Écrivez-nous avant de commander.</dd></div>
          </dl>
        </div>

        <figure className="home-hero-visual">
          <div className="home-hero-image">
            <Image
              src={settings.heroImageUrl ?? signatureProductImage}
              alt="Collier cœur en résine orné de fleurs naturelles, présenté dans son écrin"
              fill
              priority
              placeholder={settings.heroImageUrl ? "empty" : "blur"}
              sizes="(max-width: 860px) calc(100vw - 32px), 52vw"
            />
          </div>
          <figcaption>
            <span><i aria-hidden="true" /> Un exemple de pièce</span>
            <strong>Collier cœur en résine</strong>
            <small>Fleurs séchées · chaîne dorée</small>
          </figcaption>
        </figure>
      </section>

      <StoreFacts settings={settings} />

      <section className="section home-featured" aria-labelledby="featured-title">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">En ce moment</p>
            <h2 id="featured-title">Les bijoux disponibles</h2>
          </div>
          <p>Des pièces réalisées à la main, disponibles en petites quantités. Chaque modèle conserve les nuances naturelles des fleurs qui le composent.</p>
          <Link className="home-text-link" href="/boutique">Voir toute la boutique <ArrowIcon /></Link>
        </div>

        {featuredProducts === null
          ? <CatalogError />
          : featuredProducts.length > 0
            ? <div className="product-grid home-product-grid">{featuredProducts.map((product) => <ProductCard key={product.id} product={product} currency={settings.defaultCurrency} locale={settings.defaultLocale} />)}</div>
            : <div className="state-panel home-empty-state"><h3>La boutique est en cours de mise à jour.</h3><p>Écrivez-nous pour connaître les bijoux disponibles à l’atelier.</p><ContactLink className="btn secondary" whatsappUrl={whatsappUrl}>Nous écrire</ContactLink></div>}
      </section>

      {collections.length > 0 && (
        <section className="home-collections" aria-labelledby="collections-title">
          <div className="section">
            <div className="home-section-heading compact">
              <div><p className="eyebrow">Pour choisir</p><h2 id="collections-title">Parcourir les collections</h2></div>
              <Link className="home-text-link" href="/collections">Toutes les collections <ArrowIcon /></Link>
            </div>
            <div className="home-collection-grid">
              {collections.slice(0, 3).map((collection, index) => (
                <Link key={collection.id} href={`/boutique?collection=${collection.slug}`}>
                  <span className="home-collection-index">0{index + 1}</span>
                  <div>
                    <h3>{collection.name}</h3>
                    {collection.description && <p>{collection.description}</p>}
                  </div>
                  <span className="home-collection-meta">{collection._count.products} création{collection._count.products > 1 ? "s" : ""} <ArrowIcon /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="home-craft" aria-labelledby="craft-title">
        <div className="home-craft-copy">
          <p className="eyebrow">Dans l’atelier</p>
          <h2 id="craft-title">Nous fabriquons chaque pièce en trois étapes.</h2>
          <p>Nous travaillons à partir de vraies fleurs. Leur taille, leur forme et leur couleur influencent directement le résultat.</p>
          <Link className="home-text-link light" href="/a-propos">Découvrir l’atelier <ArrowIcon /></Link>
        </div>
        <ol className="home-craft-steps">
          {craftSteps.map((step) => <li key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}
        </ol>
      </section>

      <section className="home-personalization" aria-labelledby="personalization-title">
        <div>
          <p className="eyebrow">Une demande particulière</p>
          <h2 id="personalization-title">Vous avez une idée en tête ?</h2>
          <p>Dites-nous quel bijou, quelles couleurs ou quelles fleurs vous aimeriez. Nous vous répondrons simplement avec ce qu’il est possible de réaliser.</p>
        </div>
        <ContactLink className="btn primary" whatsappUrl={whatsappUrl}>Expliquer mon projet <ArrowIcon /></ContactLink>
      </section>
    </div>
  );
}

function StoreFacts({ settings }: { settings: HomePageData["settings"] }) {
  const deliveryLabel = settings.shippingEnabled ? "Livraison disponible" : "Retrait sur rendez-vous";
  const paymentLabel = settings.codEnabled ? "Paiement à la livraison" : settings.onlinePaymentEnabled ? "Paiement en ligne" : "Commande accompagnée";

  return (
    <dl className="home-facts" aria-label="Informations sur les produits et les commandes">
      <div><dt>Dans les bijoux</dt><dd>Fleurs séchées et résine</dd></div>
      <div><dt>À l’atelier</dt><dd>Composition réalisée à la main</dd></div>
      <div><dt>Pour vous livrer</dt><dd>{deliveryLabel}</dd></div>
      <div><dt>Pour régler</dt><dd>{paymentLabel}</dd></div>
    </dl>
  );
}

function ContactLink({ children, className, whatsappUrl }: { children: React.ReactNode; className: string; whatsappUrl: string | null }) {
  return whatsappUrl
    ? <a className={className} href={whatsappUrl} target="_blank" rel="noreferrer">{children}</a>
    : <Link className={className} href="/contact">{children}</Link>;
}

function ArrowIcon() {
  return <svg className="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4" /></svg>;
}
