# Performance Checklist

Only flag when impact is real and reachable — not micro-optimizations.

- **N+1 queries**: DB/API call inside a loop over unbounded data
- **Unbounded growth**: cache/map/array that grows forever; event listeners added but never removed
- **Blocking the hot path**: sync I/O or heavy compute in request handlers / render loops / UI thread
- **Missing pagination**: fetching entire tables/collections where the diff introduces unbounded input
- **Accidental fan-out**: `Promise.all` over unbounded arrays hammering an API without concurrency limit
- **React-specific** (if applicable): new object/array/function identity in deps causing infinite effect loops; heavy work in render without memo
