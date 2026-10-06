import Link from "next/link";

export default function PromotionsPage() {
  return (
    <div className="page-card promo-card">
      <h1>Play money, real hit rates</h1>
      <p>
        Plan is an NFL board with the look of FanDuel or DraftKings. The difference is the hit-rate chip on every
        player prop: season, last 5, and versus this opponent, including last season when the books have a line.
      </p>
      <p>Every balance is play currency. There is nothing to deposit and nothing to withdraw.</p>
      <p>New accounts get 10 free prop unlocks. After that, 30 tries are $3 and 100 tries are $5.</p>
      <Link href="/games" className="back-link">
        Back to NFL odds
      </Link>
    </div>
  );
}
