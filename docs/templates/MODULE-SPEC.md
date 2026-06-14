# Module Spec — MXX: <name>

> Use when adding or substantially changing a module. Keep it in sync with
> `docs/05-MODULE-PLANNING.md`.

## Responsibility
<Single sentence: the one thing this module is responsible for.>

## Owns (tables)
- `<Table>` — <why it belongs here>

## Public interface
```ts
// the narrow surface other modules may call
function doThing(input: Input): Output
```
- <route / service method / package export> — <contract>

## Depends on
- `MXX <name>` — <what it uses>

## Events
- Emits: `<event.name>` — <when / payload>
- Consumes: `<event.name>` — <reaction>

## Location
`packages/<…>` and/or `apps/api/<module>`

## Data ownership rule
Only this module writes its tables. Others read via the interface/events above.

## Test focus
- Unit: <…>
- Integration: <…>
- Isolation / idempotency / contract: <if applicable>

## Open questions / risks
- <…>
