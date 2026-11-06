import styles from "./Checkbox.module.css";

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export const Checkbox = ({ label, checked, onChange, disabled = false }: CheckboxProps) => (
  <label className={styles.check}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    {label}
  </label>
);
