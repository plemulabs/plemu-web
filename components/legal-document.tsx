import Link from "next/link";
import documents from "../lib/legal-documents.json";
import styles from "./legal-document.module.css";

export type LegalDocumentKind = "terms" | "privacy";

function LinkedText({ text }: { text: string }) {
  return text
    .split(/(https:\/\/plemu\.xyz\/(?:toc|privacy)|support@plemu\.xyz)/g)
    .map((part, index) => {
      if (part === documents.contact) {
        return (
          <a href={`mailto:${documents.contact}`} key={index}>
            {part}
          </a>
        );
      }
      if (part.startsWith("https://plemu.xyz/")) {
        return (
          <Link href={part.replace("https://plemu.xyz", "")} key={index}>
            {part}
          </Link>
        );
      }
      return part;
    });
}

export function LegalDocument({ kind }: { kind: LegalDocumentKind }) {
  const document = documents[kind];
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.documents} aria-label="Legal documents">
          <Link
            href="/toc"
            aria-current={kind === "terms" ? "page" : undefined}
          >
            Terms of service
          </Link>
          <Link
            href="/privacy"
            aria-current={kind === "privacy" ? "page" : undefined}
          >
            Privacy policy
          </Link>
        </nav>
        <h1>{document.title}</h1>
        <p className={styles.summary}>{document.summary}</p>
        <p className={styles.version}>
          {documents.publisher} · Prepared {documents.prepared} · Version{" "}
          {documents.version}
        </p>
        <p className={styles.status}>{documents.status}</p>
      </header>
      <div className={styles.layout}>
        <nav className={styles.contents} aria-label="On this page">
          <h2>On this page</h2>
          <ul>
            {document.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ul>
        </nav>
        <article className={styles.article} aria-label={document.title}>
          {document.sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id}>{section.title}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>
                  <LinkedText text={paragraph} />
                </p>
              ))}
            </section>
          ))}
          <div className={styles.contact}>
            <p>
              Questions or requests?{" "}
              <a href={`mailto:${documents.contact}`}>{documents.contact}</a>
            </p>
            <a href="#main">Back to top</a>
            <a href="/licenses/wallet-adapter-notice.txt">
              Third-party software notices
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}
