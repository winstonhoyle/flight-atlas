import Select, {
  components,
  type ClearIndicatorProps,
  type DropdownIndicatorProps,
  type GroupBase,
} from "react-select";
import { CloseIcon, ExpandMoreIcon } from "@/icons";
import styles from "./Combobox.module.css";

type ComboboxProps<T> = {
  label: string;
  options: T[];
  value: T | null;
  onChange: (option: T | null) => void;
  placeholder?: string;
  isClearable?: boolean;
  size?: "sm" | "md";
  getOptionLabel?: (option: T) => string;
  getOptionValue?: (option: T) => string;
};

function DropdownIndicator<T>(props: DropdownIndicatorProps<T, false, GroupBase<T>>) {
  return (
    <components.DropdownIndicator {...props}>
      <ExpandMoreIcon />
    </components.DropdownIndicator>
  );
}

function ClearIndicator<T>(props: ClearIndicatorProps<T, false, GroupBase<T>>) {
  return (
    <components.ClearIndicator {...props}>
      <CloseIcon />
    </components.ClearIndicator>
  );
}

export function Combobox<T>({
  label,
  options,
  value,
  onChange,
  placeholder,
  isClearable = false,
  size = "md",
  getOptionLabel,
  getOptionValue,
}: ComboboxProps<T>) {
  return (
    <Select<T, false>
      aria-label={label}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isClearable={isClearable}
      getOptionLabel={getOptionLabel}
      getOptionValue={getOptionValue}
      unstyled
      components={{ DropdownIndicator, ClearIndicator, IndicatorSeparator: null }}
      classNames={{
        container: () => [styles.container, styles[size]].join(" "),
        control: (state) =>
          [styles.control, state.isFocused && styles.controlFocused].filter(Boolean).join(" "),
        valueContainer: () => styles.valueContainer,
        placeholder: () => styles.placeholder,
        indicatorsContainer: () => styles.indicators,
        dropdownIndicator: () => styles.indicator,
        clearIndicator: () => styles.indicator,
        menu: () => styles.menu,
        menuList: () => styles.menuList,
        option: (state) =>
          [
            styles.option,
            state.isFocused && styles.optionFocused,
            state.isSelected && styles.optionSelected,
          ]
            .filter(Boolean)
            .join(" "),
        noOptionsMessage: () => styles.empty,
      }}
    />
  );
}
