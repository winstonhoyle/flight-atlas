import { useEffect, useRef } from "react";
import Select, {
  components,
  createFilter,
  type ClearIndicatorProps,
  type DropdownIndicatorProps,
  type GroupBase,
  type SelectInstance,
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
  isDisabled?: boolean;
  size?: "sm" | "md";
  getOptionLabel?: (option: T) => string;
  getOptionValue?: (option: T) => string;
  getOptionSearch?: (option: T) => string;
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
  isDisabled = false,
  size = "md",
  getOptionLabel,
  getOptionValue,
  getOptionSearch,
}: ComboboxProps<T>) {
  const selectRef = useRef<SelectInstance<T, false>>(null);

  // On touch, the first tap opens the list without the keyboard; tapping the text again opens it.
  useEffect(() => {
    const control = selectRef.current?.controlRef;
    if (!control) return;
    const onPointerDown = (event: PointerEvent) => {
      const select = selectRef.current;
      const input = select?.inputRef;
      if (!select || !input) return;
      if (event.pointerType !== "touch") {
        input.removeAttribute("inputmode");
        return;
      }
      const search =
        select.props.menuIsOpen &&
        (event.target as Element).closest(`.${styles.valueContainer}`) !== null;
      input.inputMode = search ? "search" : "none";
      // react-select refocuses on touchend, and a fresh focus is what opens the keyboard.
      if (search) input.blur();
    };
    control.addEventListener("pointerdown", onPointerDown);
    return () => control.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <Select<T, false>
      ref={selectRef}
      aria-label={label}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isClearable={isClearable}
      isDisabled={isDisabled}
      // The panel scrolls, which would clip a menu rendered inside it.
      menuPortalTarget={document.body}
      menuPosition="fixed"
      // react-select sets the portal's z-index inline, so a class can't override it.
      styles={{ menuPortal: (base) => ({ ...base, zIndex: "var(--fa-z-menu)" }) }}
      getOptionLabel={getOptionLabel}
      getOptionValue={getOptionValue}
      filterOption={
        getOptionSearch && createFilter({ stringify: (option) => getOptionSearch(option.data) })
      }
      unstyled
      components={{ DropdownIndicator, ClearIndicator, IndicatorSeparator: null }}
      classNames={{
        container: () => [styles.container, styles[size]].join(" "),
        control: (state) =>
          [
            styles.control,
            state.isFocused && styles.controlFocused,
            state.isDisabled && styles.controlDisabled,
          ]
            .filter(Boolean)
            .join(" "),
        valueContainer: () => styles.valueContainer,
        placeholder: () => styles.placeholder,
        indicatorsContainer: () => styles.indicators,
        dropdownIndicator: () => styles.indicator,
        clearIndicator: () => styles.indicator,
        menuPortal: () => [styles.container, styles[size]].join(" "),
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
