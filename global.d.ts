/**
 * A generic type alias for any value.
 *
 * @remarks
 * Use this when the type is unknown or dynamic and strict typing isn't possible or necessary.
 * Prefer using more specific types when feasible.
 *
 * @example
 * let data: AnyValue;
 * data = 42;
 * data = "hello";
 * data = { key: "value" };
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValue = any;
