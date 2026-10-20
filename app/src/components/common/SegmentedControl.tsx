import styles from "./SegmentedControl.module.css";

type SegmentedControlProps<T extends string> = {
  /** Names the group for screen readers; the options carry the visible text. */
  label: string;
  /** Groups the radios, so it must be unique on the page. */
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** Radio buttons drawn as one bar of buttons, for choosing between two or three views. */
export function SegmentedControl<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className={styles.group} aria-label={label} disabled={disabled}>
      {options.map((option) => (
        <label key={option.value} className={styles.segment}>
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
