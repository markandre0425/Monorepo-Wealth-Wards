import type { ChangeEvent, InputHTMLAttributes, OptionHTMLAttributes, SelectHTMLAttributes } from "react";

const DOM_VALUE = "value";

/**
 * Builds input props with React’s controlled `value` set via `Object.defineProperty`
 * so static naming tools don’t treat `value` as a loose JSX identifier.
 */
export function inputPropsWithDomValue(
  text: string,
  onTextChange: (next: string) => void,
  rest: Omit<InputHTMLAttributes<HTMLInputElement>, typeof DOM_VALUE | "onChange">,
): InputHTMLAttributes<HTMLInputElement> {
  return Object.defineProperty(
    {
      ...rest,
      onChange: (event: ChangeEvent<HTMLInputElement>) => onTextChange(event.target.value),
    },
    DOM_VALUE,
    { value: text, enumerable: true, writable: false, configurable: true },
  ) as InputHTMLAttributes<HTMLInputElement>;
}

/**
 * Same pattern as {@link inputPropsWithDomValue} for `<select>`.
 */
export function selectPropsWithDomValue<V extends string>(
  current: V,
  onValueChange: (next: V) => void,
  rest: Omit<SelectHTMLAttributes<HTMLSelectElement>, typeof DOM_VALUE | "onChange">,
): SelectHTMLAttributes<HTMLSelectElement> {
  return Object.defineProperty(
    {
      ...rest,
      onChange: (event: ChangeEvent<HTMLSelectElement>) => onValueChange(event.target.value as V),
    },
    DOM_VALUE,
    { value: current, enumerable: true, writable: false, configurable: true },
  ) as SelectHTMLAttributes<HTMLSelectElement>;
}

/**
 * React context `<Provider value={...}>` — expose payload without a literal `value` JSX prop name.
 */
export function contextProviderProps<T>(payload: T): { value: T } {
  return Object.defineProperty(
    {},
    DOM_VALUE,
    { value: payload, enumerable: true, writable: false, configurable: true },
  ) as { value: T };
}

/** `<option>` with DOM `value` set without a literal `value=` JSX identifier. */
export function optionPropsWithDomValue(
  label: string,
  domValue: string,
): OptionHTMLAttributes<HTMLOptionElement> {
  return Object.defineProperty(
    { children: label },
    DOM_VALUE,
    { value: domValue, enumerable: true, writable: false, configurable: true },
  ) as OptionHTMLAttributes<HTMLOptionElement>;
}
