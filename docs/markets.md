# Game token markets

The directory at `/market` lists the five reviewed Devnet markets. Opening it
reads fresh, verified snapshots with at most two market reads in flight. Refresh
quotes repeats that bounded read. Each row identifies its quote read time and
confirmed slot; unavailable providers produce an unavailable value. Quotes are
indicative display values, never authorization for a trade.

Each market has a dedicated route, such as `/market/gba-goodboy-galaxy` or
`/market/gba-apotris`. Unknown slugs return a not-found page. Library cards and
game pages link to their corresponding market. The workspace includes the game,
token mint, verified protocol state, curve allocation, trade preview, creator
fees, advanced tools and Explorer links.

The indicative spot display uses the pool reserve ratio or the derivative of the
protocol bonding curve, before fees and price impact. Decimal formatting stays
in BigInt. Buy/sell previews use the existing exact quote and plan functions,
including protocol fees and the selected slippage limit. Wallet changes discard
old balances and previews, cancel pending reads and require fresh state. Signed
transaction execution and recovery remain in their existing guarded boundary.

## Chart and history

The chart and activity table read a bounded window of at most 12 confirmed
transaction signatures. Events are accepted only after the existing program,
market, transaction and invocation-stack validation. This is partial history and
can include seeded Devnet activity; it is not a complete exchange price feed.

Each line point is an executed average fill price: lamport principal divided by
six-decimal token units, converted to SOL per whole token. Fees are excluded from
that price and displayed separately in the table. Event timestamps come from the
authenticated protocol event, not the browser's current clock. The table and
point readout retain the UTC date as well as time.

Sampled-fill candles aggregate the fetched fills into 1-minute, 5-minute or
1-hour buckets. Empty intervals are omitted. Their widths use the actual bucket
time domain, including sparse gaps. Open/close follow the sample ordering;
execution order between different transactions in the same slot is unresolved.
No missing candles, prices, volume or 24-hour changes are fabricated. The chart
shows at most the latest 256 fetched fills; the paginated table retains the
available window. Pointer and keyboard inspection show actual fill values.

Protocol events, including fee claims, stage changes, liquidity activation and
buybacks, remain available in their own activity view. Refreshing and navigation
cancel superseded reads, and errors provide an explicit retry action.
