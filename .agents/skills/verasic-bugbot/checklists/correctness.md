# Correctness Checklist

- **Logic inversion**: negated conditions, swapped branches, off-by-one in loops/slices/pagination
- **Null/undefined**: new code paths that can receive null where old code couldn't; optional chaining that silently skips required logic
- **Contract breaks**: changed function signature/return shape — did ALL callers get updated? Grep to verify
- **Error handling**: caught-and-swallowed errors, `catch` that logs but continues into invalid state, missing `await` (floating promises)
- **State mutation**: shared object mutated where a copy was expected; stale closure over changed variable
- **Concurrency**: check-then-act races, non-atomic read-modify-write, missing locks/transactions on shared state
- **Boundary values**: empty array, empty string, zero, negative numbers, max lengths, unicode
- **Type coercion**: loose equality, implicit string/number conversion, truthiness check on `0`/`""`
- **Async ordering**: assumed resolution order of parallel promises; cleanup that runs before async work finishes
- **Migration/schema**: code deployed before/after migration — is there a window where both must work?
