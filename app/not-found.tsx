import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-card not-found">
      <h1>Page not found</h1>
      <p>That page is not on the board.</p>
      <Link href="/games" className="back-link">
        Back to NFL odds
      </Link>
    </div>
  );
}
